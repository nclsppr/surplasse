package com.surplasse.application.resource;

import com.surplasse.catalog.entity.OrderIntakeStatus;
import com.surplasse.catalog.mapping.OrderIntakeMapper;
import com.surplasse.catalog.service.OrderIntakeService;
import com.surplasse.common.identity.RestaurateurIdentityGateway;
import com.surplasse.contract.api.EstablishmentApi;
import com.surplasse.contract.model.OrderIntakeUpdate;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Cookie;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import java.util.UUID;

/** Assembly adapter: authenticates the restaurateur and delegates catalog-owned policy. */
public class EstablishmentResource implements EstablishmentApi {

    private final RestaurateurIdentityGateway identityGateway;
    private final OrderIntakeService orderIntakeService;

    @Context
    HttpHeaders headers;

    EstablishmentResource(RestaurateurIdentityGateway identityGateway, OrderIntakeService orderIntakeService) {
        this.identityGateway = identityGateway;
        this.orderIntakeService = orderIntakeService;
    }

    @Override
    public Response getOrderIntake(UUID establishmentId) {
        UUID restaurateurId = identityGateway.authenticate(accessToken());
        return Response.ok(OrderIntakeMapper.toContract(orderIntakeService.get(establishmentId, restaurateurId)))
                .build();
    }

    @Override
    public Response updateOrderIntake(UUID establishmentId, OrderIntakeUpdate request) {
        UUID restaurateurId = identityGateway.authenticate(accessToken());
        OrderIntakeStatus desiredStatus =
                OrderIntakeStatus.fromDbValue(request.getStatus().toString());
        return Response.ok(OrderIntakeMapper.toContract(
                        orderIntakeService.update(establishmentId, restaurateurId, desiredStatus)))
                .build();
    }

    private String accessToken() {
        Cookie cookie = headers.getCookies().get(RestaurateurIdentityGateway.ACCESS_COOKIE);
        return cookie == null ? null : cookie.getValue();
    }
}
