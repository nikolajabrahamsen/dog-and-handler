-- Run this in the Supabase SQL editor.
--
-- Email and phone are still required for the normal public registration
-- flow (enforced in api/register/index.js), but this lets an admin add
-- a participant with partial info - e.g. just a name, before they have
-- full contact details.

alter table registrations alter column email drop not null;
alter table registrations alter column phone drop not null;

-- Replaces the previous version: email/phone now optional.
create or replace function admin_add_registration(
  p_class_id uuid,
  p_owner_name text,
  p_dog_name text,
  p_email text default null,
  p_phone text default null
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
  values (p_class_id, p_owner_name, p_dog_name, nullif(p_email, ''), nullif(p_phone, ''), 'confirmed', 'manual', false)
  returning * into v_reg;

  if v_held + 1 >= v_class.max_participants then
    update classes set is_open = false where id = p_class_id;
  end if;

  return v_reg;
end;
$$;
