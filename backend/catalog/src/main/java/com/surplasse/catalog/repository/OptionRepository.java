package com.surplasse.catalog.repository;

import com.surplasse.catalog.entity.Option;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class OptionRepository implements PanacheRepositoryBase<Option, UUID> {

    /** Options of the given groups, soft-deleted ones excluded, in display order. */
    public List<Option> listVisibleByGroupsOrdered(List<UUID> optionGroupIds) {
        if (optionGroupIds.isEmpty()) {
            return List.of();
        }
        return list(
                "optionGroupId in ?1 and deletedAt is null",
                Sort.by("optionGroupId").and("position"),
                optionGroupIds);
    }
}
