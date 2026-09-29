// Generated from the live Supabase schema (project ngckrfvsjggpnaddivyq) with the Supabase
// type generator after migration 20260929093954_sudan_only_defaults. Do not edit by hand:
// regenerate after every migration.
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
          reminder_at: string | null
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
          reminder_at?: string | null
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
          reminder_at?: string | null
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
      matter_parties: {
        Row: {
          client_id: string | null
          created_at: string
          display_name: string | null
          id: string
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
      [_ in never]: never
    }
    Functions: {
      add_office_member: {
        Args: {
          p_email: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      log_login_success: { Args: never; Returns: undefined }
      my_access: { Args: never; Returns: Json }
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
      office_status: "active" | "suspended" | "closed"
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
      office_status: ["active", "suspended", "closed"],
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
      task_status: ["pending", "in_progress", "completed", "cancelled"],
    },
  },
} as const
