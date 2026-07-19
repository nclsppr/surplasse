package com.surplasse.identity.resource;

import com.surplasse.contract.api.IdentityApi;
import com.surplasse.contract.model.MagicLinkExchange;
import com.surplasse.contract.model.MagicLinkRequest;
import com.surplasse.identity.service.IdentityService;
import com.surplasse.identity.service.SessionCookies;
import io.vertx.ext.web.RoutingContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Cookie;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;

/** Implements the generated identity interface: reads credentials, converts and delegates. */
public class IdentityResource implements IdentityApi {

    private final IdentityService service;
    private final SessionCookies cookies;

    @Context
    HttpHeaders headers;

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
        return sessionResponse(service.refresh(cookie(SessionCookies.REFRESH_COOKIE)));
    }

    @Override
    public Response getCurrentRestaurateurSession() {
        return Response.ok(service.current(cookie(SessionCookies.ACCESS_COOKIE)))
                .build();
    }

    @Override
    public Response deleteCurrentRestaurateurSession() {
        service.logout(cookie(SessionCookies.REFRESH_COOKIE));
        return Response.noContent()
                .header(HttpHeaders.SET_COOKIE, cookies.clearAccess())
                .header(HttpHeaders.SET_COOKIE, cookies.clearRefresh())
                .build();
    }

    private Response sessionResponse(IdentityService.CreatedSession session) {
        return Response.ok(session.view())
                .header(HttpHeaders.SET_COOKIE, cookies.access(session.accessToken(), session.accessExpiresAt()))
                .header(HttpHeaders.SET_COOKIE, cookies.refresh(session.refreshToken(), session.refreshExpiresAt()))
                .build();
    }

    private String cookie(String name) {
        Cookie cookie = headers.getCookies().get(name);
        return cookie == null ? null : cookie.getValue();
    }

    private String sourceIp() {
        if (routingContext == null || routingContext.request().remoteAddress() == null) {
            return "unknown";
        }
        return routingContext.request().remoteAddress().hostAddress();
    }
}
