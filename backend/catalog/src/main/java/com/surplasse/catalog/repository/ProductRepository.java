package com.surplasse.catalog.repository;

import com.surplasse.catalog.entity.Product;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class ProductRepository implements PanacheRepositoryBase<Product, UUID> {

    /** Products by ids, soft-deleted ones excluded, whatever their availability. */
    public List<Product> listExistingByIds(List<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return list("id in ?1 and deletedAt is null", ids);
    }

    /** Products of the given categories, soft-deleted ones excluded, in display order. */
    public List<Product> listVisibleByCategories(List<UUID> categoryIds) {
        if (categoryIds.isEmpty()) {
            return List.of();
        }
        return list(
                "categoryId in ?1 and deletedAt is null", Sort.by("categoryId").and("position"), categoryIds);
    }
}
