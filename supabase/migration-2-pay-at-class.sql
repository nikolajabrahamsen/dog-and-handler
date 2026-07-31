-- Run this in the Supabase SQL editor. Safe to run once on your existing
-- database - it only adds/replaces things, it doesn't touch existing data.

alter table registrations
  add column if not exists payment_method text not null default 'mobilepay'
    check (payment_method in ('mobilepay', 'pay_at_class'));

-- Replaces the previous version: now accepts a payment method and stores it.
create or replace function create_registration(
  p_class_id uuid,
  p_owner_name text,
  p_dog_name text,
  p_email text,
  p_phone text,
  p_payment_method text default 'mobilepay'
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

  select count(*) into v_held from registrations
    where class_id = p_class_id
    and (status = 'confirmed'
         or (status = 'pending' and created_at > now() - interval '15 minutes'));

  if v_held >= v_class.max_participants then
    update classes set is_open = false where id = p_class_id;
    raise exception 'class_full';
  end if;

  insert into registrations (class_id, owner_name, dog_name, email, phone, status, payment_method)
  values (p_class_id, p_owner_name, p_dog_name, p_email, p_phone, 'pending', p_payment_method)
  returning * into v_reg;

  return v_reg;
end;
$$;
