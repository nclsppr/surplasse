package com.surplasse.catalog.mapping;

import com.surplasse.catalog.service.OrderIntakeService;
import com.surplasse.contract.model.OrderIntakeBlockedReason;
import com.surplasse.contract.model.OrderIntakeStatus;

public final class OrderIntakeMapper {

    private OrderIntakeMapper() {}

    public static OrderIntakeResponse toContract(OrderIntakeService.State state) {
        OrderIntakeResponse result = new OrderIntakeResponse();
        result.establishmentId(state.establishmentId())
                .status(OrderIntakeStatus.fromString(state.status().dbValue()))
                .acceptingOrders(state.acceptingOrders())
                .updatedAt(state.updatedAt());
        if (state.blockedReason() != null) {
            result.blockedReason(
                    OrderIntakeBlockedReason.fromString(state.blockedReason().apiValue()));
        }
        return result;
    }
}
