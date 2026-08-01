-- Run this in the Supabase SQL editor.

alter table classes add column if not exists release_at timestamptz;
alter table classes add column if not exists announce_before_release boolean not null default false;
alter table classes add column if not exists release_announced_at timestamptz;

-- Widen payment_method to allow admin-added registrations (no payment
-- collected through the site at all).
alter table registrations drop constraint if exists registrations_payment_method_check;
alter table registrations add constraint registrations_payment_method_check
  check (payment_method in ('mobilepay', 'pay_at_class', 'manual'));

-- Replaces the previous version: also blocks registration before a
-- class's release date, if one is set.
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

  if v_class.release_at is not null and v_class.release_at > now() then
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

-- Admin adds someone directly, no payment collected through the site.
-- Deliberately bypasses is_open / release_at / ends_at (an admin override),
-- but still enforces the seat cap - an admin can't overbook a class either.
-- Raises: class_not_found | class_full
create or replace function admin_add_registration(
  p_class_id uuid,
  p_owner_name text,
  p_dog_name text,
  p_email text,
  p_phone text
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

  select count(*) into v_held from registrations
    where class_id = p_class_id
    and (status = 'confirmed'
         or (status = 'pending' and created_at > now() - interval '15 minutes'));

  if v_held >= v_class.max_participants then
    raise exception 'class_full';
  end if;

  insert into registrations (class_id, owner_name, dog_name, email, phone, status, payment_method, newsletter_opt_in)
  values (p_class_id, p_owner_name, p_dog_name, p_email, p_phone, 'confirmed', 'manual', false)
  returning * into v_reg;

  if v_held + 1 >= v_class.max_participants then
    update classes set is_open = false where id = p_class_id;
  end if;

  return v_reg;
end;
$$;

-- Moves an existing registration to a different class, enforcing the
-- target class's seat cap. Doesn't change the registration's status or
-- payment method - just which class it belongs to.
-- Raises: registration_not_found | class_not_found | class_full
create or replace function move_registration(
  p_reg_id uuid,
  p_new_class_id uuid
) returns registrations
language plpgsql
as $$
declare
  v_reg registrations%rowtype;
  v_new_class classes%rowtype;
  v_held int;
begin
  select * into v_reg from registrations where id = p_reg_id for update;
  if not found then
    raise exception 'registration_not_found';
  end if;

  select * into v_new_class from classes where id = p_new_class_id for update;
  if not found then
    raise exception 'class_not_found';
  end if;

  if v_reg.status in ('confirmed', 'pending') then
    select count(*) into v_held from registrations
      where class_id = p_new_class_id
      and (status = 'confirmed'
           or (status = 'pending' and created_at > now() - interval '15 minutes'));

    if v_held >= v_new_class.max_participants then
      raise exception 'class_full';
    end if;
  end if;

  update registrations set class_id = p_new_class_id where id = p_reg_id
    returning * into v_reg;

  if v_reg.status = 'confirmed' and v_held + 1 >= v_new_class.max_participants then
    update classes set is_open = false where id = p_new_class_id;
  end if;

  return v_reg;
end;
$$;
