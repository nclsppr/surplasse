-- Order domain schema (docs/architecture/donnees.md): anonymous table
-- sessions, orders with frozen lines, and the persisted event log that
-- backs SSE replay on reconnection.

create table table_session (
    id uuid primary key,
    establishment_id uuid not null references establishment (id),
    table_qr_id uuid not null references table_qr (id),
    token_hash text not null unique,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index table_session_establishment_idx on table_session (establishment_id);

create table "order" (
    id uuid primary key,
    establishment_id uuid not null references establishment (id),
    table_qr_id uuid references table_qr (id),
    type text not null check (type in ('on_site', 'takeaway')),
    status text not null check (status in (
        'pending_payment', 'paid', 'accepted', 'preparing', 'ready',
        'served', 'picked_up', 'cancelled', 'refunded')),
    display_number text not null,
    service_day date not null,
    customer_first_name text,
    contact_email text,
    total_cents integer not null check (total_cents >= 0),
    tracking_token text not null unique,
    idempotency_key uuid not null unique,
    request_hash text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (establishment_id, service_day, display_number)
);
create index order_establishment_idx on "order" (establishment_id);

create table order_line (
    id uuid primary key,
    order_id uuid not null references "order" (id),
    product_id uuid not null references product (id) on delete restrict,
    product_name text not null,
    unit_price_cents integer not null check (unit_price_cents >= 0),
    quantity integer not null check (quantity >= 1),
    options_json jsonb not null default '[]',
    note text,
    line_total_cents integer not null check (line_total_cents >= 0),
    position integer not null
);
create index order_line_order_idx on order_line (order_id);

create table order_event (
    id bigserial primary key,
    establishment_id uuid not null references establishment (id),
    order_id uuid not null references "order" (id),
    event_type text not null,
    payload jsonb not null,
    created_at timestamptz not null default now()
);
create index order_event_order_idx on order_event (order_id, id);
create index order_event_establishment_idx on order_event (establishment_id, id);
