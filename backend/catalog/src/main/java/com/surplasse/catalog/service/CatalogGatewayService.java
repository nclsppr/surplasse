package com.surplasse.catalog.service;

import com.surplasse.catalog.entity.Category;
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
import com.surplasse.catalog.repository.TableQrRepository;
import com.surplasse.common.catalog.CatalogGateway;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Catalog side of the explicit inter-domain boundary declared in common. */
@ApplicationScoped
public class CatalogGatewayService implements CatalogGateway {

    private final EstablishmentRepository establishmentRepository;
    private final TableQrRepository tableQrRepository;
    private final MenuRepository menuRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final OptionGroupRepository optionGroupRepository;
    private final OptionRepository optionRepository;

    CatalogGatewayService(
            EstablishmentRepository establishmentRepository,
            TableQrRepository tableQrRepository,
            MenuRepository menuRepository,
            CategoryRepository categoryRepository,
            ProductRepository productRepository,
            OptionGroupRepository optionGroupRepository,
            OptionRepository optionRepository) {
        this.establishmentRepository = establishmentRepository;
        this.tableQrRepository = tableQrRepository;
        this.menuRepository = menuRepository;
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.optionGroupRepository = optionGroupRepository;
        this.optionRepository = optionRepository;
    }

    @Override
    public Optional<TableRef> findActiveTable(String establishmentSlug, String tableCode) {
        return establishmentRepository.findActiveBySlug(establishmentSlug).flatMap(establishment -> tableQrRepository
                .findActiveByCode(establishment.getId(), tableCode)
                .map(table -> new TableRef(establishment.getId(), table.getId(), table.getLabel())));
    }

    @Override
    public Optional<String> findTableLabel(UUID tableQrId) {
        return tableQrRepository.findByIdOptional(tableQrId).map(com.surplasse.catalog.entity.TableQr::getLabel);
    }

    @Override
    public Map<UUID, ProductPricing> priceProducts(UUID establishmentId, Collection<UUID> productIds) {
        Optional<Menu> menu = menuRepository.findPublishedByEstablishment(establishmentId);
        if (menu.isEmpty() || productIds.isEmpty()) {
            return Map.of();
        }
        Set<UUID> menuCategoryIds = categoryRepository
                .listByMenuOrdered(menu.get().getId())
                .stream()
                .map(Category::getId)
                .collect(Collectors.toSet());
        List<Product> products = productRepository.listExistingByIds(List.copyOf(productIds)).stream()
                .filter(product -> menuCategoryIds.contains(product.getCategoryId()))
                .toList();
        List<OptionGroup> groups = optionGroupRepository.listByProductsOrdered(
                products.stream().map(Product::getId).toList());
        Map<UUID, List<Option>> optionsByGroup =
                optionRepository
                        .listVisibleByGroupsOrdered(
                                groups.stream().map(OptionGroup::getId).toList())
                        .stream()
                        .collect(Collectors.groupingBy(Option::getOptionGroupId));
        Map<UUID, List<OptionGroup>> groupsByProduct =
                groups.stream().collect(Collectors.groupingBy(OptionGroup::getProductId));

        return products.stream()
                .map(product -> new ProductPricing(
                        product.getId(),
                        product.getName(),
                        product.getPriceCents(),
                        product.isAvailable(),
                        groupsByProduct.getOrDefault(product.getId(), List.of()).stream()
                                .map(group -> new OptionGroupPricing(
                                        group.getId(),
                                        group.getName(),
                                        group.getMinChoices(),
                                        group.getMaxChoices(),
                                        optionsByGroup.getOrDefault(group.getId(), List.of()).stream()
                                                .map(option -> new OptionPricing(
                                                        option.getId(),
                                                        option.getName(),
                                                        option.getExtraCostCents(),
                                                        option.isAvailable()))
                                                .toList()))
                                .toList()))
                .collect(Collectors.toMap(ProductPricing::productId, Function.identity()));
    }
}
