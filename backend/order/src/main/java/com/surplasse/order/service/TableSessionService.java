package com.surplasse.order.service;

import com.surplasse.common.catalog.CatalogGateway;
import com.surplasse.common.error.NotFoundException;
import com.surplasse.common.error.UnauthenticatedException;
import com.surplasse.order.entity.TableSession;
import com.surplasse.order.repository.TableSessionRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@ApplicationScoped
public class TableSessionService {

    /** Duration of a meal, sliding while the session is active (docs/architecture/securite.md). */
    static final Duration SESSION_DURATION = Duration.ofHours(2);

    private final TableSessionRepository repository;
    private final CatalogGateway catalogGateway;

    TableSessionService(TableSessionRepository repository, CatalogGateway catalogGateway) {
        this.repository = repository;
        this.catalogGateway = catalogGateway;
    }

    @Transactional
    public OpenedSession open(String establishmentSlug, String tableCode) {
        CatalogGateway.TableRef table = catalogGateway
                .findActiveTable(establishmentSlug, tableCode)
                .orElseThrow(() -> new NotFoundException("No active table matches this code."));
        String token = Tokens.newToken("ts_");
        OffsetDateTime expiresAt = now().plus(SESSION_DURATION);
        repository.persist(new TableSession(
                UUID.randomUUID(), table.establishmentId(), table.tableQrId(), Tokens.sha256Hex(token), expiresAt));
        return new OpenedSession(token, table.establishmentId(), table.tableLabel(), expiresAt);
    }

    /** Authenticates a token and slides the session expiry, as one active use. */
    @Transactional
    public ActiveSession authenticate(String token) {
        if (token == null || token.isBlank()) {
            throw UnauthenticatedException.tableSessionExpired();
        }
        TableSession session = repository
                .findByTokenHash(Tokens.sha256Hex(token))
                .orElseThrow(UnauthenticatedException::tableSessionExpired);
        OffsetDateTime now = now();
        if (session.getExpiresAt().isBefore(now)) {
            throw UnauthenticatedException.tableSessionExpired();
        }
        session.slideExpiryTo(now.plus(SESSION_DURATION));
        return new ActiveSession(session.getId(), session.getEstablishmentId(), session.getTableQrId());
    }

    private static OffsetDateTime now() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }

    public record OpenedSession(String token, UUID establishmentId, String tableLabel, OffsetDateTime expiresAt) {}

    public record ActiveSession(UUID sessionId, UUID establishmentId, UUID tableQrId) {}
}
