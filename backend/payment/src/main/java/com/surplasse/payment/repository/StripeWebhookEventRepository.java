package com.surplasse.payment.repository;

import com.surplasse.payment.entity.StripeWebhookEvent;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class StripeWebhookEventRepository implements PanacheRepositoryBase<StripeWebhookEvent, String> {}
