// Database types in the shape `supabase gen types typescript` produces, matching
// supabase/migrations/*_initial_schema.sql. Hand-written until that migration is applied; then regenerate
// and overwrite this file:
//   npx supabase gen types typescript --project-id <ref> > types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Enum<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
type Optional<T> = { [K in keyof T]?: T[K] };
/** Insert shape: the listed columns are required, every other column is optional (it has a default). */
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> & Optional<Omit<Row, Required>>;

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  status: Enum<"account_status">;
  created_at: string;
  updated_at: string;
};

type RoleRow = {
  id: string;
  user_id: string;
  role: Enum<"app_role">;
  assigned_at: string;
  assigned_by: string | null;
};

type ClientRow = {
  id: string;
  user_id: string | null;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  status: Enum<"client_status">;
  created_by: string;
  activated_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type AssignmentRow = {
  id: string;
  client_id: string;
  va_id: string;
  status: Enum<"assignment_status">;
  started_at: string;
  ended_at: string | null;
  assigned_by: string | null;
  created_at: string;
};

type LeadRow = {
  id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  message: string;
  package_code: string | null;
  status: Enum<"lead_status">;
  closer_id: string | null;
  converted_client_id: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
};

/** A foreign key to profiles(id). */
type ProfilesFk<Name extends string, Column extends string> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: "profiles";
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: InsertOf<ProfileRow, "id" | "email">;
        Update: Optional<ProfileRow>;
        Relationships: [];
      };
      roles: {
        Row: RoleRow;
        Insert: InsertOf<RoleRow, "user_id" | "role">;
        Update: Optional<RoleRow>;
        Relationships: [ProfilesFk<"roles_user_id_fkey", "user_id">, ProfilesFk<"roles_assigned_by_fkey", "assigned_by">];
      };
      clients: {
        Row: ClientRow;
        Insert: InsertOf<ClientRow, "company_name" | "contact_name" | "contact_email" | "created_by">;
        Update: Optional<ClientRow>;
        Relationships: [ProfilesFk<"clients_user_id_fkey", "user_id">, ProfilesFk<"clients_created_by_fkey", "created_by">];
      };
      client_va_assignments: {
        Row: AssignmentRow;
        Insert: InsertOf<AssignmentRow, "client_id" | "va_id">;
        Update: Optional<AssignmentRow>;
        Relationships: [
          {
            foreignKeyName: "client_va_assignments_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          ProfilesFk<"client_va_assignments_va_id_fkey", "va_id">,
          ProfilesFk<"client_va_assignments_assigned_by_fkey", "assigned_by">,
        ];
      };
      leads: {
        Row: LeadRow;
        Insert: InsertOf<LeadRow, "full_name" | "email" | "message">;
        Update: Optional<LeadRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
    };
    Enums: {
      account_status: "invited" | "active" | "inactive";
      app_role: "client" | "va" | "closer" | "admin";
      client_status: "pending" | "active" | "inactive";
      assignment_status: "active" | "ended";
      lead_status: "new" | "contacted" | "qualified" | "converted" | "closed";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Enum<T>;
