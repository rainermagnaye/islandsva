// First-load JS per page, gzipped — run after `npm run build`. Fails (exit 1) when any page goes over its
// budget in CLAUDE.md §8, so CI can block a regression. Measures every script the prerendered HTML loads:
// framework, shared chunks and the page's own client components.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

// Framework baseline (React + Next.js runtime) is ~145 KB; the rest is headroom for a page's own islands.
// Public and sign-in pages keep the tight budget (Lighthouse, first impressions). Signed-in portal pages get
// more room: visitors never load them, and some carry long forms (the VA profile) — see docs/decisions.md.
const BUDGET_KB = 160;
const PORTAL_BUDGET_KB = 170;
const PORTAL_ROUTES = ["/admin", "/client", "/closer", "/va", "/dashboard"];
const APP_DIR = ".next/server/app";

const budgetFor = (route) =>
  PORTAL_ROUTES.some((base) => route === base || route.startsWith(`${base}/`)) ? PORTAL_BUDGET_KB : BUDGET_KB;

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

const pages = readdirSync(APP_DIR).filter((f) => f.endsWith(".html") && !f.startsWith("_"));
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
  const budget = budgetFor(route);
  const over = kb > budget;
  failed ||= over;
  console.log(`${over ? "✗" : "✓"} ${route.padEnd(16)} ${kb.toFixed(1).padStart(6)} KB / ${budget}  (${scripts.size} scripts)`);
}
console.log(`Budget: ${BUDGET_KB} KB gzipped first-load JS per page; ${PORTAL_BUDGET_KB} KB for signed-in portal pages.`);
process.exit(failed ? 1 : 0);
