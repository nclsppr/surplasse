package com.surplasse.identity.service;

import com.surplasse.identity.repository.MagicLinkSessionRepository;
import com.surplasse.identity.repository.RefreshSessionRepository;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.Instant;

@ApplicationScoped
public class IdentityCleanupJob {

    private final MagicLinkSessionRepository magicLinks;
    private final RefreshSessionRepository refreshSessions;
    private final MagicLinkRateLimiter rateLimiter;
    private final Clock clock;

    IdentityCleanupJob(
            MagicLinkSessionRepository magicLinks,
            RefreshSessionRepository refreshSessions,
            MagicLinkRateLimiter rateLimiter,
            Clock clock) {
        this.magicLinks = magicLinks;
        this.refreshSessions = refreshSessions;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
    }

    @Scheduled(every = "1h", delayed = "5m")
    @Transactional
    void purgeExpiredSessions() {
        Instant now = clock.instant();
        magicLinks.deleteExpiredBefore(now);
        refreshSessions.deleteExpiredBefore(now);
        rateLimiter.prune(now);
    }
}
