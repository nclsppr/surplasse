-- Snapshot the direct-charge routing and Surplasse application fee on each
-- payment. This pre-production cutover refuses every legacy platform payment:
-- no account can be inferred safely and the generated API requires one.

alter table payment
    add column connected_account_id text,
    add column application_fee_amount integer not null default 0;

do $$
begin
    if exists (
        select 1
        from payment
    ) then
        raise exception 'Legacy platform payments require Stripe reconciliation and a clean baseline before V11';
    end if;
end $$;

alter table payment alter column connected_account_id set not null;

alter table payment
    add constraint payment_application_fee_check check (
        application_fee_amount >= 0 and application_fee_amount < amount_cents
    );

alter table payment drop constraint payment_external_reference_key;

create unique index payment_stripe_reference_account_unique_idx
    on payment (connected_account_id, external_reference);
