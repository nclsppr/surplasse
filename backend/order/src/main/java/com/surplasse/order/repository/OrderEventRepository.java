package com.surplasse.order.repository;

import com.surplasse.order.entity.OrderEvent;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class OrderEventRepository implements PanacheRepositoryBase<OrderEvent, Long> {

    public List<OrderEvent> listForOrderAfter(UUID orderId, long afterEventId) {
        return list("orderId = ?1 and id > ?2", Sort.by("id"), orderId, afterEventId);
    }
}
