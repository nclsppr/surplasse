package com.surplasse.catalog.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Entity
@Table(name = "establishment")
public class Establishment {

    @Id
    private UUID id;

    private UUID restaurateurId;
    private String name;
    private String slug;
    private String address;
    private EstablishmentStatus status;
    private String stripeAccountId;
    private boolean stripeChargesEnabled;
    private boolean stripePayoutsEnabled;
    private OffsetDateTime stripeCapabilitiesUpdatedAt;
    private OffsetDateTime activatedAt;
    private OrderIntakeStatus orderIntakeStatus;
    private OffsetDateTime orderIntakeUpdatedAt;

    protected Establishment() {}

    public Establishment(
            UUID id, UUID restaurateurId, String name, String slug, String address, EstablishmentStatus status) {
        this(id, restaurateurId, name, slug, address, status, null, false, false, null);
    }

    public Establishment(
            UUID id,
            UUID restaurateurId,
            String name,
            String slug,
            String address,
            EstablishmentStatus status,
            String stripeAccountId,
            boolean stripeChargesEnabled,
            boolean stripePayoutsEnabled,
            OffsetDateTime activatedAt) {
        this.id = id;
        this.restaurateurId = restaurateurId;
        this.name = name;
        this.slug = slug;
        this.address = address;
        this.status = status;
        this.stripeAccountId = stripeAccountId;
        this.stripeChargesEnabled = stripeChargesEnabled;
        this.stripePayoutsEnabled = stripePayoutsEnabled;
        this.activatedAt = activatedAt;
        this.orderIntakeStatus = OrderIntakeStatus.PAUSED;
        this.orderIntakeUpdatedAt = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
    }

    public UUID getId() {
        return id;
    }

    public UUID getRestaurateurId() {
        return restaurateurId;
    }

    public String getName() {
        return name;
    }

    public String getSlug() {
        return slug;
    }

    public String getAddress() {
        return address;
    }

    public EstablishmentStatus getStatus() {
        return status;
    }

    public String getStripeAccountId() {
        return stripeAccountId;
    }

    public boolean isStripeChargesEnabled() {
        return stripeChargesEnabled;
    }

    public boolean isStripePayoutsEnabled() {
        return stripePayoutsEnabled;
    }

    public OffsetDateTime getStripeCapabilitiesUpdatedAt() {
        return stripeCapabilitiesUpdatedAt;
    }

    public OffsetDateTime getActivatedAt() {
        return activatedAt;
    }

    public OrderIntakeStatus getOrderIntakeStatus() {
        return orderIntakeStatus;
    }

    public OffsetDateTime getOrderIntakeUpdatedAt() {
        return orderIntakeUpdatedAt;
    }

    public boolean isOrderIntakeOpen() {
        return orderIntakeStatus == OrderIntakeStatus.OPEN;
    }

    /** Entity-owned portion of readiness; menu and table checks live in catalog services. */
    public boolean hasLifecycleAndPaymentReadiness() {
        return isOrderIntakeOpen()
                && status == EstablishmentStatus.ACTIVE
                && stripeAccountId != null
                && !stripeAccountId.isBlank()
                && stripeChargesEnabled
                && activatedAt != null;
    }

    public boolean openOrderIntake(OffsetDateTime changedAt) {
        if (isOrderIntakeOpen()) {
            return false;
        }
        orderIntakeStatus = OrderIntakeStatus.OPEN;
        orderIntakeUpdatedAt = normalizedOrderIntakeMutationTime(changedAt);
        return true;
    }

    public boolean pauseOrderIntake(OffsetDateTime changedAt) {
        if (orderIntakeStatus == OrderIntakeStatus.PAUSED) {
            return false;
        }
        orderIntakeStatus = OrderIntakeStatus.PAUSED;
        orderIntakeUpdatedAt = normalizedOrderIntakeMutationTime(changedAt);
        return true;
    }

    /** Applies only a newer Stripe snapshot. Equal timestamps merge fail-closed. */
    public boolean updateStripeCapabilities(
            boolean chargesEnabled, boolean payoutsEnabled, OffsetDateTime occurredAt, OffsetDateTime processedAt) {
        if (stripeCapabilitiesUpdatedAt != null && occurredAt.isBefore(stripeCapabilitiesUpdatedAt)) {
            return false;
        }
        if (stripeCapabilitiesUpdatedAt != null && occurredAt.isEqual(stripeCapabilitiesUpdatedAt)) {
            boolean safeCharges = stripeChargesEnabled && chargesEnabled;
            boolean safePayouts = stripePayoutsEnabled && payoutsEnabled;
            boolean changed = safeCharges != stripeChargesEnabled || safePayouts != stripePayoutsEnabled;
            if (changed) {
                stripeChargesEnabled = safeCharges;
                stripePayoutsEnabled = safePayouts;
            }
            boolean autoPaused = autoPauseWhenChargesAreDisabled(processedAt);
            return changed || autoPaused;
        }
        stripeChargesEnabled = chargesEnabled;
        stripePayoutsEnabled = payoutsEnabled;
        stripeCapabilitiesUpdatedAt = occurredAt;
        autoPauseWhenChargesAreDisabled(processedAt);
        return true;
    }

    private boolean autoPauseWhenChargesAreDisabled(OffsetDateTime processedAt) {
        return !stripeChargesEnabled && pauseOrderIntake(processedAt);
    }

    private OffsetDateTime normalizedOrderIntakeMutationTime(OffsetDateTime changedAt) {
        OffsetDateTime normalized =
                changedAt.withOffsetSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
        if (orderIntakeUpdatedAt != null && normalized.isBefore(orderIntakeUpdatedAt)) {
            return orderIntakeUpdatedAt;
        }
        return normalized;
    }
}
