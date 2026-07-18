package com.surplasse.catalog.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class MenuStatusConverter implements AttributeConverter<MenuStatus, String> {

    @Override
    public String convertToDatabaseColumn(MenuStatus status) {
        return status == null ? null : status.dbValue();
    }

    @Override
    public MenuStatus convertToEntityAttribute(String value) {
        return value == null ? null : MenuStatus.fromDbValue(value);
    }
}
