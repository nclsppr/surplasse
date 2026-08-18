package com.surplasse.application.bootstrap;

import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.Properties;
import java.util.UUID;
import java.util.regex.Pattern;

final class PilotBootstrapDatabase implements PilotBootstrapExecutor.DatabaseOperations {

    private static final long ADVISORY_LOCK = 7_301_040_411L;
    private static final Pattern TABLE_CODE = Pattern.compile("^tbl_[0-9a-f]{32}$");

    private final ConnectionFactory connections;

    PilotBootstrapDatabase() {
        this((jdbcUrl, properties) -> java.sql.DriverManager.getConnection(jdbcUrl, properties));
    }

    PilotBootstrapDatabase(ConnectionFactory connections) {
        this.connections = connections;
    }

    @Override
    public ApplyResult apply(
            PilotBootstrapSettings settings,
            String databasePassword,
            PilotBootstrapManifest manifest,
            StripePilotAccountVerifier.Snapshot stripe,
            Instant now,
            SecureRandom random) {
        try (Connection connection = open(settings, databasePassword)) {
            connection.setTransactionIsolation(Connection.TRANSACTION_SERIALIZABLE);
            connection.setAutoCommit(false);
            try {
                acquireLock(connection);
                requireFlywayV14(connection);
                GraphState state = inspect(connection, manifest, stripe);
                if (state == GraphState.EXACT) {
                    connection.commit();
                    return ApplyResult.UNCHANGED;
                }
                Instant createdAt = now.truncatedTo(ChronoUnit.MICROS);
                insertGraph(connection, manifest, stripe, createdAt, random);
                if (inspect(connection, manifest, stripe) != GraphState.EXACT) {
                    throw PilotBootstrapException.drift("The pilot graph did not match after its transaction.");
                }
                connection.commit();
                return ApplyResult.CREATED;
            } catch (PilotBootstrapException exception) {
                rollback(connection);
                throw exception;
            } catch (SQLException exception) {
                rollback(connection);
                throw PilotBootstrapException.database();
            } catch (RuntimeException exception) {
                rollback(connection);
                throw PilotBootstrapException.database();
            }
        } catch (PilotBootstrapException exception) {
            throw exception;
        } catch (SQLException exception) {
            throw PilotBootstrapException.database();
        }
    }

    @Override
    public GraphState status(
            PilotBootstrapSettings settings,
            String databasePassword,
            PilotBootstrapManifest manifest,
            StripePilotAccountVerifier.Snapshot stripe) {
        try (Connection connection = open(settings, databasePassword)) {
            connection.setReadOnly(true);
            connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            connection.setAutoCommit(false);
            try {
                requireFlywayV14(connection);
                GraphState state = inspect(connection, manifest, stripe);
                connection.commit();
                return state;
            } catch (PilotBootstrapException exception) {
                rollback(connection);
                throw exception;
            } catch (SQLException exception) {
                rollback(connection);
                throw PilotBootstrapException.database();
            }
        } catch (PilotBootstrapException exception) {
            throw exception;
        } catch (SQLException exception) {
            throw PilotBootstrapException.database();
        }
    }

    private Connection open(PilotBootstrapSettings settings, String password) throws SQLException {
        Properties properties = new Properties();
        properties.setProperty("user", settings.databaseUsername());
        properties.setProperty("password", password);
        properties.setProperty("ApplicationName", "surplasse-pilot-bootstrap");
        properties.setProperty("connectTimeout", "5");
        properties.setProperty("currentSchema", "public");
        properties.setProperty("socketTimeout", "15");
        properties.setProperty("sslmode", "disable");
        properties.setProperty("tcpKeepAlive", "true");
        properties.setProperty(
                "options",
                "-c statement_timeout=10000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=15000");
        return connections.open(settings.jdbcUrl(), properties);
    }

    private static void acquireLock(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("select pg_advisory_xact_lock(?)")) {
            statement.setLong(1, ADVISORY_LOCK);
            statement.executeQuery();
        }
    }

    private static void requireFlywayV14(Connection connection) throws SQLException {
        try (PreparedStatement existence =
                        connection.prepareStatement("select to_regclass('public.flyway_schema_history') is not null");
                ResultSet result = existence.executeQuery()) {
            if (!result.next() || !result.getBoolean(1) || result.next()) {
                throw PilotBootstrapException.drift("The production schema is not exactly Flyway V14.");
            }
        }
        List<Integer> versions = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                        "select version, success from flyway_schema_history order by installed_rank");
                ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                String version = result.getString(1);
                if (version == null || !result.getBoolean(2)) {
                    throw PilotBootstrapException.drift("The production schema is not exactly Flyway V14.");
                }
                try {
                    versions.add(Integer.valueOf(version));
                } catch (NumberFormatException exception) {
                    throw PilotBootstrapException.drift("The production schema is not exactly Flyway V14.");
                }
            }
        }
        if (!versions.equals(
                java.util.stream.IntStream.rangeClosed(1, 14).boxed().toList())) {
            throw PilotBootstrapException.drift("The production schema is not exactly Flyway V14.");
        }
    }

    private static GraphState inspect(
            Connection connection, PilotBootstrapManifest manifest, StripePilotAccountVerifier.Snapshot stripe)
            throws SQLException {
        Cardinality cardinality = cardinality(connection);
        if (cardinality.isEmpty()) {
            return GraphState.EMPTY;
        }
        if (!cardinality.isExact()) {
            throw PilotBootstrapException.drift("The database contains a graph outside the single-pilot contract.");
        }

        Instant createdAt = verifyRestaurateur(connection, manifest.restaurateur());
        verifyEstablishment(connection, manifest, stripe, createdAt);
        verifyMenu(connection, manifest, createdAt);
        verifyCategory(connection, manifest, createdAt);
        verifyProduct(connection, manifest, createdAt);
        verifyTable(connection, manifest, createdAt);
        return GraphState.EXACT;
    }

    private static Cardinality cardinality(Connection connection) throws SQLException {
        String sql = """
                select
                    (select count(*) from restaurateur),
                    (select count(*) from establishment),
                    (select count(*) from menu),
                    (select count(*) from category),
                    (select count(*) from product),
                    (select count(*) from table_qr),
                    (select count(*) from option_group),
                    (select count(*) from option),
                    (select count(*) from magic_link_session)
                      + (select count(*) from restaurateur_session)
                      + (select count(*) from table_session)
                      + (select count(*) from "order")
                      + (select count(*) from order_line)
                      + (select count(*) from order_event)
                      + (select count(*) from payment)
                      + (select count(*) from stripe_webhook_event)
                      + (select count(*) from payment_request)
                      + (select count(*) from payment_refund)
                      + (select count(*) from refund_request)
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql);
                ResultSet result = statement.executeQuery()) {
            if (!result.next()) {
                throw PilotBootstrapException.database();
            }
            Cardinality cardinality = new Cardinality(
                    result.getLong(1),
                    result.getLong(2),
                    result.getLong(3),
                    result.getLong(4),
                    result.getLong(5),
                    result.getLong(6),
                    result.getLong(7),
                    result.getLong(8),
                    result.getLong(9));
            if (result.next()) {
                throw PilotBootstrapException.database();
            }
            return cardinality;
        }
    }

    private static Instant verifyRestaurateur(Connection connection, PilotBootstrapManifest.Restaurateur expected)
            throws SQLException {
        String sql = """
                select email, full_name, phone, last_login_at, created_at, updated_at
                from restaurateur
                where id = ?
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, expected.id());
            try (ResultSet result = statement.executeQuery()) {
                requireSingle(result);
                OffsetDateTime createdAt = result.getObject("created_at", OffsetDateTime.class);
                OffsetDateTime updatedAt = result.getObject("updated_at", OffsetDateTime.class);
                requireExact(
                        expected.email().equals(result.getString("email"))
                                && expected.fullName().equals(result.getString("full_name"))
                                && Objects.equals(expected.phone(), result.getString("phone"))
                                && result.getObject("last_login_at") == null
                                && sameInstant(createdAt, updatedAt),
                        "restaurateur");
                requireEnd(result);
                return createdAt.toInstant();
            }
        }
    }

    private static void verifyEstablishment(
            Connection connection,
            PilotBootstrapManifest manifest,
            StripePilotAccountVerifier.Snapshot stripe,
            Instant createdAt)
            throws SQLException {
        String sql = """
                select restaurateur_id, name, slug, address, status,
                       stripe_account_id, stripe_card_payments_active,
                       stripe_payouts_active, stripe_capabilities_updated_at,
                       activated_at, order_intake_status, order_intake_updated_at,
                       created_at, updated_at
                from establishment
                where id = ?
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, manifest.establishment().id());
            try (ResultSet result = statement.executeQuery()) {
                requireSingle(result);
                PilotBootstrapManifest.Establishment expected = manifest.establishment();
                requireExact(
                        manifest.restaurateur().id().equals(result.getObject("restaurateur_id", UUID.class))
                                && expected.name().equals(result.getString("name"))
                                && expected.slug().equals(result.getString("slug"))
                                && expected.address().equals(result.getString("address"))
                                && "active".equals(result.getString("status"))
                                && stripe.accountId().equals(result.getString("stripe_account_id"))
                                && result.getBoolean("stripe_card_payments_active")
                                && stripe.payoutsActive() == result.getBoolean("stripe_payouts_active")
                                && sameInstant(createdAt, result, "stripe_capabilities_updated_at")
                                && sameInstant(createdAt, result, "activated_at")
                                && "paused".equals(result.getString("order_intake_status"))
                                && sameInstant(createdAt, result, "order_intake_updated_at")
                                && sameInstant(createdAt, result, "created_at")
                                && sameInstant(createdAt, result, "updated_at"),
                        "establishment");
                requireEnd(result);
            }
        }
    }

    private static void verifyMenu(Connection connection, PilotBootstrapManifest manifest, Instant createdAt)
            throws SQLException {
        String sql = """
                select establishment_id, name, status, created_at, updated_at
                from menu
                where id = ?
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, manifest.menu().id());
            try (ResultSet result = statement.executeQuery()) {
                requireSingle(result);
                requireExact(
                        manifest.establishment().id().equals(result.getObject("establishment_id", UUID.class))
                                && manifest.menu().name().equals(result.getString("name"))
                                && "published".equals(result.getString("status"))
                                && sameInstant(createdAt, result, "created_at")
                                && sameInstant(createdAt, result, "updated_at"),
                        "menu");
                requireEnd(result);
            }
        }
    }

    private static void verifyCategory(Connection connection, PilotBootstrapManifest manifest, Instant createdAt)
            throws SQLException {
        String sql = """
                select menu_id, name, position, created_at, updated_at
                from category
                where id = ?
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, manifest.category().id());
            try (ResultSet result = statement.executeQuery()) {
                requireSingle(result);
                requireExact(
                        manifest.menu().id().equals(result.getObject("menu_id", UUID.class))
                                && manifest.category().name().equals(result.getString("name"))
                                && result.getInt("position") == 1
                                && sameInstant(createdAt, result, "created_at")
                                && sameInstant(createdAt, result, "updated_at"),
                        "category");
                requireEnd(result);
            }
        }
    }

    private static void verifyProduct(Connection connection, PilotBootstrapManifest manifest, Instant createdAt)
            throws SQLException {
        String sql = """
                select category_id, name, description, price_cents, available,
                       position, deleted_at, created_at, updated_at
                from product
                where id = ?
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, manifest.product().id());
            try (ResultSet result = statement.executeQuery()) {
                requireSingle(result);
                PilotBootstrapManifest.Product expected = manifest.product();
                requireExact(
                        manifest.category().id().equals(result.getObject("category_id", UUID.class))
                                && expected.name().equals(result.getString("name"))
                                && Objects.equals(expected.description(), result.getString("description"))
                                && expected.priceCents() == result.getInt("price_cents")
                                && result.getBoolean("available")
                                && result.getInt("position") == 1
                                && result.getObject("deleted_at") == null
                                && sameInstant(createdAt, result, "created_at")
                                && sameInstant(createdAt, result, "updated_at"),
                        "product");
                requireEnd(result);
            }
        }
    }

    private static void verifyTable(Connection connection, PilotBootstrapManifest manifest, Instant createdAt)
            throws SQLException {
        String sql = """
                select establishment_id, label, code, active, created_at, updated_at
                from table_qr
                where id = ?
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, manifest.table().id());
            try (ResultSet result = statement.executeQuery()) {
                requireSingle(result);
                requireExact(
                        manifest.establishment().id().equals(result.getObject("establishment_id", UUID.class))
                                && manifest.table().label().equals(result.getString("label"))
                                && TABLE_CODE.matcher(result.getString("code")).matches()
                                && result.getBoolean("active")
                                && sameInstant(createdAt, result, "created_at")
                                && sameInstant(createdAt, result, "updated_at"),
                        "table");
                requireEnd(result);
            }
        }
    }

    private static void insertGraph(
            Connection connection,
            PilotBootstrapManifest manifest,
            StripePilotAccountVerifier.Snapshot stripe,
            Instant createdAt,
            SecureRandom random)
            throws SQLException {
        OffsetDateTime timestamp = OffsetDateTime.ofInstant(createdAt, ZoneOffset.UTC);
        insertRestaurateur(connection, manifest.restaurateur(), timestamp);
        insertEstablishment(connection, manifest, stripe, timestamp);
        insertMenu(connection, manifest, timestamp);
        insertCategory(connection, manifest, timestamp);
        insertProduct(connection, manifest, timestamp);
        insertTable(connection, manifest, timestamp, randomTableCode(random));
    }

    private static void insertRestaurateur(
            Connection connection, PilotBootstrapManifest.Restaurateur value, OffsetDateTime timestamp)
            throws SQLException {
        String sql = """
                insert into restaurateur
                    (id, email, full_name, phone, last_login_at, created_at, updated_at)
                values (?, ?, ?, ?, null, ?, ?)
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, value.id());
            statement.setString(2, value.email());
            statement.setString(3, value.fullName());
            if (value.phone() == null) {
                statement.setNull(4, Types.VARCHAR);
            } else {
                statement.setString(4, value.phone());
            }
            statement.setObject(5, timestamp);
            statement.setObject(6, timestamp);
            requireOneInsert(statement);
        }
    }

    private static void insertEstablishment(
            Connection connection,
            PilotBootstrapManifest manifest,
            StripePilotAccountVerifier.Snapshot stripe,
            OffsetDateTime timestamp)
            throws SQLException {
        String sql = """
                insert into establishment
                    (id, restaurateur_id, name, slug, address, status,
                     stripe_account_id, stripe_card_payments_active, stripe_payouts_active,
                     stripe_capabilities_updated_at, activated_at,
                     order_intake_status, order_intake_updated_at, created_at, updated_at)
                values (?, ?, ?, ?, ?, 'active', ?, true, ?, ?, ?, 'paused', ?, ?, ?)
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, manifest.establishment().id());
            statement.setObject(2, manifest.restaurateur().id());
            statement.setString(3, manifest.establishment().name());
            statement.setString(4, manifest.establishment().slug());
            statement.setString(5, manifest.establishment().address());
            statement.setString(6, stripe.accountId());
            statement.setBoolean(7, stripe.payoutsActive());
            statement.setObject(8, timestamp);
            statement.setObject(9, timestamp);
            statement.setObject(10, timestamp);
            statement.setObject(11, timestamp);
            statement.setObject(12, timestamp);
            requireOneInsert(statement);
        }
    }

    private static void insertMenu(Connection connection, PilotBootstrapManifest manifest, OffsetDateTime timestamp)
            throws SQLException {
        String sql = """
                insert into menu (id, establishment_id, name, status, created_at, updated_at)
                values (?, ?, ?, 'published', ?, ?)
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, manifest.menu().id());
            statement.setObject(2, manifest.establishment().id());
            statement.setString(3, manifest.menu().name());
            statement.setObject(4, timestamp);
            statement.setObject(5, timestamp);
            requireOneInsert(statement);
        }
    }

    private static void insertCategory(Connection connection, PilotBootstrapManifest manifest, OffsetDateTime timestamp)
            throws SQLException {
        String sql = """
                insert into category (id, menu_id, name, position, created_at, updated_at)
                values (?, ?, ?, 1, ?, ?)
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, manifest.category().id());
            statement.setObject(2, manifest.menu().id());
            statement.setString(3, manifest.category().name());
            statement.setObject(4, timestamp);
            statement.setObject(5, timestamp);
            requireOneInsert(statement);
        }
    }

    private static void insertProduct(Connection connection, PilotBootstrapManifest manifest, OffsetDateTime timestamp)
            throws SQLException {
        String sql = """
                insert into product
                    (id, category_id, name, description, price_cents, available,
                     position, deleted_at, created_at, updated_at)
                values (?, ?, ?, ?, ?, true, 1, null, ?, ?)
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, manifest.product().id());
            statement.setObject(2, manifest.category().id());
            statement.setString(3, manifest.product().name());
            if (manifest.product().description() == null) {
                statement.setNull(4, Types.VARCHAR);
            } else {
                statement.setString(4, manifest.product().description());
            }
            statement.setInt(5, manifest.product().priceCents());
            statement.setObject(6, timestamp);
            statement.setObject(7, timestamp);
            requireOneInsert(statement);
        }
    }

    private static void insertTable(
            Connection connection, PilotBootstrapManifest manifest, OffsetDateTime timestamp, String tableCode)
            throws SQLException {
        String sql = """
                insert into table_qr
                    (id, establishment_id, label, code, active, created_at, updated_at)
                values (?, ?, ?, ?, true, ?, ?)
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, manifest.table().id());
            statement.setObject(2, manifest.establishment().id());
            statement.setString(3, manifest.table().label());
            statement.setString(4, tableCode);
            statement.setObject(5, timestamp);
            statement.setObject(6, timestamp);
            requireOneInsert(statement);
        }
    }

    private static String randomTableCode(SecureRandom random) {
        byte[] entropy = new byte[16];
        random.nextBytes(entropy);
        return "tbl_" + HexFormat.of().formatHex(entropy);
    }

    private static boolean sameInstant(OffsetDateTime first, OffsetDateTime second) {
        return first != null && second != null && first.toInstant().equals(second.toInstant());
    }

    private static boolean sameInstant(Instant expected, ResultSet result, String column) throws SQLException {
        OffsetDateTime actual = result.getObject(column, OffsetDateTime.class);
        return actual != null && expected.equals(actual.toInstant());
    }

    private static void requireSingle(ResultSet result) throws SQLException {
        if (!result.next()) {
            throw PilotBootstrapException.drift("The persisted pilot graph differs from the manifest.");
        }
    }

    private static void requireEnd(ResultSet result) throws SQLException {
        if (result.next()) {
            throw PilotBootstrapException.drift("The persisted pilot graph differs from the manifest.");
        }
    }

    private static void requireExact(boolean condition, String entity) {
        if (!condition) {
            throw PilotBootstrapException.drift("The persisted pilot " + entity + " differs from the manifest.");
        }
    }

    private static void requireOneInsert(PreparedStatement statement) throws SQLException {
        if (statement.executeUpdate() != 1) {
            throw PilotBootstrapException.database();
        }
    }

    private static void rollback(Connection connection) {
        try {
            connection.rollback();
        } catch (SQLException ignored) {
            // The caller reports only the bounded database failure.
        }
    }

    enum ApplyResult {
        CREATED,
        UNCHANGED
    }

    enum GraphState {
        EMPTY,
        EXACT
    }

    @FunctionalInterface
    interface ConnectionFactory {
        Connection open(String jdbcUrl, Properties properties) throws SQLException;
    }

    private record Cardinality(
            long restaurateurs,
            long establishments,
            long menus,
            long categories,
            long products,
            long tables,
            long optionGroups,
            long options,
            long operationalRows) {

        boolean isEmpty() {
            return restaurateurs == 0
                    && establishments == 0
                    && menus == 0
                    && categories == 0
                    && products == 0
                    && tables == 0
                    && optionGroups == 0
                    && options == 0
                    && operationalRows == 0;
        }

        boolean isExact() {
            return restaurateurs == 1
                    && establishments == 1
                    && menus == 1
                    && categories == 1
                    && products == 1
                    && tables == 1
                    && optionGroups == 0
                    && options == 0
                    && operationalRows == 0;
        }
    }
}
