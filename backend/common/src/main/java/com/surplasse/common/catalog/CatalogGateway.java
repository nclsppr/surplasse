package com.surplasse.common.catalog;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Explicit synchronous boundary of the catalog domain
 * (docs/architecture/backend.md, inter-domain rules): the order and payment
 * domains query availability and pricing through this interface, never
 * through the catalog module directly.
 */
public interface CatalogGateway {

    /** Resolves an active table of an active establishment from a scanned QR code. */
    Optional<TableRef> findActiveTable(String establishmentSlug, String tableCode);

    /** Human label of a table, for display on orders. */
    Optional<String> findTableLabel(UUID tableQrId);

    /**
     * Pricing snapshot of the requested products, restricted to the published
     * menu of the establishment: a product outside that menu is simply absent
     * from the result.
     */
    Map<UUID, ProductPricing> priceProducts(UUID establishmentId, Collection<UUID> productIds);

    record TableRef(UUID establishmentId, UUID tableQrId, String tableLabel) {}

    record ProductPricing(
            UUID productId, String name, int priceCents, boolean available, List<OptionGroupPricing> optionGroups) {}

    record OptionGroupPricing(UUID groupId, String name, int minChoices, int maxChoices, List<OptionPricing> options) {}

    record OptionPricing(UUID optionId, String name, int extraCostCents, boolean available) {}
}
