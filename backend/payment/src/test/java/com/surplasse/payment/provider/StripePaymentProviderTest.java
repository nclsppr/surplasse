package com.surplasse.payment.provider;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.stripe.net.RequestOptions;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StripePaymentProviderTest {

    @Test
    void requestOptions_creationIsIdempotentAcrossBoundedNetworkRetries() {
        UUID idempotencyKey = UUID.randomUUID();

        RequestOptions options = StripePaymentProvider.requestOptions(idempotencyKey);

        assertEquals(idempotencyKey.toString(), options.getIdempotencyKey());
        assertEquals(2, options.getMaxNetworkRetries());
    }
}
