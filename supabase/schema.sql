-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).

create extension if not exists "pgcrypto";

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  weekday text,
  location text,
  max_participants int not null,
  price_dkk int not null,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  owner_name text not null,
  dog_name text,
  email text not null,
  phone text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'failed', 'cancelled', 'expired')),
  payment_method text not null default 'mobilepay'
    check (payment_method in ('mobilepay', 'pay_at_class')),
  newsletter_opt_in boolean not null default false,
  mobilepay_payment_id text,
  mobilepay_reference text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists idx_reg_class on registrations(class_id);
create index if not exists idx_reg_status on registrations(status);

-- How long an unpaid ("pending") registration holds a seat before it no
-- longer counts against capacity. Keep in sync with the interval used
-- below if you change it.
-- Live availability per class. "held_count" = confirmed + still-active
-- pending holds; used to decide if a class is full.
create or replace view class_availability as
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

-- Atomically checks capacity and creates a 'pending' registration.
-- Locks the class row so concurrent requests for the same class are
-- serialized (safe under Vercel's concurrent serverless invocations).
-- Raises: class_not_found | class_closed | class_full
create or replace function create_registration(
  p_class_id uuid,
  p_owner_name text,
  p_dog_name text,
  p_email text,
  p_phone text,
  p_payment_method text default 'mobilepay',
  p_newsletter_opt_in boolean default false
) returns registrations
language plpgsql
as $$
declare
  v_class classes%rowtype;
  v_held int;
  v_reg registrations%rowtype;
begin
  select * into v_class from classes where id = p_class_id for update;
  if not found then
    raise exception 'class_not_found';
  end if;

  if not v_class.is_open then
    raise exception 'class_closed';
  end if;

  if v_class.ends_at is not null and v_class.ends_at < now() then
    raise exception 'class_closed';
  end if;

  select count(*) into v_held from registrations
    where class_id = p_class_id
    and (status = 'confirmed'
         or (status = 'pending' and created_at > now() - interval '15 minutes'));

  if v_held >= v_class.max_participants then
    update classes set is_open = false where id = p_class_id;
    raise exception 'class_full';
  end if;

  insert into registrations (class_id, owner_name, dog_name, email, phone, status, payment_method, newsletter_opt_in)
  values (p_class_id, p_owner_name, p_dog_name, p_email, p_phone, 'pending', p_payment_method, p_newsletter_opt_in)
  returning * into v_reg;

  return v_reg;
end;
$$;

-- Atomically confirms a registration after MobilePay approves payment,
-- and closes the class if that was the last spot. Safe to call more than
-- once for the same registration (idempotent).
-- Raises: registration_not_found
create or replace function confirm_registration(
  p_reg_id uuid
) returns registrations
language plpgsql
as $$
declare
  v_reg registrations%rowtype;
  v_class classes%rowtype;
  v_confirmed int;
begin
  select * into v_reg from registrations where id = p_reg_id for update;
  if not found then
    raise exception 'registration_not_found';
  end if;

  if v_reg.status = 'confirmed' then
    return v_reg; -- already processed, avoid double counting
  end if;

  select * into v_class from classes where id = v_reg.class_id for update;

  select count(*) into v_confirmed from registrations
    where class_id = v_class.id and status = 'confirmed';

  if v_confirmed >= v_class.max_participants then
    -- Extremely unlucky race: class filled while this payment was in
    -- flight. Don't overbook - flag for a manual refund instead.
    update registrations set status = 'failed' where id = p_reg_id
      returning * into v_reg;
    return v_reg;
  end if;

  update registrations set status = 'confirmed', confirmed_at = now()
    where id = p_reg_id
    returning * into v_reg;

  if v_confirmed + 1 >= v_class.max_participants then
    update classes set is_open = false where id = v_class.id;
  end if;

  return v_reg;
end;
$$;

-- Row Level Security: lock the tables down. All access from the app goes
-- through the Vercel serverless functions using the SERVICE ROLE key,
-- which bypasses RLS - so nothing needs to be granted to anon/public here.
alter table classes enable row level security;
alter table registrations enable row level security;

-- One row per subscribed email, deduplicated, for the admin newsletter tool.
create or replace view newsletter_subscribers as
select distinct on (lower(email)) email, owner_name
from registrations
where newsletter_opt_in = true
order by lower(email), created_at desc;
