package com.surplasse.order.service;

import com.surplasse.order.entity.Order;
import com.surplasse.order.entity.OrderEvent;
import com.surplasse.order.entity.OrderStatus;
import com.surplasse.order.repository.OrderEventRepository;
import com.surplasse.order.repository.OrderRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.jboss.logging.Logger;

@ApplicationScoped
public class OrderStatusService {

    private static final Logger LOG = Logger.getLogger(OrderStatusService.class);

    private final OrderRepository orderRepository;
    private final OrderEventRepository orderEventRepository;

    OrderStatusService(OrderRepository orderRepository, OrderEventRepository orderEventRepository) {
        this.orderRepository = orderRepository;
        this.orderEventRepository = orderEventRepository;
    }

    /**
     * Moves an order to paid after webhook confirmation. Idempotent: an order
     * already past pending_payment is left untouched. Returns the persisted
     * event to broadcast, empty when nothing changed. REQUIRES_NEW: the
     * caller is a post-commit observer, still associated with the completed
     * payment transaction; this change needs its own.
     */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public Optional<PublishedOrderEvent> markPaid(UUID orderId) {
        Optional<Order> found = orderRepository.findByIdOptional(orderId);
        if (found.isEmpty()) {
            LOG.warnf("markPaid ignored: unknown order %s", orderId);
            return Optional.empty();
        }
        Order order = found.get();
        if (!order.getStatus().canTransitionTo(OrderStatus.PAID)) {
            LOG.infof("markPaid ignored: order %s is %s", orderId, order.getStatus());
            return Optional.empty();
        }
        order.moveTo(OrderStatus.PAID);
        OrderEvent event = new OrderEvent(
                order.getEstablishmentId(),
                order.getId(),
                "order-status",
                "{\"orderId\":\"%s\",\"status\":\"%s\"}".formatted(order.getId(), OrderStatus.PAID.dbValue()),
                OffsetDateTime.now(ZoneOffset.UTC));
        orderEventRepository.persist(event);
        orderEventRepository.flush();
        return Optional.of(new PublishedOrderEvent(
                event.getId(), order.getId(), order.getEstablishmentId(), event.getEventType(), event.getPayload()));
    }

    public record PublishedOrderEvent(long id, UUID orderId, UUID establishmentId, String name, String payload) {}
}
