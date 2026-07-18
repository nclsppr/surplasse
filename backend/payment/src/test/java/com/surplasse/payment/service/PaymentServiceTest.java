package com.surplasse.payment.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.common.catalog.CatalogGateway;
import com.surplasse.common.error.ConflictException;
import com.surplasse.common.error.NotFoundException;
import com.surplasse.common.order.OrderGateway;
import com.surplasse.payment.entity.Payment;
import com.surplasse.payment.provider.PaymentProvider;
import com.surplasse.payment.repository.PaymentRepository;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.narayana.jta.TransactionRunnerOptions;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

class PaymentServiceTest {

    private static final UUID ESTABLISHMENT = UUID.randomUUID();
    private static final UUID ORDER = UUID.randomUUID();
    private static final UUID PRODUCT = UUID.randomUUID();

    private PaymentRepository paymentRepository;
    private OrderGateway orderGateway;
    private CatalogGateway catalogGateway;
    private PaymentProvider paymentProvider;
    private PaymentService service;
    private MockedStatic<QuarkusTransaction> transactions;

    @BeforeEach
    void setUp() {
        paymentRepository = mock(PaymentRepository.class);
        orderGateway = mock(OrderGateway.class);
        catalogGateway = mock(CatalogGateway.class);
        paymentProvider = mock(PaymentProvider.class);
        service = new PaymentService(paymentRepository, orderGateway, catalogGateway, paymentProvider);

        transactions = Mockito.mockStatic(QuarkusTransaction.class);
        TransactionRunnerOptions runner = mock(TransactionRunnerOptions.class);
        transactions.when(QuarkusTransaction::requiringNew).thenReturn(runner);
        when(runner.call(any())).thenAnswer(invocation -> ((Callable<?>) invocation.getArgument(0)).call());

        when(paymentRepository.findPendingByOrder(ORDER)).thenReturn(Optional.empty());
        when(orderGateway.payableOrder(ORDER, ESTABLISHMENT))
                .thenReturn(Optional.of(new OrderGateway.PayableOrder(
                        ORDER, ESTABLISHMENT, "pending_payment", 2250, "EUR", List.of(PRODUCT))));
        when(catalogGateway.priceProducts(any(), anyCollection()))
                .thenReturn(
                        Map.of(PRODUCT, new CatalogGateway.ProductPricing(PRODUCT, "Burger", 1600, true, List.of())));
        when(paymentProvider.createIntent(ORDER, 2250, "EUR"))
                .thenReturn(new PaymentProvider.PaymentIntentRef("pi_1", "pi_1_secret"));
    }

    @AfterEach
    void tearDown() {
        transactions.close();
    }

    @Test
    void createSession_pendingOrder_createsTheIntentWithTheRecomputedAmount() {
        Payment payment = service.createSession(ESTABLISHMENT, ORDER);

        assertEquals(2250, payment.getAmountCents());
        assertEquals("pi_1", payment.getExternalReference());
        assertEquals("pi_1_secret", payment.getClientSecret());
        verify(paymentRepository).persist(payment);
    }

    @Test
    void createSession_replay_returnsThePendingAttemptWithoutCallingStripe() {
        Payment pending = new Payment(UUID.randomUUID(), ORDER, ESTABLISHMENT, "pi_0", 2250, "EUR", "pi_0_secret");
        when(paymentRepository.findPendingByOrder(ORDER)).thenReturn(Optional.of(pending));

        Payment payment = service.createSession(ESTABLISHMENT, ORDER);

        assertSame(pending, payment);
        verify(paymentProvider, never()).createIntent(any(), Mockito.anyInt(), any());
    }

    @Test
    void createSession_unknownOrder_yields404() {
        when(orderGateway.payableOrder(ORDER, ESTABLISHMENT)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.createSession(ESTABLISHMENT, ORDER));
    }

    @Test
    void createSession_alreadyPaidOrder_yieldsOrderNotModifiable() {
        when(orderGateway.payableOrder(ORDER, ESTABLISHMENT))
                .thenReturn(Optional.of(
                        new OrderGateway.PayableOrder(ORDER, ESTABLISHMENT, "paid", 2250, "EUR", List.of(PRODUCT))));

        ConflictException conflict =
                assertThrows(ConflictException.class, () -> service.createSession(ESTABLISHMENT, ORDER));
        assertEquals("order-not-modifiable", conflict.problemType());
    }

    @Test
    void createSession_productBecameUnavailable_blocksBeforeAnyDebit() {
        when(catalogGateway.priceProducts(any(), anyCollection()))
                .thenReturn(
                        Map.of(PRODUCT, new CatalogGateway.ProductPricing(PRODUCT, "Burger", 1600, false, List.of())));

        ConflictException conflict =
                assertThrows(ConflictException.class, () -> service.createSession(ESTABLISHMENT, ORDER));
        assertEquals("product-unavailable", conflict.problemType());
        verify(paymentProvider, never()).createIntent(any(), Mockito.anyInt(), any());
    }
}
