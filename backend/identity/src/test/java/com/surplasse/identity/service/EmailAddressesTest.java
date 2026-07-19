package com.surplasse.identity.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.surplasse.common.error.InvalidRequestException;
import org.junit.jupiter.api.Test;

class EmailAddressesTest {

    @Test
    void normalize_mixedCaseWhitespaceAndDecomposedUnicode_returnsCanonicalAddress() {
        String normalized = EmailAddresses.normalize("  PRE\u0301NOM@EXAMPLE.COM  ");

        assertEquals("prénom@example.com", normalized);
    }

    @Test
    void normalize_nullAddress_throwsValidationError() {
        InvalidRequestException exception =
                assertThrows(InvalidRequestException.class, () -> EmailAddresses.normalize(null));

        assertEquals(400, exception.status());
        assertEquals("validation-error", exception.problemType());
    }

    @Test
    void normalize_addressWithoutDomainDot_throwsValidationError() {
        assertThrows(InvalidRequestException.class, () -> EmailAddresses.normalize("camille@localhost"));
    }

    @Test
    void normalize_addressContainingWhitespace_throwsValidationError() {
        assertThrows(InvalidRequestException.class, () -> EmailAddresses.normalize("camille martin@example.com"));
    }

    @Test
    void normalize_addressLongerThanMaximum_throwsValidationError() {
        String address = "a".repeat(309) + "@example.com";

        assertThrows(InvalidRequestException.class, () -> EmailAddresses.normalize(address));
    }
}
