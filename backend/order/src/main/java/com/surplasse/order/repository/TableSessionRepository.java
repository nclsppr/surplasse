package com.surplasse.order.repository;

import com.surplasse.order.entity.TableSession;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class TableSessionRepository implements PanacheRepositoryBase<TableSession, UUID> {

    public Optional<TableSession> findByTokenHash(String tokenHash) {
        return find("tokenHash = ?1", tokenHash).firstResultOptional();
    }
}
