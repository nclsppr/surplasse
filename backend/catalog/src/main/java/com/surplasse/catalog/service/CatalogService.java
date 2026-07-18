package com.surplasse.catalog.service;

import com.surplasse.catalog.entity.Category;
import com.surplasse.catalog.entity.Establishment;
import com.surplasse.catalog.entity.Menu;
import com.surplasse.catalog.entity.Option;
import com.surplasse.catalog.entity.OptionGroup;
import com.surplasse.catalog.entity.Product;
import com.surplasse.catalog.repository.CategoryRepository;
import com.surplasse.catalog.repository.EstablishmentRepository;
import com.surplasse.catalog.repository.MenuRepository;
import com.surplasse.catalog.repository.OptionGroupRepository;
import com.surplasse.catalog.repository.OptionRepository;
import com.surplasse.catalog.repository.ProductRepository;
import com.surplasse.common.error.NotFoundException;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@ApplicationScoped
public class CatalogService {

    /** Single currency of the MVP; becomes establishment data the day another one is needed. */
    private static final String MENU_CURRENCY = "EUR";

    private final EstablishmentRepository establishmentRepository;
    private final MenuRepository menuRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final OptionGroupRepository optionGroupRepository;
    private final OptionRepository optionRepository;

    CatalogService(
            EstablishmentRepository establishmentRepository,
            MenuRepository menuRepository,
            CategoryRepository categoryRepository,
            ProductRepository productRepository,
            OptionGroupRepository optionGroupRepository,
            OptionRepository optionRepository) {
        this.establishmentRepository = establishmentRepository;
        this.menuRepository = menuRepository;
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.optionGroupRepository = optionGroupRepository;
        this.optionRepository = optionRepository;
    }

    public Establishment activeEstablishmentBySlug(String slug) {
        return establishmentRepository
                .findActiveBySlug(slug)
                .orElseThrow(() -> new NotFoundException("No establishment matches slug '%s'.".formatted(slug)));
    }

    public MenuSnapshot publishedMenuBySlug(String slug) {
        Establishment establishment = activeEstablishmentBySlug(slug);
        Menu menu = menuRepository
                .findPublishedByEstablishment(establishment.getId())
                .orElseThrow(() -> new NotFoundException("Establishment '%s' has no published menu.".formatted(slug)));

        List<Category> categories = categoryRepository.listByMenuOrdered(menu.getId());
        List<Product> products = productRepository.listVisibleByCategories(idsOf(categories, Category::getId));
        List<OptionGroup> groups = optionGroupRepository.listByProductsOrdered(idsOf(products, Product::getId));
        List<Option> options = optionRepository.listVisibleByGroupsOrdered(idsOf(groups, OptionGroup::getId));

        Map<UUID, List<Product>> productsByCategory =
                products.stream().collect(Collectors.groupingBy(Product::getCategoryId));
        Map<UUID, List<OptionGroup>> groupsByProduct =
                groups.stream().collect(Collectors.groupingBy(OptionGroup::getProductId));
        Map<UUID, List<Option>> optionsByGroup =
                options.stream().collect(Collectors.groupingBy(Option::getOptionGroupId));

        List<MenuSnapshot.CategorySnapshot> categorySnapshots = categories.stream()
                .map(category -> new MenuSnapshot.CategorySnapshot(
                        category,
                        productsByCategory.getOrDefault(category.getId(), List.of()).stream()
                                .map(product -> new MenuSnapshot.ProductSnapshot(
                                        product,
                                        groupsByProduct.getOrDefault(product.getId(), List.of()).stream()
                                                .map(group -> new MenuSnapshot.OptionGroupSnapshot(
                                                        group, optionsByGroup.getOrDefault(group.getId(), List.of())))
                                                .toList()))
                                .toList()))
                .toList();

        return new MenuSnapshot(menu, MENU_CURRENCY, categorySnapshots);
    }

    private static <T> List<UUID> idsOf(List<T> items, Function<T, UUID> id) {
        return items.stream().map(id).toList();
    }
}
