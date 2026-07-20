package com.surplasse.common.error;

/** A business rule rejected the operation. */
public class BusinessRuleException extends DomainException {

    public BusinessRuleException(String message) {
        super("business-rule-violation", "Business rule violation", 422, message);
    }

    private BusinessRuleException(String problemType, String title, String message) {
        super(problemType, title, 422, message);
    }

    public static BusinessRuleException orderIntakeEstablishmentNotActive() {
        return new BusinessRuleException(
                "order-intake-establishment-not-active",
                "Order intake unavailable",
                "The establishment must be active before accepting orders.");
    }

    public static BusinessRuleException orderIntakeConfigurationUnavailable(String detail) {
        return new BusinessRuleException("order-intake-configuration-unavailable", "Order intake unavailable", detail);
    }

    public static BusinessRuleException orderIntakePaymentsUnavailable() {
        return new BusinessRuleException(
                "order-intake-payments-unavailable",
                "Order intake unavailable",
                "Stripe card charges must be ready before accepting orders.");
    }
}
