-- Prompt Arch 2.0: optional generation metadata for image, video and other prompt types.
-- Safe additive migration: does not drop or rewrite existing prompts or submissions.
alter table public.prompts
  add column if not exists model_name text,
  add column if not exists aspect_ratio text,
  add column if not exists resolution text,
  add column if not exists duration_seconds numeric,
  add column if not exists fps integer,
  add column if not exists style text,
  add column if not exists negative_prompt text,
  add column if not exists seed text,
  add column if not exists camera_movement text;

alter table public.prompt_suggestions
  add column if not exists model_name text,
  add column if not exists aspect_ratio text,
  add column if not exists resolution text,
  add column if not exists duration_seconds numeric,
  add column if not exists fps integer,
  add column if not exists style text,
  add column if not exists negative_prompt text,
  add column if not exists seed text,
  add column if not exists camera_movement text;

create index if not exists prompts_visual_type_created_idx
  on public.prompts (prompt_type, created_at desc)
  where status = 'published';
create index if not exists prompt_suggestions_type_created_idx
  on public.prompt_suggestions (prompt_type, created_at desc)
  where status = 'pending';
