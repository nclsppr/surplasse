package com.surplasse.identity.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import java.net.URI;
import java.time.Duration;

@ConfigMapping(prefix = "surplasse.identity")
public interface IdentityConfig {

    @WithDefault("PT15M")
    Duration magicLinkTtl();

    @WithDefault("PT15M")
    Duration accessTokenTtl();

    @WithDefault("P30D")
    Duration refreshTokenTtl();

    URI magicLinkLandingUrl();

    @WithDefault("true")
    boolean secureCookies();

    String jwtIssuer();

    @WithDefault("surplasse-dashboard")
    String jwtAudience();

    RateLimit rateLimit();

    interface RateLimit {

        @WithDefault("PT15M")
        Duration window();

        @WithDefault("5")
        int maxPerEmail();

        @WithDefault("20")
        int maxPerIp();
    }
}
