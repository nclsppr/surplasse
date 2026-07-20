-- Keep the exact anonymous session that created an on-site order. The table
-- alone is insufficient authorization: several clients can scan the same QR.

alter table "order" add column table_session_id uuid references table_session (id);

-- A legacy order can be associated safely only when exactly one matching
-- session existed before it. Chronology cannot distinguish the creator when
-- several clients scanned the same table, so ambiguous cutovers must stop.
update "order" o
set table_session_id = (
    select ts.id
    from table_session ts
    where ts.establishment_id = o.establishment_id
      and ts.table_qr_id = o.table_qr_id
      and ts.created_at <= o.created_at
      and ts.expires_at >= o.created_at
    order by ts.created_at desc
    limit 1
)
where o.type = 'on_site'
  and 1 = (
      select count(*)
      from table_session ts
      where ts.establishment_id = o.establishment_id
        and ts.table_qr_id = o.table_qr_id
        and ts.created_at <= o.created_at
        and ts.expires_at >= o.created_at
  );

do $$
begin
    if exists (
        select 1 from "order"
        where type = 'on_site' and table_session_id is null
    ) then
        raise exception 'Missing or ambiguous table session for a legacy on-site order before V8';
    end if;
end $$;

alter table "order" add constraint order_on_site_table_session_check
    check (type <> 'on_site' or table_session_id is not null);
create index order_table_session_idx on "order" (table_session_id);
