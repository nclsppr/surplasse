package com.surplasse.order.service;

import com.surplasse.common.order.OrderGateway;
import com.surplasse.order.entity.OrderLine;
import com.surplasse.order.repository.OrderLineRepository;
import com.surplasse.order.repository.OrderRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import java.util.UUID;

/** Order side of the explicit inter-domain boundary declared in common. */
@ApplicationScoped
public class OrderGatewayService implements OrderGateway {

    private final OrderRepository orderRepository;
    private final OrderLineRepository orderLineRepository;
    private final TableSessionService tableSessionService;

    OrderGatewayService(
            OrderRepository orderRepository,
            OrderLineRepository orderLineRepository,
            TableSessionService tableSessionService) {
        this.orderRepository = orderRepository;
        this.orderLineRepository = orderLineRepository;
        this.tableSessionService = tableSessionService;
    }

    @Override
    public Optional<PayableOrder> payableOrder(UUID orderId, UUID establishmentId) {
        return orderRepository
                .findByIdForEstablishment(orderId, establishmentId)
                .map(order -> new PayableOrder(
                        order.getId(),
                        order.getEstablishmentId(),
                        order.getStatus().dbValue(),
                        order.getTotalCents(),
                        "EUR",
                        orderLineRepository.listByOrderOrdered(order.getId()).stream()
                                .map(OrderLine::getProductId)
                                .toList()));
    }

    @Override
    public ActiveTableSession requireTableSession(String token) {
        TableSessionService.ActiveSession session = tableSessionService.authenticate(token);
        return new ActiveTableSession(session.establishmentId(), session.tableQrId());
    }
}
