-- Demo dataset: the canonical demonstration establishment (Le Cormoran,
-- Marseille). Loaded in dev and test only (Flyway location db/seed is not
-- part of the production locations). Idempotent: wipes then reinserts.
-- The contract examples in api/openapi.yaml align on this data; keep them
-- in sync when editing.

-- Cross-domain rows first: they reference catalog and identity data. Guarded
-- on table existence because isolated catalog tests do not load the order,
-- payment or identity migrations.
do $$
begin
    if to_regclass('public.payment_request') is not null then delete from payment_request; end if;
    if to_regclass('public.payment') is not null then delete from payment; end if;
    if to_regclass('public.order_event') is not null then delete from order_event; end if;
    if to_regclass('public.order_line') is not null then delete from order_line; end if;
    if to_regclass('public."order"') is not null then delete from "order"; end if;
    if to_regclass('public.table_session') is not null then delete from table_session; end if;
    if to_regclass('public.magic_link_session') is not null then delete from magic_link_session; end if;
    if to_regclass('public.restaurateur_session') is not null then delete from restaurateur_session; end if;
end $$;

delete from option;
delete from option_group;
delete from product;
delete from category;
delete from table_qr;
delete from menu;
delete from establishment;

-- The identity migration is absent from isolated catalog tests. Seed the
-- pilot account only when its table is on the classpath, and leave the
-- catalog-only establishment unowned otherwise.
do $$
begin
    if to_regclass('public.restaurateur') is not null then
        delete from restaurateur;
        insert into restaurateur (id, email, full_name) values
            ('a1b2c3d4-e5f6-4789-8abc-def012345678', 'pilote@le-cormoran.example', 'Camille Martin');
    end if;
end $$;

insert into establishment (
    id,
    restaurateur_id,
    name,
    slug,
    address,
    status,
    stripe_account_id,
    stripe_charges_enabled,
    stripe_payouts_enabled,
    activated_at
) values
    (
        '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        case when to_regclass('public.restaurateur') is null
            then null
            else 'a1b2c3d4-e5f6-4789-8abc-def012345678'::uuid
        end,
        'Le Cormoran',
        'le-cormoran',
        '12 quai des Belges, 13001 Marseille',
        'active',
        'acct_test_le_cormoran',
        true,
        true,
        now()
    );

insert into menu (id, establishment_id, name, status) values
    ('9b2f5c1a-6d3e-4b7f-8a2c-1e9d8c7b6a5f', '7c9e6679-7425-40de-944b-e07fc1f90ae7', 'Carte principale', 'published');

insert into table_qr (id, establishment_id, label, code, active) values
    ('a0b1c2d3-e4f5-46a7-88b9-c0d1e2f3a601', '7c9e6679-7425-40de-944b-e07fc1f90ae7', 'Table 1', 'tbl_7a1c9e3b5d0f2a4c', true),
    ('a0b1c2d3-e4f5-46a7-88b9-c0d1e2f3a602', '7c9e6679-7425-40de-944b-e07fc1f90ae7', 'Table 2', 'tbl_8b2d0f4c6e1a3b5d', true),
    ('a0b1c2d3-e4f5-46a7-88b9-c0d1e2f3a603', '7c9e6679-7425-40de-944b-e07fc1f90ae7', 'Table 3', 'tbl_9c3e1a5d7f2b4c6e', true),
    ('a0b1c2d3-e4f5-46a7-88b9-c0d1e2f3a604', '7c9e6679-7425-40de-944b-e07fc1f90ae7', 'Table 4', 'tbl_2f8e6a4c0b9d7e1f', true),
    ('a0b1c2d3-e4f5-46a7-88b9-c0d1e2f3a605', '7c9e6679-7425-40de-944b-e07fc1f90ae7', 'Comptoir', 'tbl_0d4f2b6e8a3c5d7f', false);

insert into category (id, menu_id, name, position) values
    ('c1a2b3c4-d5e6-47f8-89ab-cdef01234501', '9b2f5c1a-6d3e-4b7f-8a2c-1e9d8c7b6a5f', 'Entrées', 1),
    ('c1a2b3c4-d5e6-47f8-89ab-cdef01234502', '9b2f5c1a-6d3e-4b7f-8a2c-1e9d8c7b6a5f', 'Plats', 2),
    ('c1a2b3c4-d5e6-47f8-89ab-cdef01234503', '9b2f5c1a-6d3e-4b7f-8a2c-1e9d8c7b6a5f', 'Desserts', 3),
    ('c1a2b3c4-d5e6-47f8-89ab-cdef01234504', '9b2f5c1a-6d3e-4b7f-8a2c-1e9d8c7b6a5f', 'Boissons', 4);

insert into product (id, category_id, name, description, price_cents, available, position) values
    ('d0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d401', 'c1a2b3c4-d5e6-47f8-89ab-cdef01234501', 'Panisses croustillantes', 'Frites de pois chiches, aïoli maison.', 650, true, 1),
    ('d0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d402', 'c1a2b3c4-d5e6-47f8-89ab-cdef01234501', 'Soupe de poisson', 'Rouille, croûtons et gruyère râpé.', 850, false, 2),
    ('d0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d403', 'c1a2b3c4-d5e6-47f8-89ab-cdef01234502', 'Daube provençale', 'Bœuf mijoté au vin rouge, olives noires.', 1850, true, 1),
    ('d0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d404', 'c1a2b3c4-d5e6-47f8-89ab-cdef01234502', 'Loup grillé', 'Fenouil confit, huile d''olive du moulin.', 2200, true, 2),
    ('d0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d405', 'c1a2b3c4-d5e6-47f8-89ab-cdef01234502', 'Burger du Vieux-Port', 'Pain artisanal, bœuf de Provence, tomme de brebis.', 1600, true, 3),
    ('d0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d406', 'c1a2b3c4-d5e6-47f8-89ab-cdef01234503', 'Navettes maison', 'Biscuits à la fleur d''oranger, recette de famille.', 450, true, 1),
    ('d0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d407', 'c1a2b3c4-d5e6-47f8-89ab-cdef01234503', 'Tarte au citron', 'Meringue flambée, citrons de Menton.', 700, true, 2),
    ('d0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d408', 'c1a2b3c4-d5e6-47f8-89ab-cdef01234504', 'Pastis', 'Servi avec sa carafe d''eau fraîche.', 400, true, 1),
    ('d0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d409', 'c1a2b3c4-d5e6-47f8-89ab-cdef01234504', 'Eau pétillante', null, 350, true, 2),
    ('d0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d410', 'c1a2b3c4-d5e6-47f8-89ab-cdef01234504', 'Verre de rosé', 'Côtes-de-Provence du domaine voisin.', 500, true, 3);

insert into option_group (id, product_id, name, min_choices, max_choices, position) values
    ('e1f2a3b4-c5d6-47e8-89f0-a1b2c3d4e501', 'd0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d403', 'Accompagnement', 1, 1, 1),
    ('e1f2a3b4-c5d6-47e8-89f0-a1b2c3d4e502', 'd0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d405', 'Cuisson', 1, 1, 1),
    ('e1f2a3b4-c5d6-47e8-89f0-a1b2c3d4e503', 'd0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d405', 'Suppléments', 0, 3, 2);

insert into option (id, option_group_id, name, extra_cost_cents, available, position) values
    ('f0a1b2c3-d4e5-46f7-88a9-b0c1d2e3f401', 'e1f2a3b4-c5d6-47e8-89f0-a1b2c3d4e501', 'Polenta crémeuse', 0, true, 1),
    ('f0a1b2c3-d4e5-46f7-88a9-b0c1d2e3f402', 'e1f2a3b4-c5d6-47e8-89f0-a1b2c3d4e501', 'Pommes grenaille', 0, true, 2),
    ('f0a1b2c3-d4e5-46f7-88a9-b0c1d2e3f403', 'e1f2a3b4-c5d6-47e8-89f0-a1b2c3d4e501', 'Légumes rôtis', 0, true, 3),
    ('f0a1b2c3-d4e5-46f7-88a9-b0c1d2e3f404', 'e1f2a3b4-c5d6-47e8-89f0-a1b2c3d4e502', 'Saignant', 0, true, 1),
    ('f0a1b2c3-d4e5-46f7-88a9-b0c1d2e3f405', 'e1f2a3b4-c5d6-47e8-89f0-a1b2c3d4e502', 'À point', 0, true, 2),
    ('f0a1b2c3-d4e5-46f7-88a9-b0c1d2e3f406', 'e1f2a3b4-c5d6-47e8-89f0-a1b2c3d4e502', 'Bien cuit', 0, true, 3),
    ('f0a1b2c3-d4e5-46f7-88a9-b0c1d2e3f407', 'e1f2a3b4-c5d6-47e8-89f0-a1b2c3d4e503', 'Fromage de chèvre', 150, true, 1),
    ('f0a1b2c3-d4e5-46f7-88a9-b0c1d2e3f408', 'e1f2a3b4-c5d6-47e8-89f0-a1b2c3d4e503', 'Anchois marinés', 100, true, 2),
    ('f0a1b2c3-d4e5-46f7-88a9-b0c1d2e3f409', 'e1f2a3b4-c5d6-47e8-89f0-a1b2c3d4e503', 'Œuf au plat', 100, true, 3);
