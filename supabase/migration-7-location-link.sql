-- Run this in the Supabase SQL editor.

alter table classes add column if not exists location_url text;
