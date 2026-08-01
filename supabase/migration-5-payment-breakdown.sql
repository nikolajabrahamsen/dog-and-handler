-- Run this in the Supabase SQL editor. Replaces the view only - no data
-- changes.

create or replace view class_availability as
select
  c.*,
  coalesce(sum(case when r.status = 'confirmed' then 1 else 0 end), 0)::int as confirmed_count,
  -- Actually paid: confirmed AND paid via MobilePay.
  coalesce(sum(case when r.status = 'confirmed' and r.payment_method = 'mobilepay' then 1 else 0 end), 0)::int as paid_count,
  -- Booked but will pay in person: confirmed AND pay-at-class.
  coalesce(sum(case when r.status = 'confirmed' and r.payment_method = 'pay_at_class' then 1 else 0 end), 0)::int as pay_at_class_confirmed_count,
  coalesce(sum(
    case when r.status = 'confirmed'
           or (r.status = 'pending' and r.created_at > now() - interval '15 minutes')
         then 1 else 0 end
  ), 0)::int as held_count
from classes c
left join registrations r on r.class_id = c.id
group by c.id;
