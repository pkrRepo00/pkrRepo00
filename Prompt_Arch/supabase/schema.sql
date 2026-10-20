-- Prompt Arch hosted backend schema (Supabase PostgreSQL + Auth + Storage)
-- Public clients use only the publishable key. Never expose service_role/secret keys.
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create or replace function private.handle_new_prompt_arch_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_prompt_arch_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_prompt_arch on auth.users;
create trigger on_auth_user_created_prompt_arch after insert on auth.users
for each row execute procedure private.handle_new_prompt_arch_user();

create or replace function private.is_prompt_arch_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;
revoke all on function private.is_prompt_arch_admin() from public, anon;
grant execute on function private.is_prompt_arch_admin() to authenticated;

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 50000),
  category text not null default 'Other',
  prompt_type text not null default 'Other',
  tags text[] not null default '{}',
  media_url text,
  media_type text,
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null,
  model_name text,
  aspect_ratio text,
  resolution text,
  duration_seconds numeric,
  fps integer,
  style text,
  negative_prompt text,
  seed text,
  camera_movement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 50000),
  category text not null default 'Other',
  prompt_type text not null default 'Other',
  tags text[] not null default '{}',
  media_url text,
  media_type text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid not null references auth.users(id) on delete cascade,
  model_name text,
  aspect_ratio text,
  resolution text,
  duration_seconds numeric,
  fps integer,
  style text,
  negative_prompt text,
  seed text,
  camera_movement text,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists prompts_public_created_idx on public.prompts (created_at desc) where status = 'published';
create index if not exists prompts_type_idx on public.prompts (prompt_type) where status = 'published';
create index if not exists prompts_visual_type_created_idx on public.prompts (prompt_type, created_at desc) where status = 'published';
create index if not exists prompt_suggestions_type_created_idx on public.prompt_suggestions (prompt_type, created_at desc) where status = 'pending';
create index if not exists prompts_created_by_idx on public.prompts (created_by);
create index if not exists suggestions_queue_idx on public.prompt_suggestions (created_at) where status = 'pending';
create index if not exists suggestions_created_by_idx on public.prompt_suggestions (created_by);
create index if not exists suggestions_reviewed_by_idx on public.prompt_suggestions (reviewed_by);

alter table public.profiles enable row level security;
alter table public.prompts enable row level security;
alter table public.prompt_suggestions enable row level security;
grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;
revoke all on function private.is_prompt_arch_admin() from public, anon;
grant execute on function private.is_prompt_arch_admin() to authenticated;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
revoke all on public.prompts from anon, authenticated;
grant select on public.prompts to anon, authenticated;
grant insert, update, delete on public.prompts to authenticated;
revoke all on public.prompt_suggestions from anon, authenticated;
grant select, insert, update on public.prompt_suggestions to authenticated;

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.is_prompt_arch_admin());
drop policy if exists public_read_published_prompts on public.prompts;
create policy public_read_published_prompts on public.prompts for select to anon, authenticated
using (status = 'published' or private.is_prompt_arch_admin());
drop policy if exists admins_insert_prompts on public.prompts;
create policy admins_insert_prompts on public.prompts for insert to authenticated
with check (private.is_prompt_arch_admin());
drop policy if exists admins_update_prompts on public.prompts;
create policy admins_update_prompts on public.prompts for update to authenticated
using (private.is_prompt_arch_admin()) with check (private.is_prompt_arch_admin());
drop policy if exists admins_delete_prompts on public.prompts;
create policy admins_delete_prompts on public.prompts for delete to authenticated
using (private.is_prompt_arch_admin());
drop policy if exists users_submit_own_suggestions on public.prompt_suggestions;
create policy users_submit_own_suggestions on public.prompt_suggestions for insert to authenticated
with check (created_by = (select auth.uid()) and status = 'pending');
drop policy if exists users_read_own_or_admin_suggestions on public.prompt_suggestions;
create policy users_read_own_or_admin_suggestions on public.prompt_suggestions for select to authenticated
using (created_by = (select auth.uid()) or private.is_prompt_arch_admin());
drop policy if exists admins_review_suggestions on public.prompt_suggestions;
create policy admins_review_suggestions on public.prompt_suggestions for update to authenticated
using (private.is_prompt_arch_admin()) with check (private.is_prompt_arch_admin());

-- Community submissions are separate from permanent, administrator-curated prompts.
create table if not exists public.community_prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 50000),
  category text not null default 'Other',
  prompt_type text not null default 'Other',
  tags text[] not null default '{}',
  media_url text,
  media_type text,
  status text not null default 'pending' check (status in ('pending','published','hidden')),
  created_by uuid not null references auth.users(id) on delete cascade,
  model_name text,
  aspect_ratio text,
  resolution text,
  duration_seconds numeric,
  fps integer,
  style text,
  negative_prompt text,
  seed text,
  camera_movement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_prompts_published_idx
  on public.community_prompts (created_at desc) where status = 'published';
create index if not exists community_prompts_user_idx
  on public.community_prompts (created_by, created_at desc);

alter table public.community_prompts enable row level security;
revoke all on public.community_prompts from anon, authenticated;
grant select on public.community_prompts to anon, authenticated;
grant insert, update, delete on public.community_prompts to authenticated;

drop policy if exists community_prompts_read_published on public.community_prompts;
create policy community_prompts_read_published on public.community_prompts
  for select to anon, authenticated
  using (status = 'published' or private.is_prompt_arch_admin());
drop policy if exists community_prompts_submit on public.community_prompts;
create policy community_prompts_submit on public.community_prompts for insert to authenticated
  with check (created_by = (select auth.uid()) and status = 'pending');
drop policy if exists community_prompts_update_admin_only on public.community_prompts;
create policy community_prompts_update_admin_only on public.community_prompts for update to authenticated
  using (private.is_prompt_arch_admin()) with check (private.is_prompt_arch_admin());
drop policy if exists community_prompts_delete_owner_or_admin on public.community_prompts;
create policy community_prompts_delete_owner_or_admin on public.community_prompts for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_prompt_arch_admin());

create or replace function private.enforce_community_prompt_submission()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $
begin
  if not private.is_prompt_arch_admin() then
    new.created_by := (select auth.uid());
    new.status := 'pending';
  end if;
  return new;
end;
$;
revoke all on function private.enforce_community_prompt_submission() from public, anon, authenticated;
drop trigger if exists enforce_community_prompt_submission on public.community_prompts;
create trigger enforce_community_prompt_submission
before insert on public.community_prompts
for each row execute function private.enforce_community_prompt_submission();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prompt-media', 'prompt-media', true, 26214400,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 26214400, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists public_read_prompt_media on storage.objects;
create policy public_read_prompt_media on storage.objects for select to anon, authenticated using (bucket_id = 'prompt-media');
drop policy if exists authenticated_upload_own_prompt_media on storage.objects;
create policy authenticated_upload_own_prompt_media on storage.objects for insert to authenticated
with check (bucket_id = 'prompt-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists owners_delete_own_prompt_media on storage.objects;
create policy owners_delete_own_prompt_media on storage.objects for delete to authenticated
using (bucket_id = 'prompt-media' and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_prompt_arch_admin()));
