package com.surplasse.common.catalog;

import java.time.OffsetDateTime;
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

    /** Human labels of tables, resolved in one catalog query for order lists. */
    Map<UUID, String> findTableLabels(Collection<UUID> tableQrIds);

    /**
     * Pricing snapshot of the requested products, restricted to the published
     * menu of the establishment: a product outside that menu is simply absent
     * from the result.
     */
    Map<UUID, ProductPricing> priceProducts(UUID establishmentId, Collection<UUID> productIds);

    /**
     * Payment routing owned by an active establishment. The payment domain
     * fails closed when the account is absent or its Stripe capabilities are
     * disabled.
     */
    Optional<PaymentRouting> findPaymentRouting(UUID establishmentId);

    record TableRef(UUID establishmentId, UUID tableQrId, String tableLabel) {}

    record PaymentRouting(
            String stripeAccountId, boolean chargesEnabled, boolean payoutsEnabled, OffsetDateTime activatedAt) {}

    record ProductPricing(
            UUID productId, String name, int priceCents, boolean available, List<OptionGroupPricing> optionGroups) {}

    record OptionGroupPricing(UUID groupId, String name, int minChoices, int maxChoices, List<OptionPricing> options) {}

    record OptionPricing(UUID optionId, String name, int extraCostCents, boolean available) {}
}
