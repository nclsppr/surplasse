package com.surplasse.order.repository;

import com.surplasse.order.entity.Order;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class OrderRepository implements PanacheRepositoryBase<Order, UUID> {

    public Optional<Order> findByIdempotencyKey(UUID idempotencyKey) {
        return find("idempotencyKey = ?1", idempotencyKey).firstResultOptional();
    }

    public Optional<Order> findByIdForEstablishment(UUID orderId, UUID establishmentId) {
        return find("id = ?1 and establishmentId = ?2", orderId, establishmentId)
                .firstResultOptional();
    }

    public long countByEstablishmentAndServiceDay(UUID establishmentId, LocalDate serviceDay) {
        return count("establishmentId = ?1 and serviceDay = ?2", establishmentId, serviceDay);
    }
}
