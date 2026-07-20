package com.surplasse.payment.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

class CommissionPolicyTest {

    private static final OffsetDateTime ACTIVATED_AT = OffsetDateTime.parse("2026-01-31T12:00:00Z");

    @Test
    void applicationFeeAmount_beforeThreeCalendarMonths_isFree() {
        assertEquals(
                0,
                CommissionPolicy.applicationFeeAmount(
                        2250, ACTIVATED_AT, OffsetDateTime.parse("2026-04-30T11:59:59Z")));
    }

    @Test
    void applicationFeeAmount_atThreeCalendarMonths_chargesOnePercentRoundedDown() {
        assertEquals(
                22,
                CommissionPolicy.applicationFeeAmount(
                        2250, ACTIVATED_AT, OffsetDateTime.parse("2026-04-30T12:00:00Z")));
    }

    @Test
    void applicationFeeAmount_exactEuroAmount_isExact() {
        assertEquals(
                10,
                CommissionPolicy.applicationFeeAmount(
                        1000, ACTIVATED_AT, OffsetDateTime.parse("2026-05-01T00:00:00Z")));
    }
}
