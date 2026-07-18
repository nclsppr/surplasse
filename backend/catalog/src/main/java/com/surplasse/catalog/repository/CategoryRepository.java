package com.surplasse.catalog.repository;

import com.surplasse.catalog.entity.Category;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class CategoryRepository implements PanacheRepositoryBase<Category, UUID> {

    public List<Category> listByMenuOrdered(UUID menuId) {
        return list("menuId = ?1", Sort.by("position"), menuId);
    }
}
