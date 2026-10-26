export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      client_notes: {
        Row: {
          attachment_bytes: string | null
          attachment_name: string | null
          attachment_type: string | null
          author_id: string
          body: string
          client_id: string
          created_at: string
          id: string
          tenant_id: string
        }
        Insert: {
          attachment_bytes?: string | null
          attachment_name?: string | null
          attachment_type?: string | null
          author_id: string
          body: string
          client_id: string
          created_at?: string
          id?: string
          tenant_id: string
        }
        Update: {
          attachment_bytes?: string | null
          attachment_name?: string | null
          attachment_type?: string | null
          author_id?: string
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_author_tenant_fkey"
            columns: ["author_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "client_notes_client_tenant_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "client_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding_links: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          revoked_at: string | null
          submitted_at: string | null
          tenant_id: string
          token_hash: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          submitted_at?: string | null
          tenant_id: string
          token_hash: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          submitted_at?: string | null
          tenant_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_links_client_tenant_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "client_onboarding_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_links_creator_tenant_fkey"
            columns: ["created_by", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "client_onboarding_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_packets: {
        Row: {
          client_id: string
          consent_name: string | null
          consent_signed_at: string | null
          created_at: string
          payment_proof: string | null
          payment_proof_name: string | null
          payment_proof_type: string | null
          review_issues: string[]
          review_note: string | null
          submitted_at: string | null
          tenant_id: string
          token: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          client_id: string
          consent_name?: string | null
          consent_signed_at?: string | null
          created_at?: string
          payment_proof?: string | null
          payment_proof_name?: string | null
          payment_proof_type?: string | null
          review_issues?: string[]
          review_note?: string | null
          submitted_at?: string | null
          tenant_id: string
          token: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          consent_name?: string | null
          consent_signed_at?: string | null
          created_at?: string
          payment_proof?: string | null
          payment_proof_name?: string | null
          payment_proof_type?: string | null
          review_issues?: string[]
          review_note?: string | null
          submitted_at?: string | null
          tenant_id?: string
          token?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_packets_client_tenant_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "client_packets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_va_assignments: {
        Row: {
          assigned_by: string | null
          client_id: string
          created_at: string
          ended_at: string | null
          id: string
          started_at: string
          status: Database["public"]["Enums"]["assignment_status"]
          tenant_id: string
          va_id: string
        }
        Insert: {
          assigned_by?: string | null
          client_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          tenant_id: string
          va_id: string
        }
        Update: {
          assigned_by?: string | null
          client_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          tenant_id?: string
          va_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_va_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_va_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_va_assignments_client_tenant_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "client_va_assignments_va_id_fkey"
            columns: ["va_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_va_assignments_va_tenant_fkey"
            columns: ["va_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      clients: {
        Row: {
          activated_at: string | null
          billing: Json
          business: Json
          company_name: string
          consented_at: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          created_by: string
          currency: string
          disabled_at: string | null
          hours_per_week: number | null
          id: string
          monthly_cents: number | null
          notes: string | null
          onboarding_status: Database["public"]["Enums"]["client_onboarding_status"]
          onboarding_submitted_at: string | null
          package_code: string | null
          registration_email_sent_at: string | null
          starts_on: string | null
          status: Database["public"]["Enums"]["client_status"]
          tenant_id: string
          term_months: number | null
          timezone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          billing?: Json
          business?: Json
          company_name: string
          consented_at?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          created_by: string
          currency?: string
          disabled_at?: string | null
          hours_per_week?: number | null
          id?: string
          monthly_cents?: number | null
          notes?: string | null
          onboarding_status?: Database["public"]["Enums"]["client_onboarding_status"]
          onboarding_submitted_at?: string | null
          package_code?: string | null
          registration_email_sent_at?: string | null
          starts_on?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tenant_id: string
          term_months?: number | null
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          billing?: Json
          business?: Json
          company_name?: string
          consented_at?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          disabled_at?: string | null
          hours_per_week?: number | null
          id?: string
          monthly_cents?: number | null
          notes?: string | null
          onboarding_status?: Database["public"]["Enums"]["client_onboarding_status"]
          onboarding_submitted_at?: string | null
          package_code?: string | null
          registration_email_sent_at?: string | null
          starts_on?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tenant_id?: string
          term_months?: number | null
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_created_by_tenant_fkey"
            columns: ["created_by", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_user_tenant_fkey"
            columns: ["user_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      demo_bookings: {
        Row: {
          booked_by: string
          cancelled_at: string | null
          client_id: string
          client_note: string | null
          client_timezone: string | null
          company_name: string
          created_at: string
          decided_at: string | null
          ends_at: string
          id: string
          reject_reason: string | null
          slot_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["demo_status"]
          tenant_id: string
          updated_at: string
          va_id: string
          va_name: string
        }
        Insert: {
          booked_by: string
          cancelled_at?: string | null
          client_id: string
          client_note?: string | null
          client_timezone?: string | null
          company_name: string
          created_at?: string
          decided_at?: string | null
          ends_at: string
          id?: string
          reject_reason?: string | null
          slot_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["demo_status"]
          tenant_id: string
          updated_at?: string
          va_id: string
          va_name: string
        }
        Update: {
          booked_by?: string
          cancelled_at?: string | null
          client_id?: string
          client_note?: string | null
          client_timezone?: string | null
          company_name?: string
          created_at?: string
          decided_at?: string | null
          ends_at?: string
          id?: string
          reject_reason?: string | null
          slot_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["demo_status"]
          tenant_id?: string
          updated_at?: string
          va_id?: string
          va_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_bookings_booker_tenant_fkey"
            columns: ["booked_by", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "demo_bookings_client_tenant_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "demo_bookings_slot_tenant_fkey"
            columns: ["slot_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "demo_slots"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "demo_bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_bookings_va_tenant_fkey"
            columns: ["va_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      demo_slots: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          starts_at: string
          tenant_id: string
          va_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          starts_at: string
          tenant_id: string
          va_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          starts_at?: string
          tenant_id?: string
          va_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_slots_va_tenant_fkey"
            columns: ["va_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      lead_events: {
        Row: {
          attachment_bytes: string | null
          attachment_name: string | null
          attachment_type: string | null
          author_id: string
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["lead_event_kind"]
          lead_id: string
          tenant_id: string
        }
        Insert: {
          attachment_bytes?: string | null
          attachment_name?: string | null
          attachment_type?: string | null
          author_id: string
          body: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["lead_event_kind"]
          lead_id: string
          tenant_id: string
        }
        Update: {
          attachment_bytes?: string | null
          attachment_name?: string | null
          attachment_type?: string | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["lead_event_kind"]
          lead_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_author_tenant_fkey"
            columns: ["author_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_tenant_fkey"
            columns: ["lead_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "lead_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          closer_id: string | null
          company_name: string | null
          converted_client_id: string | null
          country: string | null
          created_at: string
          disabled_at: string | null
          email: string
          full_name: string
          id: string
          industry: string | null
          ip_hash: string | null
          message: string
          notified_at: string | null
          package_code: string | null
          profile: Json
          status: Database["public"]["Enums"]["lead_status"]
          tenant_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          closer_id?: string | null
          company_name?: string | null
          converted_client_id?: string | null
          country?: string | null
          created_at?: string
          disabled_at?: string | null
          email: string
          full_name: string
          id?: string
          industry?: string | null
          ip_hash?: string | null
          message: string
          notified_at?: string | null
          package_code?: string | null
          profile?: Json
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          closer_id?: string | null
          company_name?: string | null
          converted_client_id?: string | null
          country?: string | null
          created_at?: string
          disabled_at?: string | null
          email?: string
          full_name?: string
          id?: string
          industry?: string | null
          ip_hash?: string | null
          message?: string
          notified_at?: string | null
          package_code?: string | null
          profile?: Json
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_closer_tenant_fkey"
            columns: ["closer_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_client_tenant_fkey"
            columns: ["converted_client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          client_id: string
          created_at: string
          currency: string
          id: string
          paid_on: string
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
          term_months: number
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_cents: number
          client_id: string
          created_at?: string
          currency?: string
          id?: string
          paid_on: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
          term_months: number
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_cents?: number
          client_id?: string
          created_at?: string
          currency?: string
          id?: string
          paid_on?: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id?: string
          term_months?: number
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_tenant_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorder_tenant_fkey"
            columns: ["recorded_by", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_voider_tenant_fkey"
            columns: ["voided_by", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          signed_in_at: string | null
          status: Database["public"]["Enums"]["account_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          signed_in_at?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          signed_in_at?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_user_tenant_fkey"
            columns: ["user_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          achievements: string | null
          alternate_phone: string | null
          avatar_bytes: string | null
          avatar_type: string | null
          certifications: string | null
          current_city: string | null
          current_country: string | null
          current_line2: string | null
          current_postal_code: string | null
          current_province: string | null
          current_street: string | null
          date_of_birth: string | null
          emergency_name: string | null
          emergency_phone: string | null
          emergency_relationship: string | null
          employers: Json
          gender: Database["public"]["Enums"]["staff_gender"] | null
          highest_education: string | null
          invitation_sent_at: string
          job_references: Json
          key_responsibilities: string | null
          languages: string | null
          marital_status:
            | Database["public"]["Enums"]["staff_marital_status"]
            | null
          mobile_number: string | null
          nationality: string | null
          registration_completed_at: string | null
          registration_status: Database["public"]["Enums"]["staff_registration_status"]
          resume_bytes: string | null
          resume_name: string | null
          resume_type: string | null
          return_note: string | null
          returned_sections: string[]
          review_status: Database["public"]["Enums"]["staff_review_status"]
          skills: string | null
          tenant_id: string
          time_format: string
          updated_at: string
          user_id: string
        }
        Insert: {
          achievements?: string | null
          alternate_phone?: string | null
          avatar_bytes?: string | null
          avatar_type?: string | null
          certifications?: string | null
          current_city?: string | null
          current_country?: string | null
          current_line2?: string | null
          current_postal_code?: string | null
          current_province?: string | null
          current_street?: string | null
          date_of_birth?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          employers?: Json
          gender?: Database["public"]["Enums"]["staff_gender"] | null
          highest_education?: string | null
          invitation_sent_at?: string
          job_references?: Json
          key_responsibilities?: string | null
          languages?: string | null
          marital_status?:
            | Database["public"]["Enums"]["staff_marital_status"]
            | null
          mobile_number?: string | null
          nationality?: string | null
          registration_completed_at?: string | null
          registration_status?: Database["public"]["Enums"]["staff_registration_status"]
          resume_bytes?: string | null
          resume_name?: string | null
          resume_type?: string | null
          return_note?: string | null
          returned_sections?: string[]
          review_status?: Database["public"]["Enums"]["staff_review_status"]
          skills?: string | null
          tenant_id: string
          time_format?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          achievements?: string | null
          alternate_phone?: string | null
          avatar_bytes?: string | null
          avatar_type?: string | null
          certifications?: string | null
          current_city?: string | null
          current_country?: string | null
          current_line2?: string | null
          current_postal_code?: string | null
          current_province?: string | null
          current_street?: string | null
          date_of_birth?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          employers?: Json
          gender?: Database["public"]["Enums"]["staff_gender"] | null
          highest_education?: string | null
          invitation_sent_at?: string
          job_references?: Json
          key_responsibilities?: string | null
          languages?: string | null
          marital_status?:
            | Database["public"]["Enums"]["staff_marital_status"]
            | null
          mobile_number?: string | null
          nationality?: string | null
          registration_completed_at?: string | null
          registration_status?: Database["public"]["Enums"]["staff_registration_status"]
          resume_bytes?: string | null
          resume_name?: string | null
          resume_type?: string | null
          return_note?: string | null
          returned_sections?: string[]
          review_status?: Database["public"]["Enums"]["staff_review_status"]
          skills?: string | null
          tenant_id?: string
          time_format?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profiles_user_tenant_fkey"
            columns: ["user_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_client_review: { Args: { client_id: string }; Returns: undefined }
      activate_client: {
        Args: { activated_by: string; client_id: string; user_id: string }
        Returns: undefined
      }
      book_demo: {
        Args: {
          actor: string
          client_id: string
          note: string
          slot_id: string
        }
        Returns: Json
      }
      cancel_demo: {
        Args: { actor: string; booking_id: string }
        Returns: Json
      }
      convert_lead: {
        Args: {
          company_name: string
          contact_name: string
          contact_phone?: string
          lead_id: string
        }
        Returns: string
      }
      convert_lead_noted: {
        Args: {
          company_name: string
          contact_name: string
          contact_phone: string
          hours_per_week: number
          lead_id: string
          monthly_cents: number
          package_code: string
          remarks: string
          starts_on: string
          term_months: number
          timezone: string
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      decide_demo: {
        Args: {
          actor: string
          booking_id: string
          decision: string
          reason: string
        }
        Returns: Json
      }
      issue_client_onboarding_link: {
        Args: { client_id: string; token: string; token_hash: string }
        Returns: undefined
      }
      issue_onboarding_link: {
        Args: { client_id: string; issued_by: string; token_hash: string }
        Returns: {
          link_expires_at: string
          link_id: string
        }[]
      }
      record_client_invite: {
        Args: { client_id: string; user_id: string }
        Returns: undefined
      }
      record_client_note: {
        Args: {
          attachment_base64: string
          attachment_name: string
          attachment_type: string
          body: string
          client_id: string
        }
        Returns: string
      }
      record_lead_call: {
        Args: {
          attachment_base64: string
          attachment_name: string
          attachment_type: string
          body: string
          lead_id: string
        }
        Returns: string
      }
      record_lead_note: {
        Args: {
          attachment_base64: string
          attachment_name: string
          attachment_type: string
          body: string
          lead_id: string
        }
        Returns: string
      }
      record_lead_step: {
        Args: {
          body: string
          kind: Database["public"]["Enums"]["lead_event_kind"]
          lead_id: string
        }
        Returns: undefined
      }
      record_manual_payment: {
        Args: {
          amount_cents: number
          client_id: string
          paid_on: string
          provider_ref: string
          recorded_by: string
        }
        Returns: string
      }
      revoke_onboarding_link: {
        Args: { client_id: string; revoked_by: string }
        Returns: boolean
      }
      save_client_review: {
        Args: { client_id: string; issues: string[]; note: string }
        Returns: undefined
      }
      submit_client_packet: {
        Args: {
          company_name: string
          consent_name: string
          contact_name: string
          contact_phone: string
          details: Json
          proof_base64: string
          proof_name: string
          proof_type: string
          token_hash: string
        }
        Returns: string
      }
      submit_onboarding: {
        Args: {
          billing: Json
          business: Json
          consent: boolean
          contact_name: string
          contact_phone: string
          token_hash: string
        }
        Returns: string
      }
      void_payment: {
        Args: { payment_id: string; voided_by: string }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "invited" | "active" | "inactive"
      app_role: "client" | "va" | "closer" | "admin" | "super_admin"
      assignment_status: "active" | "ended"
      client_onboarding_status:
        | "ready"
        | "pending_customer"
        | "pending_review"
        | "changes_requested"
        | "approved"
        | "invite_sent"
      client_status: "pending" | "active" | "inactive"
      demo_status:
        | "pending"
        | "confirmed"
        | "rejected"
        | "cancelled"
        | "completed"
        | "expired"
      lead_event_kind:
        | "call"
        | "qualification"
        | "conversion"
        | "junk"
        | "note"
        | "remark"
      lead_status: "new" | "contacted" | "qualified" | "converted" | "closed"
      payment_provider: "manual"
      payment_status: "paid" | "void"
      staff_gender: "female" | "male" | "non_binary" | "prefer_not_to_say"
      staff_marital_status:
        | "single"
        | "married"
        | "widowed"
        | "separated"
        | "prefer_not_to_say"
        | "divorced"
      staff_registration_status: "pending" | "in_progress" | "completed"
      staff_review_status: "pending" | "pending_review" | "approved"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["invited", "active", "inactive"],
      app_role: ["client", "va", "closer", "admin", "super_admin"],
      assignment_status: ["active", "ended"],
      client_onboarding_status: [
        "ready",
        "pending_customer",
        "pending_review",
        "changes_requested",
        "approved",
        "invite_sent",
      ],
      client_status: ["pending", "active", "inactive"],
      demo_status: [
        "pending",
        "confirmed",
        "rejected",
        "cancelled",
        "completed",
        "expired",
      ],
      lead_event_kind: [
        "call",
        "qualification",
        "conversion",
        "junk",
        "note",
        "remark",
      ],
      lead_status: ["new", "contacted", "qualified", "converted", "closed"],
      payment_provider: ["manual"],
      payment_status: ["paid", "void"],
      staff_gender: ["female", "male", "non_binary", "prefer_not_to_say"],
      staff_marital_status: [
        "single",
        "married",
        "widowed",
        "separated",
        "prefer_not_to_say",
        "divorced",
      ],
      staff_registration_status: ["pending", "in_progress", "completed"],
      staff_review_status: ["pending", "pending_review", "approved"],
    },
  },
} as const
