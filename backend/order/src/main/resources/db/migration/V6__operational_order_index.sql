-- Supports stable keyset pagination of the active Dashboard queue.
create index order_operational_page_idx
    on "order" (establishment_id, created_at desc, id desc)
    where status in ('paid', 'accepted', 'preparing', 'ready');
