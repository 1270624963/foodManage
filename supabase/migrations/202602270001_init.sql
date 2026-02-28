-- Enable extensions used by this project.
create extension if not exists pgcrypto;

-- Keep all app data linked to auth.users so each logged-in account sees only its own records.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expire_reminder boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.food_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  category text not null check (char_length(category) between 1 and 12),
  quantity text not null check (char_length(quantity) between 1 and 24),
  in_date date not null,
  expire_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_items_date_check check (expire_date >= in_date)
);

create index if not exists idx_food_items_user_id on public.food_items(user_id);
create index if not exists idx_food_items_expire_date on public.food_items(expire_date);
create index if not exists idx_food_items_category on public.food_items(category);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_food_items_updated_at on public.food_items;
create trigger trg_food_items_updated_at
before update on public.food_items
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();

-- Initialize profile and settings when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(new.email, '@', 1),
    'user_' || left(new.id::text, 8)
  );

  insert into public.profiles (user_id, username)
  values (new.id, v_username)
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- RLS: every user can only read/write their own rows.
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.food_items enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "settings_select_own"
on public.user_settings
for select
to authenticated
using (auth.uid() = user_id);

create policy "settings_insert_own"
on public.user_settings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "settings_update_own"
on public.user_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "food_select_own"
on public.food_items
for select
to authenticated
using (auth.uid() = user_id);

create policy "food_insert_own"
on public.food_items
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "food_update_own"
on public.food_items
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "food_delete_own"
on public.food_items
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.dashboard_stats(range_days int default null)
returns table (
  total_count int,
  fresh_count int,
  warning_count int,
  expired_count int,
  avg_remaining_days int,
  top_category text
)
language sql
security invoker
set search_path = public
as $$
  with scoped as (
    select *
    from public.food_items fi
    where fi.user_id = auth.uid()
      and (
        range_days is null
        or fi.in_date >= (current_date - ((range_days - 1) * interval '1 day'))::date
      )
  ),
  classified as (
    select
      category,
      case
        when expire_date < current_date then 'expired'
        when expire_date <= current_date + 3 then 'warning'
        else 'fresh'
      end as status,
      greatest((expire_date - current_date), 0) as remaining_days
    from scoped
  ),
  category_rank as (
    select category, count(*) as cnt,
      row_number() over (order by count(*) desc, category asc) as rn
    from classified
    group by category
  )
  select
    count(*)::int as total_count,
    count(*) filter (where status = 'fresh')::int as fresh_count,
    count(*) filter (where status = 'warning')::int as warning_count,
    count(*) filter (where status = 'expired')::int as expired_count,
    coalesce(round(avg(remaining_days))::int, 0) as avg_remaining_days,
    coalesce((select category from category_rank where rn = 1), '无') as top_category
  from classified;
$$;

grant execute on function public.dashboard_stats(int) to authenticated;
