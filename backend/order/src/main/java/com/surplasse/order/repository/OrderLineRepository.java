package com.surplasse.order.repository;

import com.surplasse.order.entity.OrderLine;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class OrderLineRepository implements PanacheRepositoryBase<OrderLine, UUID> {

    public List<OrderLine> listByOrderOrdered(UUID orderId) {
        return list("orderId = ?1", Sort.by("position"), orderId);
    }
}
