# Prompt Arch — End-to-end audit snapshot

Audit date: 2026-10-20  
Target: `Prompt_Arch/` static HTML/CSS/JavaScript app, Supabase Auth/Postgres/Storage, Vercel production hosting.

## Confirmed baseline

- Production homepage responds HTTP 200.
- Vercel runtime-error aggregation reported no runtime errors in the previous 7 days.
- The Supabase security advisor reports **Leaked Password Protection Disabled** (WARN).
- The production response already includes HSTS, but the other intended headers in `_headers` are not applied by Vercel. A Vercel-native `vercel.json` header configuration is included in this change.
- The app is a static frontend with no root `package.json`; the Supabase JS SDK is loaded from `esm.sh`. A dependency CVE audit and a real browser Lighthouse run are not available from this static source-only check.

## Changes in this branch

- Add Vercel-native response headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and explicit HSTS.
- Add a complete password-recovery flow: Supabase `resetPasswordForEmail`, recovery-event handling, new-password form, and `updateUser`; success messaging avoids confirming whether an account exists.
- Add Open Graph/Twitter metadata, canonical URL, web app manifest, SVG icon, robots.txt, and sitemap.xml.
- Add dependency-free Node.js security/metadata regression checks and a GitHub Actions workflow.
- Existing RLS policies keep permanent prompt writes and review actions admin-only; community submissions are forced to pending by a database trigger. Public media is intentionally readable for public prompt previews; uploads are authenticated, UID-folder scoped, MIME allow-listed, and limited to 25 MiB.

## Findings and disposition

| Severity | Finding | Status |
|---|---|---|
| P1 | Supabase leaked-password protection disabled | **Open — production security gate remains blocked** until enabled in Supabase Auth settings and verified. This setting is not exposed by the available project-management actions in this session; do not claim it was changed. |
| P2 | Missing password recovery flow | Fixed and covered by static regression tests; live email delivery/reset-link flow still needs a real account smoke test. |
| P2 | Security headers configured in a non-Vercel `_headers` file were not all present on the live response | Vercel-native configuration added and verified on a successful preview: expected security headers were present on HTML and static assets. Latest branch revision did not receive a fresh deployment because Vercel returned a build-rate-limit error. |
| P2 | Public media storage can be abused for high-volume authenticated uploads; per-file size/MIME controls do not provide account-level quotas or content sniffing | Existing RLS and bucket restrictions verified. Add quotas/rate limiting and server-side content inspection in a future server-side upload flow; do not switch the bucket private without redesigning public preview delivery. |
| P2 | No enforced Content Security Policy observed/configured | Not changed yet; requires browser verification because the app loads the Supabase SDK from esm.sh and uses Google Fonts and Supabase media. |
| P3 | Missing install/SEO sharing metadata and crawler files | Added in this branch. |
| P3 | Seven database indexes are currently reported unused by Supabase | No indexes removed: usage may be low or recent, and deleting them without workload evidence could regress queries. Re-evaluate after collecting query workload. |

## Verification limits

The included automated tests are static regression checks, not a full browser integration suite. Signup/login, OAuth callback, password-reset email delivery, upload/delete, admin moderation, RLS denial cases, touch-device QA, cross-browser behavior, Lighthouse scores, and Core Web Vitals still require live smoke/manual tests. No before/after performance numbers are asserted without measurements.

## Required before production merge

1. Enable leaked-password protection in Supabase Auth password/security settings.
2. Verify the Supabase Auth redirect allow-list includes `https://prompt-arch-orpin.vercel.app/**` (and the intended preview domain only if required).
3. Wait for Vercel preview build quota/rate limit to recover, then verify the latest branch revision and response headers. GitHub Actions static checks pass on the latest tested revision.
4. Run account recovery and role/RLS negative tests with a non-admin account before promoting.
