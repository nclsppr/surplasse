-- Accounts v2 capability statuses replace the legacy v1 charges_enabled and
-- payouts_enabled booleans. The values stay fail-closed during the rename.

alter table establishment
    rename column stripe_charges_enabled to stripe_card_payments_active;

alter table establishment
    rename column stripe_payouts_enabled to stripe_payouts_active;

alter table establishment
    rename constraint establishment_stripe_capabilities_require_account_check
    to establishment_stripe_active_capabilities_require_account_check;
