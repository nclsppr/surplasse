package com.surplasse.catalog.service;

import com.surplasse.catalog.entity.Establishment;

public record PublicEstablishmentSnapshot(Establishment establishment, boolean acceptingOrders) {}
