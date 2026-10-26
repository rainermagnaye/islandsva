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

  it("signed-in users cannot insert an assignment", async () => {
    const assign = (claims: Claims) => asUser(claims, "insert into public.client_va_assignments (client_id, va_id) values ($1, $2)", [clientB, VA2]);
    await expect(assign(asCloser)).rejects.toThrow(/permission denied/);
    await expect(assign(asVa)).rejects.toThrow(/permission denied/);
    await expect(assign(asAdmin)).rejects.toThrow(/permission denied/);
    await expect(as("service_role", asAdmin, "insert into public.client_va_assignments (client_id, va_id) values ($1, $2)", [clientB, VA2])).rejects.toMatchObject({ code: "IVA28" });
  });

  it("only a VA can be assigned, and the same pair cannot be active twice", async () => {
    await expect(asServer("insert into public.client_va_assignments (client_id, va_id) values ($1, $2)", [clientC, CLOSER])).rejects.toThrow(/not an active user with the va role/);
    const [second] = await asServer<{ id: string }>("insert into public.client_va_assignments (client_id, va_id) values ($1, $2) returning id", [clientA, VA2]);
    await expect(asServer("insert into public.client_va_assignments (client_id, va_id) values ($1, $2)", [clientA, VA2])).rejects.toThrow(/one_active_pair/);
    await asServer("update public.client_va_assignments set status = 'ended', ended_at = now() where id = $1", [second.id]);
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

  it("only admins with two-factor sign-in read every lead; a Lead Gen only those they own", async () => {
    expect((await asUser(asAdmin, "select id from public.leads")).length).toBeGreaterThan(0);
    for (const claims of [token(ADMIN, ["admin"], "aal1"), asVa, asClient]) {
      expect(await asUser(claims, "select id from public.leads")).toEqual([]);
    }
    const owners = await asUser<{ closer_id: string }>(asCloser, "select distinct closer_id from public.leads");
    expect(owners).toEqual([{ closer_id: CLOSER }]);
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
    expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining(["demo_slots", "demo_bookings", "payments", "client_onboarding_links", "discovery_times", "meetings", "meeting_events"]));
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

describe("discovery calls", () => {
  // LG_A and LG_B are Lead Gens of the default tenant; LG_OFF is one who was deactivated (their token still carries
  // the role for up to an hour). CLOSER_B, ADMIN_B and SUPER come from "tenants".
  const LG_A = "00000000-0000-0000-0000-0000000000f1";
  const LG_B = "00000000-0000-0000-0000-0000000000f2";
  const LG_OFF = "00000000-0000-0000-0000-0000000000f3";
  const ADMIN_ONLY = "00000000-0000-0000-0000-0000000000f4"; // an admin of the default tenant without the closer role
  const CLOSER_B = "00000000-0000-0000-0000-0000000000b3";
  const ADMIN_B = "00000000-0000-0000-0000-0000000000b1";
  const SUPER = "00000000-0000-0000-0000-000000000010";
  const asLgA = token(LG_A, ["closer"]);
  const asLgB = token(LG_B, ["closer"]);
  const asLgOff = token(LG_OFF, ["closer"]);
  const asAdminB = token(ADMIN_B, ["admin"], "aal2");
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  const HALF_HOUR = HOUR / 2;
  const TIMES = ["01:00", "05:00", "09:00", "13:00", "17:00", "21:00"];
  const IP = "c".repeat(64);
  let tenantA = "";
  let tenantB = "";

  /** What open_discovery_slots should list for these PHT times (UTC+8, no DST), 12 hours to 14 days ahead. */
  const expectedSlots = (times: string[], now = Date.now()) => {
    const phtMidnight = Math.floor((now + 8 * HOUR) / DAY) * DAY;
    const out: string[] = [];
    for (let day = 0; day <= 14; day++) {
      for (const time of times) {
        const [h, m] = time.split(":").map(Number);
        const start = phtMidnight + day * DAY + h * HOUR + m * 60 * 1000 - 8 * HOUR;
        if (start >= now + 12 * HOUR && start <= now + 14 * DAY) out.push(new Date(start).toISOString());
      }
    }
    return out.sort();
  };
  const iso = (value: unknown) => new Date(value as string).toISOString();
  const aligned = (offsetMs: number) => new Date(Math.floor((Date.now() + offsetMs) / HALF_HOUR) * HALF_HOUR).toISOString();
  const later = (start: string, ms: number) => new Date(new Date(start).getTime() + ms).toISOString();

  const slots = async () => (await asServer<{ s: string }>("select public.open_discovery_slots() as s")).map((r) => iso(r.s));
  const nextSlot = async () => (await slots())[0];
  const timesOf = (tenant: string) =>
    asServer<{ position: number; t: string }>("select position, time_of_day::text as t from public.discovery_times where tenant_id = $1 order by position", [tenant]);
  const setTimes = (claims: Claims, times: (string | null)[]) => asUser(claims, "select public.set_discovery_times($1::time[])", [times]);
  const request = async (email: string, startsAt: string, ip: string | null = null) =>
    (await asServer<{ id: string }>(
      "select public.request_discovery_call('Ana Cruz', $1, 'Cruz Co', 'Legal', 'Philippines', 'Inbox help, please.', 'executive', $2, 'UA', $3) as id",
      [email, ip, startsAt],
    ))[0].id;
  const meetingOf = async (lead: string) => (await asServer<{ id: string }>("select id from public.meetings where lead_id = $1", [lead]))[0].id;
  const decide = (meeting: string, actor: string, decision: string, reason: string | null = null, eventId: string | null = null, meetUrl: string | null = null) =>
    asServer<{ r: Record<string, string> }>("select public.decide_discovery_call($1, $2, $3, $4, $5, $6) as r", [meeting, actor, decision, reason, eventId, meetUrl]);
  const outcome = (meeting: string, actor: string, result: string, note: string | null = null) =>
    asServer("select public.record_discovery_outcome($1, $2, $3, $4)", [meeting, actor, result, note]);
  const inbox = (claims: Claims) => asUser<{ meeting_id: string } & Record<string, unknown>>(claims, "select * from public.discovery_inbox()");
  const inboxIds = async (claims: Claims) => (await inbox(claims)).map((r) => r.meeting_id);
  const statusOf = async (meeting: string) => (await asServer<{ status: string }>("select status from public.meetings where id = $1", [meeting]))[0].status;
  const leadOf = async (lead: string) =>
    (await asServer<{ status: string; closer_id: string | null }>("select status, closer_id from public.leads where id = $1", [lead]))[0];

  beforeAll(async () => {
    [{ id: tenantA }] = await asServer<{ id: string }>("select id from public.tenants where is_default");
    [{ id: tenantB }] = await asServer<{ id: string }>("select id from public.tenants where slug = 'other-agency'");
    await as("supabase_auth_admin", {}, `insert into auth.users (id, email) values ('${LG_A}', 'lg-a@x.co'), ('${LG_B}', 'lg-b@x.co'), ('${LG_OFF}', 'lg-off@x.co'), ('${ADMIN_ONLY}', 'admin-only@x.co')`);
    await asServer("insert into public.roles (user_id, role) values ($1, 'admin')", [ADMIN_ONLY]);
    await asServer(`insert into public.roles (user_id, role) values ('${LG_A}', 'closer'), ('${LG_B}', 'closer'), ('${LG_OFF}', 'closer')`);
    await asServer("update public.profiles set status = 'inactive' where id = $1", [LG_OFF]);
    // Out of order on purpose: positions follow the time of day.
    await setTimes(asAdmin, ["21:00", "01:00", "17:00", "09:00", "13:00", "05:00"]);
  });

  describe("discovery times", () => {
    it("an admin with two-factor replaces their tenant's times; positions follow the time of day", async () => {
      expect(await timesOf(tenantA)).toEqual(TIMES.map((t, i) => ({ position: i + 1, t: `${t}:00` })));
      expect(await asUser(asAdmin, "select id from public.discovery_times")).toHaveLength(6);
    });

    it("refuses a seventh time, a misaligned, repeated or missing time — keeping the saved ones", async () => {
      await expect(setTimes(asAdmin, [...TIMES, "23:00"])).rejects.toThrow(/at most 6 discovery times/);
      await expect(setTimes(asAdmin, ["10:15"])).rejects.toThrow(/discovery_times_aligned/);
      await expect(setTimes(asAdmin, ["10:00", "10:00"])).rejects.toThrow(/duplicate key/);
      await expect(setTimes(asAdmin, ["10:00", null])).rejects.toThrow(/times are required/);
      expect(await timesOf(tenantA)).toHaveLength(6);
    });

    it("only admins with two-factor call set_discovery_times; visitors can't call it at all", async () => {
      for (const claims of [token(ADMIN, ["admin"], "aal1"), asLgA, asVa, asClient]) {
        await expect(setTimes(claims, ["10:00"])).rejects.toThrow(/admins with two-factor sign-in only/);
      }
      await expect(as("anon", {}, "select public.set_discovery_times(array['10:00']::time[])")).rejects.toThrow(/permission denied for function/);
      expect(await timesOf(tenantA)).toHaveLength(6);
    });

    it("only admins with two-factor read or write the table; nobody sets its tenant or updates a row", async () => {
      for (const claims of [token(ADMIN, ["admin"], "aal1"), asLgA, asVa, asClient]) {
        expect(await asUser(claims, "select id from public.discovery_times")).toEqual([]);
        expect(await asUser(claims, "delete from public.discovery_times returning id")).toEqual([]);
      }
      await expect(asUser(asLgA, "insert into public.discovery_times (position, time_of_day) values (6, '22:00')")).rejects.toThrow(/row-level security/);
      await expect(asUser(asAdmin, "insert into public.discovery_times (tenant_id, position, time_of_day) values ($1, 6, '22:00')", [tenantB])).rejects.toThrow(/permission denied/);
      await expect(asUser(asAdmin, "update public.discovery_times set time_of_day = '22:00'")).rejects.toThrow(/permission denied/);
      await expect(as("anon", {}, "select id from public.discovery_times")).rejects.toThrow(/permission denied/);
      expect(await timesOf(tenantA)).toHaveLength(6);
    });

    it("a Super Admin's save replaces only their own tenant's times; another tenant's admin sees only theirs", async () => {
      await asServer("insert into public.discovery_times (tenant_id, position, time_of_day) values ($1, 1, '03:30')", [tenantB]);
      await setTimes(token(SUPER, ["super_admin"], "aal2"), ["10:00"]);
      expect(await timesOf(tenantA)).toEqual([{ position: 1, t: "10:00:00" }]);
      expect(await timesOf(tenantB)).toEqual([{ position: 1, t: "03:30:00" }]);
      expect(await asUser(asAdminB, "select time_of_day::text as t from public.discovery_times")).toEqual([{ t: "03:30:00" }]);
      await setTimes(asAdmin, TIMES);
      expect(await timesOf(tenantA)).toHaveLength(6);
    });
  });

  describe("open slots", () => {
    it("lists every day at each PHT time, 12 hours to 14 days ahead, from the default tenant only", async () => {
      const listed = await slots();
      expect(listed).toEqual(expectedSlots(TIMES));
      // 09:00 PHT is 01:00 UTC; tenant B's 03:30 PHT (19:30 UTC) is never listed.
      expect(new Set(listed.map((s) => new Date(s).getUTCHours()))).toEqual(new Set([17, 21, 1, 5, 9, 13]));
      expect(listed.some((s) => new Date(s).getUTCMinutes() === 30)).toBe(false);
    });

    it("is for the server only", async () => {
      await expect(asUser(asAdmin, "select public.open_discovery_slots()")).rejects.toThrow(/permission denied for function/);
      await expect(as("anon", {}, "select public.open_discovery_slots()")).rejects.toThrow(/permission denied for function/);
    });
  });

  describe("requests", () => {
    it("stores the lead, its 30-minute meeting and the first history row; the slot leaves the list", async () => {
      const start = await nextSlot();
      const lead = await request("first@disc.co", start, IP);
      const [stored] = await asServer("select email, status::text as status, closer_id, tenant_id, ip_hash from public.leads where id = $1", [lead]);
      expect(stored).toEqual({ email: "first@disc.co", status: "new", closer_id: null, tenant_id: tenantA, ip_hash: IP });
      const [meeting] = await asServer<Record<string, unknown>>(
        "select id, kind::text as kind, status::text as status, starts_at, ends_at, organizer_id, decided_by, tenant_id from public.meetings where lead_id = $1",
        [lead],
      );
      expect(meeting).toMatchObject({ kind: "discovery", status: "requested", organizer_id: null, decided_by: null, tenant_id: tenantA });
      expect(iso(meeting.starts_at)).toBe(start);
      expect(iso(meeting.ends_at)).toBe(later(start, HALF_HOUR));
      expect(await asServer("select kind::text as kind, actor_id, body, tenant_id from public.meeting_events where meeting_id = $1", [meeting.id])).toEqual([
        { kind: "requested", actor_id: null, body: null, tenant_id: tenantA },
      ]);
      expect(await slots()).not.toContain(start);
    });

    it("refuses a time that isn't open — taken, misaligned, not a set time, too soon, too far — storing nothing (IVA22)", async () => {
      const [{ starts_at: taken }] = await asServer<{ starts_at: string }>(
        "select m.starts_at from public.meetings m join public.leads l on l.id = m.lead_id where l.email = 'first@disc.co'",
      );
      const open = await nextSlot();
      for (const start of [iso(taken), later(open, 15 * 60 * 1000), later(open, HALF_HOUR), aligned(2 * HOUR), aligned(20 * DAY)]) {
        await expect(request("nope@disc.co", start)).rejects.toMatchObject({ code: "IVA22" });
      }
      expect(await asServer("select id from public.leads where email = 'nope@disc.co'")).toEqual([]);
    });

    it("holds one open request per email and two per IP (IVA24), storing nothing for the refused one", async () => {
      await expect(request("first@disc.co", await nextSlot())).rejects.toMatchObject({ code: "IVA24" });
      await request("second@disc.co", await nextSlot(), IP);
      await expect(request("third@disc.co", await nextSlot(), IP)).rejects.toMatchObject({ code: "IVA24" });
      expect(await asServer("select id from public.leads where email = 'third@disc.co'")).toEqual([]);
      expect(await asServer("select count(*)::int as n from public.leads where email = 'first@disc.co'")).toEqual([{ n: 1 }]);
      // Without an IP hash only the email counts.
      await expect(request("no-ip@disc.co", await nextSlot())).resolves.toBeTruthy();
    });

    it("the indexes hold past the function: one open call per start, and per lead (two requests at once)", async () => {
      const [{ id: lead, starts_at: start }] = await asServer<{ id: string; starts_at: string }>(
        "select l.id, m.starts_at from public.leads l join public.meetings m on m.lead_id = l.id where l.email = 'first@disc.co'",
      );
      const [{ id: other }] = await asServer<{ id: string }>("insert into public.leads (full_name, email, message) values ('B', 'race@disc.co', 'hi') returning id");
      await expect(
        asServer("insert into public.meetings (kind, lead_id, starts_at, ends_at) values ('discovery', $1, $2, $3)", [other, iso(start), later(iso(start), HALF_HOUR)]),
      ).rejects.toThrow(/meetings_one_open_discovery_per_start/);
      const free = await nextSlot();
      await expect(
        asServer("insert into public.meetings (kind, lead_id, starts_at, ends_at) values ('discovery', $1, $2, $3)", [lead, free, later(free, HALF_HOUR)]),
      ).rejects.toThrow(/meetings_one_open_discovery_per_lead/);
    });

    it("settles a stale request to expired first, so the visitor may request again; a stale call can't be decided", async () => {
      const past = aligned(-2 * HOUR);
      const [{ id: oldLead }] = await asServer<{ id: string }>("insert into public.leads (full_name, email, message) values ('S', 'stale@disc.co', 'hi') returning id");
      const [{ id: old }] = await asServer<{ id: string }>(
        "insert into public.meetings (kind, lead_id, starts_at, ends_at) values ('discovery', $1, $2, $3) returning id",
        [oldLead, past, later(past, HALF_HOUR)],
      );
      await asServer("insert into public.meeting_events (meeting_id, kind) values ($1, 'requested')", [old]);
      await expect(decide(old, LG_A, "scheduled")).rejects.toMatchObject({ code: "IVA23" });
      await request("stale@disc.co", await nextSlot());
      expect(await statusOf(old)).toBe("expired");
      expect(await asServer("select kind::text as kind, actor_id, body from public.meeting_events where meeting_id = $1 order by created_at, kind", [old])).toEqual([
        { kind: "requested", actor_id: null, body: null },
        { kind: "expired", actor_id: null, body: null },
      ]);
      // The expired call no longer holds its start.
      const [{ id: again }] = await asServer<{ id: string }>("insert into public.leads (full_name, email, message) values ('S', 'stale2@disc.co', 'hi') returning id");
      await expect(
        asServer("insert into public.meetings (kind, lead_id, starts_at, ends_at) values ('discovery', $1, $2, $3) returning id", [again, past, later(past, HALF_HOUR)]),
      ).resolves.toHaveLength(1);
      await asServer("update public.meetings set status = 'expired' where lead_id = $1", [again]);
    });

    it("settles stale requests by IP hash too, which frees the per-IP cap", async () => {
      const ip = "d".repeat(64);
      const stale: string[] = [];
      for (const [n, hours] of [[1, -3], [2, -4]] as const) {
        const past = aligned(hours * HOUR);
        const [{ id: l }] = await asServer<{ id: string }>("insert into public.leads (full_name, email, message, ip_hash) values ('S', $1, 'hi', $2) returning id", [`ip-stale${n}@disc.co`, ip]);
        const [{ id: m }] = await asServer<{ id: string }>("insert into public.meetings (kind, lead_id, starts_at, ends_at) values ('discovery', $1, $2, $3) returning id", [l, past, later(past, HALF_HOUR)]);
        stale.push(m);
      }
      // Two requested calls from this IP: a third would be refused if they still counted.
      await expect(request("ip-fresh@disc.co", await nextSlot(), ip)).resolves.toBeTruthy();
      for (const m of stale) expect(await statusOf(m)).toBe("expired");
      expect(await asServer("select count(*)::int as n from public.meeting_events where meeting_id = any($1::uuid[]) and kind = 'expired'", [stale])).toEqual([{ n: 2 }]);
    });

    it("is for the server only", async () => {
      const call = "select public.request_discovery_call('A', 'a@x.co', null, null, null, 'hi', null, null, null, now())";
      await expect(asUser(asAdmin, call)).rejects.toThrow(/permission denied for function/);
      await expect(as("anon", {}, call)).rejects.toThrow(/permission denied for function/);
    });
  });

  describe("inbox and confirm", () => {
    let lead = "";
    let meeting = "";
    beforeAll(async () => {
      lead = await request("inbox@disc.co", await nextSlot());
      meeting = await meetingOf(lead);
    });

    it("an active Lead Gen sees open future requests in a reduced form — no email, IP, user agent or profile", async () => {
      const rows = await inbox(asLgA);
      const row = rows.find((r) => r.meeting_id === meeting);
      expect(row).toMatchObject({ full_name: "Ana Cruz", company_name: "Cruz Co", industry: "Legal", country: "Philippines", package_code: "executive", message: "Inbox help, please." });
      expect(Object.keys(row ?? {}).sort()).toEqual(["company_name", "country", "ends_at", "full_name", "industry", "meeting_id", "message", "package_code", "starts_at"]);
      expect(rows.every((r) => new Date(r.starts_at as string).getTime() > Date.now())).toBe(true);
    });

    it("gives nothing to a token claiming closer without the role, an inactive Lead Gen, another tenant's Lead Gen or other roles", async () => {
      expect(await inbox(token(VA, ["closer"]))).toEqual([]);
      expect(await inbox(asLgOff)).toEqual([]);
      expect(await inbox(token(CLOSER_B, ["closer"]))).toEqual([]);
      expect(await inbox(asClient)).toEqual([]);
      expect(await inbox(asVa)).toEqual([]);
      await expect(as("anon", {}, "select * from public.discovery_inbox()")).rejects.toThrow(/permission denied for function/);
    });

    it("gives nothing to an admin with two-factor who doesn't hold the closer role, even if the token claims it", async () => {
      expect(await inboxIds(asLgA)).toContain(meeting);
      expect(await inbox(token(ADMIN_ONLY, ["admin"], "aal2"))).toEqual([]);
      expect(await inbox(token(ADMIN_ONLY, ["admin", "closer"], "aal2"))).toEqual([]);
    });

    it("a Lead Gen can't read an unowned lead, or the request, through the tables", async () => {
      expect(await asUser(asLgA, "select id from public.leads where id = $1", [lead])).toEqual([]);
      expect(await asUser(asLgA, "select id from public.meetings where id = $1", [meeting])).toEqual([]);
      expect(await asUser(asLgA, "select id from public.meeting_events where meeting_id = $1", [meeting])).toEqual([]);
    });

    it("confirming makes the Lead Gen the organizer and the lead's owner; then only they (and admins with 2FA) see it", async () => {
      const [{ r }] = await decide(meeting, LG_A, "scheduled", null, "evt-1", "https://meet.google.com/abc-defg-hij");
      expect(r).toMatchObject({ lead_id: lead, status: "scheduled", email: "inbox@disc.co", full_name: "Ana Cruz" });
      const [stored] = await asServer("select status::text as status, organizer_id, decided_by, google_event_id, meet_url from public.meetings where id = $1", [meeting]);
      expect(stored).toEqual({ status: "scheduled", organizer_id: LG_A, decided_by: LG_A, google_event_id: "evt-1", meet_url: "https://meet.google.com/abc-defg-hij" });
      expect(await leadOf(lead)).toEqual({ status: "new", closer_id: LG_A });

      expect(await asUser(asLgA, "select email from public.leads where id = $1", [lead])).toEqual([{ email: "inbox@disc.co" }]);
      expect(ids(await asUser<{ id: string }>(asLgA, "select id from public.meetings where id = $1", [meeting]))).toEqual([meeting]);
      expect(await asUser(asLgA, "select kind::text as kind from public.meeting_events where meeting_id = $1 order by created_at", [meeting])).toEqual([
        { kind: "requested" },
        { kind: "scheduled" },
      ]);
      expect(await asUser(asLgB, "select id from public.leads where id = $1", [lead])).toEqual([]);
      expect(await asUser(asLgB, "select id from public.meetings where id = $1", [meeting])).toEqual([]);
      expect(await asUser(asLgB, "select id from public.meeting_events where meeting_id = $1", [meeting])).toEqual([]);
      expect(await inboxIds(asLgA)).not.toContain(meeting);
      expect(await inboxIds(asLgB)).not.toContain(meeting);
      expect(await asUser(asAdmin, "select id from public.meeting_events where meeting_id = $1", [meeting])).toHaveLength(2);
      expect(await asUser(token(ADMIN, ["admin"], "aal1"), "select id from public.meetings")).toEqual([]);

      await expect(decide(meeting, LG_A, "scheduled")).rejects.toMatchObject({ code: "IVA23" });
    });

    it("refuses an unknown call, an actor who isn't an active Lead Gen of this agency, someone else's lead, a bad decision or link", async () => {
      const other = await request("owned@disc.co", await nextSlot());
      const otherMeeting = await meetingOf(other);
      await expect(decide("00000000-0000-0000-0000-00000000dead", LG_A, "scheduled")).rejects.toMatchObject({ code: "IVA01" });
      await expect(decide(otherMeeting, LG_OFF, "scheduled")).rejects.toMatchObject({ code: "IVA14" });
      await expect(decide(otherMeeting, CLOSER_B, "scheduled")).rejects.toMatchObject({ code: "IVA14" });
      await expect(decide(otherMeeting, VA, "scheduled")).rejects.toMatchObject({ code: "IVA14" });
      await expect(decide(otherMeeting, LG_A, "maybe")).rejects.toThrow(/scheduled or rejected/);
      await expect(decide(otherMeeting, LG_A, "scheduled", null, null, "https://evil.example/abc-defg-hij")).rejects.toThrow(/check constraint/);
      await expect(decide(otherMeeting, LG_A, "scheduled", null, "x".repeat(1025))).rejects.toThrow(/check constraint/);

      // Owned by LG_B (e.g. assigned by an admin): only LG_B may decide it, and only LG_B's inbox shows it.
      await asServer("update public.leads set closer_id = $1 where id = $2", [LG_B, other]);
      await expect(decide(otherMeeting, LG_A, "scheduled")).rejects.toMatchObject({ code: "IVA14" });
      expect(await inboxIds(asLgA)).not.toContain(otherMeeting);
      expect(await inboxIds(asLgB)).toContain(otherMeeting);
      expect(await statusOf(otherMeeting)).toBe("requested");
      await expect(decide(otherMeeting, LG_B, "scheduled")).resolves.toHaveLength(1);
    });

    it("refuses a request whose lead is paused (IVA23), and hides it from the inbox", async () => {
      const paused = await request("paused@disc.co", await nextSlot());
      const pausedMeeting = await meetingOf(paused);
      await asServer("update public.leads set disabled_at = now() where id = $1", [paused]);
      await expect(decide(pausedMeeting, LG_A, "scheduled")).rejects.toMatchObject({ code: "IVA23" });
      expect(await inboxIds(asLgA)).not.toContain(pausedMeeting);
    });

    it("rejecting needs a reason, closes the lead as junk and frees the slot", async () => {
      const junk = await request("junk@disc.co", await nextSlot());
      const junkMeeting = await meetingOf(junk);
      const [{ starts_at: start }] = await asServer<{ starts_at: string }>("select starts_at from public.meetings where id = $1", [junkMeeting]);
      await expect(decide(junkMeeting, LG_B, "rejected", "  ")).rejects.toThrow(/reason of 1 to 300/);
      await expect(decide(junkMeeting, LG_B, "rejected", "x".repeat(301))).rejects.toThrow(/reason of 1 to 300/);
      const [{ r }] = await decide(junkMeeting, LG_B, "rejected", "  Not a business  ");
      expect(r).toMatchObject({ lead_id: junk, status: "rejected" });
      expect(await asServer("select status::text as status, organizer_id, decided_by from public.meetings where id = $1", [junkMeeting])).toEqual([
        { status: "rejected", organizer_id: null, decided_by: LG_B },
      ]);
      expect(await leadOf(junk)).toEqual({ status: "closed", closer_id: null });
      expect(await asServer("select kind::text as kind, author_id, body from public.lead_events where lead_id = $1", [junk])).toEqual([
        { kind: "junk", author_id: LG_B, body: "Not a business" },
      ]);
      expect(await asServer("select body from public.meeting_events where meeting_id = $1 and kind = 'rejected'", [junkMeeting])).toEqual([{ body: "Not a business" }]);
      expect(await slots()).toContain(iso(start));
      // The decider reads the call, not the lead (it has no owner).
      expect(await asUser(asLgB, "select id from public.meetings where id = $1", [junkMeeting])).toHaveLength(1);
      expect(await asUser(asLgB, "select id from public.leads where id = $1", [junk])).toEqual([]);
    });

    it("is for the server only", async () => {
      await expect(asUser(asLgA, "select public.decide_discovery_call($1, $2, 'scheduled', null)", [meeting, LG_A])).rejects.toThrow(/permission denied for function/);
      await expect(as("anon", {}, "select public.decide_discovery_call($1, $2, 'scheduled', null)", [meeting, LG_A])).rejects.toThrow(/permission denied for function/);
    });

    it("locks the meeting before its lead, in both functions that take both", async () => {
      for (const fn of ["decide_discovery_call", "record_discovery_outcome"]) {
        const [{ src }] = (await db.query<{ src: string }>("select prosrc as src from pg_proc where proname = $1", [fn])).rows;
        const meetingLock = src.search(/from public\.meetings m where m\.id = \w+\.meeting_id for update/);
        const leadLock = src.search(/from public\.leads l where l\.id = meeting\.lead_id for update/);
        expect(meetingLock).toBeGreaterThan(-1);
        expect(leadLock).toBeGreaterThan(meetingLock);
      }
    });
  });

  describe("closing or pausing a lead", () => {
    const requestOf = async (email: string) => {
      const start = await nextSlot();
      const lead = await request(email, start);
      return { start, lead, meeting: await meetingOf(lead) };
    };
    const expectFreed = async (call: { start: string; meeting: string }, email: string) => {
      expect(await statusOf(call.meeting)).toBe("expired");
      expect(await asServer("select kind::text as kind, actor_id from public.meeting_events where meeting_id = $1 and kind = 'expired'", [call.meeting])).toEqual([
        { kind: "expired", actor_id: null },
      ]);
      expect(await slots()).toContain(call.start);
      // The same visitor may request again, even the same time.
      await expect(request(email, call.start)).resolves.toBeTruthy();
    };

    it("closing a lead settles its open request: the slot reopens and the email may request again", async () => {
      const call = await requestOf("closed@disc.co");
      expect(await asUser(asAdmin, "update public.leads set status = 'closed' where id = $1 returning id", [call.lead])).toHaveLength(1);
      await expectFreed(call, "closed@disc.co");
    });

    it("pausing a lead does the same", async () => {
      const call = await requestOf("paused2@disc.co");
      expect(await asUser(asAdmin, "update public.leads set disabled_at = now() where id = $1 returning id", [call.lead])).toHaveLength(1);
      await expectFreed(call, "paused2@disc.co");
    });

    it("leaves confirmed calls alone, and other updates don't settle anything", async () => {
      const call = await requestOf("kept@disc.co");
      await asUser(asAdmin, "update public.leads set full_name = 'Ana C.' where id = $1", [call.lead]);
      expect(await statusOf(call.meeting)).toBe("requested");
      await decide(call.meeting, LG_A, "scheduled");
      await asServer("update public.leads set disabled_at = now() where id = $1", [call.lead]);
      expect(await statusOf(call.meeting)).toBe("scheduled");
    });

    it("a request the trigger skipped (being decided at that moment) doesn't hold its slot, and the next request settles it", async () => {
      // Stand-in for the race: close the lead without the trigger, as if its meeting row was locked by a decision.
      const call = await requestOf("raced@disc.co");
      await db.exec("alter table public.leads disable trigger leads_settle_discovery");
      try {
        await asServer("update public.leads set status = 'closed' where id = $1", [call.lead]);
      } finally {
        await db.exec("alter table public.leads enable trigger leads_settle_discovery");
      }
      expect(await statusOf(call.meeting)).toBe("requested");
      expect(await slots()).toContain(call.start);
      await expect(request("raced-other@disc.co", call.start)).resolves.toBeTruthy();
      expect(await statusOf(call.meeting)).toBe("expired");
    });
  });

  describe("outcomes", () => {
    /** A confirmed call that has already started, organised by LG_A. */
    const startedCall = async (email: string) => {
      const start = aligned(-HOUR);
      const [{ id: lead }] = await asServer<{ id: string }>("insert into public.leads (full_name, email, message, closer_id) values ('O', $1, 'hi', $2) returning id", [email, LG_A]);
      const [{ id }] = await asServer<{ id: string }>(
        "insert into public.meetings (kind, status, lead_id, organizer_id, decided_by, decided_at, starts_at, ends_at) values ('discovery', 'scheduled', $1, $2, $2, now(), $3, $4) returning id",
        [lead, LG_A, start, later(start, HALF_HOUR)],
      );
      return { lead, id };
    };

    it("the organizer records done once the call has started; a new lead moves to contacted", async () => {
      const call = await startedCall("held@disc.co");
      await expect(outcome(call.id, LG_B, "done")).rejects.toMatchObject({ code: "IVA14" });
      await expect(outcome(call.id, LG_A, "later")).rejects.toThrow(/done or no_show/);
      await outcome(call.id, LG_A, "done", "  Wants 40 hours  ");
      expect(await statusOf(call.id)).toBe("done");
      expect(await leadOf(call.lead)).toEqual({ status: "contacted", closer_id: LG_A });
      expect(await asServer("select kind::text as kind, actor_id, body from public.meeting_events where meeting_id = $1", [call.id])).toEqual([
        { kind: "done", actor_id: LG_A, body: "Wants 40 hours" },
      ]);
      await expect(outcome(call.id, LG_A, "no_show")).rejects.toMatchObject({ code: "IVA23" });
    });

    it("a no-show leaves the lead new; a call that hasn't started, or an inactive organizer, is refused", async () => {
      const call = await startedCall("noshow@disc.co");
      await asServer("update public.profiles set status = 'inactive' where id = $1", [LG_A]);
      await expect(outcome(call.id, LG_A, "no_show")).rejects.toMatchObject({ code: "IVA14" });
      await asServer("update public.profiles set status = 'invited' where id = $1", [LG_A]);
      await outcome(call.id, LG_A, "no_show");
      expect(await statusOf(call.id)).toBe("no_show");
      expect(await leadOf(call.lead)).toEqual({ status: "new", closer_id: LG_A });

      const [{ id: upcoming }] = await asServer<{ id: string }>("select id from public.meetings where organizer_id = $1 and status = 'scheduled' and starts_at > now() limit 1", [LG_A]);
      await expect(outcome(upcoming, LG_A, "done")).rejects.toMatchObject({ code: "IVA23" });
      await expect(outcome("00000000-0000-0000-0000-00000000dead", LG_A, "done")).rejects.toMatchObject({ code: "IVA01" });
      await expect(asUser(asLgA, "select public.record_discovery_outcome($1, $2, 'done', null)", [upcoming, LG_A])).rejects.toThrow(/permission denied for function/);
    });

    it("names the actor for the rest of the transaction only (app.actor, for the audit log)", async () => {
      const call = await startedCall("actor@disc.co");
      await db.exec("begin");
      try {
        await outcome(call.id, LG_A, "done");
        expect((await db.query<{ a: string }>("select current_setting('app.actor', true) as a")).rows).toEqual([{ a: LG_A }]);
      } finally {
        await db.exec("rollback");
      }
      expect((await db.query<{ a: string | null }>("select nullif(current_setting('app.actor', true), '') as a")).rows).toEqual([{ a: null }]);
    });
  });

  describe("integrity", () => {
    it("history can't be changed or deleted — not through the API, and not even by the database owner", async () => {
      const [{ id }] = await asServer<{ id: string }>("select id from public.meeting_events limit 1");
      await expect(asServer("update public.meeting_events set body = 'x' where id = $1", [id])).rejects.toThrow(/permission denied/);
      await expect(asServer("delete from public.meeting_events where id = $1", [id])).rejects.toThrow(/permission denied/);
      await expect(asUser(asAdmin, "update public.meeting_events set body = 'x' where id = $1", [id])).rejects.toThrow(/permission denied/);
      await expect(db.query("update public.meeting_events set body = 'x' where id = $1", [id])).rejects.toThrow(/append-only/);
      await expect(db.query("delete from public.meeting_events where id = $1", [id])).rejects.toThrow(/append-only/);
    });

    it("nobody writes meetings or history through the API, and the server never deletes a meeting", async () => {
      const [{ id, lead_id: lead }] = await asServer<{ id: string; lead_id: string }>("select id, lead_id from public.meetings limit 1");
      await expect(
        asUser(asAdmin, "insert into public.meetings (kind, lead_id, starts_at, ends_at) values ('discovery', $1, now(), now() + interval '30 minutes')", [lead]),
      ).rejects.toThrow(/permission denied/);
      await expect(asUser(asLgA, "update public.meetings set status = 'done' where id = $1", [id])).rejects.toThrow(/permission denied/);
      await expect(asUser(asAdmin, "insert into public.meeting_events (meeting_id, kind, actor_id) values ($1, 'note', $2)", [id, ADMIN])).rejects.toThrow(/permission denied/);
      await expect(asServer("delete from public.meetings where id = $1", [id])).rejects.toThrow(/permission denied/);
      for (const table of ["meetings", "meeting_events"]) {
        await expect(as("anon", {}, `select id from public.${table}`)).rejects.toThrow(/permission denied/);
        expect(await asUser(asVa, `select id from public.${table}`)).toEqual([]);
        expect(await asUser(asClient, `select id from public.${table}`)).toEqual([]);
      }
    });

    it("a lead with a meeting can't be deleted (IVA05)", async () => {
      const lead = await request("keep@disc.co", await nextSlot());
      await expect(asUser(asAdmin, "delete from public.leads where id = $1", [lead])).rejects.toMatchObject({ code: "IVA05" });
    });

    it("organizers, deciders and actors must be Lead Gens; a timeline remark may now come from a Lead Gen, not a VA", async () => {
      const [{ id, lead_id: lead }] = await asServer<{ id: string; lead_id: string }>(
        "select id, lead_id from public.meetings where status = 'requested' and starts_at > now() limit 1",
      );
      await expect(asServer("update public.meetings set status = 'scheduled', organizer_id = $1, decided_by = $1, decided_at = now() where id = $2", [VA, id])).rejects.toThrow(/closer role/);
      await expect(asServer("insert into public.meeting_events (meeting_id, kind, actor_id) values ($1, 'note', $2)", [id, VA])).rejects.toThrow(/closer role/);
      await expect(asServer("insert into public.meeting_events (meeting_id, kind) values ($1, 'note')", [id])).rejects.toThrow(/meeting_events_actor/);
      await expect(asServer("insert into public.meeting_events (meeting_id, kind, actor_id) values ($1, 'rejected', $2)", [id, LG_A])).rejects.toThrow(/meeting_events_body/);
      await expect(asServer("insert into public.lead_events (lead_id, author_id, kind, body) values ($1, $2, 'note', 'hi')", [lead, VA])).rejects.toThrow(/admin or closer role/);
      await expect(asServer("insert into public.lead_events (lead_id, author_id, kind, body) values ($1, $2, 'note', 'hi') returning id", [lead, LG_A])).resolves.toHaveLength(1);
    });

    it("enforces the call's shape and state", async () => {
      const [{ id: lead }] = await asServer<{ id: string }>("insert into public.leads (full_name, email, message) values ('Z', 'shape@disc.co', 'hi') returning id");
      const start = aligned(30 * DAY);
      const insert = (values: string, params: unknown[]) =>
        asServer(`insert into public.meetings (kind, lead_id, starts_at, ends_at, status, organizer_id, decided_by, decided_at) values ${values}`, params);
      await expect(insert("('discovery', $1, $2, $3, 'requested', null, null, null)", [lead, start, later(start, 45 * 60 * 1000)])).rejects.toThrow(/meetings_discovery_shape/);
      await expect(insert("('discovery', $1, $2, $3, 'requested', null, null, null)", [lead, later(start, 10 * 60 * 1000), later(start, 40 * 60 * 1000)])).rejects.toThrow(/meetings_discovery_shape/);
      await expect(
        asServer("insert into public.meetings (kind, lead_id, starts_at, ends_at, tenant_id) values ('discovery', null, $1, $2, $3)", [start, later(start, HALF_HOUR), tenantA]),
      ).rejects.toThrow(/meetings_discovery_shape/);
      // A discovery call's fixed length is the stricter rule; meetings_ends_after_start matters once other kinds exist.
      await expect(insert("('discovery', $1, $2, $2, 'requested', null, null, null)", [lead, start])).rejects.toThrow(/meetings_discovery_shape|meetings_ends_after_start/);
      await expect(insert("('discovery', $1, $2, $3, 'scheduled', null, null, null)", [lead, start, later(start, HALF_HOUR)])).rejects.toThrow(/meetings_scheduled_has_organizer/);
      await expect(insert("('discovery', $1, $2, $3, 'requested', $4, $4, now())", [lead, start, later(start, HALF_HOUR), LG_A])).rejects.toThrow(/meetings_requested_undecided/);
      await expect(insert("('discovery', $1, $2, $3, 'rejected', null, null, null)", [lead, start, later(start, HALF_HOUR)])).rejects.toThrow(/meetings_rejected_decided/);
    });

    it("keeps meetings and history inside their tenant", async () => {
      const [{ id }] = await asServer<{ id: string }>("select id from public.meetings where status = 'requested' and starts_at > now() limit 1");
      const [{ id: lead }] = await asServer<{ id: string }>("insert into public.leads (full_name, email, message) values ('T', 'tenant@disc.co', 'hi') returning id");
      await expect(asServer("update public.meetings set status = 'scheduled', organizer_id = $1, decided_by = $1, decided_at = now() where id = $2", [CLOSER_B, id])).rejects.toThrow(/foreign key/);
      await expect(asServer("insert into public.meeting_events (meeting_id, kind, actor_id, body) values ($1, 'note', $2, 'hi')", [id, CLOSER_B])).rejects.toThrow(/foreign key/);
      await expect(
        asServer("insert into public.meetings (kind, lead_id, starts_at, ends_at, tenant_id) values ('discovery', $1, $2, $3, $4)", [lead, aligned(40 * DAY), later(aligned(40 * DAY), HALF_HOUR), tenantB]),
      ).rejects.toThrow(/foreign key/);
      expect(await asUser(asAdminB, "select id from public.meetings")).toEqual([]);
      expect(await asUser(asAdminB, "select id from public.meeting_events")).toEqual([]);
      expect(await inbox(asAdminB)).toEqual([]);
      expect((await asUser(token(SUPER, ["super_admin"], "aal2"), "select id from public.meetings")).length).toBeGreaterThan(0);
      expect(await asUser(token(SUPER, ["super_admin"], "aal1"), "select id from public.meetings")).toEqual([]);
    });
  });
});

describe("tasks", () => {
  // Its own users, company and assignment — clientA stays as the other suites left it.
  // f1–f4 belong to the discovery-call suite. These ids stay clear of every other suite.
  const OWNER = "22222222-2222-4222-8222-222222222201";
  const WORKER = "22222222-2222-4222-8222-222222222202";
  const WORKER2 = "22222222-2222-4222-8222-222222222203";
  const OTHER = "22222222-2222-4222-8222-222222222204";
  const SUPER = "22222222-2222-4222-8222-222222222205";
  const SPARE = "22222222-2222-4222-8222-222222222206";
  const FAR_CLOSER = "22222222-2222-4222-8222-222222222207";
  const FAR_CLIENT = "22222222-2222-4222-8222-222222222208";
  const FAR_VA = "22222222-2222-4222-8222-222222222209";
  const PEND = "22222222-2222-4222-8222-222222222210";
  const ENDU = "22222222-2222-4222-8222-222222222211";
  const DISA = "22222222-2222-4222-8222-222222222212";

  const asOwner = token(OWNER, ["client"]);
  const asWorker = token(WORKER, ["va"]);
  const asOther = token(OTHER, ["client"]);
  const asFar = token(FAR_CLIENT, ["client"]);
  const asSuper = token(SUPER, ["super_admin"], "aal2");

  let harbor = "";
  let otherCo = "";
  let taskId = "";
  let otherTask = "";
  let farTask = "";

  const insertTask = (claims: Claims, client: string, va: string, actor: string, deadlineSql = "current_date + 10") =>
    asUser<{ id: string; company_name: string; va_first_name: string; deadline_timezone: string; status: string }>(
      claims,
      `insert into public.tasks (client_id, va_id, title, deadline, created_by)
       values ($1, $2, 'Call the vendor', ${deadlineSql}, $3)
       returning id, company_name, va_first_name, deadline_timezone, status`,
      [client, va, actor],
    );

  const insertAsServer = (client: string, va: string, deadlineSql = "current_date + 10") =>
    asServer<{ id: string }>(
      `insert into public.tasks (client_id, va_id, title, deadline, created_by) values ($1, $2, 'Call the vendor', ${deadlineSql}, $3) returning id`,
      [client, va, OWNER],
    );

  async function makeCompany(
    name: string,
    opts: { user: string | null; createdBy?: string; status?: string; zone?: string | null; disabled?: boolean; va?: string | null; ended?: boolean },
  ) {
    const [{ id }] = await asServer<{ id: string }>(
      "insert into public.clients (company_name, contact_name, contact_email, created_by) values ($1, 'Contact', $2, $3) returning id",
      [name, `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@tasks.co`, opts.createdBy ?? CLOSER],
    );
    await asServer(
      `update public.clients set user_id = $2, status = $3::public.client_status, timezone = $4,
         package_code = case when $4::text is null then null else 'essentials' end,
         hours_per_week = case when $4::text is null then null else 20 end,
         term_months = case when $4::text is null then null else 6 end,
         monthly_cents = case when $4::text is null then null else 85500 end,
         starts_on = case when $4::text is null then null else date '2026-11-01' end,
         activated_at = case when $3::public.client_status = 'active' then now() else null end,
         disabled_at = case when $5 then now() else null end
       where id = $1`,
      [
      id,
      opts.user,
      opts.status ?? "active",
      opts.zone === undefined ? "Pacific/Auckland" : opts.zone,
      opts.disabled ?? false,
    ]);
    if (opts.va) {
      await asServer("insert into public.client_va_assignments (client_id, va_id) values ($1, $2)", [id, opts.va]);
      if (opts.ended) {
        await asServer("update public.client_va_assignments set status = 'ended', ended_at = now() where client_id = $1 and status = 'active'", [id]);
      }
    }
    return id;
  }

  beforeAll(async () => {
    await as("supabase_auth_admin", {}, `
      insert into auth.users (id, email, raw_user_meta_data) values
        ('${OWNER}', 'task-owner@x.co', '{"full_name":"Cleo Owner"}'),
        ('${WORKER}', 'task-va@x.co', '{"full_name":"Maria Santos"}'),
        ('${WORKER2}', 'task-va2@x.co', '{"full_name":"Luis Other"}'),
        ('${OTHER}', 'task-other@x.co', '{"full_name":"Pat Other"}'),
        ('${SUPER}', 'task-super@x.co', '{"full_name":"Super Tasks"}'),
        ('${SPARE}', 'task-spare@x.co', '{"full_name":"Spare VA"}'),
        ('${FAR_CLOSER}', 'task-far-closer@x.co', '{}'),
        ('${FAR_CLIENT}', 'task-far-client@x.co', '{"full_name":"Far Client"}'),
        ('${FAR_VA}', 'task-far-va@x.co', '{"full_name":"Far VA"}'),
        ('${PEND}', 'task-pend@x.co', '{"full_name":"Pending Owner"}'),
        ('${ENDU}', 'task-endu@x.co', '{"full_name":"Ended Owner"}'),
        ('${DISA}', 'task-disa@x.co', '{"full_name":"Disabled Owner"}')`);
    await asServer(`update public.profiles set status = 'active' where id in ('${OWNER}', '${WORKER}', '${WORKER2}', '${OTHER}', '${SUPER}', '${FAR_CLOSER}', '${FAR_CLIENT}', '${FAR_VA}', '${PEND}', '${ENDU}', '${DISA}')`);
    await asServer(`
      insert into public.roles (user_id, role) values
        ('${OWNER}', 'client'), ('${WORKER}', 'va'), ('${WORKER2}', 'va'), ('${OTHER}', 'client'),
        ('${SUPER}', 'super_admin'), ('${SPARE}', 'va'), ('${FAR_CLOSER}', 'closer'), ('${FAR_CLIENT}', 'client'), ('${FAR_VA}', 'va'),
        ('${PEND}', 'client'), ('${ENDU}', 'client'), ('${DISA}', 'client')`);

    harbor = await makeCompany("Harbor Co", { user: OWNER, va: WORKER });
    otherCo = await makeCompany("Other Co", { user: OTHER, va: WORKER2 });
    [{ id: taskId }] = await insertTask(asOwner, harbor, WORKER, OWNER);
    [{ id: otherTask }] = await insertTask(asOther, otherCo, WORKER2, OTHER);

    const [{ id: farTenant }] = await asServer<{ id: string }>("insert into public.tenants (name, slug) values ('Tasks other', 'tasks-other') returning id");
    await asServer(`update public.profiles set tenant_id = $1 where id in ('${FAR_CLOSER}', '${FAR_CLIENT}', '${FAR_VA}')`, [farTenant]);
    const farCo = await makeCompany("Far Co", { user: FAR_CLIENT, createdBy: FAR_CLOSER, va: FAR_VA });
    [{ id: farTask }] = await asServer<{ id: string }>(
      "insert into public.tasks (client_id, va_id, title, deadline, created_by) values ($1, $2, 'Far task', current_date + 10, $3) returning id",
      [farCo, FAR_VA, FAR_CLIENT],
    );
  });

  it("snapshots the company name and the VA's first name, and ignores columns the client cannot send", async () => {
    const [row] = await asUser<{ company_name: string; va_first_name: string; deadline_timezone: string; status: string }>(
      asOwner,
      "select company_name, va_first_name, deadline_timezone, status from public.tasks where id = $1",
      [taskId],
    );
    expect(row).toEqual({ company_name: "Harbor Co", va_first_name: "Maria", deadline_timezone: "Pacific/Auckland", status: "todo" });
    await expect(
      asUser(asOwner, "insert into public.tasks (client_id, va_id, title, deadline, created_by, company_name) values ($1, $2, 'X', current_date + 10, $3, 'Spoofed')", [harbor, WORKER, OWNER]),
    ).rejects.toThrow(/permission denied/);
    await expect(asServer("update public.tasks set company_name = 'Spoofed' where id = $1", [taskId])).rejects.toMatchObject({ code: "IVA25" });
  });

  it("uses Your VA when the profile has no first name", async () => {
    await asServer("update public.profiles set full_name = '' where id = $1", [WORKER]);
    try {
      const [row] = await insertTask(asOwner, harbor, WORKER, OWNER);
      expect(row.va_first_name).toBe("Your VA");
      await asServer("delete from public.tasks where id = $1", [row.id]);
    } finally {
      await asServer("update public.profiles set full_name = 'Maria Santos' where id = $1", [WORKER]);
    }
  });

  it("rejects a past deadline, one too far ahead, and a zone Postgres does not know", async () => {
    // PGlite cannot freeze now(). The Auckland "today versus yesterday in UTC" case lives in metrics.test.ts.
    await expect(insertTask(asOwner, harbor, WORKER, OWNER, "date '2000-01-01'")).rejects.toMatchObject({ code: "IVA22" });
    await expect(insertTask(asOwner, harbor, WORKER, OWNER, "current_date + 400")).rejects.toMatchObject({ code: "IVA22" });
    const odd = await makeCompany("Odd Zone", { user: null, zone: "Not/AZone", va: WORKER });
    await expect(insertAsServer(odd, WORKER)).rejects.toMatchObject({ code: "IVA22" });
    const blank = await makeCompany("No Zone", { user: null, zone: null, va: WORKER });
    await expect(insertAsServer(blank, WORKER)).rejects.toMatchObject({ code: "IVA22" });
  });

  it("rejects a pending company, a disabled company, a closed portal and an ended assignment", async () => {
    const pending = await makeCompany("Pending Co", { user: PEND, status: "pending", va: WORKER });
    await expect(insertAsServer(pending, WORKER)).rejects.toMatchObject({ code: "IVA23" });
    await expect(insertTask(token(PEND, ["client"]), pending, WORKER, PEND)).rejects.toMatchObject({ code: "IVA23" });
    const disabled = await makeCompany("Disabled Co", { user: DISA, disabled: true, va: WORKER });
    await expect(insertAsServer(disabled, WORKER)).rejects.toMatchObject({ code: "IVA23" });
    await expect(insertTask(token(DISA, ["client"]), disabled, WORKER, DISA)).rejects.toMatchObject({ code: "IVA23" });
    const spareCo = await makeCompany("Spare Co", { user: null, va: SPARE });
    await expect(insertAsServer(spareCo, SPARE)).rejects.toMatchObject({ code: "IVA24" });
    const ended = await makeCompany("Ended Co", { user: ENDU, va: WORKER, ended: true });
    await expect(insertAsServer(ended, WORKER)).rejects.toMatchObject({ code: "IVA24" });
    await expect(insertTask(token(ENDU, ["client"]), ended, WORKER, ENDU)).rejects.toMatchObject({ code: "IVA24" });

    // The guard raises before RLS WITH CHECK. With it off, the insert policy still refuses these rows.
    await db.exec("alter table public.tasks disable trigger tasks_guard");
    try {
      await expect(insertTask(token(PEND, ["client"]), pending, WORKER, PEND)).rejects.toThrow(/row-level security/);
      await expect(insertTask(token(DISA, ["client"]), disabled, WORKER, DISA)).rejects.toThrow(/row-level security/);
      await expect(insertTask(token(ENDU, ["client"]), ended, WORKER, ENDU)).rejects.toThrow(/row-level security/);
      await expect(insertTask(asOwner, harbor, WORKER2, OWNER)).rejects.toThrow(/row-level security/);
    } finally {
      await db.exec("alter table public.tasks enable trigger tasks_guard");
    }
  });

  it("lets only the client insert, and only for their own company and active VA", async () => {
    await expect(insertTask(asOwner, otherCo, WORKER2, OWNER)).rejects.toThrow(/row-level security/);
    await expect(insertTask(asOwner, harbor, WORKER2, OWNER)).rejects.toMatchObject({ code: "IVA24" });
    await expect(insertTask(asWorker, harbor, WORKER, WORKER)).rejects.toThrow(/row-level security|permission denied|not an active user with the client role/);
    await expect(insertTask(asCloser, harbor, WORKER, CLOSER)).rejects.toThrow(/row-level security|permission denied|not an active user with the client role/);
    await expect(insertTask(asAdmin, harbor, WORKER, ADMIN)).rejects.toThrow(/row-level security|permission denied|not an active user with the client role/);
    await expect(as("anon", {}, "select id from public.tasks")).rejects.toThrow(/permission denied/);
    await expect(asUser(asOwner, "select private.guard_task()")).rejects.toThrow(/permission denied/);
  });

  it("lets an admin with two-factor read and not write; a super admin reads across tenants", async () => {
    expect(await asUser(asAdmin, "select id from public.tasks where id = $1", [taskId])).toEqual([{ id: taskId }]);
    expect(await asUser(asAdmin, "update public.tasks set title = 'Nope' where id = $1 returning id", [taskId])).toEqual([]);
    expect(await asUser(token(ADMIN, ["admin"], "aal1"), "select id from public.tasks where id = $1", [taskId])).toEqual([]);
    expect(ids(await asUser<{ id: string }>(asSuper, "select id from public.tasks where id in ($1, $2)", [taskId, farTask]))).toEqual([farTask, taskId].sort());
    expect(await asUser(asOwner, "select id from public.tasks where id = $1", [farTask])).toEqual([]);
    expect(await asUser(asFar, "select id from public.tasks where id = $1", [taskId])).toEqual([]);
    expect(await asUser(asAdmin, "select id from public.tasks where id = $1", [farTask])).toEqual([]);
  });

  it("hides tasks from a token that no longer has the role", async () => {
    expect(await asUser(token(OWNER, []), "select id from public.tasks where id = $1", [taskId])).toEqual([]);
    expect(await asUser(token(WORKER, []), "update public.tasks set status = 'in_progress' where id = $1 returning id", [taskId])).toEqual([]);
  });

  it("does not re-check the deadline window when only the status changes", async () => {
    await db.exec("alter table public.tasks disable trigger tasks_guard");
    let late = "";
    try {
      const [row] = await asServer<{ id: string }>(
        "insert into public.tasks (client_id, va_id, title, deadline, created_by) values ($1, $2, 'Late', date '2000-01-01', $3) returning id",
        [harbor, WORKER, OWNER],
      );
      late = row.id;
    } finally {
      await db.exec("alter table public.tasks enable trigger tasks_guard");
    }
    await expect(asUser<{ status: string }>(asWorker, "update public.tasks set status = 'in_progress' where id = $1 returning status", [late])).resolves.toEqual([
      { status: "in_progress" },
    ]);
  });

  it("moves status forward, keeps the row with the VA after the assignment ends, and freezes it once done", async () => {
    await expect(asUser(asOwner, "update public.tasks set status = 'in_progress' where id = $1", [taskId])).rejects.toMatchObject({ code: "IVA25" });
    await expect(asUser(asWorker, "update public.tasks set title = 'VA title' where id = $1", [taskId])).rejects.toMatchObject({ code: "IVA25" });
    expect(await asUser(asWorker, "update public.tasks set status = 'in_progress' where id = $1 returning id", [otherTask])).toEqual([]);

    const [second] = await insertTask(asOwner, harbor, WORKER, OWNER);
    expect(await asUser<{ status: string }>(asWorker, "update public.tasks set status = 'done' where id = $1 returning status", [second.id])).toEqual([{ status: "done" }]);
    await expect(asUser(asOwner, "update public.tasks set title = 'Again' where id = $1", [second.id])).rejects.toMatchObject({ code: "IVA25" });
    await expect(asServer("update public.tasks set status = 'todo', done_at = null where id = $1", [second.id])).rejects.toMatchObject({ code: "IVA25" });

    expect(await asUser<{ status: string }>(asWorker, "update public.tasks set status = 'in_progress' where id = $1 returning status", [taskId])).toEqual([{ status: "in_progress" }]);
    await expect(asUser(asWorker, "update public.tasks set status = 'todo' where id = $1", [taskId])).rejects.toMatchObject({ code: "IVA25" });
    expect(await asUser<{ title: string }>(asOwner, "update public.tasks set title = 'Call tomorrow', deadline = current_date + 12 where id = $1 returning title", [taskId])).toEqual([
      { title: "Call tomorrow" },
    ]);

    const [note] = await asUser<{ author_first_name: string }>(
      asWorker,
      "insert into public.task_comments (task_id, author_id, body) values ($1, $2, 'Starting now') returning author_first_name",
      [taskId, WORKER],
    );
    expect(note.author_first_name).toBe("Maria");
    await expect(asServer("insert into public.task_comments (task_id, author_id, body) values ($1, $2, 'Not my company')", [otherTask, OWNER])).rejects.toMatchObject({ code: "IVA25" });

    await asServer("update public.client_va_assignments set status = 'ended', ended_at = now() where client_id = $1 and status = 'active'", [harbor]);
    expect(await asUser(asWorker, "update public.tasks set status = 'done' where id = $1 returning id", [taskId])).toEqual([]);
    await expect(asUser(asWorker, "insert into public.task_comments (task_id, author_id, body) values ($1, $2, 'Still here')", [taskId, WORKER])).rejects.toMatchObject({ code: "IVA24" });
    await db.exec("alter table public.task_comments disable trigger task_comments_guard");
    try {
      await expect(asUser(asWorker, "insert into public.task_comments (task_id, author_id, body) values ($1, $2, 'Still here')", [taskId, WORKER])).rejects.toThrow(/row-level security/);
    } finally {
      await db.exec("alter table public.task_comments enable trigger task_comments_guard");
    }
    await expect(as("service_role", asWorker, "update public.tasks set status = 'done' where id = $1", [taskId])).rejects.toMatchObject({ code: "IVA24" });
    await expect(as("service_role", asWorker, "insert into public.task_comments (task_id, author_id, body) values ($1, $2, 'Still here')", [taskId, WORKER])).rejects.toMatchObject({ code: "IVA24" });
    expect(await asUser(asWorker, "select id from public.tasks where id = $1", [taskId])).toEqual([{ id: taskId }]);

    await asServer("update public.clients set disabled_at = now() where id = $1", [harbor]);
    await expect(asUser(asOwner, "update public.tasks set title = 'Too late' where id = $1", [taskId])).rejects.toMatchObject({ code: "IVA23" });
    const [clientNote] = await asUser<{ author_first_name: string }>(
      asOwner,
      "insert into public.task_comments (task_id, author_id, body) values ($1, $2, 'Closing this') returning author_first_name",
      [taskId, OWNER],
    );
    expect(clientNote.author_first_name).toBe("Cleo");
    const [closed] = await asUser<{ status: string; closed_by: string; closed: boolean }>(
      asOwner,
      "update public.tasks set status = 'done' where id = $1 returning status, closed_by, done_at is not null as closed",
      [taskId],
    );
    expect(closed).toEqual({ status: "done", closed_by: OWNER, closed: true });

    await expect(asUser(asOwner, "update public.tasks set title = 'After' where id = $1", [taskId])).rejects.toMatchObject({ code: "IVA25" });
    await expect(asUser(asOwner, "update public.tasks set deadline = current_date + 3 where id = $1", [taskId])).rejects.toMatchObject({ code: "IVA25" });
    await expect(asUser(asOwner, "update public.tasks set status = 'in_progress' where id = $1", [taskId])).rejects.toMatchObject({ code: "IVA25" });
    await expect(asUser(asOwner, "update public.task_comments set body = 'Edited' where task_id = $1", [taskId])).rejects.toThrow(/permission denied/);
    await expect(asUser(asOwner, "delete from public.task_comments where task_id = $1", [taskId])).rejects.toThrow(/permission denied/);
    await expect(asUser(asWorker, "delete from public.task_comments where task_id = $1", [taskId])).rejects.toThrow(/permission denied/);
    await expect(asUser(asOwner, "delete from public.tasks where id = $1", [taskId])).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, "delete from public.tasks where id = $1", [taskId])).rejects.toThrow(/permission denied/);
  });
});

describe("VA match", () => {
  const CLIENT_M = "11111111-1111-4111-8111-111111111101";
  const VA_M = "11111111-1111-4111-8111-111111111102";
  const VA_N = "11111111-1111-4111-8111-111111111103";
  const VA_O = "11111111-1111-4111-8111-111111111104";
  const VA_P = "11111111-1111-4111-8111-111111111105";
  const OTHER_M = "11111111-1111-4111-8111-111111111106";
  const asMatch = token(CLIENT_M, ["client"]);
  const asVaM = token(VA_M, ["va"]);
  let company = "";

  const offer = (va: string, claims: Claims = asAdmin) =>
    asUser<{ id: string; va_first_name: string }>(
      claims,
      "insert into public.va_shortlists (client_id, va_id, offered_by) values ($1, $2, $3) returning id, va_first_name",
      [company, va, claims.sub],
    );

  beforeAll(async () => {
    await as("supabase_auth_admin", {}, `
      insert into auth.users (id, email, raw_user_meta_data) values
        ('${CLIENT_M}', 'match-client@x.co', '{"full_name":"Mina Client"}'),
        ('${VA_M}', 'match-va@x.co', '{"full_name":"Nora Santos"}'),
        ('${VA_N}', 'match-va-n@x.co', '{"full_name":"Omar Diaz"}'),
        ('${VA_O}', 'match-va-o@x.co', '{"full_name":"Pia Cruz"}'),
        ('${VA_P}', 'match-va-p@x.co', '{"full_name":"Quinn Reyes"}'),
        ('${OTHER_M}', 'match-other@x.co', '{"full_name":"Other Client"}')`);
    await asServer(`update public.profiles set status = 'active' where id in ('${CLIENT_M}', '${VA_M}', '${VA_N}', '${VA_O}', '${VA_P}', '${OTHER_M}')`);
    await asServer(`
      insert into public.roles (user_id, role) values
        ('${CLIENT_M}', 'client'), ('${VA_M}', 'va'), ('${VA_N}', 'va'), ('${VA_O}', 'va'), ('${VA_P}', 'va'), ('${OTHER_M}', 'client')`);
    const [{ id }] = await asServer<{ id: string }>(
      "insert into public.clients (company_name, contact_name, contact_email, created_by) values ('Match Co', 'Mina', 'match@tasks.co', $1) returning id",
      [CLOSER],
    );
    company = id;
    await asServer(
      `update public.clients set user_id = $2, status = 'active', activated_at = now(), timezone = 'America/New_York',
         package_code = 'essentials', hours_per_week = 20, term_months = 6, monthly_cents = 85500, starts_on = '2026-11-01'
       where id = $1`,
      [company, CLIENT_M],
    );
  });

  it("offers up to three VAs, copies the first name, and refuses a fourth or a duplicate", async () => {
    const [first] = await offer(VA_M);
    expect(first.va_first_name).toBe("Nora");
    await offer(VA_N);
    await offer(VA_O);
    await expect(offer(VA_P)).rejects.toMatchObject({ code: "IVA26" });
    await expect(offer(VA_M)).rejects.toMatchObject({ code: "IVA26" });
    await expect(offer(VA_M, asCloser)).rejects.toMatchObject({ code: "IVA26" });
    await expect(as("anon", {}, "select id from public.va_shortlists")).rejects.toThrow(/permission denied/);
    expect(await asUser(token(ADMIN, ["admin"], "aal1"), "select id from public.va_shortlists where client_id = $1", [company])).toEqual([]);
    expect(await asUser(asMatch, "select id from public.profiles where id = $1", [VA_M])).toEqual([]);
  });

  it("lets the client accept one offer into an assignment and decline another", async () => {
    const [nora] = await asUser<{ id: string }>(asAdmin, "select id from public.va_shortlists where client_id = $1 and va_id = $2", [company, VA_M]);
    const [accepted] = await asUser<{ status: string }>(asMatch, "update public.va_shortlists set status = 'accepted' where id = $1 returning status", [nora.id]);
    expect(accepted.status).toBe("accepted");
    const assignments = await asUser<{ va_id: string; va_first_name: string }>(
      asMatch,
      "select va_id, va_first_name from public.client_va_assignments where client_id = $1 and status = 'active'",
      [company],
    );
    expect(assignments).toEqual([{ va_id: VA_M, va_first_name: "Nora" }]);
    expect(await asUser(asMatch, "update public.va_shortlists set status = 'declined' where id = $1 returning id", [nora.id])).toEqual([]);
    await expect(asServer("update public.va_shortlists set status = 'declined' where id = $1", [nora.id])).rejects.toMatchObject({ code: "IVA27" });

    const [omar] = await asUser<{ id: string }>(asAdmin, "select id from public.va_shortlists where client_id = $1 and va_id = $2", [company, VA_N]);
    expect(await asUser(asMatch, "update public.va_shortlists set status = 'declined' where id = $1 returning status", [omar.id])).toEqual([{ status: "declined" }]);
    expect(await asServer("select count(*)::int as n from public.client_va_assignments where client_id = $1 and va_id = $2", [company, VA_N])).toEqual([{ n: 0 }]);
  });

  it("allows a second active VA, and an admin can end one without changing the shortlist", async () => {
    const [pia] = await asUser<{ id: string }>(asAdmin, "select id from public.va_shortlists where client_id = $1 and va_id = $2", [company, VA_O]);
    await asUser(asMatch, "update public.va_shortlists set status = 'accepted' where id = $1", [pia.id]);
    const active = await asServer<{ id: string; va_id: string }>("select id, va_id from public.client_va_assignments where client_id = $1 and status = 'active' order by va_id", [company]);
    expect(active.map((row) => row.va_id).sort()).toEqual([VA_M, VA_O].sort());
    const nora = active.find((row) => row.va_id === VA_M);
    await asUser(asAdmin, "update public.client_va_assignments set status = 'ended', ended_at = now() where id = $1", [nora?.id]);
    expect(await asServer("select status from public.va_shortlists where client_id = $1 and va_id = $2", [company, VA_M])).toEqual([{ status: "accepted" }]);
    expect(await asServer("select status from public.client_va_assignments where id = $1", [nora?.id])).toEqual([{ status: "ended" }]);
    const [again] = await offer(VA_M);
    await asUser(asMatch, "update public.va_shortlists set status = 'accepted' where id = $1", [again.id]);
    expect(await asServer("select count(*)::int as n from public.client_va_assignments where client_id = $1 and va_id = $2 and status = 'active'", [company, VA_M])).toEqual([{ n: 1 }]);
  });

  it("lets the VA save their own hours and refuses another person's", async () => {
    const saved = await asUser<{ weekday: number }>(
      asVaM,
      "insert into public.va_working_hours (va_id, weekday, start_minute, end_minute) values ($1, 1, 540, 1020) returning weekday",
      [VA_M],
    );
    expect(saved).toEqual([{ weekday: 1 }]);
    await expect(asUser(asVaM, "insert into public.va_working_hours (va_id, weekday, start_minute, end_minute) values ($1, 1, 500, 600)", [VA_M])).rejects.toMatchObject({ code: "IVA29" });
    expect(await asUser(asMatch, "select id from public.va_working_hours where va_id = $1", [VA_M])).toEqual([]);
    await expect(asUser(asCloser, "insert into public.va_working_hours (va_id, weekday, start_minute, end_minute) values ($1, 2, 540, 1020)", [VA_M])).rejects.toMatchObject({ code: "IVA29" });
    expect(await asUser(asAdmin, "select weekday from public.va_working_hours where va_id = $1", [VA_M])).toEqual([{ weekday: 1 }]);
  });
});
