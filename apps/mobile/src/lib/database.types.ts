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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          assigned_to: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          matter_id: string | null
          office_id: string
          outcome: string | null
          reminder_at: string | null
          stage_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at: string
        }
        Insert: {
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          matter_id?: string | null
          office_id?: string
          outcome?: string | null
          reminder_at?: string | null
          stage_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at?: string
        }
        Update: {
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          matter_id?: string | null
          office_id?: string
          outcome?: string | null
          reminder_at?: string | null
          stage_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_assignee_fk"
            columns: ["office_id", "assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "appointments_client_fk"
            columns: ["office_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_matter_fk"
            columns: ["office_id", "matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "appointments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_stage_fk"
            columns: ["office_id", "matter_id", "stage_id"]
            isOneToOne: false
            referencedRelation: "matter_stages"
            referencedColumns: ["office_id", "matter_id", "id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
          office_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
          office_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
          office_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          civil_id: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          id_country: string | null
          id_type: Database["public"]["Enums"]["identity_document_type"] | null
          metadata: Json
          nationality: string | null
          notes: string | null
          office_id: string
          phone: string | null
          registration_number: string | null
          revision: number
          secondary_phone: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          civil_id?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          id_country?: string | null
          id_type?: Database["public"]["Enums"]["identity_document_type"] | null
          metadata?: Json
          nationality?: string | null
          notes?: string | null
          office_id?: string
          phone?: string | null
          registration_number?: string | null
          revision?: number
          secondary_phone?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          civil_id?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          id_country?: string | null
          id_type?: Database["public"]["Enums"]["identity_document_type"] | null
          metadata?: Json
          nationality?: string | null
          notes?: string | null
          office_id?: string
          phone?: string | null
          registration_number?: string | null
          revision?: number
          secondary_phone?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          whatsapp?: string | null
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
            foreignKeyName: "clients_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          client_id: string | null
          created_at: string
          description: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_size: number
          id: string
          matter_id: string | null
          mime_type: string
          office_id: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_size: number
          id?: string
          matter_id?: string | null
          mime_type: string
          office_id?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          file_name?: string
          file_size?: number
          id?: string
          matter_id?: string | null
          mime_type?: string
          office_id?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_fk"
            columns: ["office_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "documents_matter_fk"
            columns: ["office_id", "matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matter_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          ended_at: string | null
          id: string
          is_primary: boolean
          matter_id: string
          office_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          ended_at?: string | null
          id?: string
          is_primary?: boolean
          matter_id: string
          office_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          ended_at?: string | null
          id?: string
          is_primary?: boolean
          matter_id?: string
          office_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matter_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_assignments_office_id_matter_id_fkey"
            columns: ["office_id", "matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "matter_assignments_office_id_user_id_fkey"
            columns: ["office_id", "user_id"]
            isOneToOne: false
            referencedRelation: "office_members"
            referencedColumns: ["office_id", "user_id"]
          },
        ]
      }
      matter_deadlines: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_at: string
          id: string
          legal_basis: string
          matter_id: string
          office_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_at: string
          id?: string
          legal_basis: string
          matter_id: string
          office_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          id?: string
          legal_basis?: string
          matter_id?: string
          office_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matter_deadlines_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_deadlines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_deadlines_matter_fk"
            columns: ["office_id", "matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "matter_deadlines_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      matter_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: number
          kind: string
          matter_id: string
          office_id: string
          subject: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: never
          kind: string
          matter_id: string
          office_id: string
          subject?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: never
          kind?: string
          matter_id?: string
          office_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matter_events_matter_fk"
            columns: ["office_id", "matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "matter_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      matter_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          matter_id: string
          office_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          matter_id: string
          office_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          matter_id?: string
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matter_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_notes_matter_fk"
            columns: ["office_id", "matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "matter_notes_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      matter_parties: {
        Row: {
          client_id: string | null
          created_at: string
          display_name: string | null
          id: string
          is_primary: boolean
          matter_id: string
          notes: string | null
          office_id: string
          party_role: Database["public"]["Enums"]["party_role"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_primary?: boolean
          matter_id: string
          notes?: string | null
          office_id?: string
          party_role?: Database["public"]["Enums"]["party_role"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_primary?: boolean
          matter_id?: string
          notes?: string | null
          office_id?: string
          party_role?: Database["public"]["Enums"]["party_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matter_parties_client_fk"
            columns: ["office_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "matter_parties_matter_fk"
            columns: ["office_id", "matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "matter_parties_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      matter_stages: {
        Row: {
          authority: string
          created_at: string
          created_by: string | null
          details: Json
          document_ids: string[]
          finished_at: string | null
          id: string
          matter_id: string
          name: string
          notes: string
          office_id: string
          position: number
          procedure_name: string
          reference: string
          requirements: Json
          skip_reason: string | null
          stage_date: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["stage_status"]
          updated_at: string
        }
        Insert: {
          authority: string
          created_at?: string
          created_by?: string | null
          details?: Json
          document_ids?: string[]
          finished_at?: string | null
          id?: string
          matter_id: string
          name: string
          notes?: string
          office_id?: string
          position: number
          procedure_name: string
          reference?: string
          requirements?: Json
          skip_reason?: string | null
          stage_date?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["stage_status"]
          updated_at?: string
        }
        Update: {
          authority?: string
          created_at?: string
          created_by?: string | null
          details?: Json
          document_ids?: string[]
          finished_at?: string | null
          id?: string
          matter_id?: string
          name?: string
          notes?: string
          office_id?: string
          position?: number
          procedure_name?: string
          reference?: string
          requirements?: Json
          skip_reason?: string | null
          stage_date?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["stage_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matter_stages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_stages_matter_fk"
            columns: ["office_id", "matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "matter_stages_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      matters: {
        Row: {
          assigned_lawyer_id: string | null
          case_number: string | null
          client_id: string
          closed_at: string | null
          court_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          details: Json
          id: string
          matter_number: string
          matter_type: Database["public"]["Enums"]["matter_type"]
          office_id: string
          opened_at: string
          priority: Database["public"]["Enums"]["priority_level"]
          revision: number
          status: Database["public"]["Enums"]["matter_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_lawyer_id?: string | null
          case_number?: string | null
          client_id: string
          closed_at?: string | null
          court_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          details?: Json
          id?: string
          matter_number?: string
          matter_type?: Database["public"]["Enums"]["matter_type"]
          office_id?: string
          opened_at?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          revision?: number
          status?: Database["public"]["Enums"]["matter_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_lawyer_id?: string | null
          case_number?: string | null
          client_id?: string
          closed_at?: string | null
          court_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          details?: Json
          id?: string
          matter_number?: string
          matter_type?: Database["public"]["Enums"]["matter_type"]
          office_id?: string
          opened_at?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          revision?: number
          status?: Database["public"]["Enums"]["matter_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matters_client_fk"
            columns: ["office_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "matters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matters_lawyer_fk"
            columns: ["office_id", "assigned_lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "matters_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_members: {
        Row: {
          created_at: string
          created_by: string | null
          joined_at: string | null
          office_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          joined_at?: string | null
          office_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          joined_at?: string | null
          office_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_members_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          address: string | null
          country: string
          created_at: string
          default_currency: string
          email: string | null
          id: string
          name: string
          name_ar: string | null
          phone: string | null
          settings: Json
          status: Database["public"]["Enums"]["office_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          country?: string
          created_at?: string
          default_currency?: string
          email?: string | null
          id?: string
          name: string
          name_ar?: string | null
          phone?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["office_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          country?: string
          created_at?: string
          default_currency?: string
          email?: string | null
          id?: string
          name?: string
          name_ar?: string | null
          phone?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["office_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          matter_id: string | null
          office_id: string
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          payment_type: Database["public"]["Enums"]["payment_type"]
          reference_number: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          matter_id?: string | null
          office_id?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_type?: Database["public"]["Enums"]["payment_type"]
          reference_number?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          matter_id?: string | null
          office_id?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_type?: Database["public"]["Enums"]["payment_type"]
          reference_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_fk"
            columns: ["office_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_matter_fk"
            columns: ["office_id", "matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "payments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          matter_types: Database["public"]["Enums"]["matter_type"][]
          name: string
          office_id: string
          stages: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          matter_types: Database["public"]["Enums"]["matter_type"][]
          name: string
          office_id?: string
          stages: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          matter_types?: Database["public"]["Enums"]["matter_type"][]
          name?: string
          office_id?: string
          stages?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          client_id: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          office_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          client_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          office_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          client_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          office_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_same_office_fkey"
            columns: ["office_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "profiles_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_receipts: {
        Row: {
          created_at: string
          entity_id: string
          kind: string
          office_id: string
          operation_id: string
          request_hash: string
          revision: number
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          kind: string
          office_id: string
          operation_id: string
          request_hash: string
          revision: number
          user_id?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          kind?: string
          office_id?: string
          operation_id?: string
          request_hash?: string
          revision?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_receipts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          matter_id: string | null
          office_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          matter_id?: string | null
          office_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          matter_id?: string | null
          office_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_fk"
            columns: ["office_id", "assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "tasks_client_fk"
            columns: ["office_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_matter_fk"
            columns: ["office_id", "matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["office_id", "id"]
          },
          {
            foreignKeyName: "tasks_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      matter_progress: {
        Row: {
          current_stage: string | null
          matter_id: string | null
          next_event_at: string | null
        }
        Insert: {
          current_stage?: never
          matter_id?: string | null
          next_event_at?: never
        }
        Update: {
          current_stage?: never
          matter_id?: string | null
          next_event_at?: never
        }
        Relationships: []
      }
    }
    Functions: {
      add_office_member: {
        Args: {
          p_email: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      append_procedure: {
        Args: { p_matter: string; p_name: string; p_stages: Json }
        Returns: number
      }
      finish_session: {
        Args: { p_appointment: string; p_next_at?: string; p_outcome: string }
        Returns: string
      }
      log_login_success: { Args: never; Returns: undefined }
      my_access: { Args: never; Returns: Json }
      platform_list_office_requests: {
        Args: never
        Returns: {
          admin_name: string
          admin_phone: string
          decided_at: string
          decision: string
          note: string
          office_id: string
          office_name: string
          office_phone: string
          requested_at: string
          status: Database["public"]["Enums"]["office_status"]
        }[]
      }
      platform_list_offices: {
        Args: never
        Returns: {
          admins: Json
          country: string
          created_at: string
          id: string
          members: number
          name: string
          name_ar: string
          phone: string
          status: Database["public"]["Enums"]["office_status"]
        }[]
      }
      platform_set_office_status: {
        Args: {
          p_office: string
          p_status: Database["public"]["Enums"]["office_status"]
        }
        Returns: undefined
      }
      portal_overview: { Args: never; Returns: Json }
      save_matter: {
        Args: { p_matter: Json; p_parties?: Json }
        Returns: string
      }
      save_stage: {
        Args: { p_next_at?: string; p_stage: Json }
        Returns: undefined
      }
      svc_actor_info: { Args: { p_actor: string }; Returns: Json }
      svc_add_member: {
        Args: {
          p_actor: string
          p_full_name: string
          p_phone: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user: string
        }
        Returns: string
      }
      svc_bootstrap_code_valid: {
        Args: { p_code_hash: string }
        Returns: boolean
      }
      svc_bootstrap_owner: {
        Args: {
          p_code_hash: string
          p_full_name: string
          p_phone: string
          p_user: string
        }
        Returns: boolean
      }
      svc_can_manage_user: {
        Args: { p_actor: string; p_target: string }
        Returns: boolean
      }
      svc_consume_office_request_attempt: {
        Args: { p_source_hash: string }
        Returns: string
      }
      svc_create_office: {
        Args: {
          p_actor: string
          p_admin: string
          p_admin_name: string
          p_admin_phone: string
          p_country?: string
          p_currency?: string
          p_name: string
          p_name_ar: string
          p_phone: string
          p_timezone?: string
        }
        Returns: string
      }
      svc_link_client_login: {
        Args: {
          p_actor: string
          p_client: string
          p_phone: string
          p_user: string
        }
        Returns: string
      }
      svc_office_request_limit: {
        Args: { p_source_hash: string }
        Returns: string
      }
      svc_request_office: {
        Args: {
          p_admin_name: string
          p_admin_phone: string
          p_name: string
          p_note: string
          p_phone: string
          p_source_hash: string
          p_user: string
        }
        Returns: string
      }
      svc_review_office_request: {
        Args: { p_actor: string; p_approve: boolean; p_office: string }
        Returns: string
      }
      sync_assignment: {
        Args: {
          p_base_revision: number
          p_data: Json
          p_id: string
          p_office: string
          p_operation: string
        }
        Returns: number
      }
      sync_client: {
        Args: {
          p_base_revision: number
          p_data: Json
          p_id: string
          p_office: string
          p_operation: string
        }
        Returns: number
      }
      sync_matter: {
        Args: {
          p_base_revision: number
          p_data: Json
          p_id: string
          p_office: string
          p_operation: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "lawyer" | "employee" | "reception" | "client"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      appointment_type:
        | "client_meeting"
        | "court_session"
        | "consultation"
        | "internal_meeting"
        | "reminder"
        | "other"
      client_status: "active" | "inactive" | "archived"
      client_type: "individual" | "organization"
      document_type:
        | "pleading"
        | "evidence"
        | "contract"
        | "power_of_attorney"
        | "judgment"
        | "correspondence"
        | "identity"
        | "receipt"
        | "other"
      identity_document_type:
        | "civil_id"
        | "passport"
        | "national_id"
        | "residency"
        | "commercial_registration"
        | "other"
      matter_status: "open" | "on_hold" | "closed" | "archived"
      matter_type:
        | "criminal"
        | "civil"
        | "commercial"
        | "personal_status"
        | "labour"
        | "administrative"
        | "real_estate"
        | "special_court"
        | "commercial_registry"
        | "land_registry"
        | "notarization"
        | "consultation"
        | "other"
      office_status: "active" | "suspended" | "closed" | "pending" | "rejected"
      party_role: "client" | "opponent" | "witness" | "expert" | "other"
      payment_method:
        | "cash"
        | "bank_transfer"
        | "bankak"
        | "card"
        | "cheque"
        | "other"
      payment_status: "pending" | "completed" | "failed" | "refunded" | "void"
      payment_type:
        | "legal_fee"
        | "retainer"
        | "consultation_fee"
        | "court_fee"
        | "expense_reimbursement"
        | "trust_deposit"
        | "refund"
        | "other"
      priority_level: "low" | "normal" | "high" | "urgent"
      stage_status: "pending" | "active" | "completed" | "skipped"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
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
      app_role: ["admin", "lawyer", "employee", "reception", "client"],
      appointment_status: [
        "scheduled",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      appointment_type: [
        "client_meeting",
        "court_session",
        "consultation",
        "internal_meeting",
        "reminder",
        "other",
      ],
      client_status: ["active", "inactive", "archived"],
      client_type: ["individual", "organization"],
      document_type: [
        "pleading",
        "evidence",
        "contract",
        "power_of_attorney",
        "judgment",
        "correspondence",
        "identity",
        "receipt",
        "other",
      ],
      identity_document_type: [
        "civil_id",
        "passport",
        "national_id",
        "residency",
        "commercial_registration",
        "other",
      ],
      matter_status: ["open", "on_hold", "closed", "archived"],
      matter_type: [
        "criminal",
        "civil",
        "commercial",
        "personal_status",
        "labour",
        "administrative",
        "real_estate",
        "special_court",
        "commercial_registry",
        "land_registry",
        "notarization",
        "consultation",
        "other",
      ],
      office_status: ["active", "suspended", "closed", "pending", "rejected"],
      party_role: ["client", "opponent", "witness", "expert", "other"],
      payment_method: [
        "cash",
        "bank_transfer",
        "bankak",
        "card",
        "cheque",
        "other",
      ],
      payment_status: ["pending", "completed", "failed", "refunded", "void"],
      payment_type: [
        "legal_fee",
        "retainer",
        "consultation_fee",
        "court_fee",
        "expense_reimbursement",
        "trust_deposit",
        "refund",
        "other",
      ],
      priority_level: ["low", "normal", "high", "urgent"],
      stage_status: ["pending", "active", "completed", "skipped"],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
    },
  },
} as const
