package com.surplasse.order.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.surplasse.common.error.InvalidRequestException;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;

/** Versioned opaque keyset cursor, bound to one establishment. */
final class OperationalOrderCursor {

    private static final byte LEGACY_BINARY_VERSION = 1;
    private static final int LEGACY_PAYLOAD_BYTES = Byte.BYTES + Long.BYTES * 5 + Integer.BYTES;
    private static final int JSON_VERSION = 2;
    private static final int MAX_ENCODED_LENGTH = 512;
    private static final ObjectMapper JSON = new ObjectMapper().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

    private OperationalOrderCursor() {}

    static String encode(UUID establishmentId, OffsetDateTime createdAt, UUID orderId) {
        Instant instant = createdAt.toInstant();
        return encodePayload(
                new Payload(JSON_VERSION, establishmentId, instant.getEpochSecond(), instant.getNano(), orderId));
    }

    static Position decode(String encoded, UUID expectedEstablishmentId) {
        if (encoded == null || encoded.isBlank() || encoded.length() > MAX_ENCODED_LENGTH) {
            throw invalid();
        }
        try {
            byte[] bytes = Base64.getUrlDecoder().decode(encoded);
            if (!Base64.getUrlEncoder().withoutPadding().encodeToString(bytes).equals(encoded)) {
                throw invalid();
            }
            if (bytes.length == LEGACY_PAYLOAD_BYTES && bytes[0] == LEGACY_BINARY_VERSION) {
                return decodeLegacy(bytes, expectedEstablishmentId);
            }
            Payload payload = JSON.readValue(bytes, Payload.class);
            if (!encodePayload(payload).equals(encoded) || payload.version() != JSON_VERSION) {
                throw invalid();
            }
            return position(
                    payload.establishmentId(),
                    payload.createdAtEpochSecond(),
                    payload.createdAtNano(),
                    payload.orderId(),
                    expectedEstablishmentId);
        } catch (IOException | IllegalArgumentException | DateTimeException exception) {
            throw invalid();
        }
    }

    private static Position decodeLegacy(byte[] bytes, UUID expectedEstablishmentId) {
        ByteBuffer payload = ByteBuffer.wrap(bytes);
        payload.get();
        UUID establishmentId = readUuid(payload);
        long createdAtEpochSecond = payload.getLong();
        int createdAtNano = payload.getInt();
        UUID orderId = readUuid(payload);
        return position(establishmentId, createdAtEpochSecond, createdAtNano, orderId, expectedEstablishmentId);
    }

    private static Position position(
            UUID establishmentId,
            long createdAtEpochSecond,
            int createdAtNano,
            UUID orderId,
            UUID expectedEstablishmentId) {
        if (!expectedEstablishmentId.equals(establishmentId)
                || orderId == null
                || createdAtNano < 0
                || createdAtNano > 999_999_999) {
            throw invalid();
        }
        OffsetDateTime createdAt =
                OffsetDateTime.ofInstant(Instant.ofEpochSecond(createdAtEpochSecond, createdAtNano), ZoneOffset.UTC);
        return new Position(createdAt, orderId);
    }

    private static UUID readUuid(ByteBuffer payload) {
        return new UUID(payload.getLong(), payload.getLong());
    }

    private static String encodePayload(Payload payload) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(JSON.writeValueAsBytes(payload));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("The pagination cursor could not be encoded.", exception);
        }
    }

    private static InvalidRequestException invalid() {
        return new InvalidRequestException("The pagination cursor is malformed or incompatible with this request.");
    }

    private record Payload(
            int version, UUID establishmentId, long createdAtEpochSecond, int createdAtNano, UUID orderId) {}

    record Position(OffsetDateTime createdAt, UUID orderId) {}
}
