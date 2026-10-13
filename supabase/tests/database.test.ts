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

  it("nobody inserts or deletes leads through the API (the contact form uses the server key)", async () => {
    await expect(asUser(asAdmin, "insert into public.leads (full_name, email, message) values ('a', 'a@b.co', 'hi')")).rejects.toThrow(/permission denied/);
    await expect(asUser(asAdmin, "delete from public.leads")).rejects.toThrow(/permission denied/);
    await expect(as("anon", {}, "insert into public.leads (full_name, email, message) values ('a', 'a@b.co', 'hi')")).rejects.toThrow(/permission denied/);
  });

  it("admins change only the triage columns", async () => {
    const [lead] = await insert({});
    expect(await asUser(asAdmin, "update public.leads set status = 'contacted' where id = $1 returning id", [lead.id])).toHaveLength(1);
    await expect(asUser(asAdmin, "update public.leads set email = 'x@y.co' where id = $1", [lead.id])).rejects.toThrow(/permission denied/);
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

    it("is for admins with two-factor sign-in only", async () => {
      const [lead] = await insert({});
      for (const claims of [token(ADMIN, ["admin"], "aal1"), asCloser, asVa, asClient]) {
        await expect(convert(claims, lead.id)).rejects.toThrow(/admins with two-factor sign-in only/);
      }
      await expect(as("anon", {}, "select public.convert_lead('00000000-0000-0000-0000-0000000000aa', 'x', 'y')")).rejects.toThrow(/permission denied/);
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

describe("staff profiles", () => {
  it("lets a person save their own profile, and an admin with two-factor sign-in read and update it", async () => {
    await asUser(asVa, `insert into public.staff_profiles (user_id, nationality) values ('${VA}', 'Filipino')`);
    expect(await asUser(asVa, `select nationality from public.staff_profiles where user_id = '${VA}'`)).toEqual([{ nationality: "Filipino" }]);
    await asUser(asAdmin, `update public.staff_profiles set current_city = 'Cebu' where user_id = '${VA}'`);
    expect(await asUser(asAdmin, `select current_city from public.staff_profiles where user_id = '${VA}'`)).toEqual([{ current_city: "Cebu" }]);
  });

  it("hides a profile from other people, from an admin without two-factor sign-in, and from anon", async () => {
    expect(await asUser(asVa2, `select user_id from public.staff_profiles where user_id = '${VA}'`)).toEqual([]);
    expect(await asUser(asCloser, `select user_id from public.staff_profiles where user_id = '${VA}'`)).toEqual([]);
    expect(await asUser(token(ADMIN, ["admin"], "aal1"), `select user_id from public.staff_profiles where user_id = '${VA}'`)).toEqual([]);
    await expect(as("anon", {}, "select user_id from public.staff_profiles")).rejects.toThrow(/permission denied/);
  });

  it("refuses writing someone else's profile, deleting one, or storing the résumé through the API", async () => {
    await expect(asUser(asVa, `insert into public.staff_profiles (user_id) values ('${VA2}')`)).rejects.toThrow(/row-level security/);
    await expect(asUser(asAdmin, `delete from public.staff_profiles where user_id = '${VA}'`)).rejects.toThrow(/permission denied/);
    await expect(asUser(asVa, `update public.staff_profiles set resume_bytes = '\\x00' where user_id = '${VA}'`)).rejects.toThrow(/permission denied/);
  });

  it("rejects a nationality that is too long", async () => {
    await expect(asServer(`insert into public.staff_profiles (user_id, nationality) values ('${VA2}', $1)`, ["n".repeat(81)])).rejects.toThrow(/check constraint/);
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
