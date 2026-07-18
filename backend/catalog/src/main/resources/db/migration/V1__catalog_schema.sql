-- Catalog domain schema (docs/architecture/donnees.md).
-- Flyway only: no manual DDL, ever.

create table establishment (
    id uuid primary key,
    restaurateur_id uuid,
    name text not null,
    slug text not null unique,
    address text,
    status text not null check (status in ('pregenerated', 'claimed', 'configuring', 'active', 'suspended')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table menu (
    id uuid primary key,
    establishment_id uuid not null references establishment (id),
    name text not null,
    status text not null check (status in ('draft', 'published')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index menu_establishment_idx on menu (establishment_id);

create table category (
    id uuid primary key,
    menu_id uuid not null references menu (id),
    name text not null,
    position integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index category_menu_idx on category (menu_id);

create table product (
    id uuid primary key,
    category_id uuid not null references category (id),
    name text not null,
    description text,
    price_cents integer not null check (price_cents >= 0),
    available boolean not null,
    position integer not null,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index product_category_idx on product (category_id);

create table option_group (
    id uuid primary key,
    product_id uuid not null references product (id) on delete restrict,
    name text not null,
    min_choices integer not null check (min_choices >= 0),
    max_choices integer not null,
    position integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (max_choices >= min_choices)
);
create index option_group_product_idx on option_group (product_id);

create table option (
    id uuid primary key,
    option_group_id uuid not null references option_group (id) on delete restrict,
    name text not null,
    extra_cost_cents integer not null default 0 check (extra_cost_cents >= 0),
    available boolean not null,
    position integer not null,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index option_option_group_idx on option (option_group_id);
