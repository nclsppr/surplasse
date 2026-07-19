package com.surplasse.identity.config;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import java.time.Clock;

final class IdentityClock {

    @Produces
    @ApplicationScoped
    Clock utcClock() {
        return Clock.systemUTC();
    }
}
