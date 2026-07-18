package com.surplasse.catalog.resource;

import com.surplasse.catalog.mapping.CatalogMapper;
import com.surplasse.catalog.service.CatalogService;
import com.surplasse.contract.api.CatalogApi;
import com.surplasse.contract.model.EstablishmentPublic;
import com.surplasse.contract.model.PublicMenu;

/** Implements the generated catalog interface: converts and delegates, no logic. */
public class CatalogResource implements CatalogApi {

    private final CatalogService service;

    CatalogResource(CatalogService service) {
        this.service = service;
    }

    @Override
    public EstablishmentPublic getEstablishmentPublic(String slug) {
        return CatalogMapper.toEstablishmentPublic(service.activeEstablishmentBySlug(slug));
    }

    @Override
    public PublicMenu getPublishedMenu(String slug) {
        return CatalogMapper.toPublicMenu(service.publishedMenuBySlug(slug));
    }
}
