package com.surplasse.catalog.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class EstablishmentStatusConverter implements AttributeConverter<EstablishmentStatus, String> {

    @Override
    public String convertToDatabaseColumn(EstablishmentStatus status) {
        return status == null ? null : status.dbValue();
    }

    @Override
    public EstablishmentStatus convertToEntityAttribute(String value) {
        return value == null ? null : EstablishmentStatus.fromDbValue(value);
    }
}
