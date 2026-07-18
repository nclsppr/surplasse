package com.surplasse.common.error;

/** State conflict. Carries its precise problem type (product-unavailable, order-not-modifiable, ...). */
public class ConflictException extends DomainException {

    public ConflictException(String problemType, String title, String message) {
        super(problemType, title, 409, message);
    }

    public static ConflictException productUnavailable(String detail) {
        return new ConflictException("product-unavailable", "Product unavailable", detail);
    }

    public static ConflictException orderNotModifiable(String detail) {
        return new ConflictException("order-not-modifiable", "Order not modifiable", detail);
    }

    public static ConflictException idempotencyKeyConflict() {
        return new ConflictException(
                "idempotency-key-conflict",
                "Idempotency key conflict",
                "This idempotency key was already used with a different payload.");
    }
}
