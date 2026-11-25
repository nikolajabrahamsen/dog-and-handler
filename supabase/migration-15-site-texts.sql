-- Texts that the admin can edit (front page, terms, newsletter box, Facebook
-- notice, confirmation email). A missing row means "use the default text
-- from the code", so the site works even if this table is empty.
create table if not exists site_texts (
  key text not null,
  lang text not null check (lang in ('da', 'en')),
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (key, lang)
);

-- Row Level Security on with no policies: only the server (secret key) can
-- read or write. The public site gets the texts through /api/texts.
alter table site_texts enable row level security;
