-- Persist every client payment intention. The request key is distinct from
-- the Stripe PaymentIntent reference: several browser intentions may safely
-- resolve to the same still-pending payment session.

create table payment_request (
    idempotency_key uuid primary key,
    payment_id uuid not null references payment (id),
    order_id uuid not null references "order" (id),
    establishment_id uuid not null references establishment (id),
    table_session_id uuid not null references table_session (id),
    created_at timestamptz not null default now()
);
create index payment_request_payment_idx on payment_request (payment_id);
