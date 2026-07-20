package com.surplasse.catalog.repository;

import com.surplasse.catalog.entity.TableQr;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class TableQrRepository implements PanacheRepositoryBase<TableQr, UUID> {

    public Optional<TableQr> findActiveByCode(UUID establishmentId, String code) {
        return find("establishmentId = ?1 and code = ?2 and active = true", establishmentId, code)
                .firstResultOptional();
    }

    public boolean hasActiveByEstablishment(UUID establishmentId) {
        return count("establishmentId = ?1 and active = true", establishmentId) > 0;
    }

    public List<TableQr> listByIds(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return list("id in ?1", ids);
    }
}
