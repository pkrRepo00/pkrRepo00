import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [headers, html, cloud, config, schema, manifest] = await Promise.all([
  read("../vercel.json"), read("../index.html"), read("../cloud.js"),
  read("../config.js"), read("../supabase/schema.sql"), read("../manifest.json")
]);
const headerConfig = JSON.parse(headers).headers.flatMap((route) => route.headers);
const header = (name) => headerConfig.find((item) => item.key.toLowerCase() === name.toLowerCase())?.value;

test("production response security headers are configured", () => {
  assert.equal(header("X-Content-Type-Options"), "nosniff");
  assert.equal(header("X-Frame-Options"), "DENY");
  assert.equal(header("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(header("Strict-Transport-Security"), /max-age=63072000/);
  assert.match(header("Permissions-Policy"), /camera=\(\)/);
});

test("browser configuration contains no server-side secret", () => {
  assert.match(config, /sb_publishable_[A-Za-z0-9_-]+/);
  assert.doesNotMatch(config, /service_role|SUPABASE_SECRET|PRIVATE_KEY/i);
});

test("community uploads enforce allowlisted MIME and a 25 MiB client limit", () => {
  assert.match(cloud, /const ok=\["image\/jpeg","image\/png","image\/webp","image\/gif","video\/mp4","video\/webm","video\/quicktime"\]/);
  assert.match(cloud, /file\.size>25\*1024\*1024/);
  assert.match(schema, /file_size_limit, allowed_mime_types/);
  assert.match(schema, /authenticated_upload_own_prompt_media/);
});

test("RLS keeps permanent prompt writes admin-only and submissions pending", () => {
  assert.match(schema, /create policy admins_insert_prompts[\s\S]*?with check \(private\.is_prompt_arch_admin\(\)\)/);
  assert.match(schema, /create policy admins_update_prompts[\s\S]*?using \(private\.is_prompt_arch_admin\(\)\) with check \(private\.is_prompt_arch_admin\(\)\)/);
  assert.match(schema, /create policy community_prompts_submit[\s\S]*?status = 'pending'/);
  assert.match(schema, /create trigger enforce_community_prompt_submission/);
});

test("dynamic preview metadata escapes HTML-sensitive characters", () => {
  assert.match(cloud, /const esc=v=>String\(v\?\?""\)\.replace\(\/\[&<>\\"'\]/);
  assert.match(cloud, /esc\(item\.media_url\)/);
  assert.match(cloud, /esc\(item\.title\)/);
});

test("password recovery avoids account enumeration in its success message", () => {
  assert.match(cloud, /resetPasswordForEmail\(email/);
  assert.match(cloud, /If an account exists for this email/);
  assert.match(html, /id="authForgotPassword"/);
});

test("SEO and install metadata are present", () => {
  assert.match(html, /property="og:title"/);
  assert.match(html, /rel="canonical"/);
  assert.match(html, /rel="manifest"/);
  assert.equal(JSON.parse(manifest).display, "standalone");
});
