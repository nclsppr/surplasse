package com.surplasse.application;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.MockMailbox;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.locks.LockSupport;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/** End-to-end passwordless flow through email, database, JWT and cookie rotation. */
@QuarkusTest
class IdentityFlowTest {

    private static final String PILOT_EMAIL = "pilote@le-cormoran.example";
    private static final String ACCESS_COOKIE = "surplasse_session";
    private static final String REFRESH_COOKIE = "surplasse_refresh";
    private static final String PROBLEM_JSON = "application/problem+json";
    private static final Pattern TOKEN = Pattern.compile("[?&]token=([A-Za-z0-9_-]{43,128})");

    @Inject
    MockMailbox mailbox;

    @Test
    void passwordlessFlow_hidesAccounts_rotatesTokens_andRevokesReplay() {
        mailbox.clear();

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .body("{\"email\":\"personne@inconnue.example\"}")
                .when()
                .post("/v1/auth/magic-links")
                .then()
                .statusCode(202);
        assertEquals(0, mailbox.getTotalMessagesSent());

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .body("{\"email\":\"  PILOTE@LE-CORMORAN.EXAMPLE  \"}")
                .when()
                .post("/v1/auth/magic-links")
                .then()
                .statusCode(202);

        String invalidatedToken = tokenFrom(awaitMail(PILOT_EMAIL));
        mailbox.clear();

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .body("{\"email\":\"%s\"}".formatted(PILOT_EMAIL))
                .when()
                .post("/v1/auth/magic-links")
                .then()
                .statusCode(202);
        String magicLinkToken = tokenFrom(awaitMail(PILOT_EMAIL));
        assertNotEquals(invalidatedToken, magicLinkToken);

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .body("{\"token\":\"%s\"}".formatted(invalidatedToken))
                .when()
                .post("/v1/auth/sessions")
                .then()
                .statusCode(401)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("magic-link-expired"));

        Response created = given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .body("{\"token\":\"%s\"}".formatted(magicLinkToken))
                .when()
                .post("/v1/auth/sessions");

        created.then()
                .statusCode(200)
                .body("email", equalTo(PILOT_EMAIL))
                .body("fullName", equalTo("Camille Martin"))
                .body("establishments", hasSize(1))
                .body("establishments[0].name", equalTo("Le Cormoran"));

        String accessToken = created.getCookie(ACCESS_COOKIE);
        String refreshToken = created.getCookie(REFRESH_COOKIE);
        assertNotNull(accessToken);
        assertNotNull(refreshToken);
        assertSessionCookieAttributes(created.getHeaders().getValues("Set-Cookie"));

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .body("{\"token\":\"%s\"}".formatted(magicLinkToken))
                .when()
                .post("/v1/auth/sessions")
                .then()
                .statusCode(401)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("magic-link-expired"));

        given().filter(ContractValidation.FILTER)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .when()
                .get("/v1/auth/sessions/current")
                .then()
                .statusCode(200)
                .body("email", equalTo(PILOT_EMAIL))
                .body("establishments[0].slug", equalTo("le-cormoran"));

        Response refreshed = given().filter(ContractValidation.FILTER)
                .header("Cookie", REFRESH_COOKIE + "=" + refreshToken)
                .when()
                .post("/v1/auth/sessions/refresh");
        refreshed.then().statusCode(200).body("email", equalTo(PILOT_EMAIL));

        String nextAccessToken = refreshed.getCookie(ACCESS_COOKIE);
        String nextRefreshToken = refreshed.getCookie(REFRESH_COOKIE);
        assertNotEquals(accessToken, nextAccessToken);
        assertNotEquals(refreshToken, nextRefreshToken);

        given().filter(ContractValidation.FILTER)
                .header("Cookie", REFRESH_COOKIE + "=" + refreshToken)
                .when()
                .post("/v1/auth/sessions/refresh")
                .then()
                .statusCode(401)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("session-expired"));

        given().filter(ContractValidation.FILTER)
                .header("Cookie", REFRESH_COOKIE + "=" + nextRefreshToken)
                .when()
                .post("/v1/auth/sessions/refresh")
                .then()
                .statusCode(401)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("session-expired"));

        given().filter(ContractValidation.FILTER)
                .when()
                .delete("/v1/auth/sessions/current")
                .then()
                .statusCode(204)
                .header("Set-Cookie", containsString("Max-Age=0"));

        for (int accepted = 0; accepted < 5; accepted++) {
            given().filter(ContractValidation.FILTER)
                    .contentType(ContentType.JSON)
                    .body("{\"email\":\"limite@inconnue.example\"}")
                    .when()
                    .post("/v1/auth/magic-links")
                    .then()
                    .statusCode(202);
        }
        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .body("{\"email\":\"limite@inconnue.example\"}")
                .when()
                .post("/v1/auth/magic-links")
                .then()
                .statusCode(429)
                .contentType(PROBLEM_JSON)
                .header("Retry-After", matchesPattern("[1-9][0-9]*"))
                .body("type", containsString("rate-limited"));
    }

    private Mail awaitMail(String recipient) {
        long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
        while (System.nanoTime() < deadline) {
            List<Mail> messages = mailbox.getMailsSentTo(recipient);
            if (!messages.isEmpty()) {
                return messages.getLast();
            }
            LockSupport.parkNanos(Duration.ofMillis(10).toNanos());
        }
        throw new AssertionError("The magic link email was not captured.");
    }

    private static String tokenFrom(Mail mail) {
        Matcher matcher = TOKEN.matcher(mail.getText());
        assertTrue(matcher.find(), "The email must contain an opaque magic link token.");
        return matcher.group(1);
    }

    private static void assertSessionCookieAttributes(List<String> setCookies) {
        assertEquals(2, setCookies.size());
        assertTrue(setCookies.stream()
                .anyMatch(cookie -> cookie.startsWith(ACCESS_COOKIE + "=")
                        && cookie.contains("Path=/;")
                        && cookie.contains("HttpOnly")
                        && cookie.contains("SameSite=Lax")));
        assertTrue(setCookies.stream()
                .anyMatch(cookie -> cookie.startsWith(REFRESH_COOKIE + "=")
                        && cookie.contains("Path=/v1/auth/sessions;")
                        && cookie.contains("HttpOnly")
                        && cookie.contains("SameSite=Lax")));
        assertFalse(setCookies.stream().anyMatch(cookie -> cookie.contains("Domain=")));
        assertFalse(setCookies.stream().anyMatch(cookie -> cookie.contains("Secure")));
    }
}
