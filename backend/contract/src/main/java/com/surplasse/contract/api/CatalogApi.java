package com.surplasse.contract.api;

import com.surplasse.contract.model.EstablishmentPublic;
import com.surplasse.contract.model.Problem;
import com.surplasse.contract.model.PublicMenu;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;


import java.io.InputStream;
import java.util.Map;
import java.util.List;
import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

/**
* Represents a collection of functions to interact with the API endpoints.
*/
@Path("/v1/establishments/{slug}")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public interface CatalogApi {

    /**
     * Returns the public information of an establishment resolved by its slug (the subdomain of its mini-site). This endpoint is public: it backs the header of the mini-site rendered by the Commande frontend. Unknown slugs, as well as establishments that are not publicly visible, yield a 404 without distinction. 
     *
     * @param slug Slug of the establishment, the label of its subdomain (&#x60;{slug}.surplasse.com&#x60;). Lowercase letters, digits and hyphens. 
     * @return The public profile of the establishment.
     * @return The slug is syntactically invalid.
     * @return No establishment matches this slug.
     */
    @GET
    @Path("/public")
    @Produces({ "application/json", "application/problem+json" })
    Response getEstablishmentPublic(@PathParam("slug") @Pattern(regexp="^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$") String slug);


    /**
     * Returns the published menu of an establishment resolved by its slug, as a complete read model: categories, products, option groups and options, in display order (array order is the display order, no position field is exposed). Products and options marked unavailable are included with `available: false` so the frontend can render them greyed out. If the establishment has no published menu, the response is a 404. 
     *
     * @param slug Slug of the establishment, the label of its subdomain (&#x60;{slug}.surplasse.com&#x60;). Lowercase letters, digits and hyphens. 
     * @return The published menu, in display order.
     * @return The slug is syntactically invalid.
     * @return No establishment matches this slug, or it has no published menu.
     */
    @GET
    @Path("/menu")
    @Produces({ "application/json", "application/problem+json" })
    Response getPublishedMenu(@PathParam("slug") @Pattern(regexp="^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$") String slug);

}
