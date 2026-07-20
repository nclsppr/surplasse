package com.surplasse.catalog.repository;

import com.surplasse.catalog.entity.Menu;
import com.surplasse.catalog.entity.MenuStatus;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class MenuRepository implements PanacheRepositoryBase<Menu, UUID> {

    public Optional<Menu> findPublishedByEstablishment(UUID establishmentId) {
        return find("establishmentId = ?1 and status = ?2", establishmentId, MenuStatus.PUBLISHED)
                .firstResultOptional();
    }

    public boolean hasPublishedByEstablishment(UUID establishmentId) {
        return count("establishmentId = ?1 and status = ?2", establishmentId, MenuStatus.PUBLISHED) > 0;
    }
}
