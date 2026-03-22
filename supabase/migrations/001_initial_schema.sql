-- ============================================================
-- Enums
-- ============================================================
create type public.classification as enum ('repair', 'capital_improvement');
create type public.renovation_status as enum ('planned', 'in_progress', 'completed');
create type public.expense_category as enum (
  'labour',
  'materials',
  'permits',
  'professional_fees',
  'appliances',
  'fixtures',
  'other'
);

-- ============================================================
-- profiles
-- Extends auth.users; created automatically via trigger
-- financial_year_start: AU default is month=7, day=1
-- ============================================================
create table public.profiles (
  id                           uuid primary key references auth.users(id) on delete cascade,
  display_name                 text,
  financial_year_start_month   smallint not null default 7 check (financial_year_start_month between 1 and 12),
  financial_year_start_day     smallint not null default 1  check (financial_year_start_day between 1 and 31),
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

-- ============================================================
-- properties
-- ============================================================
create table public.properties (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  address        text not null,
  suburb         text,
  state          text,
  postcode       text,
  purchase_date  date,
  purchase_price numeric(12, 2),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- renovations
-- ============================================================
create table public.renovations (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties(id) on delete cascade,
  name            text not null,
  description     text,
  contractor      text,
  start_date      date,
  end_date        date,
  status          public.renovation_status not null default 'planned',
  classification  public.classification not null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- expenses
-- classification_override: when null, inherits from renovation
-- raw_text: reserved for future OCR/RAG extraction
-- ============================================================
create table public.expenses (
  id                      uuid primary key default gen_random_uuid(),
  renovation_id           uuid not null references public.renovations(id) on delete cascade,
  amount                  numeric(12, 2) not null check (amount >= 0),
  category                public.expense_category not null,
  expense_date            date not null,
  description             text,
  supplier                text,
  invoice_path            text,
  classification_override public.classification,
  raw_text                text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

create trigger trg_renovations_updated_at
  before update on public.renovations
  for each row execute function public.set_updated_at();

create trigger trg_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ============================================================
-- Auto-create profile on new user signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.properties  enable row level security;
alter table public.renovations enable row level security;
alter table public.expenses    enable row level security;

-- profiles: users can only read/write their own profile
create policy "profiles: own row" on public.profiles
  for all using (auth.uid() = id);

-- properties: users can only access their own properties
create policy "properties: own rows" on public.properties
  for all using (auth.uid() = user_id);

-- renovations: users can access renovations whose property belongs to them
create policy "renovations: via property owner" on public.renovations
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
  );

-- expenses: users can access expenses whose renovation's property belongs to them
create policy "expenses: via property owner" on public.expenses
  for all using (
    exists (
      select 1 from public.renovations r
      join public.properties p on p.id = r.property_id
      where r.id = renovation_id and p.user_id = auth.uid()
    )
  );

-- ============================================================
-- Helpful indexes
-- ============================================================
create index on public.properties (user_id);
create index on public.renovations (property_id);
create index on public.expenses (renovation_id);
create index on public.expenses (expense_date);
