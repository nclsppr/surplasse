package com.surplasse.order.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class OrderTypeConverter implements AttributeConverter<OrderType, String> {

    @Override
    public String convertToDatabaseColumn(OrderType type) {
        return type == null ? null : type.dbValue();
    }

    @Override
    public OrderType convertToEntityAttribute(String value) {
        return value == null ? null : OrderType.fromDbValue(value);
    }
}
