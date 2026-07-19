package com.surplasse.order.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.quarkus.panache.common.Sort.Direction;
import java.util.List;
import org.junit.jupiter.api.Test;

class OrderRepositoryTest {

    @Test
    void operationalOrderSort_creationAndIdentifier_areBothDescending() {
        var columns = OrderRepository.operationalOrderSort().getColumns();

        assertEquals(
                List.of("createdAt", "id"),
                columns.stream().map(column -> column.getName()).toList());
        assertEquals(
                List.of(Direction.Descending, Direction.Descending),
                columns.stream().map(column -> column.getDirection()).toList());
    }
}
