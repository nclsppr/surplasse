package com.surplasse.catalog.repository;

import com.surplasse.catalog.entity.OptionGroup;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class OptionGroupRepository implements PanacheRepositoryBase<OptionGroup, UUID> {

    public List<OptionGroup> listByProductsOrdered(List<UUID> productIds) {
        if (productIds.isEmpty()) {
            return List.of();
        }
        return list("productId in ?1", Sort.by("productId").and("position"), productIds);
    }
}
