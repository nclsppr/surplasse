package com.surplasse.catalog.service;

import java.util.Locale;

public enum OrderIntakeBlockReason {
    PAUSED,
    ESTABLISHMENT_NOT_ACTIVE,
    CONFIGURATION_UNAVAILABLE,
    PAYMENTS_UNAVAILABLE;

    public String apiValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
