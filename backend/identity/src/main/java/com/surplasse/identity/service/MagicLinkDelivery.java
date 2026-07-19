package com.surplasse.identity.service;

import java.net.URI;
import java.util.UUID;

record MagicLinkDelivery(UUID sessionId, String recipient, URI loginUrl) {}
