package com.surplasse.identity.service;

import com.surplasse.common.error.InvalidRequestException;
import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

final class EmailAddresses {

    private static final Pattern SIMPLE_EMAIL =
            Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", Pattern.CASE_INSENSITIVE);

    private EmailAddresses() {}

    static String normalize(String value) {
        if (value == null) {
            throw invalid();
        }
        String normalized =
                Normalizer.normalize(value.trim(), Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
        if (normalized.length() > 320 || !SIMPLE_EMAIL.matcher(normalized).matches()) {
            throw invalid();
        }
        return normalized;
    }

    private static InvalidRequestException invalid() {
        return new InvalidRequestException("email must be a well-formed email address.");
    }
}
