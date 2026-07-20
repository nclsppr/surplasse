-- Persist full refund intentions before calling Stripe. Active and successful
-- attempts are unique per payment; a failed or canceled attempt can be retried.

create table payment_refund (
    id uuid primary key,
    payment_id uuid not null references payment (id),
    order_id uuid not null references "order" (id),
    establishment_id uuid not null references establishment (id),
    provider text not null check (provider in ('stripe')),
    external_reference text not null,
    creation_key uuid not null,
    payment_intent_id text not null,
    connected_account_id text not null,
    amount_cents integer not null check (amount_cents > 0),
    application_fee_amount integer not null check (
        application_fee_amount >= 0 and application_fee_amount < amount_cents
    ),
    currency text not null,
    reason text not null check (
        reason in ('restaurant_refusal', 'item_unavailable', 'service_incident')
    ),
    status text not null check (
        status in ('creating', 'pending', 'requires_action', 'succeeded', 'failed', 'canceled')
    ),
    failure_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index payment_refund_stripe_reference_account_unique_idx
    on payment_refund (connected_account_id, external_reference);

create unique index payment_refund_active_payment_unique_idx
    on payment_refund (payment_id)
    where status in ('creating', 'pending', 'requires_action', 'succeeded');

create index payment_refund_order_idx on payment_refund (order_id);

create table refund_request (
    idempotency_key uuid primary key,
    refund_id uuid not null references payment_refund (id),
    order_id uuid not null references "order" (id),
    establishment_id uuid not null references establishment (id),
    reason text not null check (
        reason in ('restaurant_refusal', 'item_unavailable', 'service_incident')
    ),
    created_at timestamptz not null default now()
);

create index refund_request_refund_idx on refund_request (refund_id);
