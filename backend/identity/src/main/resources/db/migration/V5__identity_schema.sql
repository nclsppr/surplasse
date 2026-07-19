-- Identity domain schema (docs/architecture/donnees.md): passwordless
-- restaurateur accounts, single-use magic links and rotating refresh tokens.

create table restaurateur (
    id uuid primary key,
    email text not null unique,
    full_name text not null,
    phone text,
    last_login_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (email = lower(btrim(email)))
);

create table magic_link_session (
    id uuid primary key,
    restaurateur_id uuid not null references restaurateur (id),
    token_hash text not null unique check (length(token_hash) = 64),
    expires_at timestamptz not null,
    consumed_at timestamptz,
    invalidated_at timestamptz,
    created_at timestamptz not null default now(),
    check (consumed_at is null or invalidated_at is null)
);
create index magic_link_session_restaurateur_idx
    on magic_link_session (restaurateur_id);
create index magic_link_session_expires_at_idx
    on magic_link_session (expires_at);
create unique index magic_link_session_active_restaurateur_idx
    on magic_link_session (restaurateur_id)
    where consumed_at is null and invalidated_at is null;

create table restaurateur_session (
    id uuid primary key,
    restaurateur_id uuid not null references restaurateur (id),
    family_id uuid not null,
    token_hash text not null unique check (length(token_hash) = 64),
    expires_at timestamptz not null,
    rotated_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz not null default now()
);
create index restaurateur_session_restaurateur_idx
    on restaurateur_session (restaurateur_id);
create index restaurateur_session_family_idx
    on restaurateur_session (family_id);
create index restaurateur_session_expires_at_idx
    on restaurateur_session (expires_at);
create unique index restaurateur_session_active_family_idx
    on restaurateur_session (family_id)
    where rotated_at is null and revoked_at is null;

alter table establishment
    add constraint establishment_restaurateur_fk
    foreign key (restaurateur_id) references restaurateur (id);
create index establishment_restaurateur_idx
    on establishment (restaurateur_id);
