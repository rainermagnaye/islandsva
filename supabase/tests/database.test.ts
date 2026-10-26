import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

// Runs every migration on PGlite (real Postgres in WASM, no Docker) against stand-ins for Supabase's roles
// and auth schema, then checks grants, RLS (allowed and denied per role), triggers, constraints and the
// access-token hook. auth.uid()/auth.jwt() read `request.jwt.claims`, as on Supabase.

const MIGRATIONS = join(import.meta.dirname, "..", "migrations");

const ADMIN = "00000000-0000-0000-0000-00000000000a";
const VA = "00000000-0000-0000-0000-00000000000b";
const VA2 = "00000000-0000-0000-0000-00000000000e";
const CLIENT = "00000000-0000-0000-0000-00000000000c";
const CLOSER = "00000000-0000-0000-0000-00000000000d";
const CLOSER2 = "00000000-0000-0000-0000-00000000000f";

const db = new PGlite();

type Claims = Record<string, unknown>;
const token = (sub: string, roles: string[], aal = "aal1"): Claims => ({ sub, role: "authenticated", aal, app_metadata: { roles } });
const asAdmin = token(ADMIN, ["admin"], "aal2");
const asVa = token(VA, ["va"]);
const asVa2 = token(VA2, ["va"]);
const asClient = token(CLIENT, ["client"]);
const asCloser = token(CLOSER, ["closer"]);
const asCloser2 = token(CLOSER2, ["closer"]);

/** Runs SQL as an API role with the given token claims; resolves to the rows or rejects with Postgres' error. */
async function as<T = Record<string, unknown>>(role: string, claims: Claims, sql: string, params: unknown[] = []) {
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
  await db.exec(`set role ${role}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}
const asUser = <T = Record<string, unknown>>(claims: Claims, sql: string, params: unknown[] = []) => as<T>("authenticated", claims, sql, params);
const asServer = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => as<T>("service_role", {}, sql, params);
const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

async function hookRoles(userId: string) {
  const event = { user_id: userId, claims: { sub: userId, aal: "aal1", app_metadata: { provider: "email" } } };
  const [row] = await as<{ e: { claims: { app_metadata: { roles: string[]; provider: string } } } }>(
    "supabase_auth_admin",
    {},
    "select public.custom_access_token_hook($1::jsonb) as e",
    [JSON.stringify(event)],
  );
  return row.e.claims.app_metadata;
}

// Clients created by CLOSER (A, B) and CLOSER2 (C). A belongs to CLIENT and is assigned to VA.
let clientA = "";
let clientB = "";
let clientC = "";

beforeAll(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role supabase_auth_admin nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}', last_sign_in_at timestamptz
    );
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
    grant all on auth.users to supabase_auth_admin;
    grant usage on schema public to anon, authenticated, service_role;
    -- Supabase's platform defaults, which the migration must undo.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }

  // Users arrive the way Supabase Auth creates them: as supabase_auth_admin inserting into auth.users.
  await as("supabase_auth_admin", {}, `
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${ADMIN}', 'Ada@X.co', '{"full_name":"Ada Admin"}'),
      ('${VA}', 'va@x.co', '{}'),
      ('${VA2}', 'va2@x.co', '{}'),
      ('${CLIENT}', 'client@x.co', '{"full_name":"Cleo Client"}'),
      ('${CLOSER}', 'closer@x.co', '{}'),
      ('${CLOSER2}', 'closer2@x.co', '{}')`);
  await asServer(`
    insert into public.roles (user_id, role) values
      ('${ADMIN}', 'admin'), ('${ADMIN}', 'closer'), ('${VA}', 'va'), ('${VA2}', 'va'),
      ('${CLIENT}', 'client'), ('${CLOSER}', 'closer'), ('${CLOSER2}', 'closer')`);

  const newClient = async (name: string, createdBy: string, userId: string | null) =>
    (await asServer<{ id: string }>(
      "insert into public.clients (company_name, contact_name, contact_email, created_by, user_id) values ($1, 'Contact', $2, $3, $4) returning id",
      [name, `${name.toLowerCase()}@x.co`, createdBy, userId],
    ))[0].id;
  clientA = await newClient("Acme", CLOSER, CLIENT);
  clientB = await newClient("Beta", CLOSER, null);
  clientC = await newClient("Gamma", CLOSER2, null);
  await asServer("insert into public.client_va_assignments (client_id, va_id) values ($1, $2)", [clientA, VA]);
});

describe("users (profiles)", () => {
  it("creates an invited profile per auth user, lower-casing the email and copying full_name", async () => {
    const rows = (await db.query<{ id: string; email: string; full_name: string; status: string }>("select * from public.profiles")).rows;
    expect(rows).toHaveLength(6);
    expect(rows.find((p) => p.id === ADMIN)).toMatchObject({ email: "ada@x.co", full_name: "Ada Admin", status: "invited" });
  });

  it("syncs email changes and activates the account on first sign-in", async () => {
    await as("supabase_auth_admin", {}, `update auth.users set email = 'ada.admin@x.co', last_sign_in_at = now() where id = '${ADMIN}'`);
    const [p] = (await db.query<{ email: string; status: string }>(`select email, status from public.profiles where id = '${ADMIN}'`)).rows;
    expect(p).toEqual({ email: "ada.admin@x.co", status: "active" });
  });

  it("keeps a VA invited after they set a password, and still activates a Closer", async () => {
    await as("supabase_auth_admin", {}, `update auth.users set last_sign_in_at = now() where id = '${VA}'`);
    const [va] = (await db.query<{ status: string; signed_in_at: string | null }>(`select status, signed_in_at from public.profiles where id = '${VA}'`)).rows;
    expect(va.status).toBe("invited");
    expect(va.signed_in_at).not.toBeNull();

    await as("supabase_auth_admin", {}, `update auth.users set last_sign_in_at = now() where id = '${CLOSER}'`);
    expect((await db.query<{ status: string }>(`select status from public.profiles where id = '${CLOSER}'`)).rows[0].status).toBe("active");
  });

  it("keeps a deactivated user inactive when they sign in", async () => {
    await asServer(`update public.profiles set status = 'inactive' where id = '${CLOSER2}'`);
    await as("supabase_auth_admin", {}, `update auth.users set last_sign_in_at = now() where id = '${CLOSER2}'`);
    expect((await db.query<{ status: string }>(`select status from public.profiles where id = '${CLOSER2}'`)).rows[0].status).toBe("inactive");
    await asServer(`update public.profiles set status = 'active' where id = '${CLOSER2}'`);
  });

  it("lets users read only their own profile; admins with 2FA read all", async () => {
    expect(ids(await asUser(asClient, "select id from public.profiles"))).toEqual([CLIENT]);
    expect(await asUser(token(ADMIN, ["admin"], "aal1"), "select id from public.profiles")).toHaveLength(1);
    expect(await asUser(asAdmin, "select id from public.profiles")).toHaveLength(6);
  });

  it("does not let users edit their profile", async () => {
    await expect(asUser(asClient, `update public.profiles set status = 'active' where id = '${CLIENT}'`)).rejects.toThrow(/permission denied/);
  });
});

describe("roles", () => {
  it("lets users read only their own roles; admins with 2FA read all", async () => {
    const own = await asUser<{ user_id: string }>(asClient, "select user_id from public.roles");
    expect(own.map((r) => r.user_id)).toEqual([CLIENT]);
    expect(await asUser(asAdmin, "select id from public.roles")).toHaveLength(7);
  });

  it("does not let anyone grant themselves a role through the API", async () => {
    await expect(asUser(asClient, `insert into public.roles (user_id, role) values ('${CLIENT}', 'admin')`)).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, `insert into public.roles (user_id, role) values ('${CLIENT}', 'va')`)).rejects.toThrow(/permission denied/);
  });

  it("allows each role once per user", async () => {
    await expect(asServer(`insert into public.roles (user_id, role) values ('${VA}', 'va')`)).rejects.toThrow(/duplicate key/);
  });
});

describe("access token hook", () => {
  it("adds the user's roles and keeps existing app_metadata", async () => {
    const meta = await hookRoles(ADMIN);
    expect(meta.provider).toBe("email");
    expect([...meta.roles].sort()).toEqual(["admin", "closer"]);
  });

  it("gives inactive users no roles", async () => {
    await asServer(`update public.profiles set status = 'inactive' where id = '${VA2}'`);
    expect((await hookRoles(VA2)).roles).toEqual([]);
    await asServer(`update public.profiles set status = 'active' where id = '${VA2}'`);
    expect((await hookRoles(VA2)).roles).toEqual(["va"]);
  });

  it.each(["anon", "authenticated", "service_role"])("cannot be called by %s", async (role) => {
    await expect(as(role, asClient, "select public.custom_access_token_hook('{}'::jsonb)")).rejects.toThrow(/permission denied/);
  });
});

describe("clients: who can read which client", () => {
  const visible = async (claims: Claims) => ids(await asUser(claims, "select id from public.clients"));

  it("a client reads only their own record", async () => {
    expect(await visible(asClient)).toEqual([clientA]);
  });

  it("a VA reads only clients assigned to them", async () => {
    expect(await visible(asVa)).toEqual([clientA]);
    expect(await visible(asVa2)).toEqual([]);
  });

  it("a VA stops seeing a client once the assignment ends", async () => {
    await asServer("update public.client_va_assignments set status = 'ended', ended_at = now() where client_id = $1", [clientA]);
    expect(await visible(asVa)).toEqual([]);
    await asServer("insert into public.client_va_assignments (client_id, va_id) values ($1, $2)", [clientA, VA]);
  });

  it("a Closer reads only clients they created", async () => {
    expect(await visible(asCloser)).toEqual([clientA, clientB].sort());
    expect(await visible(asCloser2)).toEqual([clientC]);
  });

  it("an admin reads every client, but only with a two-factor session", async () => {
    expect(await visible(asAdmin)).toHaveLength(3);
    expect(await visible(token(ADMIN, ["admin"], "aal1"))).toEqual([]);
  });

  it("a role claim alone isn't enough — the row must match the user", async () => {
    // Signed in as the client user but holding only the VA claim: not assigned, so nothing.
    expect(await visible(token(CLIENT, ["va"]))).toEqual([]);
    // Holding the client role without being linked to any client record: nothing.
    expect(await visible(token(VA, ["client"]))).toEqual([]);
  });

  it("anon reads nothing", async () => {
    await expect(as("anon", {}, "select id from public.clients")).rejects.toThrow(/permission denied/);
  });
});

describe("clients: who can write", () => {
  const create = (claims: Claims, createdBy: string) =>
    asUser<{ id: string }>(
      claims,
      "insert into public.clients (company_name, contact_name, contact_email, created_by) values ('New Co', 'Nia', 'nia@new.co', $1) returning id",
      [createdBy],
    );

  it("a Closer creates clients as themselves, always pending", async () => {
    const [row] = await create(asCloser, CLOSER);
    const [stored] = await asServer<{ status: string }>("select status from public.clients where id = $1", [row.id]);
    expect(stored.status).toBe("pending");
  });

  it("a Closer can't create a client on another Closer's behalf", async () => {
    await expect(create(asCloser, CLOSER2)).rejects.toThrow(/row-level security/);
  });

  it.each([
    ["a client", asClient, CLIENT],
    ["a VA", asVa, VA],
  ])("%s can't create clients", async (_, claims, self) => {
    // Blocked twice over: RLS, and the creator must hold the closer or admin role.
    await expect(create(claims, self)).rejects.toThrow(/row-level security|not an active user with the closer or admin role/);
  });

  it("a Closer edits details of their own clients only", async () => {
    expect(await asUser(asCloser, "update public.clients set notes = 'called' where id = $1 returning id", [clientB])).toHaveLength(1);
    expect(await asUser(asCloser, "update public.clients set notes = 'x' where id = $1 returning id", [clientC])).toHaveLength(0);
  });

  it("a Closer can't hand a client to another Closer", async () => {
    await expect(asUser(asCloser, "update public.clients set created_by = $1 where id = $2", [CLOSER2, clientB])).rejects.toThrow(/permission denied/);
  });

  it.each([
    ["activate a client", "update public.clients set status = 'active', activated_at = now() where id = $1"],
    ["attach a login to a client", `update public.clients set user_id = '${CLOSER}' where id = $1`],
    ["delete a client", "delete from public.clients where id = $1"],
  ])("nobody can %s through the API (server only)", async (_, sql) => {
    await expect(asUser(asCloser, sql, [clientB])).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, sql, [clientB])).rejects.toThrow(/permission denied/);
  });

  it("clients and VAs can't edit client records", async () => {
    expect(await asUser(asClient, "update public.clients set notes = 'x' where id = $1 returning id", [clientA])).toHaveLength(0);
    expect(await asUser(asVa, "update public.clients set notes = 'x' where id = $1 returning id", [clientA])).toHaveLength(0);
  });

  it("an admin with 2FA edits any client", async () => {
    expect(await asUser(asAdmin, "update public.clients set notes = 'ok' where id = $1 returning id", [clientC])).toHaveLength(1);
  });

  it("a Closer records a package on their own client, and a half-filled package is refused", async () => {
    const filled =
      "update public.clients set package_code = 'essentials', hours_per_week = 20, term_months = 1, monthly_cents = 90000, starts_on = '2026-11-01', timezone = 'America/New_York' where id = $1 returning id";
    expect(await asUser(asCloser, filled, [clientB])).toHaveLength(1);
    expect(await asUser(asCloser, filled, [clientC])).toHaveLength(0);
    expect(await asUser(asVa, filled, [clientA])).toHaveLength(0);
    await expect(as("anon", {}, "update public.clients set timezone = 'America/New_York' where id = $1", [clientB])).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, "update public.clients set hours_per_week = 80 where id = $1", [clientB])).rejects.toThrow(/clients_package_hours/);
    await asServer(
      "update public.clients set package_code = null, hours_per_week = null, term_months = null, monthly_cents = null, starts_on = null, timezone = null where id = $1",
      [clientB],
    );
  });

  it("an admin or the owning closer can disable a client, and a VA cannot", async () => {
    expect(await asUser(asAdmin, "update public.clients set disabled_at = now() where id = $1 returning id", [clientC])).toHaveLength(1);
    expect(await asUser(asCloser, "update public.clients set disabled_at = now() where id = $1 returning id", [clientB])).toHaveLength(1);
    expect(await asUser(asCloser, "update public.clients set disabled_at = now() where id = $1 returning id", [clientC])).toHaveLength(0);
    expect(await asUser(asVa, "update public.clients set disabled_at = now() where id = $1 returning id", [clientA])).toHaveLength(0);
    await expect(as("anon", {}, "update public.clients set disabled_at = now() where id = $1", [clientA])).rejects.toThrow(/permission denied/);
    await asServer("update public.clients set disabled_at = null where id in ($1, $2)", [clientB, clientC]);
  });

  it("stores business details; only the server records when the registration email went out", async () => {
    expect(await asUser(asAdmin, "update public.clients set business = '{\"city\":\"Austin\"}'::jsonb where id = $1 returning id", [clientC])).toHaveLength(1);
    await expect(asUser(asAdmin, "update public.clients set registration_email_sent_at = now() where id = $1", [clientC])).rejects.toThrow(/permission denied/);
    await expect(asUser(asCloser, "update public.clients set registration_email_sent_at = now() where id = $1", [clientB])).rejects.toThrow(/permission denied/);
    expect(await asServer("update public.clients set registration_email_sent_at = now() where id = $1 returning id", [clientC])).toHaveLength(1);
    await expect(asUser(asAdmin, "update public.clients set business = '[]'::jsonb where id = $1", [clientC])).rejects.toThrow(/clients_business_object/);
    await expect(asUser(asAdmin, "update public.clients set business = jsonb_build_object('about', repeat('a', 5000)) where id = $1", [clientC])).rejects.toThrow(/clients_business_object/);
    expect(await asUser(asVa, "update public.clients set business = '{}'::jsonb where id = $1 returning id", [clientC])).toHaveLength(0);
    await asServer("update public.clients set business = '{}'::jsonb, registration_email_sent_at = null where id = $1", [clientC]);
  });
});

describe("VA assignments", () => {
  const visible = async (claims: Claims) => (await asUser<{ client_id: string }>(claims, "select client_id from public.client_va_assignments")).length;

  it("each side sees only its own assignments", async () => {
    expect(await visible(asClient)).toBeGreaterThan(0);
    expect(await visible(asVa)).toBeGreaterThan(0);
    expect(await visible(asVa2)).toBe(0);
    expect(await visible(asCloser)).toBeGreaterThan(0);
    expect(await visible(asCloser2)).toBe(0);
  });

  it("only admins with 2FA assign VAs", async () => {
    const assign = (claims: Claims) => asUser(claims, "insert into public.client_va_assignments (client_id, va_id) values ($1, $2)", [clientB, VA2]);
    await expect(assign(asCloser)).rejects.toThrow(/row-level security/);
    await expect(assign(asVa)).rejects.toThrow(/row-level security/);
    await expect(assign(asAdmin)).resolves.toBeDefined();
  });

  it("only a VA can be assigned, and one active VA per client", async () => {
    await expect(asServer("insert into public.client_va_assignments (client_id, va_id) values ($1, $2)", [clientC, CLOSER])).rejects.toThrow(/not an active user with the va role/);
    await expect(asServer("insert into public.client_va_assignments (client_id, va_id) values ($1, $2)", [clientA, VA2])).rejects.toThrow(/one_active_per_client/);
  });
});

describe("relationships", () => {
  const newClient = (createdBy: string, userId: string | null = null) =>
    asServer<{ id: string }>(
      "insert into public.clients (company_name, contact_name, contact_email, created_by, user_id) values ('Rel Co', 'R', 'rel@x.co', $1, $2) returning id",
      [createdBy, userId],
    );

  it("a client is created by a Closer or an admin, never by another role", async () => {
    await expect(newClient(ADMIN)).resolves.toHaveLength(1);
    await expect(newClient(VA)).rejects.toThrow(/created_by .* is not an active user with the closer or admin role/);
    await expect(newClient(CLIENT)).rejects.toThrow(/closer or admin role/);
  });

  it("a deactivated Closer can't create clients, but their existing clients stay editable", async () => {
    await asServer(`update public.profiles set status = 'inactive' where id = '${CLOSER2}'`);
    await expect(newClient(CLOSER2)).rejects.toThrow(/closer or admin role/);
    await expect(asServer("update public.clients set notes = 'kept' where id = $1", [clientC])).resolves.toBeDefined();
    await asServer(`update public.profiles set status = 'active' where id = '${CLOSER2}'`);
  });

  it("only a user with the client role can be linked as a client's login", async () => {
    await expect(asServer("update public.clients set user_id = $1 where id = $2", [VA2, clientB])).rejects.toThrow(/user_id .* client role/);
  });

  it("a lead is assigned only to a Closer or an admin", async () => {
    const lead = (closer: string) =>
      asServer("insert into public.leads (full_name, email, message, closer_id) values ('L', 'l@x.co', 'Hi', $1)", [closer]);
    await expect(lead(CLOSER)).resolves.toBeDefined();
    await expect(lead(VA)).rejects.toThrow(/closer_id .* closer or admin role/);
  });

  it("a client with assignment history or a converted lead can't be deleted", async () => {
    await expect(asServer("delete from public.clients where id = $1", [clientA])).rejects.toThrow(/foreign key/);
    const [{ id }] = await newClient(CLOSER);
    await asServer("insert into public.leads (full_name, email, message, status, converted_client_id) values ('L', 'l@x.co', 'Hi', 'converted', $1)", [id]);
    await expect(asServer("delete from public.clients where id = $1", [id])).rejects.toThrow(/foreign key/);
  });

  it("a VA role can't be removed while the VA has an active assignment", async () => {
    await expect(asServer(`delete from public.roles where user_id = '${VA}' and role = 'va'`)).rejects.toThrow(/active assignments/);
  });

  it("a client role can't be removed while the login is linked to a client record", async () => {
    await expect(asServer(`delete from public.roles where user_id = '${CLIENT}' and role = 'client'`)).rejects.toThrow(/unlink this user/);
  });

  it("roles are removed and granted, never edited in place", async () => {
    await expect(asServer(`update public.roles set role = 'admin' where user_id = '${CLOSER}'`)).rejects.toThrow(/not edited in place/);
  });

  it("a role with nothing depending on it can be removed", async () => {
    const id = "00000000-0000-0000-0000-000000000098";
    await as("supabase_auth_admin", {}, `insert into auth.users (id, email) values ('${id}', 'idle-va@x.co')`);
    await asServer(`insert into public.roles (user_id, role) values ('${id}', 'va')`);
    await expect(asServer(`delete from public.roles where user_id = '${id}' and role = 'va' returning id`)).resolves.toHaveLength(1);
  });

  it("deleting a fresh invite (no clients or assignments) removes the profile and its roles", async () => {
    const id = "00000000-0000-0000-0000-000000000099";
    await as("supabase_auth_admin", {}, `insert into auth.users (id, email) values ('${id}', 'fresh@x.co')`);
    await asServer(`insert into public.roles (user_id, role) values ('${id}', 'va')`);
    await as("supabase_auth_admin", {}, `delete from auth.users where id = '${id}'`);
    expect(await asServer("select 1 from public.roles where user_id = $1", [id])).toHaveLength(0);
  });

  it("a user who created clients can't be deleted — deactivate them instead", async () => {
    await expect(as("supabase_auth_admin", {}, `delete from auth.users where id = '${CLOSER}'`)).rejects.toThrow(/foreign key/);
  });
});

describe("leads", () => {
  const insert = (values: Record<string, unknown>) => {
    const row = { full_name: "Ana Cruz", email: "ana@x.co", message: "Inbox help, please.", ...values };
    const keys = Object.keys(row);
    return asServer<{ id: string }>(
      `insert into public.leads (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
      Object.values(row),
    );
  };

  it("stores industry and country, and rejects a value past the limit", async () => {
    const [lead] = await insert({ industry: "Real estate", country: "Philippines" });
    expect(await asServer("select industry, country from public.leads where id = $1", [lead.id])).toEqual([{ industry: "Real estate", country: "Philippines" }]);
    await expect(insert({ industry: "x".repeat(81) })).rejects.toThrow(/check constraint/);
    await expect(insert({ country: "x".repeat(81) })).rejects.toThrow(/check constraint/);
  });

  it("stores a contact-form lead and marks it notified", async () => {
    const [lead] = await insert({ package_code: "executive", ip_hash: "a".repeat(64), user_agent: "UA" });
    await expect(asServer("update public.leads set notified_at = now() where id = $1", [lead.id])).resolves.toBeDefined();
  });

  it("only admins with two-factor sign-in can read leads", async () => {
    expect((await asUser(asAdmin, "select id from public.leads")).length).toBeGreaterThan(0);
    for (const claims of [token(ADMIN, ["admin"], "aal1"), asCloser, asVa, asClient]) {
      expect(await asUser(claims, "select id from public.leads")).toEqual([]);
    }
    await expect(as("anon", {}, "select id from public.leads")).rejects.toThrow(/permission denied/);
  });

  it("nobody inserts leads through the API, and anon cannot delete them", async () => {
    await expect(asUser(asAdmin, "insert into public.leads (full_name, email, message) values ('a', 'a@b.co', 'hi')")).rejects.toThrow(/permission denied/);
    await expect(as("anon", {}, "insert into public.leads (full_name, email, message) values ('a', 'a@b.co', 'hi')")).rejects.toThrow(/permission denied/);
    await expect(as("anon", {}, "delete from public.leads")).rejects.toThrow(/permission denied/);
  });

  it("the unfiltered list has a newest-first index", async () => {
    const rows = await asServer<{ indexdef: string }>("select indexdef from pg_indexes where schemaname = 'public' and tablename = 'leads'");
    expect(rows.map((r) => r.indexdef)).toContainEqual(expect.stringMatching(/\(created_at DESC\)$/));
  });

  it("admins can correct contact details, and still cannot touch spam metadata", async () => {
    const [lead] = await insert({});
    expect(await asUser(asAdmin, "update public.leads set status = 'contacted', full_name = 'Ana', profile = '{\"job_title\":\"Founder\"}'::jsonb where id = $1 returning id", [lead.id])).toHaveLength(1);
    await expect(asUser(asAdmin, "update public.leads set profile = '[]'::jsonb where id = $1", [lead.id])).rejects.toThrow(/check constraint|profile/);
    await expect(asUser(asAdmin, "update public.leads set ip_hash = $2 where id = $1", [lead.id, "b".repeat(64)])).rejects.toThrow(/permission denied/);
    expect(await asUser(asCloser, "update public.leads set status = 'closed' where id = $1 returning id", [lead.id])).toHaveLength(0);
  });

  describe("status flow", () => {
    const setStatus = (id: string, status: string) =>
      asUser(asAdmin, "update public.leads set status = $2 where id = $1 returning id", [id, status]);

    it("open leads move freely between open statuses and closed", async () => {
      const [lead] = await insert({});
      for (const status of ["contacted", "qualified", "new", "closed"]) expect(await setStatus(lead.id, status)).toHaveLength(1);
    });

    it("a closed lead can only be reopened", async () => {
      const [lead] = await insert({ status: "closed" });
      for (const status of ["contacted", "qualified"]) await expect(setStatus(lead.id, status)).rejects.toMatchObject({ code: "IVA04" });
      expect(await setStatus(lead.id, "new")).toHaveLength(1);
    });

    it("a converted lead is final, even for the server key", async () => {
      const [lead] = await insert({});
      await asUser(asAdmin, "select public.convert_lead($1, 'Cruz Co', 'Ana Cruz')", [lead.id]);
      for (const status of ["new", "closed"]) await expect(setStatus(lead.id, status)).rejects.toMatchObject({ code: "IVA04" });
      await expect(asServer("update public.leads set converted_client_id = null, status = 'new' where id = $1", [lead.id])).rejects.toMatchObject({ code: "IVA04" });
    });

    it("links a client only to a converted lead", async () => {
      const [lead] = await insert({});
      const [other] = await insert({});
      const [{ id: clientId }] = await asUser<{ id: string }>(asAdmin, "select public.convert_lead($1, 'Cruz Co', 'Ana Cruz') as id", [other.id]);
      await expect(asUser(asAdmin, "update public.leads set converted_client_id = $2 where id = $1", [lead.id, clientId])).rejects.toThrow(
        /leads_client_only_when_converted/,
      );
    });
  });

  describe("convert_lead", () => {
    const convert =(claims: Claims, leadId: string, company = "Cruz Co") =>
      asUser<{ id: string }>(claims, "select public.convert_lead($1, $2, 'Ana Cruz') as id", [leadId, company]);

    it("creates one pending client from the lead and marks the lead converted", async () => {
      const [lead] = await insert({ email: "convert@x.co", message: "Need inbox help." });
      const [{ id: clientId }] = await convert(asAdmin, lead.id);
      const [client] = await asServer<Record<string, unknown>>("select * from public.clients where id = $1", [clientId]);
      expect(client).toMatchObject({
        company_name: "Cruz Co",
        contact_name: "Ana Cruz",
        contact_email: "convert@x.co",
        notes: "Need inbox help.",
        status: "pending",
        created_by: ADMIN,
      });
      const [stored] = await asServer<{ status: string; converted_client_id: string }>("select status, converted_client_id from public.leads where id = $1", [lead.id]);
      expect(stored).toEqual({ status: "converted", converted_client_id: clientId });
    });

    it("refuses to convert the same lead twice", async () => {
      const [lead] = await insert({});
      await convert(asAdmin, lead.id);
      await expect(convert(asAdmin, lead.id)).rejects.toMatchObject({ code: "IVA02" });
      expect(await asServer("select id from public.clients where id in (select converted_client_id from public.leads where id = $1)", [lead.id])).toHaveLength(1);
    });

    it("refuses closed and unknown leads", async () => {
      const [lead] = await insert({ status: "closed" });
      await expect(convert(asAdmin, lead.id)).rejects.toMatchObject({ code: "IVA03" });
      await expect(convert(asAdmin, "00000000-0000-0000-0000-0000000000aa")).rejects.toMatchObject({ code: "IVA01" });
    });

    it("leaves nothing behind when the client is invalid (all or nothing)", async () => {
      const [lead] = await insert({});
      await expect(convert(asAdmin, lead.id, "")).rejects.toThrow(/violates check constraint/);
      const [stored] = await asServer<{ status: string }>("select status from public.leads where id = $1", [lead.id]);
      expect(stored.status).toBe("new");
    });

    it("stores the confirmed package on the new client", async () => {
      const [lead] = await insert({ email: "package@x.co", status: "qualified" });
      const [{ id: clientId }] = await asUser<{ id: string }>(
        asAdmin,
        "select public.convert_lead_noted($1::uuid, 'Cruz Co', 'Ana Cruz', null::text, 'Agreed on the call.', 'executive', 40::smallint, 6::smallint, 152000, '2026-11-02'::date, 'America/New_York') as id",
        [lead.id],
      );
      const [client] = await asServer(
        "select package_code, hours_per_week, term_months, monthly_cents, currency, starts_on::text as starts_on, timezone from public.clients where id = $1",
        [clientId],
      );
      expect(client).toEqual({
        package_code: "executive",
        hours_per_week: 40,
        term_months: 6,
        monthly_cents: 152000,
        currency: "USD",
        starts_on: "2026-11-02",
        timezone: "America/New_York",
      });
      expect(await asServer("select kind, body from public.lead_events where lead_id = $1", [lead.id])).toEqual([{ kind: "conversion", body: "Agreed on the call." }]);
    });

    it("refuses hours that don't belong to the package and leaves the lead open", async () => {
      const [lead] = await insert({ email: "hours@x.co" });
      await expect(
        asUser(asAdmin, "select public.convert_lead_noted($1::uuid, 'Cruz Co', 'Ana Cruz', null::text, 'Agreed.', 'executive', 20::smallint, 1::smallint, 160000, '2026-11-02'::date, 'America/New_York')", [lead.id]),
      ).rejects.toThrow(/hours do not match/);
      expect(await asServer("select status from public.leads where id = $1", [lead.id])).toEqual([{ status: "new" }]);
    });

    it("is for admins with two-factor sign-in only", async () => {
      const [lead] = await insert({});
      for (const claims of [token(ADMIN, ["admin"], "aal1"), asCloser, asVa, asClient]) {
        await expect(convert(claims, lead.id)).rejects.toThrow(/admins with two-factor sign-in only/);
      }
      await expect(as("anon", {}, "select public.convert_lead('00000000-0000-0000-0000-0000000000aa', 'x', 'y')")).rejects.toThrow(/permission denied/);
    });
  });

  describe("timeline", () => {
    const step = (id: string, kind: string, body = "Spoke with them.") =>
      asUser(asAdmin, "select public.record_lead_step($1, $2::public.lead_event_kind, $3)", [id, kind, body]);

    it("stores a small call attachment and refuses one over 2 MB", async () => {
      const [lead] = await insert({ email: "attach@x.co" });
      await asUser(asAdmin, "select public.record_lead_call($1, 'Left a voicemail.', 'call.mp3', 'audio/mpeg', $2)", [lead.id, Buffer.from("hi").toString("base64")]);
      expect(await asServer("select attachment_name, octet_length(attachment_bytes) as size from public.lead_events where lead_id = $1", [lead.id])).toEqual([
        { attachment_name: "call.mp3", size: 2 },
      ]);
      const [another] = await insert({ email: "attach-big@x.co" });
      const tooBig = Buffer.alloc(2_097_153).toString("base64");
      await expect(asUser(asAdmin, "select public.record_lead_call($1, 'Long recording.', 'call.mp3', 'audio/mpeg', $2)", [another.id, tooBig])).rejects.toThrow(/attachment is too large/);
    });

    it("stores a note attachment without moving the lead", async () => {
      const [lead] = await insert({ email: "note-file@x.co", status: "qualified" });
      await asUser(asAdmin, "select public.record_lead_note($1, 'Follow up Friday.', 'Friday note.pdf', 'application/pdf', $2)", [lead.id, Buffer.from("%PDF").toString("base64")]);
      expect(await asServer("select status from public.leads where id = $1", [lead.id])).toEqual([{ status: "qualified" }]);
      expect(await asServer("select kind, attachment_name from public.lead_events where lead_id = $1", [lead.id])).toEqual([{ kind: "note", attachment_name: "Friday note.pdf" }]);
    });

    it("records a call and moves a new lead to contacted", async () => {
      const [lead] = await insert({});
      await step(lead.id, "call");
      expect(await asServer("select status from public.leads where id = $1", [lead.id])).toEqual([{ status: "contacted" }]);
      expect(await asUser(asAdmin, "select kind, body, author_id from public.lead_events where lead_id = $1", [lead.id])).toEqual([
        { kind: "call", body: "Spoke with them.", author_id: ADMIN },
      ]);
    });

    it("refuses a step that does not match the status, and a closer or an admin without two-factor", async () => {
      const [lead] = await insert({});
      await expect(step(lead.id, "qualification")).rejects.toMatchObject({ code: "IVA04" });
      for (const claims of [token(ADMIN, ["admin"], "aal1"), asCloser]) {
        await expect(asUser(claims, "select public.record_lead_step($1, 'call', 'hi')", [lead.id])).rejects.toThrow(/admins with two-factor sign-in only/);
      }
      expect(await asUser(asCloser, "select id from public.lead_events")).toEqual([]);
      await expect(as("anon", {}, "select id from public.lead_events")).rejects.toThrow(/permission denied/);
    });

    it("junks an open lead and keeps the remark", async () => {
      const [lead] = await insert({ status: "qualified" });
      await step(lead.id, "junk", "Customer cancelled.");
      expect(await asServer("select status from public.leads where id = $1", [lead.id])).toEqual([{ status: "closed" }]);
      expect(await asServer("select kind from public.lead_events where lead_id = $1", [lead.id])).toEqual([{ kind: "junk" }]);
    });

    it("lets an admin delete a new lead with no timeline, and refuses one that has history", async () => {
      const [fresh] = await insert({ email: "fresh-delete@x.co" });
      expect(await asUser(asAdmin, "delete from public.leads where id = $1 returning id", [fresh.id])).toHaveLength(1);
      const [worked] = await insert({ email: "worked-delete@x.co" });
      await step(worked.id, "note", "Left a voicemail.");
      await expect(asUser(asAdmin, "delete from public.leads where id = $1", [worked.id])).rejects.toMatchObject({ code: "IVA05" });
      expect(await asUser(asCloser, "delete from public.leads where id = $1 returning id", [worked.id])).toHaveLength(0);
    });
  });

  it.each([
    ["a malformed email", { email: "not-an-email" }],
    ["an upper-case email", { email: "Ana@X.co" }],
    ["a 121-character name", { full_name: "a".repeat(121) }],
    ["an empty message", { message: "" }],
    ["a raw IP instead of a hash", { ip_hash: "203.0.113.7" }],
    ["converted without a client", { status: "converted" }],
  ])("rejects %s", async (_, values) => {
    await expect(insert(values)).rejects.toThrow(/violates check constraint/);
  });
});

describe("client notes", () => {
  it("stores a note and a small file, and refuses one over 2 MB", async () => {
    await asUser(asAdmin, "select public.record_client_note($1, 'Called about the start date.', 'Start date.pdf', 'application/pdf', $2)", [
      clientA,
      Buffer.from("%PDF").toString("base64"),
    ]);
    expect(await asServer("select body, attachment_name, octet_length(attachment_bytes) as size, author_id from public.client_notes where client_id = $1", [clientA])).toEqual([
      { body: "Called about the start date.", attachment_name: "Start date.pdf", size: 4, author_id: ADMIN },
    ]);
    const tooBig = Buffer.alloc(2_097_153).toString("base64");
    await expect(asUser(asAdmin, "select public.record_client_note($1, 'Too big.', 'big.pdf', 'application/pdf', $2)", [clientA, tooBig])).rejects.toThrow(/attachment is too large/);
  });

  it("stores a note with no file", async () => {
    await asUser(asAdmin, "select public.record_client_note($1, 'No file this time.', null, null, null)", [clientB]);
    expect(await asServer("select attachment_name from public.client_notes where client_id = $1", [clientB])).toEqual([{ attachment_name: null }]);
  });

  it("is for admins with two-factor sign-in only", async () => {
    for (const claims of [token(ADMIN, ["admin"], "aal1"), asCloser, asVa]) {
      await expect(asUser(claims, "select public.record_client_note($1, 'Nope.', null, null, null)", [clientA])).rejects.toThrow(/admins with two-factor sign-in only/);
    }
    expect(await asUser(asCloser, "select id from public.client_notes")).toEqual([]);
    await expect(as("anon", {}, "select id from public.client_notes")).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, "select public.record_client_note($1, 'Missing.', null, null, null)", ["00000000-0000-0000-0000-0000000000aa"])).rejects.toMatchObject({ code: "IVA01" });
  });
});

describe("employee profiles", () => {
  it("lets a person save their own profile, and an admin with two-factor sign-in read and update it", async () => {
    await asUser(asVa, `insert into public.employee_profiles (user_id, nationality) values ('${VA}', 'Filipino')`);
    expect(await asUser(asVa, `select nationality from public.employee_profiles where user_id = '${VA}'`)).toEqual([{ nationality: "Filipino" }]);
    await asUser(asAdmin, `update public.employee_profiles set current_city = 'Cebu' where user_id = '${VA}'`);
    expect(await asUser(asAdmin, `select current_city from public.employee_profiles where user_id = '${VA}'`)).toEqual([{ current_city: "Cebu" }]);
    await asUser(asVa, `update public.employee_profiles set current_country = 'Philippines' where user_id = '${VA}'`);
    expect(await asUser(asVa, `select current_country from public.employee_profiles where user_id = '${VA}'`)).toEqual([{ current_country: "Philippines" }]);
    await expect(asServer("select permanent_street from public.employee_profiles")).rejects.toThrow(/permanent_street/);
  });

  it("stores up to three references and refuses a fourth", async () => {
    const people = JSON.stringify([{ name: "Ana Cruz", phone: "0917", relationship: "Manager", company: "North", email: "ana@x.co" }]);
    await asUser(asVa, `update public.employee_profiles set job_references = $1::jsonb where user_id = '${VA}'`, [people]);
    expect(await asUser(asVa, `select job_references from public.employee_profiles where user_id = '${VA}'`)).toEqual([
      { job_references: [{ name: "Ana Cruz", phone: "0917", relationship: "Manager", company: "North", email: "ana@x.co" }] },
    ]);
    const four = JSON.stringify([1, 2, 3, 4].map(() => ({ name: "A", company: "", phone: "", email: "" })));
    await expect(asServer(`update public.employee_profiles set job_references = $1::jsonb where user_id = '${VA}'`, [four])).rejects.toThrow(/check constraint/);
  });

  it("hides a profile from other people, from an admin without two-factor sign-in, and from anon", async () => {
    expect(await asUser(asVa2, `select user_id from public.employee_profiles where user_id = '${VA}'`)).toEqual([]);
    expect(await asUser(asCloser, `select user_id from public.employee_profiles where user_id = '${VA}'`)).toEqual([]);
    expect(await asUser(token(ADMIN, ["admin"], "aal1"), `select user_id from public.employee_profiles where user_id = '${VA}'`)).toEqual([]);
    await expect(as("anon", {}, "select user_id from public.employee_profiles")).rejects.toThrow(/permission denied/);
  });

  it("refuses writing someone else's profile, deleting one, or storing the résumé through the API", async () => {
    await expect(asUser(asVa, `insert into public.employee_profiles (user_id) values ('${VA2}')`)).rejects.toThrow(/row-level security/);
    await expect(asUser(asAdmin, `delete from public.employee_profiles where user_id = '${VA}'`)).rejects.toThrow(/permission denied/);
    await expect(asUser(asVa, `update public.employee_profiles set resume_bytes = '\\x00' where user_id = '${VA}'`)).rejects.toThrow(/permission denied/);
    await expect(asUser(asVa, `update public.employee_profiles set avatar_bytes = '\\x00' where user_id = '${VA}'`)).rejects.toThrow(/permission denied/);
  });

  it("rejects a nationality that is too long", async () => {
    await expect(asServer(`insert into public.employee_profiles (user_id, nationality) values ('${VA2}', $1)`, ["n".repeat(81)])).rejects.toThrow(/check constraint/);
  });

  it("leaves registration progress to the server: nobody sets it through the API", async () => {
    for (const claims of [asVa, asAdmin]) {
      await expect(asUser(claims, `update public.employee_profiles set registration_status = 'completed' where user_id = '${VA}'`)).rejects.toThrow(/permission denied/);
      await expect(asUser(claims, `update public.employee_profiles set registration_completed_at = now() where user_id = '${VA}'`)).rejects.toThrow(/permission denied/);
    }
    await expect(asUser(asVa2, `insert into public.employee_profiles (user_id, registration_status) values ('${VA2}', 'completed')`)).rejects.toThrow(/permission denied/);
    expect(await asServer(`update public.employee_profiles set registration_status = 'completed' where user_id = '${VA}' returning user_id`)).toHaveLength(1);
  });

  it("leaves the review to the server, and only allows the sections an admin can send back", async () => {
    for (const claims of [asVa, asAdmin]) {
      await expect(asUser(claims, `update public.employee_profiles set review_status = 'approved' where user_id = '${VA}'`)).rejects.toThrow(/permission denied/);
    }
    expect(await asServer(`update public.employee_profiles set review_status = 'pending_review', returned_sections = '{basic}' where user_id = '${VA}' returning review_status`)).toEqual([
      { review_status: "pending_review" },
    ]);
    await expect(asServer(`update public.employee_profiles set returned_sections = '{salary}' where user_id = '${VA}'`)).rejects.toThrow(/check constraint/);
    await asServer(`update public.employee_profiles set review_status = 'pending', returned_sections = '{}' where user_id = '${VA}'`);
  });

  it("only employees have an employee profile: a client can't create one for themselves", async () => {
    await expect(asUser(asClient, `insert into public.employee_profiles (user_id) values ('${CLIENT}')`)).rejects.toThrow(/row-level security/);
    await expect(asUser(asVa2, `insert into public.employee_profiles (user_id) values ('${VA2}') returning user_id`)).resolves.toHaveLength(1);
  });

  it("keeps no staff names after the rename: table, types, constraints, indexes, triggers, policies, function bodies", async () => {
    const [left] = await db.query<{ n: number }>(`
      select ((select count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace
                where s.nspname = 'public' and c.relname like 'staff%')
           + (select count(*) from pg_type t join pg_namespace s on s.oid = t.typnamespace
                where s.nspname = 'public' and t.typname like 'staff%')
           + (select count(*) from pg_constraint where conname like 'staff%')
           + (select count(*) from pg_trigger where tgname like 'staff%')
           + (select count(*) from pg_policies where policyname ilike '%staff%')
           + (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                where s.nspname in ('public', 'private') and p.prosrc like '%staff\\_profiles%'))::int as n`).then((r) => r.rows);
    expect(left.n).toBe(0);
    expect(await asServer("select to_regclass('public.employee_profiles')::text as t")).toEqual([{ t: "employee_profiles" }]);
  });
});

describe("hardening", () => {
  it("the server can't truncate tables", async () => {
    await expect(asServer("truncate public.leads")).rejects.toThrow(/permission denied/);
  });

  it("tables created by later migrations get no automatic grants", async () => {
    await db.exec("create table public.later_table (id int)");
    await expect(as("anon", {}, "select 1 from public.later_table")).rejects.toThrow(/permission denied/);
    await expect(asServer("select 1 from public.later_table")).rejects.toThrow(/permission denied/);
    await db.exec("drop table public.later_table");
  });

  it("private trigger functions can't be called through the API", async () => {
    await expect(asUser(asClient, "select private.handle_new_user()")).rejects.toThrow(/permission denied/);
  });
});

describe("tenants", () => {
  // A second tenant beside the default one. Its users start in the default tenant (as every invite does)
  // and the server moves them, as a Super Admin would.
  const SUPER = "00000000-0000-0000-0000-000000000010";
  const ADMIN_B = "00000000-0000-0000-0000-0000000000b1";
  const VA_B = "00000000-0000-0000-0000-0000000000b2";
  const CLOSER_B = "00000000-0000-0000-0000-0000000000b3";
  let tenantA = "";
  let tenantB = "";
  let clientInB = "";
  const asSuper = token(SUPER, ["super_admin"], "aal2");
  const asAdminB = { ...token(ADMIN_B, ["admin"], "aal2"), app_metadata: { roles: ["admin"], tenant_id: "" } };

  beforeAll(async () => {
    [{ id: tenantA }] = await asServer<{ id: string }>("select id from public.tenants where is_default");
    [{ id: tenantB }] = await asServer<{ id: string }>("insert into public.tenants (name, slug) values ('Other agency', 'other-agency') returning id");
    asAdminB.app_metadata.tenant_id = tenantB;
    await as("supabase_auth_admin", {}, `
      insert into auth.users (id, email) values
        ('${SUPER}', 'super@x.co'), ('${ADMIN_B}', 'admin-b@x.co'), ('${VA_B}', 'va-b@x.co'), ('${CLOSER_B}', 'closer-b@x.co')`);
    await asServer(`update public.profiles set tenant_id = $1 where id in ('${ADMIN_B}', '${VA_B}', '${CLOSER_B}')`, [tenantB]);
    await asServer(`
      insert into public.roles (user_id, role) values
        ('${SUPER}', 'super_admin'), ('${ADMIN_B}', 'admin'), ('${VA_B}', 'va'), ('${CLOSER_B}', 'closer')`);
    [{ id: clientInB }] = await asServer<{ id: string }>(
      "insert into public.clients (company_name, contact_name, contact_email, created_by) values ('Delta', 'Contact', 'delta@x.co', $1) returning id",
      [CLOSER_B],
    );
  });

  it("assign_tenant names every table that uses it (profiles and leads take the default on purpose)", async () => {
    // Guards against a redefinition that drops a case: that table's rows would silently land in the default tenant.
    // Read as the test superuser: the catalog lookup needs the private schema, which no API role can use.
    const tables = (
      await db.query<{ name: string }>(
        "select c.relname as name from pg_trigger t join pg_class c on c.oid = t.tgrelid where t.tgfoid = 'private.assign_tenant()'::regprocedure order by 1",
      )
    ).rows;
    const [{ src }] = (await db.query<{ src: string }>("select prosrc as src from pg_proc where oid = 'private.assign_tenant()'::regprocedure")).rows;
    const missing = tables.map((t) => t.name).filter((name) => !["profiles", "leads"].includes(name) && !src.includes(`when '${name}'`));
    expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining(["demo_slots", "demo_bookings", "payments", "client_onboarding_links"]));
    expect(missing).toEqual([]);
  });

  it("every row inherits a tenant: users the default, clients their creator's, assignments their client's", async () => {
    const tenantOf = async (sql: string) => (await asServer<{ tenant_id: string }>(sql))[0].tenant_id;
    expect(await tenantOf(`select tenant_id from public.profiles where id = '${ADMIN}'`)).toBe(tenantA);
    expect(await tenantOf(`select tenant_id from public.clients where id = '${clientA}'`)).toBe(tenantA);
    expect(await tenantOf(`select tenant_id from public.client_va_assignments where client_id = '${clientA}'`)).toBe(tenantA);
    expect(await tenantOf(`select tenant_id from public.roles where user_id = '${ADMIN_B}'`)).toBe(tenantB);
    expect(await tenantOf(`select tenant_id from public.clients where id = '${clientInB}'`)).toBe(tenantB);
    const [lead] = await asServer<{ tenant_id: string }>("insert into public.leads (full_name, email, message) values ('A', 'a@x.co', 'hi') returning tenant_id");
    expect(lead.tenant_id).toBe(tenantA);
  });

  it("the token carries the user's tenant", async () => {
    expect(((await hookRoles(ADMIN_B)) as unknown as { tenant_id: string }).tenant_id).toBe(tenantB);
  });

  it("an admin sees only their own tenant, with or without the tenant in the token", async () => {
    expect(ids(await asUser<{ id: string }>(asAdminB, "select id from public.clients"))).toEqual([clientInB]);
    expect(ids(await asUser<{ id: string }>(asAdminB, "select id from public.profiles"))).toEqual([ADMIN_B, CLOSER_B, VA_B].sort());
    expect(await asUser(asAdminB, "select id from public.leads")).toEqual([]);
    // asAdmin's token predates the tenant claim: the tenant comes from the profile.
    const seen = ids(await asUser<{ id: string }>(asAdmin, "select id from public.clients"));
    expect(seen).toContain(clientA);
    expect(seen).not.toContain(clientInB);
    expect(await asUser(asAdmin, "select id from public.profiles where id = $1", [ADMIN_B])).toEqual([]);
    expect(await asUser(asAdmin, "select id from public.roles where user_id = $1", [VA_B])).toEqual([]);
  });

  it("other roles stay inside their tenant too", async () => {
    expect(await asUser(token(CLOSER_B, ["closer"]), "select id from public.clients")).toHaveLength(1);
    expect(await asUser(asCloser, "select id from public.clients where id = $1", [clientInB])).toEqual([]);
    expect(await asUser(asAdminB, "select id from public.tenants")).toEqual([{ id: tenantB }]);
  });

  it("a Super Admin with two-factor sees every tenant; without it, nothing beyond their own rows", async () => {
    expect(ids(await asUser<{ id: string }>(asSuper, "select id from public.clients"))).toEqual(expect.arrayContaining([clientA, clientInB]));
    expect(await asUser(asSuper, "select id from public.tenants")).toHaveLength(2);
    expect((await asUser(asSuper, "select id from public.leads")).length).toBeGreaterThan(0);
    const noMfa = token(SUPER, ["super_admin"], "aal1");
    expect(await asUser(noMfa, "select id from public.clients")).toEqual([]);
    expect(await asUser(noMfa, "select id from public.leads")).toEqual([]);
    expect(await asUser(noMfa, "select id from public.profiles where id = $1", [ADMIN_B])).toEqual([]);
    expect(await asUser(noMfa, "select id from public.tenants")).toEqual([{ id: tenantA }]);
  });

  it("an admin can't change rows in another tenant", async () => {
    expect(await asUser(asAdmin, "update public.leads set status = 'closed' where tenant_id = $1 returning id", [tenantB])).toEqual([]);
    expect(await asUser(asAdminB, "update public.client_va_assignments set status = 'active' where client_id = $1 returning id", [clientA])).toEqual([]);
  });

  it("rows can't point at another tenant's data", async () => {
    const [{ id: unassigned }] = await asServer<{ id: string }>(
      "insert into public.clients (company_name, contact_name, contact_email, created_by) values ('H', 'C', 'h@x.co', $1) returning id",
      [CLOSER],
    );
    await expect(asServer("insert into public.client_va_assignments (client_id, va_id) values ($1, $2)", [unassigned, VA_B])).rejects.toThrow(/foreign key/);
    await expect(
      asServer("insert into public.clients (company_name, contact_name, contact_email, created_by, tenant_id) values ('E', 'C', 'e@x.co', $1, $2)", [CLOSER_B, tenantA]),
    ).rejects.toThrow(/foreign key/);
    await expect(asServer("insert into public.leads (full_name, email, message, closer_id) values ('A', 'a@x.co', 'hi', $1)", [CLOSER_B])).rejects.toThrow(/foreign key/);
  });

  it("signed-in users can't set or change a row's tenant", async () => {
    await expect(asUser(asCloser, "update public.clients set tenant_id = $1 where created_by = $2", [tenantB, CLOSER])).rejects.toThrow(/permission denied/);
    await expect(
      asUser(asCloser, "insert into public.clients (company_name, contact_name, contact_email, created_by, tenant_id) values ('F', 'C', 'f@x.co', $1, $2)", [CLOSER, tenantB]),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, "insert into public.tenants (name, slug) values ('X', 'x')")).rejects.toThrow(/permission denied/);
  });

  it("only a Super Admin grants admin rights; an admin grants roles only inside their tenant", async () => {
    const grant = (user: string, role: string, by: string) =>
      asServer("insert into public.roles (user_id, role, assigned_by) values ($1, $2, $3) returning id", [user, role, by]);
    await expect(grant(VA_B, "admin", ADMIN_B)).rejects.toThrow(/only a Super Admin grants the admin role/);
    await expect(grant(VA_B, "super_admin", ADMIN_B)).rejects.toThrow(/only a Super Admin/);
    await expect(grant(VA_B, "closer", ADMIN)).rejects.toThrow(/admin of the same tenant/);
    await expect(grant(VA_B, "closer", VA_B)).rejects.toThrow(/admin of the same tenant/);
    await expect(grant(VA_B, "closer", ADMIN_B)).resolves.toHaveLength(1);
    await expect(grant(VA_B, "admin", SUPER)).resolves.toHaveLength(1);
    await asServer("delete from public.roles where user_id = $1 and role in ('closer', 'admin')", [VA_B]);
  });

  it("a Super Admin may stand in where an admin is allowed", async () => {
    await expect(
      asServer("insert into public.clients (company_name, contact_name, contact_email, created_by) values ('G', 'C', 'g@x.co', $1) returning id", [SUPER]),
    ).resolves.toHaveLength(1);
  });

  it("moving a user carries their roles and employee profile; it's refused while they own clients", async () => {
    await asServer("insert into public.employee_profiles (user_id) values ($1)", [VA_B]);
    await asServer("update public.profiles set tenant_id = $1 where id = $2", [tenantA, VA_B]);
    expect((await asServer<{ tenant_id: string }>("select tenant_id from public.roles where user_id = $1", [VA_B]))[0].tenant_id).toBe(tenantA);
    expect((await asServer<{ tenant_id: string }>("select tenant_id from public.employee_profiles where user_id = $1", [VA_B]))[0].tenant_id).toBe(tenantA);
    await expect(asServer("update public.profiles set tenant_id = $1 where id = $2", [tenantA, CLOSER_B])).rejects.toThrow(/foreign key/);
  });

  it("the default tenant is unique", async () => {
    await expect(asServer("update public.tenants set is_default = true where id = $1", [tenantB])).rejects.toThrow(/duplicate key/);
  });

  it("tenant helpers can't be called by visitors", async () => {
    await expect(as("anon", {}, "select private.tenant_id()")).rejects.toThrow(/permission denied/);
    await expect(asUser(asClient, "select private.assign_tenant()")).rejects.toThrow(/permission denied/);
  });
});

describe("client onboarding links", () => {
  // Fresh clients so earlier blocks can't leave them disabled or linked. Links are issued and used by the server
  // (secret key); signed-in users only read their status.
  const OTHER_ADMIN = "00000000-0000-0000-0000-0000000000b1"; // the second tenant's admin (see "tenants")
  const SUPER = "00000000-0000-0000-0000-000000000010";
  const sha = (value: string) => createHash("sha256").update(value).digest("hex");
  let mine = "";
  let theirs = "";
  let spare = "";
  const newClient = async (name: string, closer: string) =>
    (await asServer<{ id: string }>(
      "insert into public.clients (company_name, contact_name, contact_email, created_by) values ($1, 'Contact', $2, $3) returning id",
      [name, `${name.toLowerCase()}@onboard.co`, closer],
    ))[0].id;
  const issue = (client: string, by: string, value: string) =>
    asServer<{ link_id: string; link_expires_at: string }>("select * from public.issue_onboarding_link($1, $2, $3)", [client, by, sha(value)]);
  const submit = (value: string, consent = true, billing = JSON.stringify({ name: "Acme Ltd" })) =>
    asServer<{ id: string }>(
      "select public.submit_onboarding($1, 'Ada Lovelace', ' +1 555 0100 ', $2::jsonb, $3::jsonb, $4) as id",
      [sha(value), JSON.stringify({ city: "Austin" }), billing, consent],
    );
  const ageLinks = (client: string) =>
    asServer("update public.client_onboarding_links set created_at = created_at - interval '3 minutes' where client_id = $1", [client]);

  beforeAll(async () => {
    mine = await newClient("Onboard", CLOSER);
    theirs = await newClient("Elsewhere", CLOSER2);
    spare = await newClient("Spare", CLOSER);
  });

  it("only the server can issue, revoke or use a link", async () => {
    await expect(asUser(asCloser, "select * from public.issue_onboarding_link($1, $2, $3)", [mine, CLOSER, sha("x")])).rejects.toThrow(/permission denied for function/);
    await expect(asUser(asAdmin, "select public.revoke_onboarding_link($1, $2)", [mine, ADMIN])).rejects.toThrow(/permission denied for function/);
    await expect(as("anon", {}, "select public.submit_onboarding($1, 'A', '', '{}', '{}', true)", [sha("x")])).rejects.toThrow(/permission denied for function/);
    const [grants] = await asServer<Record<string, boolean>>(`
      select
        bool_or(has_function_privilege(r, 'public.issue_onboarding_link(uuid, uuid, text)', 'execute')) as issue,
        bool_or(has_function_privilege(r, 'public.revoke_onboarding_link(uuid, uuid)', 'execute')) as revoke,
        bool_or(has_function_privilege(r, 'public.submit_onboarding(text, text, text, jsonb, jsonb, boolean)', 'execute')) as submit
      from unnest(array['anon', 'authenticated']) as r`);
    expect(grants).toEqual({ issue: false, revoke: false, submit: false });
  });

  it("the client's Closer or an admin of the tenant issues a link, valid for 7 days; others are refused", async () => {
    const [link] = await issue(mine, CLOSER, "first");
    const days = (new Date(link.link_expires_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
    await expect(issue(theirs, CLOSER, "nope")).rejects.toThrow(/only the client's Closer or an admin/);
    await expect(issue(mine, VA, "nope")).rejects.toThrow(/only the client's Closer or an admin/);
    await expect(issue(theirs, ADMIN, "admin-sent")).resolves.toHaveLength(1);
    await expect(asServer("select * from public.issue_onboarding_link($1, $2, 'not-a-hash')", [spare, CLOSER])).rejects.toThrow(/64 hex/);
  });

  it("a new link revokes the old one, never within two minutes, and only one link is open at a time", async () => {
    await expect(issue(mine, CLOSER, "too-soon")).rejects.toThrow(/sent moments ago/);
    await ageLinks(mine);
    await issue(mine, CLOSER, "second");
    const rows = await asServer<{ token_hash: string; revoked_at: string | null }>(
      "select token_hash, revoked_at from public.client_onboarding_links where client_id = $1",
      [mine],
    );
    expect(rows.find((r) => r.token_hash === sha("first"))?.revoked_at).not.toBeNull();
    expect(rows.filter((r) => r.revoked_at === null)).toHaveLength(1);
    await expect(
      asServer("insert into public.client_onboarding_links (client_id, token_hash, created_by) values ($1, $2, $3)", [mine, sha("third"), CLOSER]),
    ).rejects.toThrow(/client_onboarding_links_one_open_idx/);
  });

  it("links go only to pending, enabled clients", async () => {
    await asServer("update public.clients set disabled_at = now() where id = $1", [spare]);
    await expect(issue(spare, CLOSER, "disabled")).rejects.toThrow(/disabled/);
    await asServer("update public.clients set disabled_at = null, status = 'inactive' where id = $1", [spare]);
    await expect(issue(spare, CLOSER, "inactive")).rejects.toThrow(/already inactive/);
    await asServer("update public.clients set status = 'pending' where id = $1", [spare]);
  });

  it("the Closer and admins with 2FA read a link's status, never its hash; nobody else reads or writes links", async () => {
    const status = "select id from public.client_onboarding_links where client_id = $1";
    expect((await asUser(asCloser, status, [mine])).length).toBeGreaterThan(0);
    expect(await asUser(asCloser2, status, [mine])).toEqual([]);
    expect((await asUser(asAdmin, status, [mine])).length).toBeGreaterThan(0);
    expect(await asUser(token(ADMIN, ["admin"], "aal1"), status, [mine])).toEqual([]);
    expect(await asUser(asClient, status, [mine])).toEqual([]);
    expect(await asUser(asVa, status, [mine])).toEqual([]);
    await expect(as("anon", {}, status, [mine])).rejects.toThrow(/permission denied/);
    await expect(asUser(asCloser, "select token_hash from public.client_onboarding_links")).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, "select * from public.client_onboarding_links")).rejects.toThrow(/permission denied/);
    await expect(
      asUser(asCloser, "insert into public.client_onboarding_links (client_id, token_hash, created_by) values ($1, $2, $3)", [spare, sha("mine"), CLOSER]),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, "update public.client_onboarding_links set revoked_at = now() where client_id = $1", [mine])).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, "delete from public.client_onboarding_links where client_id = $1", [mine])).rejects.toThrow(/permission denied/);
  });

  it("links stay inside their tenant; a Super Admin with 2FA sees them all", async () => {
    const [{ id: other }] = await asServer<{ id: string }>("select id from public.tenants where slug = 'other-agency'");
    const otherAdmin = { ...token(OTHER_ADMIN, ["admin"], "aal2"), app_metadata: { roles: ["admin"], tenant_id: other } };
    expect(await asUser(otherAdmin, "select id from public.client_onboarding_links")).toEqual([]);
    await expect(issue(spare, OTHER_ADMIN, "cross-tenant")).rejects.toThrow(/only the client's Closer or an admin/);
    expect((await asUser(token(SUPER, ["super_admin"], "aal2"), "select id from public.client_onboarding_links where client_id = $1", [mine])).length).toBeGreaterThan(0);
    const [link] = await asServer<{ tenant_id: string }>("select tenant_id from public.client_onboarding_links where client_id = $1 limit 1", [mine]);
    const [client] = await asServer<{ tenant_id: string }>("select tenant_id from public.clients where id = $1", [mine]);
    expect(link.tenant_id).toBe(client.tenant_id);
  });

  it("a revoked or unknown link can't be used, and only the client's Closer or an admin revokes", async () => {
    await expect(asServer("select public.revoke_onboarding_link($1, $2)", [mine, CLOSER2])).rejects.toThrow(/only the client's Closer or an admin/);
    expect(await asServer("select public.revoke_onboarding_link($1, $2) as revoked", [theirs, ADMIN])).toEqual([{ revoked: true }]);
    await expect(submit("admin-sent")).rejects.toThrow(/already used or withdrawn/);
    await expect(submit("never-issued")).rejects.toThrow(/unknown link/);
  });

  it("an expired link can't be used", async () => {
    await issue(spare, CLOSER, "old");
    await asServer(
      "update public.client_onboarding_links set created_at = now() - interval '8 days', expires_at = now() - interval '1 day' where token_hash = $1",
      [sha("old")],
    );
    await expect(submit("old")).rejects.toThrow(/expired/);
  });

  it("a submission needs consent and fitting billing details, writes them once, and never touches the email", async () => {
    await expect(submit("second", false)).rejects.toThrow(/consent is required/);
    await expect(submit("second", true, JSON.stringify({ notes: "x".repeat(2100) }))).rejects.toThrow(/clients_billing_object/);
    await expect(submit("second", true, "[]")).rejects.toThrow(/clients_billing_object/);
    expect((await submit("second"))[0].id).toBe(mine);
    const [row] = await asServer<{ contact_name: string; contact_phone: string; contact_email: string; billing: object; consented_at: string | null; onboarding_submitted_at: string | null }>(
      "select contact_name, contact_phone, contact_email, billing, consented_at, onboarding_submitted_at from public.clients where id = $1",
      [mine],
    );
    expect(row).toMatchObject({ contact_name: "Ada Lovelace", contact_phone: "+1 555 0100", contact_email: "onboard@onboard.co", billing: { name: "Acme Ltd" } });
    expect(row.consented_at).not.toBeNull();
    expect(row.onboarding_submitted_at).not.toBeNull();
    await expect(submit("second")).rejects.toThrow(/already used or withdrawn/);
  });

  it("signed-in users can't set consent or submission times; Closers and admins may correct billing", async () => {
    await expect(asUser(asCloser, "update public.clients set consented_at = now() where id = $1", [mine])).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, "update public.clients set onboarding_submitted_at = now() where id = $1", [mine])).rejects.toThrow(/permission denied/);
    expect(await asUser(asCloser, "update public.clients set billing = $1::jsonb where id = $2 returning id", [JSON.stringify({ name: "Acme Limited" }), mine])).toHaveLength(1);
    expect(await asUser(asCloser2, "update public.clients set billing = '{}'::jsonb where id = $1 returning id", [mine])).toHaveLength(0);
    expect(await asUser(asVa, "update public.clients set billing = '{}'::jsonb where id = $1 returning id", [mine])).toHaveLength(0);
  });

  it("a Closer creates a client with its package in one step, only as themselves", async () => {
    const create =
      "insert into public.clients (company_name, contact_name, contact_email, created_by, package_code, hours_per_week, term_months, monthly_cents, starts_on, timezone, business) values ('Pkg', 'C', 'pkg@onboard.co', $1, 'essentials', 20, 1, 90000, '2026-11-01', 'America/New_York', '{}') returning status";
    expect(await asUser(asCloser, create, [CLOSER])).toEqual([{ status: "pending" }]);
    await expect(asUser(asCloser, create, [CLOSER2])).rejects.toThrow(/row-level security/);
    await expect(asUser(asVa, create, [CLOSER])).rejects.toThrow(/row-level security/);
  });
});

describe("client payments and activation", () => {
  // Payments are recorded by hand (Stripe arrives in M4); activation needs the form, consent and a payment.
  const CLOSER_B = "00000000-0000-0000-0000-0000000000b3"; // the second tenant's Closer (see "tenants")
  const LOGIN = "00000000-0000-0000-0000-0000000000e1";
  const LOGIN_B = "00000000-0000-0000-0000-0000000000e2";
  const FRESH = "00000000-0000-0000-0000-0000000000e3";
  const sha = (value: string) => createHash("sha256").update(value).digest("hex");
  let ready = "";
  let unsent = "";
  let noPackage = "";
  let inB = "";
  const newClient = async (name: string, closer: string, withPackage = true) =>
    (await asServer<{ id: string }>(
      withPackage
        ? "insert into public.clients (company_name, contact_name, contact_email, created_by, package_code, hours_per_week, term_months, monthly_cents, starts_on, timezone) values ($1, 'C', $2, $3, 'essentials', 20, 6, 85500, '2026-11-01', 'America/New_York') returning id"
        : "insert into public.clients (company_name, contact_name, contact_email, created_by) values ($1, 'C', $2, $3) returning id",
      [name, `${name.toLowerCase()}@activate.co`, closer],
    ))[0].id;
  const onboard = async (client: string, closer: string, value: string) => {
    await asServer("select * from public.issue_onboarding_link($1, $2, $3)", [client, closer, sha(value)]);
    await asServer("select public.submit_onboarding($1, 'C', '', '{}'::jsonb, '{}'::jsonb, true)", [sha(value)]);
  };
  const pay = (client: string, by: string, amount = 85500, paidOn = "2026-10-20") =>
    asServer<{ id: string }>("select public.record_manual_payment($1, $2, $3, ' TRX-1 ', $4) as id", [client, by, amount, paidOn]);
  const activate = (client: string, login: string, by: string) => asServer("select public.activate_client($1, $2, $3)", [client, login, by]);
  const grant = (user: string, role: string, by: string) =>
    asServer("insert into public.roles (user_id, role, assigned_by) values ($1, $2, $3) returning id", [user, role, by]);

  beforeAll(async () => {
    await as("supabase_auth_admin", {}, `
      insert into auth.users (id, email) values ('${LOGIN}', 'owner@activate.co'), ('${LOGIN_B}', 'owner-b@activate.co'), ('${FRESH}', 'fresh@activate.co')`);
    ready = await newClient("Ready", CLOSER);
    unsent = await newClient("Unsent", CLOSER);
    noPackage = await newClient("Bare", CLOSER, false);
    inB = await newClient("Bravo", CLOSER_B);
    await onboard(ready, CLOSER, "ready");
    await onboard(inB, CLOSER_B, "bravo");
  });

  it("only the server records payments or activates", async () => {
    await expect(asUser(asCloser, "select public.record_manual_payment($1, $2, 100, null, current_date)", [ready, CLOSER])).rejects.toThrow(/permission denied for function/);
    await expect(asUser(asAdmin, "select public.activate_client($1, $2, $3)", [ready, LOGIN, ADMIN])).rejects.toThrow(/permission denied for function/);
    await expect(as("anon", {}, "select public.void_payment($1, $2)", [ready, ADMIN])).rejects.toThrow(/permission denied for function/);
    const [grants] = await asServer<Record<string, boolean>>(`
      select
        bool_or(has_function_privilege(r, 'public.record_manual_payment(uuid, uuid, integer, text, date)', 'execute')) as record,
        bool_or(has_function_privilege(r, 'public.void_payment(uuid, uuid)', 'execute')) as void,
        bool_or(has_function_privilege(r, 'public.activate_client(uuid, uuid, uuid)', 'execute')) as activate
      from unnest(array['anon', 'authenticated']) as r`);
    expect(grants).toEqual({ record: false, void: false, activate: false });
  });

  it("the client's Closer or an admin records a payment for the client's term; bad amounts and dates are refused", async () => {
    const [{ id }] = await pay(ready, CLOSER);
    const [row] = await asServer<{ term_months: number; provider_ref: string; status: string; provider: string }>(
      "select term_months, provider_ref, status, provider from public.payments where id = $1",
      [id],
    );
    expect(row).toEqual({ term_months: 6, provider_ref: "TRX-1", status: "paid", provider: "manual" });
    await expect(pay(ready, CLOSER2)).rejects.toThrow(/only the client's Closer or an admin/);
    await expect(pay(ready, VA)).rejects.toThrow(/only the client's Closer or an admin/);
    await expect(pay(unsent, ADMIN)).resolves.toHaveLength(1);
    await expect(pay(ready, CLOSER, 0)).rejects.toThrow(/payments_amount_cents_check/);
    await expect(pay(ready, CLOSER, 100, "2999-01-01")).rejects.toThrow(/can't be in the future/);
    await expect(pay(noPackage, CLOSER)).rejects.toThrow(/set the client's package/);
  });

  it("the Closer and admins with 2FA read payments; nobody else reads them, and no signed-in user writes them", async () => {
    const read = "select id from public.payments where client_id = $1";
    expect((await asUser(asCloser, read, [ready])).length).toBeGreaterThan(0);
    expect(await asUser(asCloser2, read, [ready])).toEqual([]);
    expect((await asUser(asAdmin, read, [ready])).length).toBeGreaterThan(0);
    expect(await asUser(token(ADMIN, ["admin"], "aal1"), read, [ready])).toEqual([]);
    expect(await asUser(asVa, read, [ready])).toEqual([]);
    expect(await asUser(asClient, read, [ready])).toEqual([]);
    await expect(as("anon", {}, read, [ready])).rejects.toThrow(/permission denied/);
    await expect(
      asUser(asCloser, "insert into public.payments (client_id, amount_cents, term_months, paid_on, recorded_by) values ($1, 100, 6, current_date, $2)", [ready, CLOSER]),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, "update public.payments set amount_cents = 1 where client_id = $1", [ready])).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, "delete from public.payments where client_id = $1", [ready])).rejects.toThrow(/permission denied/);
  });

  it("a payment marked by mistake can be voided once, by the client's Closer or an admin", async () => {
    const [{ id }] = await pay(unsent, CLOSER);
    await expect(asServer("select public.void_payment($1, $2)", [id, CLOSER2])).rejects.toThrow(/only the client's Closer or an admin/);
    await asServer("select public.void_payment($1, $2)", [id, CLOSER]);
    await expect(asServer("select public.void_payment($1, $2)", [id, ADMIN])).rejects.toThrow(/already void/);
    expect(await asServer("select status from public.payments where id = $1", [id])).toEqual([{ status: "void" }]);
  });

  it("activation needs the form, consent, a payment, an enabled client, and the client's Closer or an admin", async () => {
    await expect(activate(unsent, LOGIN, CLOSER)).rejects.toThrow(/hasn't sent the onboarding form/);
    await onboard(unsent, CLOSER, "unsent");
    await asServer("update public.payments set status = 'void', voided_at = now(), voided_by = $2 where client_id = $1", [unsent, ADMIN]);
    await expect(activate(unsent, LOGIN, CLOSER)).rejects.toThrow(/record a payment before activating/);
    await expect(activate(ready, LOGIN, CLOSER2)).rejects.toThrow(/only the client's Closer or an admin/);
    await asServer("update public.clients set disabled_at = now() where id = $1", [ready]);
    await expect(activate(ready, LOGIN, CLOSER)).rejects.toThrow(/disabled/);
    await asServer("update public.clients set disabled_at = null where id = $1", [ready]);
    await expect(activate(ready, VA, CLOSER)).rejects.toThrow(/already belongs to someone/);
    expect(await asServer("select status from public.clients where id = $1", [ready])).toEqual([{ status: "pending" }]);
  });

  it("activating grants the client role, links the login, marks the client active and closes open links", async () => {
    await asServer("update public.client_onboarding_links set created_at = created_at - interval '3 minutes' where client_id = $1", [ready]);
    await asServer("select * from public.issue_onboarding_link($1, $2, $3)", [ready, CLOSER, sha("reissued")]);
    await activate(ready, LOGIN, CLOSER);
    const [client] = await asServer<{ status: string; user_id: string; activated_at: string | null }>(
      "select status, user_id, activated_at from public.clients where id = $1",
      [ready],
    );
    expect(client).toMatchObject({ status: "active", user_id: LOGIN });
    expect(client.activated_at).not.toBeNull();
    expect(await asServer("select role, assigned_by from public.roles where user_id = $1", [LOGIN])).toEqual([{ role: "client", assigned_by: CLOSER }]);
    expect((await hookRoles(LOGIN)).roles).toEqual(["client"]);
    expect(await asServer("select id from public.client_onboarding_links where client_id = $1 and submitted_at is null and revoked_at is null", [ready])).toEqual([]);
    const asOwner = token(LOGIN, ["client"]);
    expect(ids(await asUser<{ id: string }>(asOwner, "select id from public.clients"))).toEqual([ready]);
    expect((await asUser(asOwner, "select id from public.payments")).length).toBeGreaterThan(0);
  });

  it("an active client can't be activated again, and its payments can't be added or voided by hand", async () => {
    await expect(activate(ready, FRESH, CLOSER)).rejects.toThrow(/already active/);
    await expect(pay(ready, CLOSER)).rejects.toThrow(/already active/);
    const [{ id }] = await asServer<{ id: string }>("select id from public.payments where client_id = $1 and status = 'paid' limit 1", [ready]);
    await expect(asServer("select public.void_payment($1, $2)", [id, ADMIN])).rejects.toThrow(/already active/);
    await pay(unsent, CLOSER);
    await expect(activate(unsent, LOGIN, CLOSER)).rejects.toThrow(/already belongs to someone/);
  });

  it("a fresh login moves into the client's tenant on activation", async () => {
    await pay(inB, CLOSER_B);
    await activate(inB, LOGIN_B, CLOSER_B);
    const [{ tenant_id: clientTenant }] = await asServer<{ tenant_id: string }>("select tenant_id from public.clients where id = $1", [inB]);
    expect(await asServer("select tenant_id from public.profiles where id = $1", [LOGIN_B])).toEqual([{ tenant_id: clientTenant }]);
    expect(await asServer("select tenant_id from public.roles where user_id = $1", [LOGIN_B])).toEqual([{ tenant_id: clientTenant }]);
  });

  it("payments stay inside their tenant; a Super Admin with 2FA sees them all", async () => {
    const [{ tenant_id: other }] = await asServer<{ tenant_id: string }>("select tenant_id from public.clients where id = $1", [inB]);
    const adminB = { ...token("00000000-0000-0000-0000-0000000000b1", ["admin"], "aal2"), app_metadata: { roles: ["admin"], tenant_id: other } };
    const clientsSeen = async (claims: Claims) => [...new Set((await asUser<{ client_id: string }>(claims, "select client_id from public.payments")).map((p) => p.client_id))];
    expect(await clientsSeen(adminB)).toEqual([inB]);
    expect(await clientsSeen(asAdmin)).not.toContain(inB);
    expect(await clientsSeen(token("00000000-0000-0000-0000-000000000010", ["super_admin"], "aal2"))).toEqual(expect.arrayContaining([inB, ready]));
  });

  it("a Closer grants only the client role, only in their own tenant, only while active", async () => {
    await expect(grant(FRESH, "va", CLOSER)).rejects.toThrow(/admin of the same tenant/);
    await expect(grant(FRESH, "closer", CLOSER)).rejects.toThrow(/admin of the same tenant/);
    await expect(grant(FRESH, "admin", CLOSER)).rejects.toThrow(/only a Super Admin/);
    await expect(grant(FRESH, "client", CLOSER_B)).rejects.toThrow(/admin of the same tenant/);
    await asServer("update public.profiles set status = 'inactive' where id = $1", [CLOSER2]);
    await expect(grant(FRESH, "client", CLOSER2)).rejects.toThrow(/admin of the same tenant/);
    await asServer("update public.profiles set status = 'active' where id = $1", [CLOSER2]);
    await expect(grant(FRESH, "client", CLOSER)).resolves.toHaveLength(1);
    await asServer("delete from public.roles where user_id = $1", [FRESH]);
  });
});


describe("client onboarding", () => {
  const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJK123456";
  const hash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const details = {
    industry: "Legal",
    country: "United States",
    city: "Austin",
    about: "Inbox",
    website: "",
    jobTitle: "",
    street: "",
    state: "",
    zip: "",
    staffCount: "",
  };
  let clientId = "";

  beforeAll(async () => {
    clientId = (
      await asServer<{ id: string }>(
        "insert into public.clients (company_name, contact_name, contact_email, created_by) values ('Packet Co', 'Nia', 'packet@x.co', $1) returning id",
        [CLOSER],
      )
    )[0].id;
  });

  it("keeps the link, the signature and the payment file off the API", async () => {
    await expect(as("anon", {}, "select client_id from public.client_packets")).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, "select client_id from public.client_packets")).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, "select public.issue_client_onboarding_link($1, $2, $3)", [clientId, token, hash])).rejects.toThrow(/permission denied/);
    await expect(as("anon", {}, "select public.issue_client_onboarding_link($1, $2, $3)", [clientId, token, hash])).rejects.toThrow(/permission denied/);
  });

  it("refuses a token that is not 43 characters", async () => {
    await expect(asServer("select public.issue_client_onboarding_link($1, 'short', $2)", [clientId, hash])).rejects.toThrow(/bad onboarding token/);
  });

  it("issues one stable link and then accepts the packet once", async () => {
    await asServer("select public.issue_client_onboarding_link($1, $2, $3)", [clientId, token, hash]);
    const [open] = await asServer<{ onboarding_status: string; token: string }>(
      "select c.onboarding_status, p.token from public.clients c join public.client_packets p on p.client_id = c.id where c.id = $1",
      [clientId],
    );
    expect(open).toEqual({ onboarding_status: "pending_customer", token });
    await expect(asServer("select public.issue_client_onboarding_link($1, $2, $3)", [clientId, token, hash])).rejects.toThrow(/onboarding link already exists/);

    await asServer(
      "select public.submit_client_packet($1, 'Packet Co', 'Nia', null, $2::jsonb, 'Nia Packet', 'receipt.pdf', 'application/pdf', 'YQ==')",
      [hash, JSON.stringify(details)],
    );
    const [done] = await asServer<{ onboarding_status: string; consent_name: string; size: number }>(
      "select c.onboarding_status, p.consent_name, octet_length(p.payment_proof) as size from public.clients c join public.client_packets p on p.client_id = c.id where c.id = $1",
      [clientId],
    );
    expect(done).toEqual({ onboarding_status: "pending_review", consent_name: "Nia Packet", size: 1 });
    await expect(
      asServer("select public.submit_client_packet($1, 'Packet Co', 'Nia', null, $2::jsonb, 'Nia Packet', 'receipt.pdf', 'application/pdf', 'YQ==')", [
        hash,
        JSON.stringify(details),
      ]),
    ).rejects.toThrow(/registration is not open/);
    await expect(
      asServer("select public.submit_client_packet($1, 'Packet Co', 'Nia', null, $2::jsonb, 'Nia Packet', 'receipt.pdf', 'application/pdf', 'YQ==')", [
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        JSON.stringify(details),
      ]),
    ).rejects.toThrow(/unknown registration link/);
  });

  it("refuses a link for a disabled client", async () => {
    const [row] = await asServer<{ id: string }>(
      "insert into public.clients (company_name, contact_name, contact_email, created_by, disabled_at) values ('Closed Co', 'Nia', 'closed@x.co', $1, now()) returning id",
      [CLOSER],
    );
    await expect(asServer("select public.issue_client_onboarding_link($1, $2, $3)", [row.id, `${token.slice(0, 42)}Z`, hash])).rejects.toThrow(/client is disabled/);
  });

  it("keeps review marks until every section is clear, then links the login", async () => {
    await expect(asUser(asAdmin, "select public.accept_client_review($1)", [clientId])).rejects.toThrow(/permission denied/);
    await expect(asServer("select public.accept_client_review($1)", ["00000000-0000-0000-0000-000000000099"])).rejects.toThrow(/client not found/);
    await asServer("select public.save_client_review($1, $2::text[], $3)", [clientId, ["basic", "payment"], "City is wrong"]);
    const [marked] = await asServer<{ review_issues: string[]; review_note: string; onboarding_status: string }>(
      "select p.review_issues, p.review_note, c.onboarding_status from public.client_packets p join public.clients c on c.id = p.client_id where c.id = $1",
      [clientId],
    );
    expect(marked.onboarding_status).toBe("changes_requested");
    expect(marked.review_note).toBe("City is wrong");
    expect(marked.review_issues.sort()).toEqual(["basic", "payment"]);
    await expect(asServer("select public.accept_client_review($1)", [clientId])).rejects.toThrow(/registration is not in review/);

    await asServer(
      "select public.submit_client_packet($1, 'Packet Co', 'Nia', null, $2::jsonb, 'Nia Packet', 'receipt.pdf', 'application/pdf', 'YQ==')",
      [hash, JSON.stringify(details)],
    );
    const [returned] = await asServer<{ onboarding_status: string; review_note: string | null }>(
      "select c.onboarding_status, p.review_note from public.clients c join public.client_packets p on p.client_id = c.id where c.id = $1",
      [clientId],
    );
    expect(returned).toEqual({ onboarding_status: "pending_review", review_note: null });

    await asServer("select public.accept_client_review($1)", [clientId]);
    const [accepted] = await asServer<{ onboarding_status: string; review_note: string | null }>(
      "select c.onboarding_status, p.review_note from public.clients c join public.client_packets p on p.client_id = c.id where c.id = $1",
      [clientId],
    );
    expect(accepted).toEqual({ onboarding_status: "approved", review_note: null });
    await expect(asServer("select public.save_client_review($1, $2::text[], $3)", [clientId, ["basic"], "Too late"])).rejects.toThrow(/registration is not in review/);

    const login = "00000000-0000-0000-0000-0000000000aa";
    await as("supabase_auth_admin", {}, `insert into auth.users (id, email) values ('${login}', 'packet-login@x.co')`);
    await asServer("insert into public.roles (user_id, role, assigned_by) values ($1, 'client', $2)", [login, ADMIN]);
    await asServer("select public.record_client_invite($1, $2)", [clientId, login]);
    const [sent] = await asServer<{ onboarding_status: string; user_id: string; status: string }>(
      "select onboarding_status, user_id, status from public.clients where id = $1",
      [clientId],
    );
    expect(sent).toEqual({ onboarding_status: "invite_sent", user_id: login, status: "pending" });
    await expect(asServer("select public.record_client_invite($1, $2)", [clientId, login])).rejects.toThrow(/client already has a login/);

    // The login's first sign-in activates the client; a later one changes nothing.
    await as("supabase_auth_admin", {}, `update auth.users set last_sign_in_at = now() where id = '${login}'`);
    const [active] = await asServer<{ status: string; activated: boolean }>("select status, activated_at is not null as activated from public.clients where id = $1", [clientId]);
    expect(active).toEqual({ status: "active", activated: true });
    const [{ at }] = await asServer<{ at: string }>("select activated_at::text as at from public.clients where id = $1", [clientId]);
    await as("supabase_auth_admin", {}, `update auth.users set last_sign_in_at = now() + interval '1 day' where id = '${login}'`);
    expect((await asServer<{ at: string }>("select activated_at::text as at from public.clients where id = $1", [clientId]))[0].at).toBe(at);
  });

  it("activates on sign-in only a client whose invite went out, and never a disabled one", async () => {
    const make = async (name: string, login: string, onboarding: string, disabled = false) => {
      await as("supabase_auth_admin", {}, `insert into auth.users (id, email) values ('${login}', '${name}@x.co')`);
      await asServer("insert into public.roles (user_id, role, assigned_by) values ($1, 'client', $2)", [login, ADMIN]);
      const [{ id }] = await asServer<{ id: string }>(
        "insert into public.clients (company_name, contact_name, contact_email, created_by, user_id, onboarding_status, disabled_at) values ($1, 'C', $2, $3, $4, $5, $6) returning id",
        [name, `${name}-c@x.co`, CLOSER, login, onboarding, disabled ? new Date().toISOString() : null],
      );
      await as("supabase_auth_admin", {}, `update auth.users set last_sign_in_at = now() where id = '${login}'`);
      return (await asServer<{ status: string }>("select status from public.clients where id = $1", [id]))[0].status;
    };
    expect(await make("approved-only", "00000000-0000-0000-0000-0000000000ab", "approved")).toBe("pending");
    expect(await make("disabled-sent", "00000000-0000-0000-0000-0000000000ac", "invite_sent", true)).toBe("pending");
  });
});

describe("demo scheduling", () => {
  // VA is an approved VA; VA2 is not (invited, no review). OWNER logs in for Demo Co (active, no VA); OTHER for
  // Other Co. VA_X is an approved VA in the second tenant (see "tenants").
  const OWNER = "00000000-0000-0000-0000-0000000000d1";
  const OTHER = "00000000-0000-0000-0000-0000000000d2";
  const VA_X = "00000000-0000-0000-0000-0000000000d3";
  const asOwner = token(OWNER, ["client"]);
  const asOther = token(OTHER, ["client"]);
  const HALF_HOUR = 30 * 60 * 1000;
  /** An aligned slot start, `hours` from now (rounded up to the next :00 or :30). */
  const at = (hours: number) => new Date(Math.ceil((Date.now() + hours * 3600 * 1000) / HALF_HOUR) * HALF_HOUR).toISOString();
  const end = (start: string) => new Date(new Date(start).getTime() + HALF_HOUR).toISOString();
  let demoCo = "";
  let otherCo = "";
  let pendingCo = "";

  const addSlot = async (claims: Claims, va: string, start: string, finish = end(start)) =>
    (await asUser<{ id: string }>(claims, "insert into public.demo_slots (va_id, starts_at, ends_at) values ($1, $2, $3) returning id", [va, start, finish]))[0]?.id;
  const book = (client: string, slot: string, actor: string, note: string | null = null) =>
    asServer<{ r: Record<string, string> }>("select public.book_demo($1, $2, $3, $4) as r", [client, slot, actor, note]);
  const decide = (booking: string, actor: string, decision: string, reason: string | null = null) =>
    asServer<{ r: Record<string, string> }>("select public.decide_demo($1, $2, $3, $4) as r", [booking, actor, decision, reason]);
  const cancel = (booking: string, actor: string) => asServer<{ r: Record<string, string> }>("select public.cancel_demo($1, $2) as r", [booking, actor]);
  const statusOf = async (booking: string) => (await asServer<{ status: string }>("select status from public.demo_bookings where id = $1", [booking]))[0].status;
  const newActiveClient = async (name: string, login: string | null, status = "active") =>
    (await asServer<{ id: string }>(
      `insert into public.clients (company_name, contact_name, contact_email, created_by, user_id, status, activated_at,
         package_code, hours_per_week, term_months, monthly_cents, starts_on, timezone)
       values ($1, 'Pat', $2, $3, $4, $5, ${status === "active" ? "now()" : "null"}, 'essentials', 20, 6, 85500, '2026-11-01', 'America/New_York') returning id`,
      [name, `${name.toLowerCase().replace(/\s+/g, "")}@demo.co`, CLOSER, login, status],
    ))[0].id;

  beforeAll(async () => {
    await as("supabase_auth_admin", {}, `insert into auth.users (id, email) values ('${OWNER}', 'owner@demo.co'), ('${OTHER}', 'other@demo.co'), ('${VA_X}', 'va-x@demo.co')`);
    await asServer("update public.profiles set status = 'active', tenant_id = (select id from public.tenants where slug = 'other-agency') where id = $1", [VA_X]);
    await asServer("insert into public.roles (user_id, role) values ($1, 'va')", [VA_X]);
    await asServer(`insert into public.roles (user_id, role) values ('${OWNER}', 'client'), ('${OTHER}', 'client')`);
    await asServer("update public.profiles set full_name = 'Vera Cruz', status = 'active' where id = $1", [VA]);
    await asServer("update public.employee_profiles set review_status = 'approved' where user_id = $1", [VA]);
    demoCo = await newActiveClient("Demo Co", OWNER);
    otherCo = await newActiveClient("Other Co", OTHER);
    pendingCo = await newActiveClient("Pending Co", null, "pending");
  });

  describe("slots", () => {
    it("an approved VA adds, reads and deletes their own open slot", async () => {
      const slot = await addSlot(asVa, VA, at(30));
      expect(ids(await asUser<{ id: string }>(asVa, "select id from public.demo_slots where id = $1", [slot]))).toEqual([slot]);
      expect(await asUser(asVa, "delete from public.demo_slots where id = $1 returning id", [slot])).toHaveLength(1);
    });

    it("skips a time the VA already offers (insert … on conflict do nothing, as the calendar sends it)", async () => {
      const start = at(32);
      const upsert = () =>
        asUser<{ id: string }>(asVa, "insert into public.demo_slots (va_id, starts_at, ends_at) values ($1, $2, $3) on conflict (va_id, starts_at) do nothing returning id", [VA, start, end(start)]);
      const [first] = await upsert();
      expect(await upsert()).toEqual([]);
      await asServer("delete from public.demo_slots where id = $1", [first.id]);
    });

    it("refuses a slot for another VA, in the past, misaligned, the wrong length or over 30 days ahead", async () => {
      await expect(addSlot(asVa, VA2, at(30))).rejects.toThrow(/row-level security/);
      await expect(addSlot(asVa, VA, at(-2))).rejects.toThrow(/row-level security/);
      const misaligned = new Date(new Date(at(30)).getTime() + 10 * 60 * 1000).toISOString();
      await expect(addSlot(asVa, VA, misaligned)).rejects.toThrow(/demo_slots_aligned/);
      await expect(addSlot(asVa, VA, at(30), end(end(at(30))))).rejects.toThrow(/demo_slots_length/);
      await expect(addSlot(asVa, VA, at(24 * 31))).rejects.toThrow(/row-level security/);
    });

    it("refuses slots from a VA who isn't approved or is deactivated, and from other roles", async () => {
      await expect(addSlot(asVa2, VA2, at(30))).rejects.toThrow(/row-level security/);
      await asServer("update public.profiles set status = 'inactive' where id = $1", [VA]);
      await expect(addSlot(asVa, VA, at(31))).rejects.toThrow(/row-level security|not an active user/);
      await asServer("update public.profiles set status = 'active' where id = $1", [VA]);
      await expect(addSlot(asOwner, VA, at(30))).rejects.toThrow(/row-level security/);
      await expect(addSlot(asAdmin, VA, at(30))).rejects.toThrow(/row-level security/);
      await expect(as("anon", {}, "select id from public.demo_slots")).rejects.toThrow(/permission denied/);
    });

    it("a VA sees only their own slots; a client only bookable ones; an admin needs two-factor", async () => {
      const mine = await addSlot(asVa, VA, at(40));
      const soon = await addSlot(asVa, VA, at(1)); // under 4 hours' notice: not bookable
      expect(await asUser(asVa2, "select id from public.demo_slots")).toEqual([]);
      const seen = ids(await asUser<{ id: string }>(asOwner, "select id from public.demo_slots"));
      expect(seen).toContain(mine);
      expect(seen).not.toContain(soon);
      expect(await asUser(asCloser, "select id from public.demo_slots")).toEqual([]);
      expect(await asUser(token(ADMIN, ["admin"], "aal1"), "select id from public.demo_slots")).toEqual([]);
      expect(ids(await asUser<{ id: string }>(asAdmin, "select id from public.demo_slots"))).toEqual(expect.arrayContaining([mine, soon]));
      await asServer("delete from public.demo_slots where id in ($1, $2)", [mine, soon]);
    });

    it("hides slots of a VA who isn't open, and slots in another tenant", async () => {
      const slot = await addSlot(asVa, VA, at(42));
      await asServer("update public.employee_profiles set review_status = 'pending' where user_id = $1", [VA]);
      expect(ids(await asUser<{ id: string }>(asOwner, "select id from public.demo_slots"))).not.toContain(slot);
      await asServer("update public.employee_profiles set review_status = 'approved' where user_id = $1", [VA]);
      const [{ id: inB }] = await asServer<{ id: string }>("insert into public.demo_slots (va_id, starts_at, ends_at) values ($1, $2, $3) returning id", [VA_X, at(44), end(at(44))]);
      expect(ids(await asUser<{ id: string }>(asOwner, "select id from public.demo_slots"))).not.toContain(inB);
      await expect(book(demoCo, inB, OWNER)).rejects.toMatchObject({ code: "IVA18" });
      await asServer("delete from public.demo_slots where id in ($1, $2)", [slot, inB]);
    });
  });

  describe("bookings", () => {
    it("only the server books, decides or cancels — and nobody writes bookings directly", async () => {
      const slot = await addSlot(asVa, VA, at(50));
      await expect(asUser(asOwner, "select public.book_demo($1, $2, $3, null)", [demoCo, slot, OWNER])).rejects.toThrow(/permission denied for function/);
      await expect(asUser(asVa, "select public.decide_demo($1, $2, 'confirmed', null)", [slot, VA])).rejects.toThrow(/permission denied for function/);
      await expect(as("anon", {}, "select public.cancel_demo($1, $2)", [slot, OWNER])).rejects.toThrow(/permission denied for function/);
      await expect(
        asUser(asOwner, "insert into public.demo_bookings (client_id, va_id, starts_at, ends_at, booked_by, company_name, va_name) values ($1, $2, $3, $4, $5, 'X', 'Y')", [demoCo, VA, at(50), end(at(50)), OWNER]),
      ).rejects.toThrow(/permission denied/);
      await expect(asUser(asVa, "update public.demo_bookings set status = 'confirmed'")).rejects.toThrow(/permission denied/);
      await asServer("delete from public.demo_slots where id = $1", [slot]);
    });

    it("books, shows the right rows to each role, then confirms; the slot is then used and can't be deleted", async () => {
      const slot = await addSlot(asVa, VA, at(52));
      const [{ r }] = await book(demoCo, slot, OWNER, "  Inbox triage  ");
      expect(r).toMatchObject({ va_email: "va@x.co", company_name: "Demo Co", client_timezone: "America/New_York", client_note: "Inbox triage" });
      const [row] = await asServer<{ va_name: string; status: string; client_note: string }>("select va_name, status, client_note from public.demo_bookings where id = $1", [r.id]);
      expect(row).toEqual({ va_name: "Vera", status: "pending", client_note: "Inbox triage" });

      expect(ids(await asUser<{ id: string }>(asOwner, "select id from public.demo_bookings"))).toEqual([r.id]);
      expect(await asUser(asOther, "select id from public.demo_bookings")).toEqual([]);
      expect(ids(await asUser<{ id: string }>(asVa, "select id from public.demo_bookings"))).toEqual([r.id]);
      expect(await asUser(asVa2, "select id from public.demo_bookings")).toEqual([]);
      expect(ids(await asUser<{ id: string }>(asCloser, "select id from public.demo_bookings"))).toEqual([r.id]);
      expect(await asUser(asCloser2, "select id from public.demo_bookings")).toEqual([]);
      expect(await asUser(token(ADMIN, ["admin"], "aal1"), "select id from public.demo_bookings")).toEqual([]);
      expect(ids(await asUser<{ id: string }>(asAdmin, "select id from public.demo_bookings"))).toContain(r.id);
      expect(ids(await asUser<{ id: string }>(asOther, "select id from public.demo_slots"))).not.toContain(slot);

      await expect(decide(r.id, VA2, "confirmed")).rejects.toMatchObject({ code: "IVA14" });
      await expect(decide(r.id, VA, "maybe")).rejects.toThrow(/confirmed or rejected/);
      const [{ r: decided }] = await decide(r.id, VA, "confirmed", "ignored");
      expect(decided).toMatchObject({ status: "confirmed", client_email: "owner@demo.co", contact_name: "Pat", va_name: "Vera", reject_reason: null });
      expect(await statusOf(r.id)).toBe("confirmed");
      await expect(decide(r.id, VA, "rejected")).rejects.toMatchObject({ code: "IVA20" });
      expect(await asUser(asVa, "delete from public.demo_slots where id = $1 returning id", [slot])).toEqual([]);
    });

    it("holds the 1-call rule: one open demo per client, so a second booking is refused", async () => {
      const slot = await addSlot(asVa, VA, at(54));
      await expect(book(demoCo, slot, OWNER)).rejects.toMatchObject({ code: "IVA17" });
      // The index holds it even past the function (e.g. two requests at once).
      await expect(
        asServer("insert into public.demo_bookings (client_id, va_id, starts_at, ends_at, booked_by, company_name, va_name) values ($1, $2, $3, $4, $5, 'Demo Co', 'Vera')", [demoCo, VA, at(54), end(at(54)), OWNER]),
      ).rejects.toThrow(/demo_bookings_one_open_per_client/);
      await asServer("delete from public.demo_slots where id = $1", [slot]);
    });

    it("lets the client cancel, frees the slot, and lets another client book it", async () => {
      const [{ id: open }] = await asServer<{ id: string }>("select id from public.demo_bookings where client_id = $1 and status = 'confirmed'", [demoCo]);
      await expect(cancel(open, OTHER)).rejects.toMatchObject({ code: "IVA14" });
      await expect(cancel(open, VA)).rejects.toMatchObject({ code: "IVA14" });
      const [{ r }] = await cancel(open, OWNER);
      expect(r).toMatchObject({ previous_status: "confirmed", va_email: "va@x.co", company_name: "Demo Co" });
      await expect(cancel(open, OWNER)).rejects.toMatchObject({ code: "IVA20" });
      const [{ slot_id: freed }] = await asServer<{ slot_id: string }>("select slot_id from public.demo_bookings where id = $1", [open]);
      expect(ids(await asUser<{ id: string }>(asOther, "select id from public.demo_slots"))).toContain(freed);
      const [{ r: again }] = await book(otherCo, freed, OTHER);
      expect(await statusOf(again.id)).toBe("pending");
    });

    it("refuses a used slot; a rejected slot stays used, and the client may book again after a reject", async () => {
      const [{ id: taken, slot_id: used }] = await asServer<{ id: string; slot_id: string }>("select id, slot_id from public.demo_bookings where client_id = $1 and status = 'pending'", [otherCo]);
      await expect(book(demoCo, used, OWNER)).rejects.toMatchObject({ code: "IVA18" });
      const [{ r }] = await decide(taken, VA, "rejected", "  Fully booked that week  ");
      expect(r).toMatchObject({ status: "rejected", reject_reason: "Fully booked that week" });
      await expect(book(demoCo, used, OWNER)).rejects.toMatchObject({ code: "IVA18" });
      const next = await addSlot(asVa, VA, at(56));
      const [{ r: rebooked }] = await book(otherCo, next, OTHER);
      expect(await statusOf(rebooked.id)).toBe("pending");
    });

    it("settles stale bookings before booking: an unanswered past request expires, a past confirmed demo completes", async () => {
      const past = at(-30);
      await asServer("update public.demo_bookings set status = 'expired', decided_at = null where client_id = $1 and status = 'pending'", [otherCo]);
      const [{ id: stale }] = await asServer<{ id: string }>(
        "insert into public.demo_bookings (client_id, va_id, starts_at, ends_at, booked_by, company_name, va_name) values ($1, $2, $3, $4, $5, 'Other Co', 'Vera') returning id",
        [otherCo, VA, past, end(past), OTHER],
      );
      const slot = await addSlot(asVa, VA, at(58));
      await book(otherCo, slot, OTHER);
      expect(await statusOf(stale)).toBe("expired");
      await expect(decide(stale, VA, "confirmed")).rejects.toMatchObject({ code: "IVA20" });
    });

    it("refuses too soon, too far ahead, unknown slots and clients, a client with a VA, a pending or disabled client", async () => {
      const soon = await addSlot(asVa, VA, at(2));
      const far = await addSlot(asVa, VA, at(24 * 20));
      const fine = await addSlot(asVa, VA, at(60));
      await asServer("update public.demo_bookings set status = 'cancelled', cancelled_at = now() where client_id = $1 and status in ('pending', 'confirmed')", [demoCo]);
      await expect(book(demoCo, soon, OWNER)).rejects.toMatchObject({ code: "IVA19" });
      await expect(book(demoCo, far, OWNER)).rejects.toMatchObject({ code: "IVA19" });
      await expect(book(demoCo, "00000000-0000-0000-0000-00000000dead", OWNER)).rejects.toMatchObject({ code: "IVA18" });
      await expect(book("00000000-0000-0000-0000-00000000dead", fine, OWNER)).rejects.toMatchObject({ code: "IVA01" });
      await expect(book(demoCo, fine, OTHER)).rejects.toMatchObject({ code: "IVA14" });
      await asServer("insert into public.client_va_assignments (client_id, va_id) values ($1, $2)", [demoCo, VA]);
      await expect(book(demoCo, fine, OWNER)).rejects.toMatchObject({ code: "IVA16" });
      await asServer("update public.client_va_assignments set status = 'ended', ended_at = now() where client_id = $1", [demoCo]);
      await expect(book(pendingCo, fine, OWNER)).rejects.toMatchObject({ code: "IVA14" });
      await asServer("update public.clients set disabled_at = now() where id = $1", [demoCo]);
      await expect(book(demoCo, fine, OWNER)).rejects.toMatchObject({ code: "IVA07" });
      await asServer("update public.clients set disabled_at = null where id = $1", [demoCo]);
      await expect(decide("00000000-0000-0000-0000-00000000dead", VA, "confirmed")).rejects.toMatchObject({ code: "IVA01" });
      await asServer("delete from public.demo_slots where id in ($1, $2, $3)", [soon, far, fine]);
    });

    it("refuses a deactivated client login, and a VA who lost the role or the approval", async () => {
      const slot = await addSlot(asVa, VA, at(64));
      await asServer("update public.demo_bookings set status = 'cancelled', cancelled_at = now() where client_id = $1 and status in ('pending', 'confirmed')", [demoCo]);
      await asServer("update public.profiles set status = 'inactive' where id = $1", [OWNER]);
      await expect(book(demoCo, slot, OWNER)).rejects.toMatchObject({ code: "IVA14" });
      await asServer("update public.profiles set status = 'active' where id = $1", [OWNER]);
      const [{ r }] = await book(demoCo, slot, OWNER);
      await asServer("update public.profiles set status = 'inactive' where id = $1", [OWNER]);
      await expect(cancel(r.id, OWNER)).rejects.toMatchObject({ code: "IVA14" });
      await asServer("update public.profiles set status = 'active' where id = $1", [OWNER]);
      await asServer("update public.employee_profiles set review_status = 'pending' where user_id = $1", [VA]);
      await expect(decide(r.id, VA, "confirmed")).rejects.toMatchObject({ code: "IVA14" });
      await asServer("update public.employee_profiles set review_status = 'approved' where user_id = $1", [VA]);
      await asServer("update public.profiles set status = 'inactive' where id = $1", [VA]);
      await expect(decide(r.id, VA, "confirmed")).rejects.toMatchObject({ code: "IVA14" });
      await asServer("update public.profiles set status = 'active' where id = $1", [VA]);
    });

    it("refuses deciding or cancelling a pending request once its start has passed", async () => {
      const past = at(-1);
      await asServer("update public.demo_bookings set status = 'cancelled', cancelled_at = now() where client_id = $1 and status in ('pending', 'confirmed')", [demoCo]);
      const [{ id: late }] = await asServer<{ id: string }>(
        "insert into public.demo_bookings (client_id, va_id, starts_at, ends_at, booked_by, company_name, va_name) values ($1, $2, $3, $4, $5, 'Demo Co', 'Vera') returning id",
        [demoCo, VA, past, end(past), OWNER],
      );
      await expect(decide(late, VA, "confirmed")).rejects.toMatchObject({ code: "IVA20" });
      await expect(cancel(late, OWNER)).rejects.toMatchObject({ code: "IVA20" });
      await asServer("update public.demo_bookings set status = 'expired' where id = $1", [late]);
    });

    it("a VA can't delete another VA's slot, a past slot, or a booked one — nor update any slot", async () => {
      const mine = await addSlot(asVa, VA, at(66));
      await asServer("update public.profiles set status = 'active' where id = $1", [VA2]);
      expect(await asUser(asVa2, "delete from public.demo_slots where id = $1 returning id", [mine])).toEqual([]);
      await asServer("update public.profiles set status = 'invited' where id = $1", [VA2]);
      await expect(asUser(asVa, "update public.demo_slots set starts_at = starts_at where id = $1", [mine])).rejects.toThrow(/permission denied/);
      const [{ id: past }] = await asServer<{ id: string }>("insert into public.demo_slots (va_id, starts_at, ends_at) values ($1, $2, $3) returning id", [VA, at(-3), end(at(-3))]);
      expect(await asUser(asVa, "delete from public.demo_slots where id = $1 returning id", [past])).toEqual([]);
      // Booked: hidden from the VA's delete, and refused by the trigger even for the server.
      const [{ r }] = await book(demoCo, mine, OWNER);
      expect(await asUser(asVa, "delete from public.demo_slots where id = $1 returning id", [mine])).toEqual([]);
      await expect(asServer("delete from public.demo_slots where id = $1", [mine])).rejects.toMatchObject({ code: "IVA20" });
      // Once cancelled, the slot can go and the booking keeps its time without it.
      await cancel(r.id, OWNER);
      expect(await asUser(asVa, "delete from public.demo_slots where id = $1 returning id", [mine])).toHaveLength(1);
      expect(await asServer("select slot_id, starts_at from public.demo_bookings where id = $1", [r.id])).toEqual([{ slot_id: null, starts_at: expect.anything() }]);
      await asServer("delete from public.demo_slots where id = $1", [past]);
    });

    it("the slot index holds even past the function: one non-cancelled booking per slot", async () => {
      const slot = await addSlot(asVa, VA, at(68));
      const [{ r }] = await book(demoCo, slot, OWNER);
      await asServer("update public.demo_bookings set status = 'cancelled', cancelled_at = now() where client_id = $1 and status in ('pending', 'confirmed')", [otherCo]);
      await expect(
        asServer("insert into public.demo_bookings (client_id, va_id, slot_id, starts_at, ends_at, booked_by, company_name, va_name) values ($1, $2, $3, $4, $5, $6, 'Other Co', 'Vera')", [otherCo, VA, slot, at(68), end(at(68)), OTHER]),
      ).rejects.toThrow(/demo_bookings_slot_once/);
      await cancel(r.id, OWNER);
    });

    it("keeps slots and bookings inside their tenant", async () => {
      const [{ tenant_id: tenant }] = await asServer<{ tenant_id: string }>("select tenant_id from public.clients where id = $1", [demoCo]);
      const rows = await asServer<{ tenant_id: string }>("select distinct tenant_id from public.demo_bookings where client_id = $1", [demoCo]);
      expect(rows).toEqual([{ tenant_id: tenant }]);
      const [{ id: slotB }] = await asServer<{ id: string }>("insert into public.demo_slots (va_id, starts_at, ends_at) values ($1, $2, $3) returning id", [VA_X, at(62), end(at(62))]);
      // The second tenant's admin (two-factor) sees only that tenant's slot, and none of this tenant's bookings.
      const asAdminB = token("00000000-0000-0000-0000-0000000000b1", ["admin"], "aal2");
      expect(ids(await asUser<{ id: string }>(asAdminB, "select id from public.demo_slots"))).toEqual([slotB]);
      expect(await asUser(asAdminB, "select id from public.demo_bookings")).toEqual([]);
      expect(ids(await asUser<{ id: string }>(asAdmin, "select id from public.demo_slots"))).not.toContain(slotB);
      await expect(
        asServer("insert into public.demo_bookings (client_id, va_id, slot_id, starts_at, ends_at, booked_by, company_name, va_name) values ($1, $2, $3, $4, $5, $6, 'Demo Co', 'B')", [demoCo, VA_X, slotB, at(62), end(at(62)), OWNER]),
      ).rejects.toThrow(/foreign key/);
      await asServer("delete from public.demo_slots where id = $1", [slotB]);
    });
  });
});

describe("payment at review (sales)", () => {
  // An admin approves a registration packet and records the payment received, in one transaction.
  const details = { industry: "Legal", country: "United States", city: "Austin", about: "Inbox", website: "", jobTitle: "", street: "", state: "", zip: "", staffCount: "" };
  const linkToken = (n: string) => `${"s".repeat(42)}${n}`;
  const hash = (n: string) => `${n}`.padEnd(64, "a");
  let inReview = "";
  let notInReview = "";

  const packetInReview = async (name: string, n: string) => {
    const [{ id }] = await asServer<{ id: string }>(
      "insert into public.clients (company_name, contact_name, contact_email, created_by, package_code, hours_per_week, term_months, monthly_cents, starts_on, timezone) values ($1, 'Nia', $2, $3, 'essentials', 20, 6, 85500, '2026-11-01', 'America/New_York') returning id",
      [name, `${name.toLowerCase().replace(/\s+/g, "")}@sales.co`, CLOSER],
    );
    await asServer("select public.issue_client_onboarding_link($1, $2, $3)", [id, linkToken(n), hash(n)]);
    await asServer("select public.submit_client_packet($1, $2, 'Nia', null, $3::jsonb, 'Nia Packet', 'receipt.pdf', 'application/pdf', 'YQ==')", [hash(n), name, JSON.stringify(details)]);
    return id;
  };
  const approve = (client: string, actor: string, amount = 85500, fee = 1500, paidOn = "2026-10-20", ref: string | null = " TRX-9 ") =>
    asServer<{ id: string }>("select public.accept_client_review_paid($1, $2, $3, $4, $5, $6) as id", [client, actor, amount, fee, paidOn, ref]);
  const paymentsOf = (client: string) => asServer<{ amount_cents: number; fee_cents: number }>("select amount_cents, fee_cents from public.payments where client_id = $1", [client]);
  const stageOf = async (client: string) => (await asServer<{ s: string }>("select onboarding_status::text as s from public.clients where id = $1", [client]))[0].s;

  beforeAll(async () => {
    inReview = await packetInReview("Sales Co", "1");
    const [{ id }] = await asServer<{ id: string }>("insert into public.clients (company_name, contact_name, contact_email, created_by) values ('Fresh Co', 'F', 'fresh@sales.co', $1) returning id", [CLOSER]);
    notInReview = id;
  });

  it("only the server may call it", async () => {
    await expect(asUser(asAdmin, "select public.accept_client_review_paid($1, $2, 1, 0, current_date, null)", [inReview, ADMIN])).rejects.toThrow(/permission denied for function/);
    await expect(as("anon", {}, "select public.accept_client_review_paid($1, $2, 1, 0, current_date, null)", [inReview, ADMIN])).rejects.toThrow(/permission denied for function/);
  });

  it("refuses a non-admin actor, a bad amount, fee or date, and a packet not in review — storing nothing", async () => {
    await expect(approve(inReview, CLOSER)).rejects.toMatchObject({ code: "IVA14" });
    await expect(approve(inReview, ADMIN, 0)).rejects.toMatchObject({ code: "IVA21" });
    await expect(approve(inReview, ADMIN, 1000, 1001)).rejects.toMatchObject({ code: "IVA21" });
    await expect(approve(inReview, ADMIN, 1000, -1)).rejects.toMatchObject({ code: "IVA21" });
    await expect(approve(inReview, ADMIN, 1000, 0, "2999-01-01")).rejects.toMatchObject({ code: "IVA21" });
    await expect(approve(notInReview, ADMIN)).rejects.toMatchObject({ code: "IVA08" });
    expect(await paymentsOf(inReview)).toEqual([]);
    expect(await paymentsOf(notInReview)).toEqual([]);
    expect(await stageOf(inReview)).toBe("pending_review");
  });

  it("approves the packet and stores the payment with its fee and trimmed reference; admins with 2FA read it", async () => {
    const [{ id }] = await approve(inReview, ADMIN);
    expect(await stageOf(inReview)).toBe("approved");
    const [row] = await asServer<{ amount_cents: number; fee_cents: number; provider_ref: string; recorded_by: string; status: string; term_months: number }>(
      "select amount_cents, fee_cents, provider_ref, recorded_by, status, term_months from public.payments where id = $1",
      [id],
    );
    expect(row).toEqual({ amount_cents: 85500, fee_cents: 1500, provider_ref: "TRX-9", recorded_by: ADMIN, status: "paid", term_months: 6 });
    expect(await asUser(asAdmin, "select fee_cents from public.payments where id = $1", [id])).toEqual([{ fee_cents: 1500 }]);
    expect(await asUser(token(ADMIN, ["admin"], "aal1"), "select id from public.payments where id = $1", [id])).toEqual([]);
    // A second approval is refused (no longer in review) and adds no payment.
    await expect(approve(inReview, ADMIN)).rejects.toMatchObject({ code: "IVA08" });
    expect(await paymentsOf(inReview)).toHaveLength(1);
  });

  it("keeps a fee from exceeding the amount even outside the function", async () => {
    await expect(asServer("update public.payments set fee_cents = amount_cents + 1 where client_id = $1", [inReview])).rejects.toThrow(/payments_fee_within_amount/);
  });
});
