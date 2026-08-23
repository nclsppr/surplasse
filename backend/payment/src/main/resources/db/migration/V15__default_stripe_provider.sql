-- Stripe is the sole payment provider. Keep the historical columns populated
-- without carrying a constant field in the Java entities.

alter table payment alter column provider set default 'stripe';
alter table payment_refund alter column provider set default 'stripe';
