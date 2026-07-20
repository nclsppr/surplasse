package com.surplasse.common.config;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import java.time.Clock;

/** Single injectable wall clock shared by every backend domain. */
final class UtcClock {

    @Produces
    @ApplicationScoped
    Clock utcClock() {
        return Clock.systemUTC();
    }
}
