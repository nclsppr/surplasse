-- Operational order admission is fail-closed for every existing and new
-- establishment. The demo seed explicitly opts its canonical restaurant in.

alter table establishment
    add column order_intake_status text not null default 'paused'
        check (order_intake_status in ('open', 'paused')),
    add column order_intake_updated_at timestamptz not null default now();
