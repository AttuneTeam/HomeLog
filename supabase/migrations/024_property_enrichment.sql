create table public.property_enrichment (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  year_built integer,
  architectural_style text,
  heritage_listing text,
  heritage_description text,
  historical_context text,
  notable_features text[] default '{}',
  image_urls text[] default '{}',
  sources jsonb default '[]'::jsonb,
  raw_search_results jsonb,
  enriched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id)
);

alter table public.property_enrichment enable row level security;

create policy "Users can manage own property enrichment"
  on public.property_enrichment
  for all
  using (property_id in (select id from public.properties where user_id = auth.uid()))
  with check (property_id in (select id from public.properties where user_id = auth.uid()));

grant select, insert, update, delete on public.property_enrichment to authenticated;
