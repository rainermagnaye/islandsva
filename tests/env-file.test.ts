// Guards the committed .env: it holds shared non-secret defaults, so a secret set here would be published
// in git history. Secrets belong in .env.local (git-ignored) and in Vercel.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SECRET_KEYS = ["SUPABASE_SECRET_KEY", "SUPABASE_PUBLISHABLE_KEY", "TURNSTILE_SECRET_KEY", "RESEND_API_KEY", "IP_HASH_SECRET"];
const KEY_LIKE_VALUE = /^(sb_(secret|publishable)_|re_|0x4|eyJ)|^[A-Za-z0-9_-]{32,}$/;

const assignments = readFileSync(fileURLToPath(new URL("../.env", import.meta.url)), "utf8")
  .split(/\r?\n/)
  .filter((line) => /^\s*[A-Z0-9_]+\s*=/.test(line))
  .map((line) => {
    const [name, ...value] = line.split("=");
    return { name: name.trim(), value: value.join("=").trim().replace(/^["']|["']$/g, "") };
  });

describe("committed .env", () => {
  it.each(SECRET_KEYS)("does not set %s", (key) => {
    expect(assignments.find((a) => a.name === key)).toBeUndefined();
  });

  it("contains no key- or token-like values", () => {
    expect(assignments.filter((a) => KEY_LIKE_VALUE.test(a.value)).map((a) => a.name)).toEqual([]);
  });
});
