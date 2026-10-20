# Prompt Arch

Prompt Arch is a monochrome prompt library with a local personal library and a Supabase-powered community archive.

## Features
- **My Library:** local-only prompt library, search, collections, imports/exports, favorites and copying.
- **Community Prompts:** public searchable archive of approved prompts.
- **Google sign-in:** Supabase Auth integration.
- **Suggestion moderation:** community submissions enter a queue; only admins can publish, approve or reject.
- **Media previews:** image/video uploads to Supabase Storage.

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
- `supabase/schema.sql` — schema and row-level security policies

## Security
Only use the Supabase publishable/anon key in `config.js`. Never add a Google OAuth client secret, Supabase secret/service-role key, database password, or personal access token to this repository. RLS is the security boundary for public community writes.

## Site
Live site: https://prompt-arch.pages.dev
