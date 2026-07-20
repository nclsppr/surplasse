package com.surplasse.catalog.mapping;

import com.surplasse.catalog.entity.Option;
import com.surplasse.catalog.service.MenuSnapshot;
import com.surplasse.catalog.service.PublicEstablishmentSnapshot;
import com.surplasse.contract.model.EstablishmentPublic;
import com.surplasse.contract.model.MenuCategory;
import com.surplasse.contract.model.MenuOption;
import com.surplasse.contract.model.MenuOptionGroup;
import com.surplasse.contract.model.MenuProduct;
import com.surplasse.contract.model.PublicMenu;

/** Transports catalog entities to the DTOs of the contract. Computes nothing. */
public final class CatalogMapper {

    private CatalogMapper() {}

    public static EstablishmentPublic toEstablishmentPublic(PublicEstablishmentSnapshot snapshot) {
        var establishment = snapshot.establishment();
        return new EstablishmentPublic()
                .id(establishment.getId())
                .name(establishment.getName())
                .slug(establishment.getSlug())
                .address(establishment.getAddress())
                .acceptingOrders(snapshot.acceptingOrders());
    }

    public static PublicMenu toPublicMenu(MenuSnapshot snapshot) {
        return new PublicMenu()
                .id(snapshot.menu().getId())
                .name(snapshot.menu().getName())
                .currency(snapshot.currency())
                .categories(snapshot.categories().stream()
                        .map(CatalogMapper::toMenuCategory)
                        .toList());
    }

    private static MenuCategory toMenuCategory(MenuSnapshot.CategorySnapshot snapshot) {
        return new MenuCategory()
                .id(snapshot.category().getId())
                .name(snapshot.category().getName())
                .products(snapshot.products().stream()
                        .map(CatalogMapper::toMenuProduct)
                        .toList());
    }

    private static MenuProduct toMenuProduct(MenuSnapshot.ProductSnapshot snapshot) {
        return new MenuProduct()
                .id(snapshot.product().getId())
                .name(snapshot.product().getName())
                .description(snapshot.product().getDescription())
                .priceCents(snapshot.product().getPriceCents())
                .available(snapshot.product().isAvailable())
                .optionGroups(snapshot.optionGroups().stream()
                        .map(CatalogMapper::toMenuOptionGroup)
                        .toList());
    }

    private static MenuOptionGroup toMenuOptionGroup(MenuSnapshot.OptionGroupSnapshot snapshot) {
        return new MenuOptionGroup()
                .id(snapshot.group().getId())
                .name(snapshot.group().getName())
                .minChoices(snapshot.group().getMinChoices())
                .maxChoices(snapshot.group().getMaxChoices())
                .options(snapshot.options().stream()
                        .map(CatalogMapper::toMenuOption)
                        .toList());
    }

    private static MenuOption toMenuOption(Option option) {
        return new MenuOption()
                .id(option.getId())
                .name(option.getName())
                .extraCostCents(option.getExtraCostCents())
                .available(option.isAvailable());
    }
}
