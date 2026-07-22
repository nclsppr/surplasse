package com.surplasse.payment.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.common.error.BusinessRuleException;
import com.surplasse.common.error.ConflictException;
import com.surplasse.common.error.DependencyUnavailableException;
import com.surplasse.common.event.PaymentRefundFailed;
import com.surplasse.common.event.PaymentRefunded;
import com.surplasse.common.identity.RestaurateurIdentityGateway;
import com.surplasse.common.order.OrderGateway;
import com.surplasse.payment.entity.Payment;
import com.surplasse.payment.entity.PaymentRefund;
import com.surplasse.payment.entity.PaymentStatus;
import com.surplasse.payment.entity.RefundReason;
import com.surplasse.payment.entity.RefundRequest;
import com.surplasse.payment.entity.RefundStatus;
import com.surplasse.payment.provider.RefundProvider;
import com.surplasse.payment.repository.PaymentRefundRepository;
import com.surplasse.payment.repository.PaymentRepository;
import com.surplasse.payment.repository.RefundRequestRepository;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.narayana.jta.TransactionRunnerOptions;
import jakarta.enterprise.event.Event;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

class RefundServiceTest {

    private static final String ACCESS_TOKEN = "access-token";
    private static final UUID RESTAURATEUR = UUID.randomUUID();
    private static final UUID ESTABLISHMENT = UUID.randomUUID();
    private static final UUID ORDER = UUID.randomUUID();
    private static final String CONNECTED_ACCOUNT = "acct_test_restaurant";

    private RestaurateurIdentityGateway identityGateway;
    private OrderGateway orderGateway;
    private PaymentRepository payments;
    private PaymentRefundRepository refunds;
    private RefundRequestRepository requests;
    private RefundProvider provider;
    private Event<PaymentRefunded> paymentRefunded;
    private Event<PaymentRefundFailed> paymentRefundFailed;
    private RefundService service;
    private Payment payment;
    private AtomicReference<PaymentRefund> reservedRefund;
    private MockedStatic<QuarkusTransaction> transactions;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        identityGateway = mock(RestaurateurIdentityGateway.class);
        orderGateway = mock(OrderGateway.class);
        payments = mock(PaymentRepository.class);
        refunds = mock(PaymentRefundRepository.class);
        requests = mock(RefundRequestRepository.class);
        provider = mock(RefundProvider.class);
        paymentRefunded = mock(Event.class);
        paymentRefundFailed = mock(Event.class);
        service = new RefundService(
                identityGateway,
                orderGateway,
                payments,
                refunds,
                requests,
                provider,
                paymentRefunded,
                paymentRefundFailed);

        transactions = Mockito.mockStatic(QuarkusTransaction.class);
        TransactionRunnerOptions runner = mock(TransactionRunnerOptions.class);
        transactions.when(QuarkusTransaction::requiringNew).thenReturn(runner);
        when(runner.call(any())).thenAnswer(invocation -> ((Callable<?>) invocation.getArgument(0)).call());
        doAnswer(invocation -> {
                    ((Runnable) invocation.getArgument(0)).run();
                    return null;
                })
                .when(runner)
                .run(any(Runnable.class));

        payment = new Payment(
                UUID.randomUUID(), ORDER, ESTABLISHMENT, "pi_1", 2250, "EUR", "secret", CONNECTED_ACCOUNT, 22);
        payment.markSucceeded();
        when(identityGateway.authenticate(ACCESS_TOKEN)).thenReturn(RESTAURATEUR);
        when(identityGateway.authorize(ACCESS_TOKEN, ESTABLISHMENT)).thenReturn(RESTAURATEUR);
        when(orderGateway.lockRefundableOrder(ORDER))
                .thenReturn(Optional.of(new OrderGateway.RefundableOrder(ORDER, ESTABLISHMENT, "paid")));
        when(payments.findByOrderForUpdate(ORDER, ESTABLISHMENT)).thenReturn(Optional.of(payment));
        when(payments.findByIdForUpdate(payment.getId())).thenReturn(Optional.of(payment));
        when(refunds.findActiveOrSucceededByPayment(payment.getId())).thenReturn(Optional.empty());
        when(requests.findByIdOptional(any())).thenReturn(Optional.empty());

        reservedRefund = new AtomicReference<>();
        doAnswer(invocation -> {
                    reservedRefund.set(invocation.getArgument(0));
                    return null;
                })
                .when(refunds)
                .persist(any(PaymentRefund.class));
        when(refunds.findByIdForUpdate(any())).thenAnswer(invocation -> Optional.ofNullable(reservedRefund.get()));
        when(provider.createFullRefund(any()))
                .thenReturn(new RefundProvider.RefundRef("re_1", RefundStatus.SUCCEEDED, null));
    }

    @AfterEach
    void tearDown() {
        transactions.close();
    }

    @Test
    void create_paidOrder_refundsFullPaymentAndApplicationFee() {
        UUID idempotencyKey = UUID.randomUUID();

        PaymentRefund refund = service.create(ACCESS_TOKEN, ORDER, RefundReason.RESTAURANT_REFUSAL, idempotencyKey);

        assertEquals(RefundStatus.SUCCEEDED, refund.getStatus());
        assertEquals(2250, refund.getAmountCents());
        assertEquals(22, refund.getApplicationFeeAmount());
        assertEquals(PaymentStatus.REFUNDED, payment.getStatus());
        ArgumentCaptor<RefundProvider.RefundRequest> providerRequest =
                ArgumentCaptor.forClass(RefundProvider.RefundRequest.class);
        verify(provider).createFullRefund(providerRequest.capture());
        assertEquals("pi_1", providerRequest.getValue().paymentIntentId());
        assertEquals(22, providerRequest.getValue().applicationFeeAmount());
        assertEquals(idempotencyKey, providerRequest.getValue().idempotencyKey());
        verify(paymentRefunded).fire(new PaymentRefunded(ORDER, ESTABLISHMENT));
    }

    @Test
    void create_sameKey_replaysTheExactSucceededRefund() {
        UUID idempotencyKey = UUID.randomUUID();
        PaymentRefund existing =
                PaymentRefund.reserve(UUID.randomUUID(), payment, idempotencyKey, RefundReason.RESTAURANT_REFUSAL);
        existing.reconcile("re_existing", RefundStatus.SUCCEEDED, null);
        RefundRequest request = new RefundRequest(
                idempotencyKey, existing.getId(), ORDER, ESTABLISHMENT, RefundReason.RESTAURANT_REFUSAL);
        when(requests.findByIdOptional(idempotencyKey)).thenReturn(Optional.of(request));
        when(refunds.findByIdOptional(existing.getId())).thenReturn(Optional.of(existing));

        PaymentRefund replayed = service.create(ACCESS_TOKEN, ORDER, RefundReason.RESTAURANT_REFUSAL, idempotencyKey);

        assertSame(existing, replayed);
        verify(provider, never()).createFullRefund(any());
    }

    @Test
    void create_sameKeyWithDifferentReason_yieldsIdempotencyConflict() {
        UUID idempotencyKey = UUID.randomUUID();
        PaymentRefund existing =
                PaymentRefund.reserve(UUID.randomUUID(), payment, idempotencyKey, RefundReason.RESTAURANT_REFUSAL);
        when(requests.findByIdOptional(idempotencyKey))
                .thenReturn(Optional.of(new RefundRequest(
                        idempotencyKey, existing.getId(), ORDER, ESTABLISHMENT, RefundReason.RESTAURANT_REFUSAL)));

        ConflictException conflict = assertThrows(
                ConflictException.class,
                () -> service.create(ACCESS_TOKEN, ORDER, RefundReason.SERVICE_INCIDENT, idempotencyKey));

        assertEquals("idempotency-key-conflict", conflict.problemType());
        verify(provider, never()).createFullRefund(any());
    }

    @Test
    void create_newKey_reusesTheActiveRefundWithoutCallingStripeAgain() {
        UUID originalKey = UUID.randomUUID();
        UUID newKey = UUID.randomUUID();
        PaymentRefund existing =
                PaymentRefund.reserve(UUID.randomUUID(), payment, originalKey, RefundReason.RESTAURANT_REFUSAL);
        existing.reconcile("re_existing", RefundStatus.PENDING, null);
        when(refunds.findActiveOrSucceededByPayment(payment.getId())).thenReturn(Optional.of(existing));

        PaymentRefund replayed = service.create(ACCESS_TOKEN, ORDER, RefundReason.SERVICE_INCIDENT, newKey);

        assertSame(existing, replayed);
        ArgumentCaptor<RefundRequest> linkedRequest = ArgumentCaptor.forClass(RefundRequest.class);
        verify(requests).persist(linkedRequest.capture());
        assertEquals(newKey, linkedRequest.getValue().getIdempotencyKey());
        assertEquals(existing.getId(), linkedRequest.getValue().getRefundId());
        verify(provider, never()).createFullRefund(any());
    }

    @Test
    void create_sameKey_retriesTheAmbiguousReservationAgainstStripe() {
        UUID idempotencyKey = UUID.randomUUID();
        PaymentRefund existing =
                PaymentRefund.reserve(UUID.randomUUID(), payment, idempotencyKey, RefundReason.RESTAURANT_REFUSAL);
        when(requests.findByIdOptional(idempotencyKey))
                .thenReturn(Optional.of(new RefundRequest(
                        idempotencyKey, existing.getId(), ORDER, ESTABLISHMENT, RefundReason.RESTAURANT_REFUSAL)));
        when(refunds.findByIdOptional(existing.getId())).thenReturn(Optional.of(existing));
        when(refunds.findByIdForUpdate(existing.getId())).thenReturn(Optional.of(existing));

        PaymentRefund retried = service.create(ACCESS_TOKEN, ORDER, RefundReason.RESTAURANT_REFUSAL, idempotencyKey);

        assertSame(existing, retried);
        assertEquals(RefundStatus.SUCCEEDED, retried.getStatus());
        ArgumentCaptor<RefundProvider.RefundRequest> providerRequest =
                ArgumentCaptor.forClass(RefundProvider.RefundRequest.class);
        verify(provider).createFullRefund(providerRequest.capture());
        assertEquals(idempotencyKey, providerRequest.getValue().idempotencyKey());
        verify(paymentRefunded).fire(new PaymentRefunded(ORDER, ESTABLISHMENT));
    }

    @Test
    void create_servedOrder_yieldsConflictBeforeCallingStripe() {
        when(orderGateway.lockRefundableOrder(ORDER))
                .thenReturn(Optional.of(new OrderGateway.RefundableOrder(ORDER, ESTABLISHMENT, "served")));

        ConflictException conflict = assertThrows(
                ConflictException.class,
                () -> service.create(ACCESS_TOKEN, ORDER, RefundReason.SERVICE_INCIDENT, UUID.randomUUID()));

        assertEquals("order-not-modifiable", conflict.problemType());
        verify(provider, never()).createFullRefund(any());
    }

    @Test
    void create_unreachableStripe_keepsReservationForSafeReplay() {
        when(provider.createFullRefund(any())).thenThrow(new DependencyUnavailableException("Stripe did not answer."));

        assertThrows(
                DependencyUnavailableException.class,
                () -> service.create(ACCESS_TOKEN, ORDER, RefundReason.RESTAURANT_REFUSAL, UUID.randomUUID()));

        assertEquals(RefundStatus.CREATING, reservedRefund.get().getStatus());
        verify(paymentRefunded, never()).fire(any());
    }

    @Test
    void create_providerBusinessRejection_marksAttemptFailedForANewRetry() {
        when(provider.createFullRefund(any())).thenThrow(new BusinessRuleException("Rejected."));

        assertThrows(
                BusinessRuleException.class,
                () -> service.create(ACCESS_TOKEN, ORDER, RefundReason.RESTAURANT_REFUSAL, UUID.randomUUID()));

        assertEquals(RefundStatus.FAILED, reservedRefund.get().getStatus());
        verify(paymentRefunded, never()).fire(any());
        verify(paymentRefundFailed).fire(new PaymentRefundFailed(ORDER, ESTABLISHMENT));
    }
}
