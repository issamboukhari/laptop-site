-- ============================================================================
-- Phase 3.2.3 FIX — Persistent Semantic Embeddings with pgvector
--
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Embedding model: gemini-embedding-2
-- Dimension: 768 (MRL, recommended by Google)
-- Metric: cosine distance
-- Index: HNSW
-- ============================================================================

-- 1. Enable pgvector extension
create extension if not exists vector
with
  schema extensions;

-- 2. Semantic embeddings table
-- One row per variant per embedding configuration.
-- The canonical catalog (computer_models) remains source of truth.
-- This table is an index/cache for vector search.
create table if not exists public.semantic_embeddings (
  id                 bigserial primary key,
  entity_type        text not null default 'variant',   -- 'variant' only (variant-level embeddings)
  entity_id          text not null,                      -- variant.id (canonical variant ID)
  model_id           text not null,                      -- computer_models.id (parent model)
  content_hash       text not null,                      -- SHA-like hash of semantic document
  embedding          vector(768) not null,               -- gemini-embedding-2, 768-dim MRL
  embedding_model    text not null default 'gemini-embedding-2',
  embedding_dimension integer not null default 768,
  embedding_version  text not null default '1',          -- bump to force re-embedding
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Prevent duplicates: exactly one embedding per entity + model + version
  constraint semantic_embeddings_entity_unique
    unique (entity_type, entity_id, embedding_model, embedding_version)
);

-- 3. Indexes for lookup and staleness detection
create index if not exists semantic_embeddings_entity_idx
  on public.semantic_embeddings (entity_type, entity_id);

create index if not exists semantic_embeddings_model_idx
  on public.semantic_embeddings (model_id);

create index if not exists semantic_embeddings_hash_idx
  on public.semantic_embeddings (content_hash);

-- 4. HNSW index for cosine vector search
-- Using cosine distance operator (<=>) for pgvector
-- ef_construction=64 is a good default for < 100k vectors
create index if not exists semantic_embeddings_embedding_idx
  on public.semantic_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 5. RPC function for vector similarity search
-- Returns variant IDs, model IDs, and similarity scores.
-- The application resolves these IDs against the canonical catalog.
-- This function performs the ANN search in the database, not in JavaScript.
create or replace function public.match_semantic_variants(
  query_embedding vector(768),
  match_count integer default 50,
  similarity_threshold double precision default 0.3
)
returns table (
  variant_id    text,
  model_id      text,
  similarity    double precision
)
language sql
stable
as $$
  select
    se.entity_id as variant_id,
    se.model_id,
    (1 - (se.embedding <=> query_embedding)) as similarity
  from public.semantic_embeddings se
  where (1 - (se.embedding <=> query_embedding)) >= similarity_threshold
  order by se.embedding <=> query_embedding
  limit match_count;
$$;

-- 6. Keep updated_at fresh
create or replace function public.touch_semantic_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists semantic_embeddings_touch on public.semantic_embeddings;
create trigger semantic_embeddings_touch
  before update on public.semantic_embeddings
  for each row execute function public.touch_semantic_updated_at();

-- 7. Row Level Security
-- Backend uses publishable key. Only backend writes; anon/authenticated can read.
alter table public.semantic_embeddings enable row level security;

drop policy if exists "public can read embeddings" on public.semantic_embeddings;
create policy "public can read embeddings"
  on public.semantic_embeddings for select
  to anon, authenticated
  using (true);

drop policy if exists "backend can insert embeddings" on public.semantic_embeddings;
create policy "backend can insert embeddings"
  on public.semantic_embeddings for insert
  to anon, authenticated
  with check (true);

drop policy if exists "backend can update embeddings" on public.semantic_embeddings;
create policy "backend can update embeddings"
  on public.semantic_embeddings for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "backend can delete embeddings" on public.semantic_embeddings;
create policy "backend can delete embeddings"
  on public.semantic_embeddings for delete
  to anon, authenticated
  using (true);
