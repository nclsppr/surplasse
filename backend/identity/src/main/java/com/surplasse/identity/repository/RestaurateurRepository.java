package com.surplasse.identity.repository;

import com.surplasse.identity.entity.Restaurateur;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class RestaurateurRepository implements PanacheRepositoryBase<Restaurateur, UUID> {

    public Optional<Restaurateur> findByEmailForUpdate(String normalizedEmail) {
        return find("email = ?1", normalizedEmail)
                .withLock(LockModeType.PESSIMISTIC_WRITE)
                .firstResultOptional();
    }
}
