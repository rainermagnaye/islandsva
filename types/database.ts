// The database's types: `database.generated.ts` is the Supabase CLI's output for the live schema (`npm run
// db:types`, never edited by hand), and this file adjusts it where the generator can't know a rule.
//
// tenant_id: every tenant-owned table fills it in a BEFORE INSERT trigger (private.assign_tenant, from the parent
// row), and the app must never send one, so inserts type it as optional instead of required.
//
// Function arguments: a Postgres parameter is always nullable and our functions handle null (no attachment, no
// phone), but the generator types them as required non-null; each argument stays required and may be null.

import type { Database as Generated, Json } from "./database.generated";

type Public = Generated["public"];

type TenantFromTrigger<Table> = Table extends { Insert: infer Insert }
  ? Omit<Table, "Insert"> & { Insert: "tenant_id" extends keyof Insert ? Omit<Insert, "tenant_id"> & { tenant_id?: string } : Insert }
  : Table;

type NullableArgs<Fn> = Fn extends { Args: infer Args } ? Omit<Fn, "Args"> & { Args: { [Key in keyof Args]: Args[Key] | null } } : Fn;

export type Database = Omit<Generated, "public"> & {
  public: Omit<Public, "Tables" | "Functions"> & {
    Tables: { [Name in keyof Public["Tables"]]: TenantFromTrigger<Public["Tables"][Name]> };
    Functions: { [Name in keyof Public["Functions"]]: NullableArgs<Public["Functions"][Name]> };
  };
};

export type { Json };
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
