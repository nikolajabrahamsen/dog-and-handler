-- Run this in the Supabase SQL editor.
--
-- Why this is needed: Postgres views expand `select c.*` into a FIXED
-- column list at the moment the view is created - they do NOT
-- automatically pick up columns added to the underlying table afterward.
-- Migrations 6 and 7 added new columns (release_at,
-- announce_before_release, release_announced_at, location_url) to the
-- classes table, but never re-created this view - so every read through
-- class_availability was silently missing those columns, even though
-- writes to the classes table itself were working correctly.
--
-- "create or replace view" can only APPEND new columns at the end of a
-- view's existing column list - it can't handle a table column landing
-- in the middle of the old column order (which is exactly what happens
-- here, since c.* re-expands to include the new columns before the
-- aggregate columns like confirmed_count). So this uses DROP + CREATE
-- instead, which has no such restriction.

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
