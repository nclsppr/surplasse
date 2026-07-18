package com.surplasse.order.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;

/** Opaque token generation and hashing for sessions and tracking capabilities. */
public final class Tokens {

    private static final SecureRandom RANDOM = new SecureRandom();

    private Tokens() {}

    /** A new opaque token: prefix followed by 32 hex characters of secure randomness. */
    public static String newToken(String prefix) {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return prefix + HexFormat.of().formatHex(bytes);
    }

    public static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by the JVM specification", e);
        }
    }

    /** Constant-time comparison, for capabilities stored in clear. */
    public static boolean matches(String expected, String candidate) {
        if (expected == null || candidate == null) {
            return false;
        }
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8), candidate.getBytes(StandardCharsets.UTF_8));
    }
}
