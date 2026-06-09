-- Storage metering: track total bytes per user from storage.objects (the source
-- of truth) rather than denormalised size columns on each feature table. Covers
-- every bucket automatically, including future ones (e.g. images).

-- Remove the abandoned per-table size columns (reverted approach).
alter table property_files    drop column if exists file_size_bytes;
alter table expenses          drop column if exists invoice_size_bytes;
alter table renovation_quotes drop column if exists file_size_bytes;

-- Running total of stored bytes per user.
create table if not exists public.user_storage_usage (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  total_bytes bigint not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.user_storage_usage enable row level security;

create policy "Users can view their own storage usage"
  on public.user_storage_usage
  for select
  using (auth.uid() = user_id);

grant select on public.user_storage_usage to authenticated;

-- Every object path in this app is namespaced as `<userId>/...`, so the first
-- path segment attributes the object to a user across all buckets.
create or replace function public.track_storage_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_delta   bigint;
  v_raw     text;
begin
  -- Accounting must never block the underlying storage operation.
  begin
    v_raw := split_part(coalesce(NEW.name, OLD.name), '/', 1);
    if v_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return coalesce(NEW, OLD);
    end if;
    v_user_id := v_raw::uuid;

    if TG_OP = 'INSERT' then
      v_delta := coalesce((NEW.metadata->>'size')::bigint, 0);
    elsif TG_OP = 'DELETE' then
      v_delta := -coalesce((OLD.metadata->>'size')::bigint, 0);
    else -- UPDATE (e.g. overwrite): account for the size difference
      v_delta := coalesce((NEW.metadata->>'size')::bigint, 0)
               - coalesce((OLD.metadata->>'size')::bigint, 0);
    end if;

    insert into public.user_storage_usage as u (user_id, total_bytes, updated_at)
    values (v_user_id, v_delta, now())
    on conflict (user_id)
    do update set total_bytes = u.total_bytes + v_delta,
                  updated_at  = now();
  exception when others then
    null;
  end;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists track_storage_usage on storage.objects;
create trigger track_storage_usage
  after insert or update or delete on storage.objects
  for each row execute function public.track_storage_usage();

-- Backfill running totals from objects already in storage.
insert into public.user_storage_usage (user_id, total_bytes)
select split_part(name, '/', 1)::uuid,
       sum(coalesce((metadata->>'size')::bigint, 0))
from storage.objects
where split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
group by 1
on conflict (user_id) do update set total_bytes = excluded.total_bytes,
                                     updated_at  = now();
