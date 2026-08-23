package com.surplasse.identity.resource;

import com.surplasse.contract.api.IdentityApi;
import com.surplasse.contract.model.MagicLinkExchange;
import com.surplasse.contract.model.MagicLinkRequest;
import com.surplasse.identity.service.IdentityService;
import com.surplasse.identity.service.SessionCookies;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.RequestScoped;
import jakarta.ws.rs.CookieParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Response;

/** Implements the generated identity interface: reads credentials, converts and delegates. */
@RequestScoped
public class IdentityResource implements IdentityApi {

    private final IdentityService service;
    private final SessionCookies cookies;

    @CookieParam(SessionCookies.ACCESS_COOKIE)
    String accessToken;

    @CookieParam(SessionCookies.REFRESH_COOKIE)
    String refreshToken;

    @Context
    RoutingContext routingContext;

    IdentityResource(IdentityService service, SessionCookies cookies) {
        this.service = service;
        this.cookies = cookies;
    }

    @Override
    public Response requestMagicLink(MagicLinkRequest request) {
        service.requestMagicLink(request.getEmail(), sourceIp());
        return Response.accepted().build();
    }

    @Override
    public Response createRestaurateurSession(MagicLinkExchange exchange) {
        return sessionResponse(service.exchangeMagicLink(exchange.getToken()));
    }

    @Override
    public Response refreshRestaurateurSession() {
        return sessionResponse(service.refresh(refreshToken));
    }

    @Override
    public Response getCurrentRestaurateurSession() {
        return Response.ok(service.current(accessToken)).build();
    }

    @Override
    public Response deleteCurrentRestaurateurSession() {
        service.logout(refreshToken);
        return Response.noContent()
                .cookie(cookies.clearAccess(), cookies.clearRefresh())
                .build();
    }

    private Response sessionResponse(IdentityService.CreatedSession session) {
        return Response.ok(session.view())
                .cookie(
                        cookies.access(session.accessToken(), session.accessExpiresAt()),
                        cookies.refresh(session.refreshToken(), session.refreshExpiresAt()))
                .build();
    }

    private String sourceIp() {
        if (routingContext == null || routingContext.request().remoteAddress() == null) {
            return "unknown";
        }
        return routingContext.request().remoteAddress().hostAddress();
    }
}
