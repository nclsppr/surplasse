package com.surplasse.catalog.service;

import com.surplasse.catalog.entity.Category;
import com.surplasse.catalog.entity.Menu;
import com.surplasse.catalog.entity.Option;
import com.surplasse.catalog.entity.OptionGroup;
import com.surplasse.catalog.entity.Product;
import java.util.List;

/**
 * The published menu assembled as a tree, in display order. Output of the
 * service, transported to contract DTOs by the mapper.
 */
public record MenuSnapshot(Menu menu, String currency, List<CategorySnapshot> categories) {

    public record CategorySnapshot(Category category, List<ProductSnapshot> products) {}

    public record ProductSnapshot(Product product, List<OptionGroupSnapshot> optionGroups) {}

    public record OptionGroupSnapshot(OptionGroup group, List<Option> options) {}
}
