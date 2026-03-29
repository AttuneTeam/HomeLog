-- ============================================================
-- Renovation quotes + quote AI classifications
-- ============================================================

create table renovation_quotes (
  id uuid primary key default gen_random_uuid(),
  renovation_id uuid not null references renovations(id) on delete cascade,
  title text not null,
  description text,
  total_cost numeric(12,2),
  contractor text,
  file_path text,
  created_at timestamptz not null default now()
);

alter table renovation_quotes enable row level security;

create policy "Users manage own quotes" on renovation_quotes
  using (
    exists (
      select 1 from renovations r
      join properties p on p.id = r.property_id
      where r.id = renovation_quotes.renovation_id
        and p.user_id = auth.uid()
    )
  );

create table quote_ai_classifications (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references renovation_quotes(id) on delete cascade,
  classification text not null check (classification in ('Immediate Deduction', 'Capital Works (Div 43)', 'Plant & Equipment (Div 40)')),
  deduction_strategy text not null,
  legal_citation text not null,
  environmental_flag boolean not null default false,
  confidence_score numeric(4,3) not null,
  model_used text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table quote_ai_classifications enable row level security;

create policy "Users view own quote classifications" on quote_ai_classifications
  using (
    exists (
      select 1 from renovation_quotes q
      join renovations r on r.id = q.renovation_id
      join properties p on p.id = r.property_id
      where q.id = quote_ai_classifications.quote_id
        and p.user_id = auth.uid()
    )
  );

create index on renovation_quotes(renovation_id);
create index on quote_ai_classifications(quote_id);

-- ============================================================
-- Storage: renovation-quotes bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('renovation-quotes', 'renovation-quotes', false);

create policy "renovation-quotes: upload own folder" on storage.objects
  for insert with check (
    bucket_id = 'renovation-quotes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "renovation-quotes: read own folder" on storage.objects
  for select using (
    bucket_id = 'renovation-quotes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "renovation-quotes: delete own folder" on storage.objects
  for delete using (
    bucket_id = 'renovation-quotes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
