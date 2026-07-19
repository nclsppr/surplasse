package com.surplasse.order.service;

import com.surplasse.common.error.InvalidRequestException;
import java.nio.ByteBuffer;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;

/** Versioned opaque keyset cursor, bound to one establishment. */
final class OperationalOrderCursor {

    private static final byte VERSION = 1;
    private static final int PAYLOAD_BYTES = Byte.BYTES + Long.BYTES * 2 + Long.BYTES + Integer.BYTES + Long.BYTES * 2;
    private static final int MAX_ENCODED_LENGTH = 512;

    private OperationalOrderCursor() {}

    static String encode(UUID establishmentId, OffsetDateTime createdAt, UUID orderId) {
        Instant instant = createdAt.toInstant();
        ByteBuffer payload = ByteBuffer.allocate(PAYLOAD_BYTES);
        payload.put(VERSION);
        putUuid(payload, establishmentId);
        payload.putLong(instant.getEpochSecond());
        payload.putInt(instant.getNano());
        putUuid(payload, orderId);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(payload.array());
    }

    static Position decode(String encoded, UUID expectedEstablishmentId) {
        if (encoded == null || encoded.isBlank() || encoded.length() > MAX_ENCODED_LENGTH) {
            throw invalid();
        }
        try {
            byte[] bytes = Base64.getUrlDecoder().decode(encoded);
            if (bytes.length != PAYLOAD_BYTES
                    || !Base64.getUrlEncoder()
                            .withoutPadding()
                            .encodeToString(bytes)
                            .equals(encoded)) {
                throw invalid();
            }
            ByteBuffer payload = ByteBuffer.wrap(bytes);
            if (payload.get() != VERSION) {
                throw invalid();
            }
            UUID establishmentId = getUuid(payload);
            long epochSecond = payload.getLong();
            int nano = payload.getInt();
            UUID orderId = getUuid(payload);
            if (!establishmentId.equals(expectedEstablishmentId) || nano < 0 || nano > 999_999_999) {
                throw invalid();
            }
            OffsetDateTime createdAt =
                    OffsetDateTime.ofInstant(Instant.ofEpochSecond(epochSecond, nano), ZoneOffset.UTC);
            return new Position(createdAt, orderId);
        } catch (IllegalArgumentException | DateTimeException | java.nio.BufferUnderflowException exception) {
            throw invalid();
        }
    }

    private static void putUuid(ByteBuffer payload, UUID value) {
        payload.putLong(value.getMostSignificantBits());
        payload.putLong(value.getLeastSignificantBits());
    }

    private static UUID getUuid(ByteBuffer payload) {
        return new UUID(payload.getLong(), payload.getLong());
    }

    private static InvalidRequestException invalid() {
        return new InvalidRequestException("The pagination cursor is malformed or incompatible with this request.");
    }

    record Position(OffsetDateTime createdAt, UUID orderId) {}
}
