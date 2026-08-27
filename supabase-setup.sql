-- ============================================================================
-- gen — Central cloud database schema (Supabase)
--
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Architecture: Frontend → gen Backend → Supabase. The frontend NEVER talks
-- to Supabase directly; only the backend holds keys.
--
-- Hierarchy preserved inside each row:
--   Brand → Family → Series → Model(name) → Generation → Configurations[]
-- Each configuration keeps its OWN full specs (variants jsonb) — specs are
-- never mixed between configurations.
-- ============================================================================

create table if not exists public.computer_models (
  id           text primary key,
  brand        text not null,
  family       text,
  series       text,
  name         text not null,
  generation   text,
  category     text not null,
  year         integer,
  description  text default '',
  image_url    text default '',
  source       text not null default 'ai',        -- 'ai' | 'manual' | 'base'
  variants     jsonb not null default '[]'::jsonb, -- per-configuration full specs
  signature    text not null,                      -- dedupe: brand|family|name|gen (normalized)
  name_key     text not null,                      -- dedupe: brand|family|name (normalized)
  search_text  text default '',                    -- lowercase haystack for fast prefilter
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Helpful indexes for dedupe checks and brand scans.
create index if not exists computer_models_name_key_idx on public.computer_models (name_key);
create index if not exists computer_models_signature_idx on public.computer_models (signature);
create index if not exists computer_models_brand_idx on public.computer_models (brand);

-- Keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists computer_models_touch on public.computer_models;
create trigger computer_models_touch
  before update on public.computer_models
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Row Level Security
--
-- The backend uses the PUBLISHABLE key (anon role). These policies let the app
-- work with just that key while still requiring requests to go through our
-- backend in practice. For production hardening, switch the backend to a
-- service-role key stored only in server env vars and DELETE the insert/update
-- policies below.
-- ============================================================================

alter table public.computer_models enable row level security;

drop policy if exists "public can read computers" on public.computer_models;
create policy "public can read computers"
  on public.computer_models for select
  to anon, authenticated
  using (true);

drop policy if exists "backend can insert computers" on public.computer_models;
create policy "backend can insert computers"
  on public.computer_models for insert
  to anon, authenticated
  with check (true);

drop policy if exists "backend can update computers" on public.computer_models;
create policy "backend can update computers"
  on public.computer_models for update
  to anon, authenticated
  using (true)
  with check (true);
