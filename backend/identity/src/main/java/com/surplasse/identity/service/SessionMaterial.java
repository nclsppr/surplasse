package com.surplasse.identity.service;

import com.surplasse.identity.entity.Restaurateur;
import java.time.Instant;

record SessionMaterial(
        Restaurateur restaurateur,
        String accessToken,
        String refreshToken,
        Instant accessExpiresAt,
        Instant refreshExpiresAt) {}
