package com.surplasse.catalog.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
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

    public OffsetDateTime getActivatedAt() {
        return activatedAt;
    }

    /** Applies only a newer Stripe snapshot. Equal timestamps merge fail-closed. */
    public boolean updateStripeCapabilities(boolean chargesEnabled, boolean payoutsEnabled, OffsetDateTime occurredAt) {
        if (stripeCapabilitiesUpdatedAt != null && occurredAt.isBefore(stripeCapabilitiesUpdatedAt)) {
            return false;
        }
        if (stripeCapabilitiesUpdatedAt != null && occurredAt.isEqual(stripeCapabilitiesUpdatedAt)) {
            boolean safeCharges = stripeChargesEnabled && chargesEnabled;
            boolean safePayouts = stripePayoutsEnabled && payoutsEnabled;
            if (safeCharges == stripeChargesEnabled && safePayouts == stripePayoutsEnabled) {
                return false;
            }
            stripeChargesEnabled = safeCharges;
            stripePayoutsEnabled = safePayouts;
            return true;
        }
        stripeChargesEnabled = chargesEnabled;
        stripePayoutsEnabled = payoutsEnabled;
        stripeCapabilitiesUpdatedAt = occurredAt;
        return true;
    }
}
