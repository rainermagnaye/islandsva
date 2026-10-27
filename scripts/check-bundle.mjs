// First-load JS per page, gzipped — run after `npm run build`. Fails (exit 1) when any page goes over the
// budget in CLAUDE.md §8, so CI can block a regression. Measures every prerendered page, nested and
// dynamic-route shells included, and every script its HTML loads: framework, shared chunks and the page's
// own client components.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

// Framework baseline (React + Next.js runtime) is ~148 KB; the rest is headroom for a page's own islands.
const BUDGET_KB = 160;
const APP_DIR = ".next/server/app";

// Pages already over the budget when nested routes were first measured (2026-10-27), each held to its size
// then. Remove a page once it's back under the budget; never add one or raise a cap (docs/decisions.md).
const OVER_BUDGET_CAPS_KB = {
  "/admin/demos": 176.8,
  "/admin/leads/[id]": 176.3,
  "/admin/clients/[id]": 172.5,
  "/va/calendar": 169.0,
  "/client/calendar": 168.0,
  "/admin/users/[id]": 167.1,
  "/admin/users": 161.6,
  "/admin/leads": 161.6,
  "/register/[token]": 161.2,
};

if (!existsSync(APP_DIR)) {
  console.error("No build found — run `npm run build` first.");
  process.exit(1);
}

const gzipKb = new Map();
function chunkKb(src) {
  if (!gzipKb.has(src)) {
    const file = join(".next", src.replace(/^\/_next\//, "").split("?")[0]);
    gzipKb.set(src, existsSync(file) ? gzipSync(readFileSync(file)).length / 1024 : 0);
  }
  return gzipKb.get(src);
}

// `_global-error`, `_not-found` and the like are Next.js internals, not pages.
const pages = readdirSync(APP_DIR, { recursive: true })
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => file.endsWith(".html") && !file.split("/").some((part) => part.startsWith("_")));
const routes = new Set();
let failed = false;
for (const page of pages.sort()) {
  const html = readFileSync(join(APP_DIR, page), "utf8");
  // noModule scripts are legacy polyfills that modern browsers never download — not part of first load.
  const scripts = new Set(
    [...html.matchAll(/<script\b([^>]*)\bsrc="(\/_next\/static\/[^"]+\.js[^"]*)"([^>]*)>/g)]
      .filter((m) => !/\bnoModule\b/i.test(m[1] + m[3]))
      .map((m) => m[2]),
  );
  const kb = [...scripts].reduce((sum, src) => sum + chunkKb(src), 0);
  const route = page === "index.html" ? "/" : `/${page.replace(/\.html$/, "")}`;
  routes.add(route);
  const cap = OVER_BUDGET_CAPS_KB[route];
  const limit = cap ?? BUDGET_KB;
  // Compare at the precision printed, so a cap equals the size it was measured at.
  const size = Number(kb.toFixed(1));
  const over = size > limit;
  // A capped page back under the budget fails too, so its cap is removed and the list only shrinks.
  const stale = cap !== undefined && size <= BUDGET_KB;
  failed ||= over || stale;
  const note = cap === undefined ? ""
    : over ? `  over its cap of ${cap} KB`
    : stale ? `  under ${BUDGET_KB} KB now — remove its cap from OVER_BUDGET_CAPS_KB`
    : `  capped at ${cap} KB until it's back under ${BUDGET_KB}`;
  console.log(`${over || stale ? "✗" : "✓"} ${route.padEnd(24)} ${kb.toFixed(1).padStart(6)} KB  (${scripts.size} scripts)${note}`);
}
for (const route of Object.keys(OVER_BUDGET_CAPS_KB).filter((r) => !routes.has(r))) {
  console.log(`✗ ${route.padEnd(24)} has a cap but no page — remove it from OVER_BUDGET_CAPS_KB`);
  failed = true;
}
console.log(`Budget: ${BUDGET_KB} KB gzipped first-load JS per page.`);
process.exit(failed ? 1 : 0);
