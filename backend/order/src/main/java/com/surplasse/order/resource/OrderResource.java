package com.surplasse.order.resource;

import com.surplasse.common.identity.RestaurateurIdentityGateway;
import com.surplasse.contract.api.OrderApi;
import com.surplasse.contract.model.OrderCreationRequest;
import com.surplasse.contract.model.OrderStatusUpdate;
import com.surplasse.contract.model.TableSessionRequest;
import com.surplasse.order.mapping.OrderMapper;
import com.surplasse.order.service.OperationalOrderService;
import com.surplasse.order.service.OrderEventBroadcaster;
import com.surplasse.order.service.OrderEventStreamer;
import com.surplasse.order.service.OrderService;
import com.surplasse.order.service.OrderStatusService;
import com.surplasse.order.service.TableSessionService;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Multi;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Cookie;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import java.util.List;
import java.util.UUID;

/** Implements the generated order interface: converts and delegates, no logic. */
public class OrderResource implements OrderApi {

    static final String TABLE_SESSION_HEADER = "X-Table-Session";

    private final TableSessionService tableSessionService;
    private final OrderService orderService;
    private final OperationalOrderService operationalOrderService;
    private final OrderStatusService orderStatusService;
    private final OrderEventBroadcaster orderEventBroadcaster;
    private final OrderEventStreamer orderEventStreamer;

    @Context
    HttpHeaders headers;

    @Context
    Sse sse;

    OrderResource(
            TableSessionService tableSessionService,
            OrderService orderService,
            OperationalOrderService operationalOrderService,
            OrderStatusService orderStatusService,
            OrderEventBroadcaster orderEventBroadcaster,
            OrderEventStreamer orderEventStreamer) {
        this.tableSessionService = tableSessionService;
        this.orderService = orderService;
        this.operationalOrderService = operationalOrderService;
        this.orderStatusService = orderStatusService;
        this.orderEventBroadcaster = orderEventBroadcaster;
        this.orderEventStreamer = orderEventStreamer;
    }

    @Override
    public Response createTableSession(TableSessionRequest request) {
        return Response.status(201)
                .entity(OrderMapper.toTableSession(
                        tableSessionService.open(request.getEstablishmentSlug(), request.getTableCode())))
                .build();
    }

    @Override
    public Response createOrder(UUID idempotencyKey, OrderCreationRequest request) {
        TableSessionService.ActiveSession session =
                tableSessionService.authenticate(headers.getHeaderString(TABLE_SESSION_HEADER));
        OrderService.OrderDraft draft = new OrderService.OrderDraft(
                request.getType().value(),
                request.getLines().stream()
                        .map(line -> new OrderService.LineDraft(
                                line.getProductId(),
                                line.getQuantity(),
                                line.getOptionIds() == null ? List.of() : line.getOptionIds(),
                                line.getNote()))
                        .toList());
        return Response.status(201)
                .entity(OrderMapper.toOrder(orderService.create(session, idempotencyKey, draft)))
                .build();
    }

    @Override
    public Response getOrder(UUID orderId, String trackingToken) {
        return Response.ok(OrderMapper.toOrder(orderService.getForTracking(orderId, trackingToken)))
                .build();
    }

    @Override
    public Response listOrders(UUID establishmentId, String cursor, Integer limit) {
        return Response.ok(OrderMapper.toOrderPage(operationalOrderService.list(
                        cookie(RestaurateurIdentityGateway.ACCESS_COOKIE), establishmentId, cursor, limit)))
                .build();
    }

    @Override
    public Response updateOrderStatus(UUID orderId, OrderStatusUpdate request) {
        OrderStatusService.StatusUpdate update = orderStatusService.update(
                cookie(RestaurateurIdentityGateway.ACCESS_COOKIE),
                orderId,
                com.surplasse.order.entity.OrderStatus.fromDbValue(
                        request.getStatus().value()));
        update.event().ifPresent(orderEventBroadcaster::publish);
        return Response.ok(OrderMapper.toOrderStatusResult(update)).build();
    }

    private String cookie(String name) {
        Cookie cookie = headers.getCookies().get(name);
        return cookie == null ? null : cookie.getValue();
    }

    /**
     * SSE stream of the order (x-sse in the contract, written by hand: no
     * generated interface can express a Mutiny stream). Lives on this class
     * rather than its own: a separate resource class whose path overlaps
     * /v1/orders shadows the sibling routes in the RESTEasy Reactive matcher.
     */
    // @Blocking: the capability check and the replay read the database
    // during stream setup; they must leave the IO thread (conventions
    // Quarkus: blocking work is moved out of the reactive flow).
    @GET
    @Path("/orders/{orderId}/events")
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @Blocking
    public Multi<OutboundSseEvent> streamOrderEvents(
            @PathParam("orderId") UUID orderId,
            @QueryParam("trackingToken") String trackingToken,
            @HeaderParam("Last-Event-ID") String lastEventId) {
        return orderEventStreamer.stream(orderId, trackingToken, lastEventId, sse);
    }
}
