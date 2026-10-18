// Database types in the shape `supabase gen types typescript` produces, matching
// supabase/migrations/. Hand-written until it is regenerated from the live project:
//   npx supabase gen types typescript --project-id <ref> > types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Enum<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
type Optional<T> = { [K in keyof T]?: T[K] };
/** Insert shape: the listed columns are required, every other column is optional (it has a default). */
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> & Optional<Omit<Row, Required>>;

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  is_default: boolean;
  created_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  status: Enum<"account_status">;
  tenant_id: string;
  created_at: string;
  updated_at: string;
};

type RoleRow = {
  id: string;
  user_id: string;
  role: Enum<"app_role">;
  assigned_at: string;
  assigned_by: string | null;
  tenant_id: string;
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
  package_code: string | null;
  hours_per_week: number | null;
  term_months: number | null;
  monthly_cents: number | null;
  currency: string;
  starts_on: string | null;
  timezone: string | null;
  business: Json;
  registration_email_sent_at: string | null;
  disabled_at: string | null;
  tenant_id: string;
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
  tenant_id: string;
  created_at: string;
};

type StaffProfileRow = {
  user_id: string;
  date_of_birth: string | null;
  gender: Enum<"staff_gender"> | null;
  nationality: string | null;
  marital_status: Enum<"staff_marital_status"> | null;
  current_street: string | null;
  current_city: string | null;
  current_province: string | null;
  current_postal_code: string | null;
  permanent_street: string | null;
  permanent_city: string | null;
  permanent_province: string | null;
  permanent_postal_code: string | null;
  mobile_number: string | null;
  alternate_phone: string | null;
  emergency_name: string | null;
  emergency_relationship: string | null;
  emergency_phone: string | null;
  highest_education: string | null;
  certifications: string | null;
  skills: string | null;
  languages: string | null;
  employers: Json;
  job_references: Json;
  key_responsibilities: string | null;
  achievements: string | null;
  resume_name: string | null;
  resume_type: string | null;
  resume_bytes: string | null;
  avatar_type: string | null;
  avatar_bytes: string | null;
  registration_status: Enum<"staff_registration_status">;
  invitation_sent_at: string;
  registration_completed_at: string | null;
  tenant_id: string;
  updated_at: string;
};

type LeadRow = {
  id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  industry: string | null;
  country: string | null;
  message: string;
  package_code: string | null;
  status: Enum<"lead_status">;
  closer_id: string | null;
  converted_client_id: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  notified_at: string | null;
  tenant_id: string;
  disabled_at: string | null;
  profile: Json;
  created_at: string;
  updated_at: string;
};

type ClientNoteRow = {
  id: string;
  client_id: string;
  author_id: string;
  body: string;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_bytes: string | null;
  tenant_id: string;
  created_at: string;
};

type LeadEventRow = {
  id: string;
  lead_id: string;
  author_id: string;
  kind: Enum<"lead_event_kind">;
  body: string;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_bytes: string | null;
  tenant_id: string;
  created_at: string;
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
      tenants: {
        Row: TenantRow;
        Insert: InsertOf<TenantRow, "name" | "slug">;
        Update: Optional<TenantRow>;
        Relationships: [];
      };
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
      client_notes: {
        Row: ClientNoteRow;
        Insert: InsertOf<ClientNoteRow, "client_id" | "author_id" | "body">;
        Update: Optional<ClientNoteRow>;
        Relationships: [];
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
      staff_profiles: {
        Row: StaffProfileRow;
        Insert: InsertOf<StaffProfileRow, "user_id">;
        Update: Optional<StaffProfileRow>;
        Relationships: [
          {
            foreignKeyName: "staff_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: LeadRow;
        Insert: InsertOf<LeadRow, "full_name" | "email" | "message">;
        Update: Optional<LeadRow>;
        Relationships: [];
      };
      lead_events: {
        Row: LeadEventRow;
        Insert: InsertOf<LeadEventRow, "lead_id" | "author_id" | "kind" | "body">;
        Update: Optional<LeadEventRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
      convert_lead: { Args: { lead_id: string; company_name: string; contact_name: string; contact_phone?: string | null }; Returns: string };
      convert_lead_noted: {
        Args: {
          lead_id: string;
          company_name: string;
          contact_name: string;
          contact_phone?: string | null;
          remarks: string;
          package_code: string;
          hours_per_week: number;
          term_months: number;
          monthly_cents: number;
          starts_on: string;
          timezone: string;
        };
        Returns: string;
      };
      record_lead_step: { Args: { lead_id: string; kind: Enum<"lead_event_kind">; body: string }; Returns: undefined };
      record_lead_call: {
        Args: { lead_id: string; body: string; attachment_name?: string | null; attachment_type?: string | null; attachment_base64?: string | null };
        Returns: string;
      };
      record_client_note: {
        Args: { client_id: string; body: string; attachment_name?: string | null; attachment_type?: string | null; attachment_base64?: string | null };
        Returns: string;
      };
      record_lead_note: {
        Args: { lead_id: string; body: string; attachment_name?: string | null; attachment_type?: string | null; attachment_base64?: string | null };
        Returns: string;
      };
    };
    Enums: {
      account_status: "invited" | "active" | "inactive";
      app_role: "client" | "va" | "closer" | "admin" | "super_admin";
      client_status: "pending" | "active" | "inactive";
      assignment_status: "active" | "ended";
      lead_status: "new" | "contacted" | "qualified" | "converted" | "closed";
      lead_event_kind: "call" | "qualification" | "conversion" | "junk" | "note" | "remark";
      staff_gender: "female" | "male" | "non_binary" | "prefer_not_to_say";
      staff_marital_status: "single" | "married" | "widowed" | "divorced" | "separated" | "prefer_not_to_say";
      staff_registration_status: "pending" | "in_progress" | "completed";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Enum<T>;
