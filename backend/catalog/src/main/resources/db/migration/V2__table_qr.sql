-- Table QR supports (docs/architecture/donnees.md): one row per physical
-- support, with a stable non-guessable code encoded in the QR URL.

create table table_qr (
    id uuid primary key,
    establishment_id uuid not null references establishment (id),
    label text not null,
    code text not null unique,
    active boolean not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index table_qr_establishment_idx on table_qr (establishment_id);
