package com.surplasse.common.catalog;

import java.util.List;
import java.util.UUID;

/** Catalog-owned boundary for restaurateur access to establishments. */
public interface EstablishmentAccessGateway {

    /** Returns accessible establishments sorted by name, then identifier. */
    List<AccessibleEstablishment> listAccessibleEstablishments(UUID restaurateurId);

    /** Checks whether the restaurateur can access the given establishment. */
    boolean canAccess(UUID restaurateurId, UUID establishmentId);

    record AccessibleEstablishment(UUID id, String name, String slug) {}
}
