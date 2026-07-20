package com.surplasse.catalog.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class OrderIntakeStatusConverter implements AttributeConverter<OrderIntakeStatus, String> {

    @Override
    public String convertToDatabaseColumn(OrderIntakeStatus status) {
        return status == null ? null : status.dbValue();
    }

    @Override
    public OrderIntakeStatus convertToEntityAttribute(String value) {
        return value == null ? null : OrderIntakeStatus.fromDbValue(value);
    }
}
