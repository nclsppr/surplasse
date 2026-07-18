package com.surplasse.payment.resource;

import com.surplasse.common.order.OrderGateway;
import com.surplasse.contract.api.PaymentApi;
import com.surplasse.contract.model.PaymentCreationRequest;
import com.surplasse.payment.mapping.PaymentMapper;
import com.surplasse.payment.service.PaymentService;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import java.util.UUID;

/** Implements the generated payment interface: converts and delegates, no logic. */
public class PaymentResource implements PaymentApi {

    static final String TABLE_SESSION_HEADER = "X-Table-Session";

    private final OrderGateway orderGateway;
    private final PaymentService paymentService;

    @Context
    HttpHeaders headers;

    PaymentResource(OrderGateway orderGateway, PaymentService paymentService) {
        this.orderGateway = orderGateway;
        this.paymentService = paymentService;
    }

    @Override
    public Response createPayment(UUID idempotencyKey, PaymentCreationRequest request) {
        OrderGateway.ActiveTableSession session =
                orderGateway.requireTableSession(headers.getHeaderString(TABLE_SESSION_HEADER));
        return Response.status(201)
                .entity(PaymentMapper.toPaymentSession(
                        paymentService.createSession(session.establishmentId(), request.getOrderId())))
                .build();
    }
}
