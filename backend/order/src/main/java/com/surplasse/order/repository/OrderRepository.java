package com.surplasse.order.repository;

import com.surplasse.order.entity.Order;
import com.surplasse.order.entity.OrderStatus;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class OrderRepository implements PanacheRepositoryBase<Order, UUID> {

    private static final Sort OPERATIONAL_ORDER = Sort.descending("createdAt", "id");

    public Optional<Order> findByIdempotencyKey(UUID idempotencyKey) {
        return find("idempotencyKey = ?1", idempotencyKey).firstResultOptional();
    }

    public Optional<Order> findByIdForEstablishment(UUID orderId, UUID establishmentId) {
        return find("id = ?1 and establishmentId = ?2", orderId, establishmentId)
                .firstResultOptional();
    }

    /** Serializes concurrent status updates for one order. Must run inside a transaction. */
    public Optional<Order> findByIdForUpdate(UUID orderId) {
        return find("id", orderId).withLock(LockModeType.PESSIMISTIC_WRITE).firstResultOptional();
    }

    public long countByEstablishmentAndServiceDay(UUID establishmentId, LocalDate serviceDay) {
        return count("establishmentId = ?1 and serviceDay = ?2", establishmentId, serviceDay);
    }

    /** Reads one extra row so the service can determine whether another page exists. */
    public List<Order> listOperational(UUID establishmentId, int resultLimit) {
        return find(
                        "establishmentId = ?1 and status in ?2",
                        operationalOrderSort(),
                        establishmentId,
                        OrderStatus.operationalValues())
                .page(Page.ofSize(resultLimit))
                .list();
    }

    /**
     * Keyset pagination after the exact composite position carried by the
     * cursor. The strict comparison keeps subsequent pages stable when newer
     * orders arrive.
     */
    public List<Order> listOperationalAfter(
            UUID establishmentId, OffsetDateTime createdAt, UUID orderId, int resultLimit) {
        return find(
                        "establishmentId = ?1 and status in ?2 and "
                                + "(createdAt < ?3 or (createdAt = ?3 and id < ?4))",
                        operationalOrderSort(),
                        establishmentId,
                        OrderStatus.operationalValues(),
                        createdAt,
                        orderId)
                .page(Page.ofSize(resultLimit))
                .list();
    }

    static Sort operationalOrderSort() {
        return OPERATIONAL_ORDER;
    }
}
