package com.surplasse.catalog.resource;

import com.surplasse.catalog.mapping.CatalogMapper;
import com.surplasse.catalog.service.CatalogService;
import com.surplasse.contract.api.CatalogApi;
import jakarta.ws.rs.core.Response;

/** Implements the generated catalog interface: converts and delegates, no logic. */
public class CatalogResource implements CatalogApi {

    private final CatalogService service;

    CatalogResource(CatalogService service) {
        this.service = service;
    }

    @Override
    public Response getEstablishmentPublic(String slug) {
        return Response.ok(CatalogMapper.toEstablishmentPublic(service.publicEstablishmentBySlug(slug)))
                .build();
    }

    @Override
    public Response getPublishedMenu(String slug) {
        return Response.ok(CatalogMapper.toPublicMenu(service.publishedMenuBySlug(slug)))
                .build();
    }
}
