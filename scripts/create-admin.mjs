// Creates the first admin (or makes an existing account an admin). Run it yourself, in a terminal:
//   npm run admin:create -- admin@example.com
// Uses SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local, so it targets whichever project those point
// at. Needs supabase/migrations applied first. The password is typed into a hidden prompt — it is never
// a command-line argument, so it stays out of shell history and process lists — and Supabase Auth hashes it.
// Two-factor sign-in is set up on first sign-in (/mfa), then the admin lands on /admin.
import { createClient } from "@supabase/supabase-js";

const PASSWORD = { min: 10, max: 72 }; // PASSWORD_RULES in features/auth/contract.ts
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

/** Reads a line without echoing it (raw mode); Ctrl+C aborts. */
function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    let value = "";
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          stdout.write("\n");
          process.exit(130);
        } else if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        } else if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    };
    stdin.on("data", onData);
  });
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !EMAIL_SHAPE.test(email)) fail("Usage: npm run admin:create -- <email>");

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) fail("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local.");
if (!process.stdin.isTTY) fail("Run this in an interactive terminal (the password prompt needs one).");

const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

// The schema must be in place: the profile trigger and the roles table come from the initial migration.
// Selecting roles.role (not just the table) also refuses the old draft schema, whose roles table differs.
const probe = await supabase.from("roles").select("user_id, role", { head: true, count: "exact" }).limit(1);
if (probe.error) fail(`The database isn't ready (${probe.error.message}). Apply supabase/migrations first.`);

console.log(`Project: ${new URL(url).host}\nAdmin:   ${email}`);

const existing = await supabase.from("profiles").select("id, status").eq("email", email).maybeSingle();
if (existing.error) fail(`Looking up ${email} failed: ${existing.error.message}`);

let userId = existing.data?.id;
let created = false;

if (userId) {
  if (existing.data.status === "inactive") fail(`${email} is deactivated. Reactivate the account first.`);
  console.log("That account already exists — granting the admin role only (password unchanged).");
} else {
  const password = await askHidden(`Password for ${email} (${PASSWORD.min}–${PASSWORD.max} characters, letters and digits): `);
  if (password.length < PASSWORD.min || password.length > PASSWORD.max || !/[a-z]/i.test(password) || !/\d/.test(password)) {
    fail(`Use ${PASSWORD.min}–${PASSWORD.max} characters with at least one letter and one digit.`);
  }
  if ((await askHidden("Type it again: ")) !== password) fail("The passwords don't match.");

  // email_confirm: the address is trusted (an operator is creating it), so no confirmation email is needed.
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Admin" },
  });
  if (error) fail(`Creating the account failed: ${error.message}`);
  userId = data.user.id;
  created = true;
}

const grant = await supabase.from("roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
if (grant.error) {
  // Never leave a brand-new account without its role.
  if (created) await supabase.auth.admin.deleteUser(userId);
  fail(`Granting the admin role failed: ${grant.error.message}`);
}

console.log(`
✓ ${email} is an admin.

Next:
  1. Make sure the custom access token hook is enabled (Dashboard → Authentication → Hooks), or the
     app won't see the role.
  2. Sign in at /login. You'll be asked to set up an authenticator app (two-factor), then land on /admin.`);
