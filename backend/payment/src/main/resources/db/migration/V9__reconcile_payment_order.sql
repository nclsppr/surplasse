-- Reserve a payment in a short transaction before calling Stripe. The same
-- creation key is reused by every concurrent request until activation.

alter table payment add column creation_key uuid;
alter table payment drop constraint payment_status_check;
alter table payment add constraint payment_status_check
    check (status in ('creating', 'pending', 'succeeded', 'failed', 'refunded'));
alter table payment add constraint payment_creating_key_check
    check (status <> 'creating' or creation_key is not null);

do $$
begin
    if exists (select 1 from payment where status = 'failed') then
        raise exception 'Legacy failed payments require Stripe reconciliation before V9';
    end if;
    if exists (
        select 1
        from payment
        group by order_id
        having count(*) > 1
    ) then
        raise exception 'Multiple legacy payments exist for one order; reconcile and cancel them before V9';
    end if;
end $$;

drop index payment_pending_order_idx;
create unique index payment_order_unique_idx on payment (order_id);

-- Repair the only durable split state possible before payment and order joined
-- one transaction: the payment committed as succeeded while the order stayed
-- pending_payment. The event log is restored with the same public payload.

with reconciled_order as (
    update "order" o
    set status = 'paid', updated_at = now()
    where o.status = 'pending_payment'
      and exists (
          select 1
          from payment p
          where p.order_id = o.id and p.status = 'succeeded'
      )
    returning o.id, o.establishment_id
)
insert into order_event (establishment_id, order_id, event_type, payload)
select
    establishment_id,
    id,
    'order-status',
    jsonb_build_object('orderId', id, 'status', 'paid')
from reconciled_order;
