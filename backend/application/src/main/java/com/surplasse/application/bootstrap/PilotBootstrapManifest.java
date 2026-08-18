package com.surplasse.application.bootstrap;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

record PilotBootstrapManifest(
        String contract,
        int schema,
        String mode,
        Restaurateur restaurateur,
        Establishment establishment,
        Menu menu,
        Category category,
        Product product,
        TableQr table) {

    static final String CONTRACT = "surplasse.pilot-bootstrap";
    static final String MODE = "testers";
    static final String CURRENCY = "eur";
    static final int MAXIMUM_BYTES = 16 * 1024;

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]{1,128}@[^@\\s]{1,255}$");
    private static final Pattern PHONE = Pattern.compile("^\\+[1-9][0-9]{7,14}$");
    private static final Pattern SLUG = Pattern.compile("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$");
    private static final Pattern STRIPE_ACCOUNT = Pattern.compile("^acct_[A-Za-z0-9]{8,64}$");
    private static final Set<String> RESERVED_SLUGS = Set.of(
            "www",
            "api",
            "dashboard",
            "docs",
            "app",
            "admin",
            "local",
            "mail",
            "autoconfig",
            "autodiscover",
            "mta-sts",
            "smtp",
            "imap",
            "pop",
            "pop3",
            "webmail",
            "status",
            "reports",
            "grafana");
    private static final ObjectMapper MAPPER = new ObjectMapper(JsonFactory.builder()
                    .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                    .build())
            .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

    static PilotBootstrapManifest parse(byte[] raw) {
        if (raw.length == 0 || raw.length > MAXIMUM_BYTES) {
            throw PilotBootstrapException.configuration("The pilot manifest size is outside its bound.");
        }
        if (raw[raw.length - 1] != '\n') {
            throw PilotBootstrapException.configuration("The pilot manifest must end with one newline.");
        }
        for (byte value : raw) {
            if (value == 0 || value == '\r') {
                throw PilotBootstrapException.configuration("The pilot manifest framing is invalid.");
            }
        }
        final PilotBootstrapManifest manifest;
        try {
            manifest = MAPPER.readValue(raw, PilotBootstrapManifest.class);
        } catch (Exception ignored) {
            throw PilotBootstrapException.configuration("The pilot manifest is not strict valid JSON.");
        }
        manifest.validate();
        return manifest;
    }

    private void validate() {
        require(CONTRACT.equals(contract), "contract");
        require(schema == 1, "schema");
        require(MODE.equals(mode), "mode");
        require(restaurateur != null, "restaurateur");
        require(establishment != null, "establishment");
        require(menu != null, "menu");
        require(category != null, "category");
        require(product != null, "product");
        require(table != null, "table");

        requireUuid(restaurateur.id(), "restaurateur.id");
        requireUuid(establishment.id(), "establishment.id");
        requireUuid(menu.id(), "menu.id");
        requireUuid(category.id(), "category.id");
        requireUuid(product.id(), "product.id");
        requireUuid(table.id(), "table.id");
        require(
                new HashSet<>(List.of(
                                        restaurateur.id(),
                                        establishment.id(),
                                        menu.id(),
                                        category.id(),
                                        product.id(),
                                        table.id()))
                                .size()
                        == 6,
                "entity UUID uniqueness");

        requireText(restaurateur.email(), 3, 384, "restaurateur.email");
        require(EMAIL.matcher(restaurateur.email()).matches(), "restaurateur.email");
        require(
                restaurateur.email().equals(restaurateur.email().trim().toLowerCase(Locale.ROOT)),
                "restaurateur.email");
        requireText(restaurateur.fullName(), 1, 160, "restaurateur.full_name");
        if (restaurateur.phone() != null) {
            require(PHONE.matcher(restaurateur.phone()).matches(), "restaurateur.phone");
        }

        requireText(establishment.name(), 1, 160, "establishment.name");
        require(SLUG.matcher(establishment.slug()).matches(), "establishment.slug");
        require(!RESERVED_SLUGS.contains(establishment.slug()), "establishment.slug");
        requireText(establishment.address(), 1, 500, "establishment.address");
        require(STRIPE_ACCOUNT.matcher(establishment.stripeAccountId()).matches(), "establishment.stripe_account_id");
        requireText(menu.name(), 1, 160, "menu.name");
        requireText(category.name(), 1, 160, "category.name");
        requireText(product.name(), 1, 160, "product.name");
        if (product.description() != null) {
            requireText(product.description(), 1, 1000, "product.description");
        }
        require(product.priceCents() > 0 && product.priceCents() <= 1_000_000, "product.price_cents");
        require(CURRENCY.equals(product.currency()), "product.currency");
        requireText(table.label(), 1, 80, "table.label");
    }

    private static void requireUuid(UUID value, String field) {
        require(value != null && value.version() == 4 && value.variant() == 2, field);
    }

    private static void requireText(String value, int minimum, int maximum, String field) {
        require(value != null && value.length() >= minimum && value.length() <= maximum, field);
        require(value.equals(value.trim()) && value.chars().noneMatch(Character::isISOControl), field);
    }

    private static void require(boolean condition, String field) {
        if (!condition) {
            throw PilotBootstrapException.configuration("The pilot manifest field " + field + " is invalid.");
        }
    }

    record Restaurateur(UUID id, String email, String fullName, String phone) {}

    record Establishment(UUID id, String name, String slug, String address, String stripeAccountId) {}

    record Menu(UUID id, String name) {}

    record Category(UUID id, String name) {}

    record Product(UUID id, String name, String description, int priceCents, String currency) {}

    record TableQr(UUID id, String label) {}
}
