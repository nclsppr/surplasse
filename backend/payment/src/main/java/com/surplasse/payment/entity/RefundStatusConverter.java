package com.surplasse.payment.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class RefundStatusConverter implements AttributeConverter<RefundStatus, String> {

    @Override
    public String convertToDatabaseColumn(RefundStatus status) {
        return status == null ? null : status.dbValue();
    }

    @Override
    public RefundStatus convertToEntityAttribute(String value) {
        return value == null ? null : RefundStatus.fromDbValue(value);
    }
}
