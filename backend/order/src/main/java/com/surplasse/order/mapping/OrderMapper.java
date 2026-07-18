package com.surplasse.order.mapping;

import com.surplasse.contract.model.Order;
import com.surplasse.contract.model.OrderLine;
import com.surplasse.contract.model.OrderLineOption;
import com.surplasse.contract.model.TableSession;
import com.surplasse.order.service.OptionsJson;
import com.surplasse.order.service.OrderService.OrderView;
import com.surplasse.order.service.TableSessionService.OpenedSession;

/** Transports order entities to the DTOs of the contract. Computes nothing. */
public final class OrderMapper {

    private OrderMapper() {}

    public static TableSession toTableSession(OpenedSession session) {
        return new TableSession()
                .token(session.token())
                .establishmentId(session.establishmentId())
                .tableLabel(session.tableLabel())
                .expiresAt(session.expiresAt());
    }

    public static Order toOrder(OrderView view) {
        return new Order()
                .id(view.order().getId())
                .displayNumber(view.order().getDisplayNumber())
                .status(Order.StatusEnum.fromString(view.order().getStatus().dbValue()))
                .type(Order.TypeEnum.fromString(view.order().getType().dbValue()))
                .tableLabel(view.tableLabel())
                .lines(view.lines().stream().map(OrderMapper::toOrderLine).toList())
                .totalCents(view.order().getTotalCents())
                .currency("EUR")
                .trackingToken(view.order().getTrackingToken())
                .createdAt(view.order().getCreatedAt());
    }

    private static OrderLine toOrderLine(com.surplasse.order.entity.OrderLine line) {
        return new OrderLine()
                .productId(line.getProductId())
                .productName(line.getProductName())
                .unitPriceCents(line.getUnitPriceCents())
                .quantity(line.getQuantity())
                .options(OptionsJson.read(line.getOptionsJson()).stream()
                        .map(option -> new OrderLineOption()
                                .group(option.group())
                                .option(option.option())
                                .extraCostCents(option.extraCostCents()))
                        .toList())
                .note(line.getNote())
                .lineTotalCents(line.getLineTotalCents());
    }
}
