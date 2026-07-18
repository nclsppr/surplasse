package com.surplasse.payment.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class PaymentStatusConverter implements AttributeConverter<PaymentStatus, String> {

    @Override
    public String convertToDatabaseColumn(PaymentStatus status) {
        return status == null ? null : status.dbValue();
    }

    @Override
    public PaymentStatus convertToEntityAttribute(String value) {
        return value == null ? null : PaymentStatus.fromDbValue(value);
    }
}
