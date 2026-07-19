package com.surplasse.identity.service;

import com.surplasse.identity.config.IdentityConfig;
import com.surplasse.identity.entity.MagicLinkSession;
import com.surplasse.identity.entity.Restaurateur;
import com.surplasse.identity.repository.MagicLinkSessionRepository;
import com.surplasse.identity.repository.RestaurateurRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.net.URI;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class MagicLinkIssuer {

    private final RestaurateurRepository restaurateurs;
    private final MagicLinkSessionRepository magicLinks;
    private final IdentityConfig config;

    MagicLinkIssuer(
            RestaurateurRepository restaurateurs, MagicLinkSessionRepository magicLinks, IdentityConfig config) {
        this.restaurateurs = restaurateurs;
        this.magicLinks = magicLinks;
        this.config = config;
    }

    @Transactional
    public Optional<MagicLinkDelivery> issue(String normalizedEmail, Instant now) {
        Optional<Restaurateur> account = restaurateurs.findByEmailForUpdate(normalizedEmail);
        if (account.isEmpty()) {
            return Optional.empty();
        }

        Restaurateur restaurateur = account.orElseThrow();
        magicLinks.invalidateUnused(restaurateur.getId(), now);

        String token = Tokens.randomOpaqueToken();
        MagicLinkSession session = new MagicLinkSession(
                UUID.randomUUID(), restaurateur.getId(), Tokens.sha256(token), now.plus(config.magicLinkTtl()), now);
        magicLinks.persist(session);

        return Optional.of(new MagicLinkDelivery(session.getId(), restaurateur.getEmail(), loginUrl(token)));
    }

    private URI loginUrl(String token) {
        String base = config.magicLinkLandingUrl().toASCIIString();
        return URI.create(base + (base.contains("?") ? "&" : "?") + "token=" + token);
    }
}
