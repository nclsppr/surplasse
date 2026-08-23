package com.surplasse.payment.resource;

import com.surplasse.common.identity.RestaurateurIdentityGateway;
import com.surplasse.common.order.OrderGateway;
import com.surplasse.contract.api.PaymentApi;
import com.surplasse.contract.model.PaymentCreationRequest;
import com.surplasse.contract.model.RefundCreationRequest;
import com.surplasse.payment.entity.RefundReason;
import com.surplasse.payment.mapping.PaymentMapper;
import com.surplasse.payment.service.PaymentService;
import com.surplasse.payment.service.RefundService;
import jakarta.enterprise.context.RequestScoped;
import jakarta.ws.rs.CookieParam;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.core.Response;
import java.util.UUID;

/** Implements the generated payment interface: converts and delegates, no logic. */
@RequestScoped
public class PaymentResource implements PaymentApi {

    static final String TABLE_SESSION_HEADER = "X-Table-Session";

    private final OrderGateway orderGateway;
    private final PaymentService paymentService;
    private final RefundService refundService;

    @HeaderParam(TABLE_SESSION_HEADER)
    String tableSessionToken;

    @CookieParam(RestaurateurIdentityGateway.ACCESS_COOKIE)
    String accessToken;

    PaymentResource(OrderGateway orderGateway, PaymentService paymentService, RefundService refundService) {
        this.orderGateway = orderGateway;
        this.paymentService = paymentService;
        this.refundService = refundService;
    }

    @Override
    public Response createPayment(UUID idempotencyKey, PaymentCreationRequest request) {
        OrderGateway.ActiveTableSession session = orderGateway.requireTableSession(tableSessionToken);
        return Response.status(201)
                .entity(PaymentMapper.toPaymentSession(
                        paymentService.createSession(session, request.getOrderId(), idempotencyKey)))
                .build();
    }

    @Override
    public Response createRefund(UUID idempotencyKey, RefundCreationRequest request) {
        return Response.status(201)
                .entity(PaymentMapper.toRefund(refundService.create(
                        accessToken,
                        request.getOrderId(),
                        RefundReason.fromDbValue(request.getReason().value()),
                        idempotencyKey)))
                .build();
    }
}
