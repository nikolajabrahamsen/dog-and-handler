-- Run this in the Supabase SQL editor.
-- Adds a per-class setting for which payment methods are offered:
--   'both' (default), 'mobilepay', or 'pay_at_class'.

alter table classes
  add column if not exists payment_options text not null default 'both'
  check (payment_options in ('both', 'mobilepay', 'pay_at_class'));

-- Re-create the view so it picks up the new column (see migration 8).
drop view if exists class_availability;

create view class_availability as
select
  c.*,
  coalesce(sum(case when r.status = 'confirmed' then 1 else 0 end), 0)::int as confirmed_count,
  coalesce(sum(case when r.status = 'confirmed' and r.payment_method = 'mobilepay' then 1 else 0 end), 0)::int as paid_count,
  coalesce(sum(case when r.status = 'confirmed' and r.payment_method = 'pay_at_class' then 1 else 0 end), 0)::int as pay_at_class_confirmed_count,
  coalesce(sum(
    case when r.status = 'confirmed'
           or (r.status = 'pending' and r.created_at > now() - interval '15 minutes')
         then 1 else 0 end
  ), 0)::int as held_count
from classes c
left join registrations r on r.class_id = c.id
group by c.id;
