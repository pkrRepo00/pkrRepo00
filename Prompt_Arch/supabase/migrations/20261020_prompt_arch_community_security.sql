-- Prompt Arch community and authorization hardening.
-- Public prompt archive stays separate from signed-in user submissions.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
revoke all on function private.is_prompt_arch_admin() from public, anon;
grant execute on function private.is_prompt_arch_admin() to authenticated;

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
create index if not exists community_prompts_published_idx on public.community_prompts(created_at desc) where status='published';
create index if not exists community_prompts_user_idx on public.community_prompts(created_by, created_at desc);
alter table public.community_prompts enable row level security;
revoke all on public.community_prompts from anon, authenticated;
grant select on public.community_prompts to anon, authenticated;
grant insert, update, delete on public.community_prompts to authenticated;

drop policy if exists community_prompts_read_published on public.community_prompts;
create policy community_prompts_read_published on public.community_prompts for select to anon, authenticated
  using (status='published' or private.is_prompt_arch_admin());
drop policy if exists community_prompts_submit on public.community_prompts;
create policy community_prompts_submit on public.community_prompts for insert to authenticated
  with check (created_by=(select auth.uid()) and status='pending');
drop policy if exists community_prompts_update_admin_only on public.community_prompts;
create policy community_prompts_update_admin_only on public.community_prompts for update to authenticated
  using (private.is_prompt_arch_admin()) with check (private.is_prompt_arch_admin());
drop policy if exists community_prompts_delete_owner_or_admin on public.community_prompts;
create policy community_prompts_delete_owner_or_admin on public.community_prompts for delete to authenticated
  using (created_by=(select auth.uid()) or private.is_prompt_arch_admin());

create or replace function private.enforce_community_prompt_submission()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if not private.is_prompt_arch_admin() then
    new.created_by := (select auth.uid());
    new.status := 'pending';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_community_prompt_submission() from public, anon, authenticated;
drop trigger if exists enforce_community_prompt_submission on public.community_prompts;
create trigger enforce_community_prompt_submission before insert on public.community_prompts
for each row execute function private.enforce_community_prompt_submission();

-- Least privilege: users cannot mutate role fields or publish permanent prompts without passing the admin RLS policy.
revoke all on public.prompts from anon, authenticated;
grant select on public.prompts to anon, authenticated;
grant insert, update, delete on public.prompts to authenticated;
revoke all on public.prompt_suggestions from anon, authenticated;
grant select, insert, update on public.prompt_suggestions to authenticated;

drop policy if exists community_prompts_update_owner_or_admin on public.community_prompts;
