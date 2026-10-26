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
  signed_in_at: string | null;
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
  onboarding_status: Enum<"client_onboarding_status">;
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
  billing: Json;
  consented_at: string | null;
  onboarding_submitted_at: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
};

type PaymentRow = {
  id: string;
  client_id: string;
  tenant_id: string;
  provider: Enum<"payment_provider">;
  status: Enum<"payment_status">;
  amount_cents: number;
  /** A bank or transfer fee, at most the amount; gross minus fees is net. */
  fee_cents: number;
  currency: string;
  term_months: number;
  provider_ref: string | null;
  paid_on: string;
  recorded_by: string | null;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
};

type DemoSlotRow = {
  id: string;
  tenant_id: string;
  va_id: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
};

/** Written only by book_demo, decide_demo and cancel_demo (secret key); company, time zone and VA name are snapshots. */
type DemoBookingRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  va_id: string;
  slot_id: string | null;
  starts_at: string;
  ends_at: string;
  status: Enum<"demo_status">;
  client_note: string | null;
  reject_reason: string | null;
  decided_at: string | null;
  cancelled_at: string | null;
  booked_by: string;
  company_name: string;
  client_timezone: string | null;
  va_name: string;
  created_at: string;
  updated_at: string;
};

/** An admin's daily discovery-call times (PHT), at most 6 per tenant; written through set_discovery_times. */
type DiscoveryTimeRow = {
  id: string;
  tenant_id: string;
  position: number;
  /** "HH:MM:SS", on :00 or :30. */
  time_of_day: string;
  created_at: string;
};

/** Every call (only `discovery` so far). Written only by the discovery-call functions (secret key). */
type MeetingRow = {
  id: string;
  tenant_id: string;
  kind: Enum<"meeting_kind">;
  status: Enum<"meeting_status">;
  lead_id: string | null;
  organizer_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  starts_at: string;
  ends_at: string;
  google_event_id: string | null;
  meet_url: string | null;
  created_at: string;
  updated_at: string;
};

/** A meeting's append-only history: no update or delete, for anyone. */
type MeetingEventRow = {
  id: string;
  tenant_id: string;
  meeting_id: string;
  kind: Enum<"meeting_event_kind">;
  actor_id: string | null;
  body: string | null;
  created_at: string;
};

/** Signed-in users insert title, deadline and the people columns; triggers fill the snapshots, zone, done_at and closed_by. */
type TaskRow = {
  id: string;
  client_id: string;
  va_id: string;
  title: string;
  deadline: string;
  deadline_timezone: string;
  company_name: string;
  va_first_name: string;
  status: Enum<"task_status">;
  done_at: string | null;
  closed_by: string | null;
  created_by: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
};

type TaskCommentRow = {
  id: string;
  task_id: string;
  author_id: string;
  author_first_name: string;
  body: string;
  tenant_id: string;
  created_at: string;
};

/** Written only by database triggers (private.write_audit); nobody updates or deletes it. */
type AuditLogRow = {
  id: string;
  tenant_id: string;
  at: string;
  actor_kind: Enum<"audit_actor_kind">;
  /** Null when actor_kind is "system" (shown as "System"). */
  actor_id: string | null;
  action: Enum<"audit_action">;
  record_type: "leads" | "meetings" | "clients" | "client_va_assignments" | "roles" | "profiles";
  record_id: string;
  owner_id: string | null;
  client_id: string | null;
  /** { column: value } on insert/delete, { column: [old, new] } on update; null = changed, value withheld. */
  changes: Json;
};

/** Signed-in users may read every column except token_hash (column grant); the server reads all. */
type OnboardingLinkRow = {
  id: string;
  client_id: string;
  tenant_id: string;
  token_hash: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  submitted_at: string | null;
  revoked_at: string | null;
};

type ClientPacketRow = {
  client_id: string;
  tenant_id: string;
  token: string;
  token_hash: string;
  consent_name: string | null;
  consent_signed_at: string | null;
  payment_proof: string | null;
  payment_proof_name: string | null;
  payment_proof_type: string | null;
  review_issues: string[];
  review_note: string | null;
  submitted_at: string | null;
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
  va_first_name: string;
  tenant_id: string;
  created_at: string;
};

type ShortlistRow = {
  id: string;
  client_id: string;
  va_id: string;
  status: Enum<"shortlist_status">;
  va_first_name: string;
  company_name: string;
  offered_by: string;
  decided_at: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
};

type WorkingHoursRow = {
  id: string;
  va_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  tenant_id: string;
  created_at: string;
  updated_at: string;
};

type EmployeeProfileRow = {
  user_id: string;
  date_of_birth: string | null;
  gender: Enum<"employee_gender"> | null;
  nationality: string | null;
  marital_status: Enum<"employee_marital_status"> | null;
  current_street: string | null;
  current_line2: string | null;
  current_city: string | null;
  current_province: string | null;
  current_postal_code: string | null;
  current_country: string | null;
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
  registration_status: Enum<"employee_registration_status">;
  review_status: Enum<"employee_review_status">;
  returned_sections: string[];
  return_note: string | null;
  invitation_sent_at: string;
  registration_completed_at: string | null;
  time_format: "12" | "24";
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
      client_packets: {
        Row: ClientPacketRow;
        Insert: InsertOf<ClientPacketRow, "client_id" | "token" | "token_hash">;
        Update: Optional<ClientPacketRow>;
        Relationships: [];
      };
      client_notes: {
        Row: ClientNoteRow;
        Insert: InsertOf<ClientNoteRow, "client_id" | "author_id" | "body">;
        Update: Optional<ClientNoteRow>;
        Relationships: [];
      };
      payments: {
        Row: PaymentRow;
        Insert: InsertOf<PaymentRow, "client_id" | "amount_cents" | "term_months" | "paid_on">;
        Update: Optional<PaymentRow>;
        Relationships: [];
      };
      demo_slots: {
        Row: DemoSlotRow;
        Insert: InsertOf<DemoSlotRow, "va_id" | "starts_at" | "ends_at">;
        Update: Optional<DemoSlotRow>;
        Relationships: [];
      };
      demo_bookings: {
        Row: DemoBookingRow;
        Insert: InsertOf<DemoBookingRow, "client_id" | "va_id" | "starts_at" | "ends_at" | "booked_by" | "company_name" | "va_name">;
        Update: Optional<DemoBookingRow>;
        Relationships: [];
      };
      discovery_times: {
        Row: DiscoveryTimeRow;
        Insert: InsertOf<DiscoveryTimeRow, "position" | "time_of_day">;
        Update: Optional<DiscoveryTimeRow>;
        Relationships: [];
      };
      meetings: {
        Row: MeetingRow;
        Insert: InsertOf<MeetingRow, "kind" | "starts_at" | "ends_at">;
        Update: Optional<MeetingRow>;
        Relationships: [];
      };
      meeting_events: {
        Row: MeetingEventRow;
        Insert: InsertOf<MeetingEventRow, "meeting_id" | "kind">;
        Update: Optional<MeetingEventRow>;
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: InsertOf<TaskRow, "client_id" | "va_id" | "title" | "deadline" | "created_by">;
        Update: Optional<TaskRow>;
        Relationships: [];
      };
      task_comments: {
        Row: TaskCommentRow;
        Insert: InsertOf<TaskCommentRow, "task_id" | "author_id" | "body">;
        Update: Optional<TaskCommentRow>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      client_onboarding_links: {
        Row: OnboardingLinkRow;
        Insert: InsertOf<OnboardingLinkRow, "client_id" | "token_hash" | "created_by">;
        Update: Optional<OnboardingLinkRow>;
        Relationships: [];
      };
      va_shortlists: {
        Row: ShortlistRow;
        Insert: InsertOf<ShortlistRow, "client_id" | "va_id" | "offered_by">;
        Update: Optional<ShortlistRow>;
        Relationships: [];
      };
      va_working_hours: {
        Row: WorkingHoursRow;
        Insert: InsertOf<WorkingHoursRow, "va_id" | "weekday" | "start_minute" | "end_minute">;
        Update: Optional<WorkingHoursRow>;
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
      employee_profiles: {
        Row: EmployeeProfileRow;
        Insert: InsertOf<EmployeeProfileRow, "user_id">;
        Update: Optional<EmployeeProfileRow>;
        Relationships: [
          {
            foreignKeyName: "employee_profiles_user_id_fkey";
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
      issue_onboarding_link: {
        Args: { client_id: string; issued_by: string; token_hash: string };
        Returns: { link_id: string; link_expires_at: string }[];
      };
      revoke_onboarding_link: { Args: { client_id: string; revoked_by: string }; Returns: boolean };
      submit_onboarding: {
        Args: { token_hash: string; contact_name: string; contact_phone: string; business: Json; billing: Json; consent: boolean };
        Returns: string;
      };
      record_manual_payment: {
        Args: { client_id: string; recorded_by: string; amount_cents: number; provider_ref: string | null; paid_on: string };
        Returns: string;
      };
      void_payment: { Args: { payment_id: string; voided_by: string }; Returns: undefined };
      accept_client_review_paid: {
        Args: { client_id: string; actor: string; amount_cents: number; fee_cents: number; paid_on: string; reference: string | null };
        Returns: string;
      };
      activate_client: { Args: { client_id: string; user_id: string; activated_by: string }; Returns: undefined };
      issue_client_onboarding_link: { Args: { client_id: string; token: string; token_hash: string }; Returns: undefined };
      save_client_review: { Args: { client_id: string; issues: string[]; note: string }; Returns: undefined };
      accept_client_review: { Args: { client_id: string }; Returns: undefined };
      record_client_invite: { Args: { client_id: string; user_id: string }; Returns: undefined };
      submit_client_packet: {
        Args: {
          token_hash: string;
          company_name: string;
          contact_name: string;
          contact_phone?: string | null;
          details: Json;
          consent_name: string;
          proof_name: string;
          proof_type: string;
          proof_base64: string;
        };
        Returns: string;
      };
      // Demo scheduling: executable by the secret key only; each returns the details its email needs.
      book_demo: { Args: { client_id: string; slot_id: string; actor: string; note: string | null }; Returns: Json };
      decide_demo: { Args: { booking_id: string; actor: string; decision: "confirmed" | "rejected"; reason: string | null }; Returns: Json };
      cancel_demo: { Args: { booking_id: string; actor: string }; Returns: Json };
      // Discovery calls. set_discovery_times: an admin with two-factor (signed in). discovery_inbox: signed in,
      // rows only for an active Lead Gen. The rest: the secret key only.
      // Secret key only; the actor must be an active admin of the account's agency (or a Super Admin).
      set_account_status: { Args: { user_id: string; actor: string; status: "inactive" }; Returns: undefined };
      set_discovery_times: { Args: { times: string[] }; Returns: undefined };
      open_discovery_slots: { Args: Record<PropertyKey, never>; Returns: string[] };
      request_discovery_call: {
        Args: {
          full_name: string;
          email: string;
          company_name: string | null;
          industry: string | null;
          country: string | null;
          message: string;
          package_code: string | null;
          ip_hash: string | null;
          user_agent: string | null;
          starts_at: string;
        };
        /** The new lead's id. */
        Returns: string;
      };
      decide_discovery_call: {
        Args: { meeting_id: string; actor: string; decision: "scheduled" | "rejected"; reason: string | null; google_event_id?: string | null; meet_url?: string | null };
        /** { lead_id, status, starts_at, email, full_name } */
        Returns: Json;
      };
      record_discovery_outcome: { Args: { meeting_id: string; actor: string; outcome: "done" | "no_show"; note: string | null }; Returns: undefined };
      discovery_inbox: {
        Args: Record<PropertyKey, never>;
        Returns: {
          meeting_id: string;
          starts_at: string;
          ends_at: string;
          full_name: string;
          company_name: string | null;
          industry: string | null;
          country: string | null;
          package_code: string | null;
          message: string;
        }[];
      };
    };
    Enums: {
      account_status: "invited" | "active" | "inactive";
      app_role: "client" | "va" | "closer" | "admin" | "super_admin";
      client_status: "pending" | "active" | "inactive";
      client_onboarding_status: "ready" | "pending_customer" | "pending_review" | "changes_requested" | "approved" | "invite_sent";
      assignment_status: "active" | "ended";
      shortlist_status: "offered" | "accepted" | "declined";
      lead_status: "new" | "contacted" | "qualified" | "converted" | "closed";
      lead_event_kind: "call" | "qualification" | "conversion" | "junk" | "note" | "remark";
      employee_gender: "female" | "male" | "non_binary" | "prefer_not_to_say";
      employee_marital_status: "single" | "married" | "widowed" | "divorced" | "separated" | "prefer_not_to_say";
      employee_registration_status: "pending" | "in_progress" | "completed";
      employee_review_status: "pending" | "pending_review" | "approved";
      payment_provider: "manual";
      payment_status: "paid" | "void";
      demo_status: "pending" | "confirmed" | "rejected" | "cancelled" | "completed" | "expired";
      audit_actor_kind: "user" | "system";
      audit_action: "insert" | "update" | "delete";
      meeting_kind: "discovery";
      meeting_status: "requested" | "scheduled" | "rejected" | "done" | "no_show" | "cancelled" | "expired";
      meeting_event_kind: "requested" | "scheduled" | "rejected" | "done" | "no_show" | "note" | "expired";
      task_status: "todo" | "in_progress" | "done";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Enum<T>;
