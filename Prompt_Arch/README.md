# Prompt Arch

Prompt Arch is a monochrome prompt library with a local personal library and a Supabase-powered community archive.

## Features
- **My Library:** local-only prompt library, search, collections, imports/exports, favorites and copying.
- **Prompt types:** text, image, video, image-to-video, audio, AI agent, code, workflow, research, business, and other.
- **Visual generation controls:** model/tool, aspect ratio, resolution, duration, FPS, visual style, camera movement, seed/parameters, and negative prompt.
- **Preview media:** attach local image/video previews in My Library; community previews upload to Supabase Storage. Local previews use IndexedDB and stay on that browser/device.
- **One-click templates:** photorealistic image, product photography, anime/concept art, cinematic video, image-to-video, character reference sheet, and AI agent/workflow.
- **Tags and discovery:** suggested quick tags for visual prompts, type filters, full-text search across metadata, collections, favorites, grid/list views, and recent prompts.
- **Complete copy:** copy actions preserve main prompt text and its model, aspect ratio, resolution, duration/FPS, style, camera, seed, and negative prompt when present.
- **Community Prompts:** separate public searchable archive for approved prompts.
- **Google sign-in:** Supabase Auth integration.
- **Suggestion moderation:** community submissions enter a queue; only admins can publish, approve or reject.
- **Bulk import/export:** local JSON/text import and export, plus admin JSON import for public prompts. Local binary preview files are not bundled into JSON exports.

## Static hosting
The app is static HTML, CSS and JavaScript and can be hosted on Cloudflare Pages. The folder includes the root app files and `supabase/schema.sql` for the backend schema.

## Configure
1. Configure the Supabase project and run `supabase/schema.sql` in its SQL Editor.
2. Set Supabase Google provider credentials in the dashboard; never commit an OAuth client secret or service-role key.
3. Configure Supabase Auth URL settings for your deployed domain.
4. Review the RLS policies and promote only your own trusted account to admin.

## Files
- `index.html` — application shell
- `styles.css` — styles and responsive layout
- `app.js` — local prompt library
- `cloud.js` — community archive, auth and moderation
- `config.js` — public browser config (publishable key only)
- `supabase/schema.sql` — tables, indexes, RLS policies, auth profile trigger, and media bucket policies
- `supabase/migrations/20261020_visual_prompt_metadata.sql` — additive migration for visual-generation metadata

## Security
Only use the Supabase publishable/anon key in `config.js`. Never add a Google OAuth client secret, Supabase secret/service-role key, database password, or personal access token to this repository. RLS is the security boundary for public community writes.

## Site
Live site: https://prompt-arch.pages.dev
