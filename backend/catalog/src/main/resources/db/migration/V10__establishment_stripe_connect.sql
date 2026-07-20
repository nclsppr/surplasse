-- Stripe Connect routing is establishment data. New payments fail closed
-- until an account is present and card charges are enabled.

alter table establishment
    add column stripe_account_id text,
    add column stripe_charges_enabled boolean not null default false,
    add column stripe_payouts_enabled boolean not null default false,
    add column stripe_capabilities_updated_at timestamptz,
    add column activated_at timestamptz;

update establishment
set activated_at = now()
where status = 'active' and activated_at is null;

create unique index establishment_stripe_account_unique_idx
    on establishment (stripe_account_id)
    where stripe_account_id is not null;

alter table establishment
    add constraint establishment_stripe_capabilities_require_account_check check (
        (not stripe_charges_enabled and not stripe_payouts_enabled)
        or stripe_account_id is not null
    ),
    add constraint establishment_active_activation_check check (
        status <> 'active' or activated_at is not null
    );
