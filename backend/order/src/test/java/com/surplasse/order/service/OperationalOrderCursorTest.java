package com.surplasse.order.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.surplasse.common.error.InvalidRequestException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Base64;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

class OperationalOrderCursorTest {

    private static final UUID ESTABLISHMENT = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");
    private static final UUID ORDER = UUID.fromString("0d9e8c7b-6a5f-4e3d-8c2b-1a0f9e8d7c6b");
    private static final OffsetDateTime CREATED_AT = OffsetDateTime.parse("2026-07-18T14:34:56.123456789+02:00");
    private static final String LEGACY_V1_CURSOR = "AXyeZnl0JUDelEvgf8H5CucAAAAAalty8AdbzRUNnox7al9OPYwrGg-ejXxr";

    @Test
    void encodeThenDecode_validPosition_roundTripsWithoutDependingOnOffset() {
        String encoded = OperationalOrderCursor.encode(ESTABLISHMENT, CREATED_AT, ORDER);

        OperationalOrderCursor.Position decoded = OperationalOrderCursor.decode(encoded, ESTABLISHMENT);

        assertEquals(CREATED_AT.toInstant(), decoded.createdAt().toInstant());
        assertEquals(ORDER, decoded.orderId());
        assertEquals(encoded, OperationalOrderCursor.encode(ESTABLISHMENT, decoded.createdAt(), decoded.orderId()));
        assertTrue(decodedJson(encoded).startsWith("{\"version\":2,"));
    }

    @Test
    void decode_knownLegacyBinaryV1Cursor_preservesItsPosition() {
        OperationalOrderCursor.Position decoded = OperationalOrderCursor.decode(LEGACY_V1_CURSOR, ESTABLISHMENT);

        assertEquals(CREATED_AT.toInstant(), decoded.createdAt().toInstant());
        assertEquals(ORDER, decoded.orderId());
    }

    @Test
    void decode_cursorForAnotherEstablishment_isRejected() {
        String encoded = OperationalOrderCursor.encode(ESTABLISHMENT, CREATED_AT, ORDER);

        assertThrows(
                InvalidRequestException.class,
                () -> OperationalOrderCursor.decode(encoded, UUID.fromString("11111111-1111-4111-8111-111111111111")));
    }

    @ParameterizedTest
    @MethodSource("malformedCursors")
    void decode_malformedCursor_isRejected(String encoded) {
        assertThrows(InvalidRequestException.class, () -> OperationalOrderCursor.decode(encoded, ESTABLISHMENT));
    }

    private static Stream<String> malformedCursors() {
        String valid = OperationalOrderCursor.encode(ESTABLISHMENT, CREATED_AT, ORDER);
        String payload = decodedJson(valid);
        byte[] legacy = Base64.getUrlDecoder().decode(LEGACY_V1_CURSOR);
        byte[] legacyWrongVersion = legacy.clone();
        legacyWrongVersion[0] = 0;
        byte[] legacyTruncated = Arrays.copyOf(legacy, legacy.length - 1);
        return Stream.of(
                "",
                "not+a+base64url+cursor",
                valid + "=",
                Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[] {1, 2, 3}),
                Base64.getUrlEncoder().withoutPadding().encodeToString(legacyWrongVersion),
                Base64.getUrlEncoder().withoutPadding().encodeToString(legacyTruncated),
                encodeJson(payload.replace("\"version\":2", "\"version\":1")),
                encodeJson(payload.replace("\"version\":2", "\"version\":3")),
                encodeJson(payload.replace("\"createdAtNano\":123456789", "\"createdAtNano\":-1")));
    }

    private static String decodedJson(String encoded) {
        return new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8);
    }

    private static String encodeJson(String json) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }
}
