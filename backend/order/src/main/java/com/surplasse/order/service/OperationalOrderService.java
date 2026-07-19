package com.surplasse.order.service;

import com.surplasse.common.catalog.CatalogGateway;
import com.surplasse.common.error.InvalidRequestException;
import com.surplasse.common.identity.RestaurateurIdentityGateway;
import com.surplasse.order.entity.Order;
import com.surplasse.order.entity.OrderLine;
import com.surplasse.order.repository.OrderLineRepository;
import com.surplasse.order.repository.OrderRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Lists the operational orders visible to one authenticated restaurateur. */
@ApplicationScoped
public class OperationalOrderService {

    static final int DEFAULT_LIMIT = 50;
    static final int MAX_LIMIT = 100;

    private final OrderRepository orderRepository;
    private final OrderLineRepository orderLineRepository;
    private final CatalogGateway catalogGateway;
    private final RestaurateurIdentityGateway identityGateway;

    OperationalOrderService(
            OrderRepository orderRepository,
            OrderLineRepository orderLineRepository,
            CatalogGateway catalogGateway,
            RestaurateurIdentityGateway identityGateway) {
        this.orderRepository = orderRepository;
        this.orderLineRepository = orderLineRepository;
        this.catalogGateway = catalogGateway;
        this.identityGateway = identityGateway;
    }

    public OrderPage list(String accessToken, UUID establishmentId, String cursor, Integer requestedLimit) {
        if (establishmentId == null) {
            throw new InvalidRequestException("establishmentId must be provided.");
        }
        int limit = validatedLimit(requestedLimit);
        identityGateway.authorize(accessToken, establishmentId);

        int resultLimit = limit + 1;
        List<Order> candidates;
        if (cursor == null) {
            candidates = orderRepository.listOperational(establishmentId, resultLimit);
        } else {
            OperationalOrderCursor.Position position = OperationalOrderCursor.decode(cursor, establishmentId);
            candidates = orderRepository.listOperationalAfter(
                    establishmentId, position.createdAt(), position.orderId(), resultLimit);
        }

        boolean hasMore = candidates.size() > limit;
        List<Order> visible = hasMore ? candidates.subList(0, limit) : candidates;
        String nextCursor = hasMore ? cursorForLast(establishmentId, visible) : null;
        return new OrderPage(toViews(visible), nextCursor, hasMore);
    }

    private List<OrderService.OrderView> toViews(List<Order> orders) {
        List<UUID> orderIds = orders.stream().map(Order::getId).toList();
        Map<UUID, List<OrderLine>> linesByOrder = orderLineRepository.listByOrdersOrdered(orderIds).stream()
                .collect(Collectors.groupingBy(OrderLine::getOrderId));
        Map<UUID, String> tableLabels = catalogGateway.findTableLabels(tableIds(orders));
        return orders.stream()
                .map(order -> new OrderService.OrderView(
                        order, linesByOrder.getOrDefault(order.getId(), List.of()), tableLabel(order, tableLabels)))
                .toList();
    }

    private static String tableLabel(Order order, Map<UUID, String> tableLabels) {
        return order.getTableQrId() == null ? null : tableLabels.get(order.getTableQrId());
    }

    private static Collection<UUID> tableIds(List<Order> orders) {
        return orders.stream()
                .map(Order::getTableQrId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private static int validatedLimit(Integer requestedLimit) {
        int limit = requestedLimit == null ? DEFAULT_LIMIT : requestedLimit;
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new InvalidRequestException("limit must be between 1 and 100.");
        }
        return limit;
    }

    private static String cursorForLast(UUID establishmentId, List<Order> visible) {
        Order last = visible.get(visible.size() - 1);
        return OperationalOrderCursor.encode(establishmentId, last.getCreatedAt(), last.getId());
    }

    public record OrderPage(List<OrderService.OrderView> items, String nextCursor, boolean hasMore) {

        public OrderPage {
            items = List.copyOf(items);
            if (hasMore != (nextCursor != null)) {
                throw new IllegalArgumentException("nextCursor must be present exactly when hasMore is true");
            }
        }
    }
}
