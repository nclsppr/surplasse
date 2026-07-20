package com.surplasse.payment.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class RefundReasonConverter implements AttributeConverter<RefundReason, String> {

    @Override
    public String convertToDatabaseColumn(RefundReason reason) {
        return reason == null ? null : reason.dbValue();
    }

    @Override
    public RefundReason convertToEntityAttribute(String value) {
        return value == null ? null : RefundReason.fromDbValue(value);
    }
}
