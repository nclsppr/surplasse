package com.surplasse.common.error;

/** A business rule rejected the operation. */
public class BusinessRuleException extends DomainException {

    public BusinessRuleException(String message) {
        super("business-rule-violation", "Business rule violation", 422, message);
    }
}
