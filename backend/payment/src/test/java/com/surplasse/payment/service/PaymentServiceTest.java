package com.surplasse.payment.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.common.catalog.CatalogGateway;
import com.surplasse.common.error.BusinessRuleException;
import com.surplasse.common.error.ConflictException;
import com.surplasse.common.error.NotFoundException;
import com.surplasse.common.order.OrderGateway;
import com.surplasse.payment.entity.Payment;
import com.surplasse.payment.entity.PaymentRequest;
import com.surplasse.payment.provider.PaymentProvider;
import com.surplasse.payment.repository.PaymentRepository;
import com.surplasse.payment.repository.PaymentRequestRepository;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.narayana.jta.TransactionRunnerOptions;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
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

class PaymentServiceTest {

    private static final UUID ESTABLISHMENT = UUID.randomUUID();
    private static final UUID TABLE_SESSION = UUID.randomUUID();
    private static final UUID TABLE_QR = UUID.randomUUID();
    private static final UUID ORDER = UUID.randomUUID();
    private static final UUID PRODUCT = UUID.randomUUID();
    private static final String CONNECTED_ACCOUNT = "acct_test_restaurant";
    private static final OrderGateway.ActiveTableSession SESSION =
            new OrderGateway.ActiveTableSession(TABLE_SESSION, ESTABLISHMENT, TABLE_QR);

    private PaymentRepository paymentRepository;
    private OrderGateway orderGateway;
    private CatalogGateway catalogGateway;
    private PaymentProvider paymentProvider;
    private PaymentRequestRepository paymentRequestRepository;
    private PaymentService service;
    private MockedStatic<QuarkusTransaction> transactions;
    private AtomicReference<Payment> reservedPayment;

    @BeforeEach
    void setUp() {
        paymentRepository = mock(PaymentRepository.class);
        orderGateway = mock(OrderGateway.class);
        catalogGateway = mock(CatalogGateway.class);
        paymentProvider = mock(PaymentProvider.class);
        paymentRequestRepository = mock(PaymentRequestRepository.class);
        service = new PaymentService(
                paymentRepository, orderGateway, catalogGateway, paymentProvider, paymentRequestRepository);

        transactions = Mockito.mockStatic(QuarkusTransaction.class);
        TransactionRunnerOptions runner = mock(TransactionRunnerOptions.class);
        transactions.when(QuarkusTransaction::requiringNew).thenReturn(runner);
        when(runner.call(any())).thenAnswer(invocation -> ((Callable<?>) invocation.getArgument(0)).call());

        reservedPayment = new AtomicReference<>();
        doAnswer(invocation -> {
                    reservedPayment.set(invocation.getArgument(0));
                    return null;
                })
                .when(paymentRepository)
                .persist(any(Payment.class));
        when(paymentRepository.findByIdForUpdate(any()))
                .thenAnswer(invocation -> Optional.ofNullable(reservedPayment.get()));

        when(paymentRequestRepository.findByIdOptional(any())).thenReturn(Optional.empty());
        when(paymentRepository.findReusableByOrder(ORDER, ESTABLISHMENT)).thenReturn(Optional.empty());
        when(orderGateway.lockPayableOrder(ORDER, TABLE_SESSION))
                .thenReturn(Optional.of(new OrderGateway.PayableOrder(
                        ORDER, ESTABLISHMENT, "pending_payment", 2250, "EUR", List.of(PRODUCT))));
        when(catalogGateway.priceProducts(any(), anyCollection()))
                .thenReturn(
                        Map.of(PRODUCT, new CatalogGateway.ProductPricing(PRODUCT, "Burger", 1600, true, List.of())));
        when(catalogGateway.findPaymentRouting(ESTABLISHMENT))
                .thenReturn(Optional.of(new CatalogGateway.PaymentRouting(
                        CONNECTED_ACCOUNT,
                        true,
                        true,
                        OffsetDateTime.now(ZoneOffset.UTC).minusMonths(1))));
        when(paymentProvider.createIntent(any()))
                .thenReturn(new PaymentProvider.PaymentIntentRef("pi_1", "pi_1_secret"));
    }

    @AfterEach
    void tearDown() {
        transactions.close();
    }

    @Test
    void createSession_pendingOrder_createsTheIntentWithTheRecomputedAmount() {
        UUID idempotencyKey = UUID.randomUUID();

        Payment payment = service.createSession(SESSION, ORDER, idempotencyKey);

        assertEquals(2250, payment.getAmountCents());
        assertEquals("pi_1", payment.getExternalReference());
        assertEquals("pi_1_secret", payment.getClientSecret());
        assertEquals(CONNECTED_ACCOUNT, payment.getConnectedAccountId());
        assertEquals(0, payment.getApplicationFeeAmount());
        verify(paymentRepository).persist(payment);
        ArgumentCaptor<PaymentRequest> request = ArgumentCaptor.forClass(PaymentRequest.class);
        verify(paymentRequestRepository).persist(request.capture());
        assertEquals(idempotencyKey, request.getValue().getIdempotencyKey());
        assertEquals(payment.getId(), request.getValue().getPaymentId());
        assertEquals(ORDER, request.getValue().getOrderId());
        assertEquals(ESTABLISHMENT, request.getValue().getEstablishmentId());
        assertEquals(TABLE_SESSION, request.getValue().getTableSessionId());
        ArgumentCaptor<PaymentProvider.PaymentIntentRequest> intent =
                ArgumentCaptor.forClass(PaymentProvider.PaymentIntentRequest.class);
        verify(paymentProvider).createIntent(intent.capture());
        assertEquals(payment.getId(), intent.getValue().paymentId());
        assertEquals(CONNECTED_ACCOUNT, intent.getValue().connectedAccountId());
        assertEquals(0, intent.getValue().applicationFeeAmount());
        assertEquals(idempotencyKey, intent.getValue().idempotencyKey());
    }

    @Test
    void createSession_replay_returnsThePendingAttemptWithoutCallingStripe() {
        Payment pending = new Payment(
                UUID.randomUUID(), ORDER, ESTABLISHMENT, "pi_0", 2250, "EUR", "pi_0_secret", CONNECTED_ACCOUNT, 0);
        when(paymentRepository.findReusableByOrder(ORDER, ESTABLISHMENT)).thenReturn(Optional.of(pending));

        Payment payment = service.createSession(SESSION, ORDER, UUID.randomUUID());

        assertSame(pending, payment);
        verify(paymentProvider, never()).createIntent(any());
    }

    @Test
    void createSession_legacyFailedAttempt_remainsReusable() {
        Payment failed = new Payment(
                UUID.randomUUID(), ORDER, ESTABLISHMENT, "pi_0", 2250, "EUR", "pi_0_secret", CONNECTED_ACCOUNT, 0);
        failed.markFailed();
        when(paymentRepository.findReusableByOrder(ORDER, ESTABLISHMENT)).thenReturn(Optional.of(failed));

        Payment payment = service.createSession(SESSION, ORDER, UUID.randomUUID());

        assertSame(failed, payment);
        verify(paymentProvider, never()).createIntent(any());
    }

    @Test
    void createSession_inconsistentSettledAttempt_neverCreatesAnotherIntent() {
        when(paymentRepository.existsByOrder(ORDER, ESTABLISHMENT)).thenReturn(true);

        ConflictException conflict =
                assertThrows(ConflictException.class, () -> service.createSession(SESSION, ORDER, UUID.randomUUID()));

        assertEquals("order-not-modifiable", conflict.problemType());
        verify(paymentProvider, never()).createIntent(any());
    }

    @Test
    void createSession_creatingReplay_rechecksAvailabilityBeforeStripe() {
        UUID idempotencyKey = UUID.randomUUID();
        Payment creating = Payment.reserve(
                UUID.randomUUID(), ORDER, ESTABLISHMENT, 2250, "EUR", idempotencyKey, CONNECTED_ACCOUNT, 0);
        when(paymentRequestRepository.findByIdOptional(idempotencyKey))
                .thenReturn(Optional.of(
                        new PaymentRequest(idempotencyKey, creating.getId(), ORDER, ESTABLISHMENT, TABLE_SESSION)));
        when(paymentRepository.findByIdOptional(creating.getId())).thenReturn(Optional.of(creating));
        when(catalogGateway.priceProducts(any(), anyCollection()))
                .thenReturn(
                        Map.of(PRODUCT, new CatalogGateway.ProductPricing(PRODUCT, "Burger", 1600, false, List.of())));

        ConflictException conflict =
                assertThrows(ConflictException.class, () -> service.createSession(SESSION, ORDER, idempotencyKey));

        assertEquals("product-unavailable", conflict.problemType());
        verify(paymentProvider, never()).createIntent(any());
    }

    @Test
    void createSession_sameKey_returnsTheOriginalAttemptAfterItsOrderAdvanced() {
        UUID idempotencyKey = UUID.randomUUID();
        Payment original = new Payment(
                UUID.randomUUID(), ORDER, ESTABLISHMENT, "pi_0", 2250, "EUR", "pi_0_secret", CONNECTED_ACCOUNT, 0);
        original.markSucceeded();
        when(paymentRequestRepository.findByIdOptional(idempotencyKey))
                .thenReturn(Optional.of(
                        new PaymentRequest(idempotencyKey, original.getId(), ORDER, ESTABLISHMENT, TABLE_SESSION)));
        when(paymentRepository.findByIdOptional(original.getId())).thenReturn(Optional.of(original));

        Payment payment = service.createSession(SESSION, ORDER, idempotencyKey);

        assertSame(original, payment);
        verify(orderGateway, never()).lockPayableOrder(any(), any());
        verify(paymentProvider, never()).createIntent(any());
    }

    @Test
    void createSession_sameKeyWithAnotherOrder_yieldsIdempotencyConflict() {
        UUID idempotencyKey = UUID.randomUUID();
        UUID otherOrder = UUID.randomUUID();
        when(paymentRequestRepository.findByIdOptional(idempotencyKey))
                .thenReturn(Optional.of(new PaymentRequest(
                        idempotencyKey, UUID.randomUUID(), otherOrder, ESTABLISHMENT, TABLE_SESSION)));

        ConflictException conflict =
                assertThrows(ConflictException.class, () -> service.createSession(SESSION, ORDER, idempotencyKey));

        assertEquals("idempotency-key-conflict", conflict.problemType());
        verify(paymentProvider, never()).createIntent(any());
    }

    @Test
    void createSession_sameKeyFromAnotherTableSession_yieldsIdempotencyConflict() {
        UUID idempotencyKey = UUID.randomUUID();
        when(paymentRequestRepository.findByIdOptional(idempotencyKey))
                .thenReturn(Optional.of(
                        new PaymentRequest(idempotencyKey, UUID.randomUUID(), ORDER, ESTABLISHMENT, TABLE_SESSION)));
        OrderGateway.ActiveTableSession otherSession =
                new OrderGateway.ActiveTableSession(UUID.randomUUID(), ESTABLISHMENT, TABLE_QR);

        ConflictException conflict =
                assertThrows(ConflictException.class, () -> service.createSession(otherSession, ORDER, idempotencyKey));

        assertEquals("idempotency-key-conflict", conflict.problemType());
        verify(paymentProvider, never()).createIntent(any());
    }

    @Test
    void createSession_pendingOrderOfAnotherTableSession_isNeverReturned() {
        UUID otherEstablishment = UUID.randomUUID();
        Payment foreign = new Payment(
                UUID.randomUUID(),
                ORDER,
                otherEstablishment,
                "pi_foreign",
                2250,
                "EUR",
                "foreign_secret",
                "acct_test_foreign",
                0);
        when(orderGateway.lockPayableOrder(ORDER, TABLE_SESSION)).thenReturn(Optional.empty());
        when(paymentRepository.findReusableByOrder(ORDER, otherEstablishment)).thenReturn(Optional.of(foreign));

        assertThrows(NotFoundException.class, () -> service.createSession(SESSION, ORDER, UUID.randomUUID()));

        verify(paymentRepository, never()).findReusableByOrder(ORDER, otherEstablishment);
        verify(paymentProvider, never()).createIntent(any());
    }

    @Test
    void createSession_unknownOrder_yields404() {
        when(orderGateway.lockPayableOrder(ORDER, TABLE_SESSION)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.createSession(SESSION, ORDER, UUID.randomUUID()));
    }

    @Test
    void createSession_alreadyPaidOrder_yieldsOrderNotModifiable() {
        when(orderGateway.lockPayableOrder(ORDER, TABLE_SESSION))
                .thenReturn(Optional.of(
                        new OrderGateway.PayableOrder(ORDER, ESTABLISHMENT, "paid", 2250, "EUR", List.of(PRODUCT))));

        ConflictException conflict =
                assertThrows(ConflictException.class, () -> service.createSession(SESSION, ORDER, UUID.randomUUID()));
        assertEquals("order-not-modifiable", conflict.problemType());
    }

    @Test
    void createSession_productBecameUnavailable_blocksBeforeAnyDebit() {
        when(catalogGateway.priceProducts(any(), anyCollection()))
                .thenReturn(
                        Map.of(PRODUCT, new CatalogGateway.ProductPricing(PRODUCT, "Burger", 1600, false, List.of())));

        ConflictException conflict =
                assertThrows(ConflictException.class, () -> service.createSession(SESSION, ORDER, UUID.randomUUID()));
        assertEquals("product-unavailable", conflict.problemType());
        verify(paymentProvider, never()).createIntent(any());
    }

    @Test
    void createSession_missingConnectedAccount_failsClosedBeforeStripe() {
        when(catalogGateway.findPaymentRouting(ESTABLISHMENT)).thenReturn(Optional.empty());

        BusinessRuleException failure = assertThrows(
                BusinessRuleException.class, () -> service.createSession(SESSION, ORDER, UUID.randomUUID()));

        assertEquals("business-rule-violation", failure.problemType());
        verify(paymentProvider, never()).createIntent(any());
    }

    @Test
    void createSession_disabledCharges_failsClosedBeforeStripe() {
        when(catalogGateway.findPaymentRouting(ESTABLISHMENT))
                .thenReturn(Optional.of(new CatalogGateway.PaymentRouting(
                        CONNECTED_ACCOUNT,
                        false,
                        true,
                        OffsetDateTime.now(ZoneOffset.UTC).minusMonths(1))));

        assertThrows(BusinessRuleException.class, () -> service.createSession(SESSION, ORDER, UUID.randomUUID()));

        verify(paymentProvider, never()).createIntent(any());
    }

    @Test
    void createSession_pendingAttemptAfterChargesDisabled_doesNotReturnItsClientSecret() {
        Payment pending = new Payment(
                UUID.randomUUID(), ORDER, ESTABLISHMENT, "pi_0", 2250, "EUR", "pi_0_secret", CONNECTED_ACCOUNT, 0);
        when(paymentRepository.findReusableByOrder(ORDER, ESTABLISHMENT)).thenReturn(Optional.of(pending));
        when(catalogGateway.findPaymentRouting(ESTABLISHMENT))
                .thenReturn(Optional.of(new CatalogGateway.PaymentRouting(
                        CONNECTED_ACCOUNT,
                        false,
                        true,
                        OffsetDateTime.now(ZoneOffset.UTC).minusMonths(1))));

        assertThrows(BusinessRuleException.class, () -> service.createSession(SESSION, ORDER, UUID.randomUUID()));

        verify(paymentProvider, never()).createIntent(any());
    }

    @Test
    void createSession_pendingAttemptAfterAccountChanged_doesNotReturnTheOldAccount() {
        Payment pending = new Payment(
                UUID.randomUUID(), ORDER, ESTABLISHMENT, "pi_0", 2250, "EUR", "pi_0_secret", CONNECTED_ACCOUNT, 0);
        when(paymentRepository.findReusableByOrder(ORDER, ESTABLISHMENT)).thenReturn(Optional.of(pending));
        when(catalogGateway.findPaymentRouting(ESTABLISHMENT))
                .thenReturn(Optional.of(new CatalogGateway.PaymentRouting(
                        "acct_test_replacement",
                        true,
                        true,
                        OffsetDateTime.now(ZoneOffset.UTC).minusMonths(1))));

        assertThrows(BusinessRuleException.class, () -> service.createSession(SESSION, ORDER, UUID.randomUUID()));

        verify(paymentProvider, never()).createIntent(any());
    }

    @Test
    void createSession_afterFreePeriod_snapshotsOnePercentRoundedDown() {
        when(catalogGateway.findPaymentRouting(ESTABLISHMENT))
                .thenReturn(Optional.of(new CatalogGateway.PaymentRouting(
                        CONNECTED_ACCOUNT,
                        true,
                        true,
                        OffsetDateTime.now(ZoneOffset.UTC).minusMonths(4))));

        Payment payment = service.createSession(SESSION, ORDER, UUID.randomUUID());

        assertEquals(22, payment.getApplicationFeeAmount());
        ArgumentCaptor<PaymentProvider.PaymentIntentRequest> intent =
                ArgumentCaptor.forClass(PaymentProvider.PaymentIntentRequest.class);
        verify(paymentProvider).createIntent(intent.capture());
        assertEquals(22, intent.getValue().applicationFeeAmount());
    }
}
