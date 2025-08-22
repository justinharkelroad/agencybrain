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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          address_city: string | null
          address_line1: string | null
          address_line2: string | null
          address_state: string | null
          address_zip: string | null
          agency_email: string | null
          agent_cell: string | null
          agent_name: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_state?: string | null
          address_zip?: string | null
          agency_email?: string | null
          agent_cell?: string | null
          agent_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_state?: string | null
          address_zip?: string | null
          agency_email?: string | null
          agent_cell?: string | null
          agent_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_files: {
        Row: {
          agency_id: string
          created_at: string
          file_path: string
          id: string
          member_id: string | null
          mime_type: string | null
          original_name: string
          size: number | null
          template_item_id: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by_user_id: string
          visibility: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          file_path: string
          id?: string
          member_id?: string | null
          mime_type?: string | null
          original_name: string
          size?: number | null
          template_item_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by_user_id: string
          visibility?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          file_path?: string
          id?: string
          member_id?: string | null
          mime_type?: string | null
          original_name?: string
          size?: number | null
          template_item_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by_user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_files_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_files_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_files_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_analysis: {
        Row: {
          analysis_result: string
          analysis_type: string
          created_at: string
          id: string
          period_id: string | null
          prompt_id: string | null
          prompt_used: string
          selected_uploads: Json | null
          shared_with_client: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          analysis_result: string
          analysis_type: string
          created_at?: string
          id?: string
          period_id?: string | null
          prompt_id?: string | null
          prompt_used: string
          selected_uploads?: Json | null
          shared_with_client?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          analysis_result?: string
          analysis_type?: string
          created_at?: string
          id?: string
          period_id?: string | null
          prompt_id?: string | null
          prompt_used?: string
          selected_uploads?: Json | null
          shared_with_client?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_analysis_requests: {
        Row: {
          admin_note: string | null
          analysis_id: string
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          analysis_id: string
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          analysis_id?: string
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_requests_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "ai_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_analysis_views: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          analysis_id: string
          created_at: string
          first_viewed_at: string
          id: string
          last_viewed_at: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          analysis_id: string
          created_at?: string
          first_viewed_at?: string
          id?: string
          last_viewed_at?: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          analysis_id?: string
          created_at?: string
          first_viewed_at?: string
          id?: string
          last_viewed_at?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_views_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "ai_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          analysis_id: string
          content: string
          created_at: string
          id: string
          role: string
          shared_with_client: boolean
          user_id: string | null
        }
        Insert: {
          analysis_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          shared_with_client?: boolean
          user_id?: string | null
        }
        Update: {
          analysis_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          shared_with_client?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "ai_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_grid_saves: {
        Row: {
          created_at: string
          grid_data: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          grid_data: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          grid_data?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checklist_template_items: {
        Row: {
          active: boolean
          agency_id: string | null
          created_at: string
          id: string
          label: string
          order_index: number
          required: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          agency_id?: string | null
          created_at?: string
          id?: string
          label: string
          order_index?: number
          required?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          agency_id?: string | null
          created_at?: string
          id?: string
          label?: string
          order_index?: number
          required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      column_mappings: {
        Row: {
          category: string
          created_at: string
          file_type: string
          id: string
          is_active: boolean
          mapped_columns: Json
          mapping_rules: Json | null
          original_columns: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          file_type: string
          id?: string
          is_active?: boolean
          mapped_columns: Json
          mapping_rules?: Json | null
          original_columns: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          file_type?: string
          id?: string
          is_active?: boolean
          mapped_columns?: Json
          mapping_rules?: Json | null
          original_columns?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_checklist_items: {
        Row: {
          attachments_count: number
          created_at: string
          id: string
          member_id: string
          secured: boolean
          template_item_id: string
          updated_at: string
        }
        Insert: {
          attachments_count?: number
          created_at?: string
          id?: string
          member_id: string
          secured?: boolean
          template_item_id: string
          updated_at?: string
        }
        Update: {
          attachments_count?: number
          created_at?: string
          id?: string
          member_id?: string
          secured?: boolean
          template_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_checklist_items_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_checklist_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      periods: {
        Row: {
          created_at: string
          end_date: string
          form_data: Json | null
          id: string
          start_date: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          form_data?: Json | null
          id?: string
          start_date: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          form_data?: Json | null
          id?: string
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      process_vault_files: {
        Row: {
          created_at: string
          id: string
          upload_file_path: string
          user_vault_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          upload_file_path: string
          user_vault_id: string
        }
        Update: {
          created_at?: string
          id?: string
          upload_file_path?: string
          user_vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_vault_files_upload_file_path_fkey"
            columns: ["upload_file_path"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["file_path"]
          },
          {
            foreignKeyName: "process_vault_files_user_vault_id_fkey"
            columns: ["user_vault_id"]
            isOneToOne: false
            referencedRelation: "user_process_vaults"
            referencedColumns: ["id"]
          },
        ]
      }
      process_vault_types: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency_id: string | null
          created_at: string
          id: string
          mrr: number | null
          role: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          id: string
          mrr?: number | null
          role?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          id?: string
          mrr?: number | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          subheadline: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          subheadline?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          subheadline?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      snapshot_planner: {
        Row: {
          created_at: string | null
          current_month_items_total: number | null
          grid_version: string | null
          id: string
          raw_pdf_meta: Json | null
          snapshot_date: string
          tiers: Json
          uploaded_month: number
          user_id: string
          ytd_items_total: number
        }
        Insert: {
          created_at?: string | null
          current_month_items_total?: number | null
          grid_version?: string | null
          id?: string
          raw_pdf_meta?: Json | null
          snapshot_date: string
          tiers: Json
          uploaded_month: number
          user_id: string
          ytd_items_total: number
        }
        Update: {
          created_at?: string | null
          current_month_items_total?: number | null
          grid_version?: string | null
          id?: string
          raw_pdf_meta?: Json | null
          snapshot_date?: string
          tiers?: Json
          uploaded_month?: number
          user_id?: string
          ytd_items_total?: number
        }
        Relationships: []
      }
      team_members: {
        Row: {
          agency_id: string
          created_at: string
          email: string
          employment: Database["public"]["Enums"]["app_employment_type"]
          id: string
          name: string
          notes: string | null
          role: Database["public"]["Enums"]["app_member_role"]
          status: Database["public"]["Enums"]["app_member_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          email: string
          employment: Database["public"]["Enums"]["app_employment_type"]
          id?: string
          name: string
          notes?: string | null
          role: Database["public"]["Enums"]["app_member_role"]
          status?: Database["public"]["Enums"]["app_member_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          email?: string
          employment?: Database["public"]["Enums"]["app_employment_type"]
          id?: string
          name?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["app_member_role"]
          status?: Database["public"]["Enums"]["app_member_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          category: string
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          original_name: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_name: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_process_vaults: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
          user_id: string
          vault_type_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          user_id: string
          vault_type_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          user_id?: string
          vault_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_process_vaults_vault_type_id_fkey"
            columns: ["vault_type_id"]
            isOneToOne: false
            referencedRelation: "process_vault_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_user: {
        Args: {
          p_agency_id: string
          p_email: string
          p_first_name?: string
          p_last_name?: string
          p_password: string
        }
        Returns: string
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      has_agency_access: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_employment_type: "Full-time" | "Part-time"
      app_member_role: "Sales" | "Service" | "Hybrid" | "Manager"
      app_member_status: "active" | "inactive"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_employment_type: ["Full-time", "Part-time"],
      app_member_role: ["Sales", "Service", "Hybrid", "Manager"],
      app_member_status: ["active", "inactive"],
    },
  },
} as const
