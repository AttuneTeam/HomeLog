-- ============================================================
-- Migration 006: RAG System for AI Tax Classification
-- Enables pgvector, ATO rulings embeddings, expense embeddings,
-- AI classification results table, and similarity search RPC.
-- ============================================================

create extension if not exists vector with schema extensions;

-- ============================================================
-- ATO Rulings embeddings (pre-seeded reference data)
-- ============================================================
create table public.ato_rulings_embeddings (
  id          uuid primary key default gen_random_uuid(),
  ruling_ref  text not null,
  title       text not null,
  chunk_index integer not null default 0,
  chunk_text  text not null,
  embedding   extensions.vector(1536),
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index ato_rulings_embeddings_hnsw_idx
  on public.ato_rulings_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.ato_rulings_embeddings enable row level security;
create policy "ato_rulings: authenticated read"
  on public.ato_rulings_embeddings for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- Per-invoice chunk embeddings
-- ============================================================
create table public.expense_embeddings (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references public.expenses(id) on delete cascade,
  chunk_index integer not null default 0,
  chunk_text  text not null,
  embedding   extensions.vector(1536),
  created_at  timestamptz not null default now()
);

create index expense_embeddings_expense_id_idx
  on public.expense_embeddings (expense_id);

create index expense_embeddings_hnsw_idx
  on public.expense_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.expense_embeddings enable row level security;
create policy "expense_embeddings: via property owner"
  on public.expense_embeddings for all
  using (exists (
    select 1 from public.expenses e
    join public.renovations r on r.id = e.renovation_id
    join public.properties p on p.id = r.property_id
    where e.id = expense_id and p.user_id = auth.uid()
  ));

-- ============================================================
-- AI classification results
-- ============================================================
create type public.ai_tax_classification as enum (
  'Immediate Deduction',
  'Capital Works (Div 43)',
  'Plant & Equipment (Div 40)'
);

create table public.expense_ai_classifications (
  id                 uuid primary key default gen_random_uuid(),
  expense_id         uuid not null unique references public.expenses(id) on delete cascade,
  classification     public.ai_tax_classification not null,
  deduction_strategy text not null,
  legal_citation     text not null,
  environmental_flag boolean not null default false,
  confidence_score   numeric(3,2) not null check (confidence_score >= 0 and confidence_score <= 1),
  raw_response       jsonb not null default '{}',
  model_used         text not null default 'gpt-4o-mini',
  ato_chunks_used    text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_expense_ai_classifications_updated_at
  before update on public.expense_ai_classifications
  for each row execute function public.set_updated_at();

alter table public.expense_ai_classifications enable row level security;
create policy "expense_ai_classifications: via property owner"
  on public.expense_ai_classifications for all
  using (exists (
    select 1 from public.expenses e
    join public.renovations r on r.id = e.renovation_id
    join public.properties p on p.id = r.property_id
    where e.id = expense_id and p.user_id = auth.uid()
  ));

create index expense_ai_classifications_expense_id_idx
  on public.expense_ai_classifications (expense_id);

-- ============================================================
-- Similarity search helper function
-- ============================================================
create or replace function public.match_ato_rulings(
  query_embedding extensions.vector(1536),
  match_count      int default 5,
  match_threshold  float default 0.3
)
returns table (
  id         uuid,
  ruling_ref text,
  title      text,
  chunk_text text,
  similarity float
)
language plpgsql security definer as $$
begin
  return query
  select
    a.id,
    a.ruling_ref,
    a.title,
    a.chunk_text,
    1 - (a.embedding <=> query_embedding) as similarity
  from public.ato_rulings_embeddings a
  where 1 - (a.embedding <=> query_embedding) > match_threshold
  order by a.embedding <=> query_embedding
  limit match_count;
end;
$$;
