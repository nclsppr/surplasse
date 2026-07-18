-- Payment domain schema (docs/architecture/donnees.md): payment attempts
-- and the processed Stripe webhook events (idempotency guarantee).

create table payment (
    id uuid primary key,
    order_id uuid not null references "order" (id),
    establishment_id uuid not null references establishment (id),
    provider text not null check (provider in ('stripe')),
    external_reference text not null unique,
    status text not null check (status in ('pending', 'succeeded', 'failed', 'refunded')),
    amount_cents integer not null check (amount_cents > 0),
    currency text not null default 'EUR',
    client_secret text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index payment_order_idx on payment (order_id);
-- One open attempt at a time per order: a replayed creation returns it.
create unique index payment_pending_order_idx on payment (order_id) where status = 'pending';

create table stripe_webhook_event (
    id text primary key,
    type text not null,
    created_at timestamptz not null default now()
);
