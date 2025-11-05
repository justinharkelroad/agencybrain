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
          cc_owner_on_reminders: boolean | null
          contest_board_enabled: boolean
          created_at: string
          description: string | null
          email_from: string | null
          id: string
          logo_url: string | null
          name: string
          owner_rollup_time: string | null
          phone: string | null
          reminder_times_json: Json | null
          slug: string | null
          suppress_if_final_exists: boolean | null
          timezone: string | null
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
          cc_owner_on_reminders?: boolean | null
          contest_board_enabled?: boolean
          created_at?: string
          description?: string | null
          email_from?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_rollup_time?: string | null
          phone?: string | null
          reminder_times_json?: Json | null
          slug?: string | null
          suppress_if_final_exists?: boolean | null
          timezone?: string | null
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
          cc_owner_on_reminders?: boolean | null
          contest_board_enabled?: boolean
          created_at?: string
          description?: string | null
          email_from?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_rollup_time?: string | null
          phone?: string | null
          reminder_times_json?: Json | null
          slug?: string | null
          suppress_if_final_exists?: boolean | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_access_audit: {
        Row: {
          access_type: string
          accessed_fields: string[] | null
          agency_id: string
          created_at: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string
        }
        Insert: {
          access_type: string
          accessed_fields?: string[] | null
          agency_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id: string
        }
        Update: {
          access_type?: string
          accessed_fields?: string[] | null
          agency_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string
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
      dictionaries: {
        Row: {
          agency_id: string
          category: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          category: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          category?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      dictionary_options: {
        Row: {
          active: boolean | null
          created_at: string
          dictionary_id: string
          id: string
          label: string
          order_index: number | null
          value: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          dictionary_id: string
          id?: string
          label: string
          order_index?: number | null
          value: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          dictionary_id?: string
          id?: string
          label?: string
          order_index?: number | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_dictionary_options_dictionary_id"
            columns: ["dictionary_id"]
            isOneToOne: false
            referencedRelation: "dictionaries"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          agency_id: string
          body_html: string | null
          body_text: string
          cc_owner: boolean
          created_at: string
          error: string | null
          id: string
          kind: string
          meta: Json
          scheduled_at: string
          sent_at: string | null
          subject: string
          to_email: string
        }
        Insert: {
          agency_id: string
          body_html?: string | null
          body_text: string
          cc_owner?: boolean
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          meta?: Json
          scheduled_at: string
          sent_at?: string | null
          subject: string
          to_email: string
        }
        Update: {
          agency_id?: string
          body_html?: string | null
          body_text?: string
          cc_owner?: boolean
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          meta?: Json
          scheduled_at?: string
          sent_at?: string | null
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      excusals: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string
          date: string
          id: string
          mode: string
          note: string
          team_member_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by: string
          date: string
          id?: string
          mode: string
          note: string
          team_member_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          mode?: string
          note?: string
          team_member_id?: string
        }
        Relationships: []
      }
      field_mapping_audit: {
        Row: {
          agency_id: string
          created_at: string | null
          form_template_id: string
          id: string
          items_extracted: number | null
          mappings_used: boolean
          policies_extracted: number | null
          premium_extracted: number | null
          submission_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          form_template_id: string
          id?: string
          items_extracted?: number | null
          mappings_used?: boolean
          policies_extracted?: number | null
          premium_extracted?: number | null
          submission_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          form_template_id?: string
          id?: string
          items_extracted?: number | null
          mappings_used?: boolean
          policies_extracted?: number | null
          premium_extracted?: number | null
          submission_id?: string
        }
        Relationships: []
      }
      form_fields: {
        Row: {
          builtin: boolean
          form_template_id: string
          id: string
          key: string
          label: string
          options_json: Json | null
          position: number
          required: boolean
          type: string
        }
        Insert: {
          builtin?: boolean
          form_template_id: string
          id?: string
          key: string
          label: string
          options_json?: Json | null
          position?: number
          required?: boolean
          type: string
        }
        Update: {
          builtin?: boolean
          form_template_id?: string
          id?: string
          key?: string
          label?: string
          options_json?: Json | null
          position?: number
          required?: boolean
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_template_id_fkey"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_link_analytics: {
        Row: {
          accessed_at: string
          agency_id: string
          form_link_id: string
          form_submitted: boolean | null
          id: string
          ip_address: unknown
          referer: string | null
          submission_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          agency_id: string
          form_link_id: string
          form_submitted?: boolean | null
          id?: string
          ip_address?: unknown
          referer?: string | null
          submission_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          agency_id?: string
          form_link_id?: string
          form_submitted?: boolean | null
          id?: string
          ip_address?: unknown
          referer?: string | null
          submission_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      form_links: {
        Row: {
          agency_id: string | null
          created_at: string
          enabled: boolean | null
          expires_at: string | null
          form_template_id: string
          id: string
          token: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          enabled?: boolean | null
          expires_at?: string | null
          form_template_id: string
          id?: string
          token: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          enabled?: boolean | null
          expires_at?: string | null
          form_template_id?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_form_links_agencies"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_form_links_form_template_id"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_section_field_types: {
        Row: {
          created_at: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_sticky: boolean
          is_system_required: boolean
          order_index: number
          section_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_label: string
          field_type: string
          id?: string
          is_sticky?: boolean
          is_system_required?: boolean
          order_index?: number
          section_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_sticky?: boolean
          is_system_required?: boolean
          order_index?: number
          section_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      form_templates: {
        Row: {
          agency_id: string
          created_at: string
          field_mappings: Json | null
          form_kpi_version: number
          id: string
          is_active: boolean | null
          name: string
          needs_attention: boolean
          role: Database["public"]["Enums"]["app_member_role"]
          schema_json: Json | null
          settings_json: Json | null
          slug: string
          status: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          field_mappings?: Json | null
          form_kpi_version?: number
          id?: string
          is_active?: boolean | null
          name: string
          needs_attention?: boolean
          role: Database["public"]["Enums"]["app_member_role"]
          schema_json?: Json | null
          settings_json?: Json | null
          slug: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          field_mappings?: Json | null
          form_kpi_version?: number
          id?: string
          is_active?: boolean | null
          name?: string
          needs_attention?: boolean
          role?: Database["public"]["Enums"]["app_member_role"]
          schema_json?: Json | null
          settings_json?: Json | null
          slug?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      forms_kpi_bindings: {
        Row: {
          created_at: string
          form_template_id: string
          id: string
          kpi_version_id: string
        }
        Insert: {
          created_at?: string
          form_template_id: string
          id?: string
          kpi_version_id: string
        }
        Update: {
          created_at?: string
          form_template_id?: string
          id?: string
          kpi_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_kpi_bindings_form_template_id_fkey"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_kpi_bindings_kpi_version_id_fkey"
            columns: ["kpi_version_id"]
            isOneToOne: false
            referencedRelation: "kpi_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_audit: {
        Row: {
          action: string
          actor_id: string | null
          agency_id: string
          at: string
          id: string
          kpi_key: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          agency_id: string
          at?: string
          id?: string
          kpi_key: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          agency_id?: string
          at?: string
          id?: string
          kpi_key?: string
          payload?: Json | null
        }
        Relationships: []
      }
      kpi_versions: {
        Row: {
          created_at: string
          id: string
          kpi_id: string
          label: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kpi_id: string
          label: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kpi_id?: string
          label?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_versions_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_versions_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "vw_active_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          agency_id: string
          archived_at: string | null
          color: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          role: Database["public"]["Enums"]["app_member_role"] | null
          type: string
        }
        Insert: {
          agency_id: string
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          role?: Database["public"]["Enums"]["app_member_role"] | null
          type: string
        }
        Update: {
          agency_id?: string
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          role?: Database["public"]["Enums"]["app_member_role"] | null
          type?: string
        }
        Relationships: []
      }
      lead_sources: {
        Row: {
          agency_id: string
          cost_per_lead_cents: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          cost_per_lead_cents?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          cost_per_lead_cents?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          updated_at?: string
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
      metrics_daily: {
        Row: {
          agency_id: string
          created_at: string
          cross_sells_uncovered: number | null
          daily_score: number | null
          date: string
          final_submission_id: string | null
          hits: number
          id: string
          is_counted_day: boolean
          is_late: boolean
          kpi_version_id: string | null
          label_at_submit: string | null
          metric_slug: string | null
          mini_reviews: number | null
          outbound_calls: number | null
          pass: boolean | null
          quoted_count: number | null
          quoted_entity: string | null
          role: Database["public"]["Enums"]["app_member_role"] | null
          sold_items: number | null
          sold_policies: number | null
          sold_premium_cents: number | null
          streak_count: number | null
          submitted_at: string | null
          talk_minutes: number | null
          team_member_id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          cross_sells_uncovered?: number | null
          daily_score?: number | null
          date: string
          final_submission_id?: string | null
          hits?: number
          id?: string
          is_counted_day?: boolean
          is_late?: boolean
          kpi_version_id?: string | null
          label_at_submit?: string | null
          metric_slug?: string | null
          mini_reviews?: number | null
          outbound_calls?: number | null
          pass?: boolean | null
          quoted_count?: number | null
          quoted_entity?: string | null
          role?: Database["public"]["Enums"]["app_member_role"] | null
          sold_items?: number | null
          sold_policies?: number | null
          sold_premium_cents?: number | null
          streak_count?: number | null
          submitted_at?: string | null
          talk_minutes?: number | null
          team_member_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          cross_sells_uncovered?: number | null
          daily_score?: number | null
          date?: string
          final_submission_id?: string | null
          hits?: number
          id?: string
          is_counted_day?: boolean
          is_late?: boolean
          kpi_version_id?: string | null
          label_at_submit?: string | null
          metric_slug?: string | null
          mini_reviews?: number | null
          outbound_calls?: number | null
          pass?: boolean | null
          quoted_count?: number | null
          quoted_entity?: string | null
          role?: Database["public"]["Enums"]["app_member_role"] | null
          sold_items?: number | null
          sold_policies?: number | null
          sold_premium_cents?: number | null
          streak_count?: number | null
          submitted_at?: string | null
          talk_minutes?: number | null
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_metrics_daily_final_submission_id"
            columns: ["final_submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_metrics_daily_final_submission_id"
            columns: ["final_submission_id"]
            isOneToOne: false
            referencedRelation: "vw_flattening_health"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "fk_metrics_daily_final_submission_id"
            columns: ["final_submission_id"]
            isOneToOne: false
            referencedRelation: "vw_submission_metrics"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "fk_metrics_daily_team_member_id"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_daily_kpi_version_id_fkey"
            columns: ["kpi_version_id"]
            isOneToOne: false
            referencedRelation: "kpi_versions"
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
      prospect_custom_field_values: {
        Row: {
          agency_id: string
          created_at: string
          field_id: string
          id: string
          owner_user_id: string
          quoted_household_detail_id: string
          updated_at: string
          value_text: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          field_id: string
          id?: string
          owner_user_id: string
          quoted_household_detail_id: string
          updated_at?: string
          value_text?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          field_id?: string
          id?: string
          owner_user_id?: string
          quoted_household_detail_id?: string
          updated_at?: string
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_custom_field_values_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "prospect_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_custom_field_values_quoted_household_detail_id_fkey"
            columns: ["quoted_household_detail_id"]
            isOneToOne: false
            referencedRelation: "quoted_household_details"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_custom_fields: {
        Row: {
          active: boolean
          agency_id: string
          created_at: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          options: string[] | null
          order_index: number
          owner_user_id: string
        }
        Insert: {
          active?: boolean
          agency_id: string
          created_at?: string
          field_key: string
          field_label: string
          field_type: string
          id?: string
          options?: string[] | null
          order_index?: number
          owner_user_id: string
        }
        Update: {
          active?: boolean
          agency_id?: string
          created_at?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          options?: string[] | null
          order_index?: number
          owner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_custom_fields_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_overrides: {
        Row: {
          agency_id: string
          created_at: string
          email: string | null
          id: string
          items_quoted: number | null
          lead_source_id: string | null
          lead_source_raw: string | null
          notes: string | null
          phone: string | null
          policies_quoted: number | null
          premium_potential_cents: number | null
          prospect_name: string | null
          quoted_household_detail_id: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          email?: string | null
          id?: string
          items_quoted?: number | null
          lead_source_id?: string | null
          lead_source_raw?: string | null
          notes?: string | null
          phone?: string | null
          policies_quoted?: number | null
          premium_potential_cents?: number | null
          prospect_name?: string | null
          quoted_household_detail_id: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          email?: string | null
          id?: string
          items_quoted?: number | null
          lead_source_id?: string | null
          lead_source_raw?: string | null
          notes?: string | null
          phone?: string | null
          policies_quoted?: number | null
          premium_potential_cents?: number | null
          prospect_name?: string | null
          quoted_household_detail_id?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_overrides_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_overrides_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_overrides_quoted_household_detail_id_fkey"
            columns: ["quoted_household_detail_id"]
            isOneToOne: false
            referencedRelation: "quoted_household_details"
            referencedColumns: ["id"]
          },
        ]
      }
      quoted_household_details: {
        Row: {
          agency_id: string | null
          created_at: string
          extras: Json | null
          household_name: string
          id: string
          items_quoted: number | null
          lead_source_id: string | null
          lead_source_label: string | null
          policies_quoted: number | null
          policy_type: string | null
          premium_potential_cents: number | null
          role: Database["public"]["Enums"]["app_member_role"] | null
          submission_id: string
          team_member_id: string | null
          work_date: string | null
          zip_code: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          extras?: Json | null
          household_name: string
          id?: string
          items_quoted?: number | null
          lead_source_id?: string | null
          lead_source_label?: string | null
          policies_quoted?: number | null
          policy_type?: string | null
          premium_potential_cents?: number | null
          role?: Database["public"]["Enums"]["app_member_role"] | null
          submission_id: string
          team_member_id?: string | null
          work_date?: string | null
          zip_code?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          extras?: Json | null
          household_name?: string
          id?: string
          items_quoted?: number | null
          lead_source_id?: string | null
          lead_source_label?: string | null
          policies_quoted?: number | null
          policy_type?: string | null
          premium_potential_cents?: number | null
          role?: Database["public"]["Enums"]["app_member_role"] | null
          submission_id?: string
          team_member_id?: string | null
          work_date?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qhd_lead_source_fk"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qhd_submission_fk"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qhd_submission_fk"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "vw_flattening_health"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "qhd_submission_fk"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "vw_submission_metrics"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      quoted_households: {
        Row: {
          agency_id: string
          created_at: string
          extras: Json | null
          form_template_id: string
          household_name: string
          id: string
          is_final: boolean | null
          is_late: boolean | null
          lead_source: string | null
          notes: string | null
          submission_id: string
          team_member_id: string
          work_date: string
          zip: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          extras?: Json | null
          form_template_id: string
          household_name: string
          id?: string
          is_final?: boolean | null
          is_late?: boolean | null
          lead_source?: string | null
          notes?: string | null
          submission_id: string
          team_member_id: string
          work_date: string
          zip?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          extras?: Json | null
          form_template_id?: string
          household_name?: string
          id?: string
          is_final?: boolean | null
          is_late?: boolean | null
          lead_source?: string | null
          notes?: string | null
          submission_id?: string
          team_member_id?: string
          work_date?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_quoted_households_submission_id"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quoted_households_submission_id"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "vw_flattening_health"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "fk_quoted_households_submission_id"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "vw_submission_metrics"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "fk_quoted_households_team_member_id"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quoted_households_form_template_id_fkey"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      roleplay_access_tokens: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          invalidated: boolean
          invalidated_at: string | null
          invalidated_reason: string | null
          session_completed: boolean | null
          session_id: string | null
          staff_email: string | null
          staff_name: string | null
          token: string
          used: boolean
          used_at: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          invalidated?: boolean
          invalidated_at?: string | null
          invalidated_reason?: string | null
          session_completed?: boolean | null
          session_id?: string | null
          staff_email?: string | null
          staff_name?: string | null
          token: string
          used?: boolean
          used_at?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          invalidated?: boolean
          invalidated_at?: string | null
          invalidated_reason?: string | null
          session_completed?: boolean | null
          session_id?: string | null
          staff_email?: string | null
          staff_name?: string | null
          token?: string
          used?: boolean
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roleplay_access_tokens_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      roleplay_sessions: {
        Row: {
          agency_id: string
          completed_at: string
          conversation_transcript: Json
          created_at: string
          created_by: string
          grading_data: Json
          id: string
          overall_score: string
          pdf_file_path: string | null
          staff_email: string
          staff_name: string
          started_at: string | null
          token_id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          completed_at?: string
          conversation_transcript: Json
          created_at?: string
          created_by: string
          grading_data: Json
          id?: string
          overall_score: string
          pdf_file_path?: string | null
          staff_email: string
          staff_name: string
          started_at?: string | null
          token_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          completed_at?: string
          conversation_transcript?: Json
          created_at?: string
          created_by?: string
          grading_data?: Json
          id?: string
          overall_score?: string
          pdf_file_path?: string | null
          staff_email?: string
          staff_name?: string
          started_at?: string | null
          token_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roleplay_sessions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleplay_sessions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: true
            referencedRelation: "roleplay_access_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      scorecard_rules: {
        Row: {
          agency_id: string
          backfill_days: number | null
          count_weekend_if_submitted: boolean | null
          counted_days: Json | null
          created_at: string
          id: string
          n_required: number | null
          recalc_past_on_change: boolean | null
          ring_metrics: string[] | null
          role: Database["public"]["Enums"]["app_member_role"]
          selected_metric_slugs: string[] | null
          selected_metrics: string[] | null
          updated_at: string
          weights: Json | null
        }
        Insert: {
          agency_id: string
          backfill_days?: number | null
          count_weekend_if_submitted?: boolean | null
          counted_days?: Json | null
          created_at?: string
          id?: string
          n_required?: number | null
          recalc_past_on_change?: boolean | null
          ring_metrics?: string[] | null
          role: Database["public"]["Enums"]["app_member_role"]
          selected_metric_slugs?: string[] | null
          selected_metrics?: string[] | null
          updated_at?: string
          weights?: Json | null
        }
        Update: {
          agency_id?: string
          backfill_days?: number | null
          count_weekend_if_submitted?: boolean | null
          counted_days?: Json | null
          created_at?: string
          id?: string
          n_required?: number | null
          recalc_past_on_change?: boolean | null
          ring_metrics?: string[] | null
          role?: Database["public"]["Enums"]["app_member_role"]
          selected_metric_slugs?: string[] | null
          selected_metrics?: string[] | null
          updated_at?: string
          weights?: Json | null
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
      sold_policy_details: {
        Row: {
          commission_amount_cents: number | null
          created_at: string
          extras: Json | null
          id: string
          lead_source_id: string | null
          policy_holder_name: string
          policy_type: string
          premium_amount_cents: number
          quoted_household_detail_id: string | null
          submission_id: string
        }
        Insert: {
          commission_amount_cents?: number | null
          created_at?: string
          extras?: Json | null
          id?: string
          lead_source_id?: string | null
          policy_holder_name: string
          policy_type: string
          premium_amount_cents?: number
          quoted_household_detail_id?: string | null
          submission_id: string
        }
        Update: {
          commission_amount_cents?: number | null
          created_at?: string
          extras?: Json | null
          id?: string
          lead_source_id?: string | null
          policy_holder_name?: string
          policy_type?: string
          premium_amount_cents?: number
          quoted_household_detail_id?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sold_policy_details_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          created_at: string
          final: boolean | null
          form_template_id: string
          id: string
          late: boolean | null
          payload_json: Json
          submission_date: string
          submitted_at: string
          superseded_at: string | null
          supersedes_id: string | null
          team_member_id: string
          work_date: string | null
        }
        Insert: {
          created_at?: string
          final?: boolean | null
          form_template_id: string
          id?: string
          late?: boolean | null
          payload_json?: Json
          submission_date: string
          submitted_at?: string
          superseded_at?: string | null
          supersedes_id?: string | null
          team_member_id: string
          work_date?: string | null
        }
        Update: {
          created_at?: string
          final?: boolean | null
          form_template_id?: string
          id?: string
          late?: boolean | null
          payload_json?: Json
          submission_date?: string
          submitted_at?: string
          superseded_at?: string | null
          supersedes_id?: string | null
          team_member_id?: string
          work_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_submissions_form_template_id"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_submissions_supersedes_id"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_submissions_supersedes_id"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "vw_flattening_health"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "fk_submissions_supersedes_id"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "vw_submission_metrics"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "fk_submissions_team_member_id"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      targets: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          metric_key: string
          team_member_id: string | null
          updated_at: string
          value_number: number
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          metric_key: string
          team_member_id?: string | null
          updated_at?: string
          value_number: number
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          metric_key?: string
          team_member_id?: string | null
          updated_at?: string
          value_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_targets_team_member_id"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          agency_id: string
          created_at: string
          email: string
          employment: Database["public"]["Enums"]["app_employment_type"]
          hybrid_team_assignments: string[] | null
          id: string
          name: string
          notes: string | null
          role: Database["public"]["Enums"]["app_member_role"]
          schedule_json: Json | null
          status: Database["public"]["Enums"]["app_member_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          email: string
          employment: Database["public"]["Enums"]["app_employment_type"]
          hybrid_team_assignments?: string[] | null
          id?: string
          name: string
          notes?: string | null
          role: Database["public"]["Enums"]["app_member_role"]
          schedule_json?: Json | null
          status?: Database["public"]["Enums"]["app_member_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          email?: string
          employment?: Database["public"]["Enums"]["app_employment_type"]
          hybrid_team_assignments?: string[] | null
          id?: string
          name?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["app_member_role"]
          schedule_json?: Json | null
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
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles_audit: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: string
          new_role: Database["public"]["Enums"]["app_role"] | null
          old_role: Database["public"]["Enums"]["app_role"] | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_role?: Database["public"]["Enums"]["app_role"] | null
          old_role?: Database["public"]["Enums"]["app_role"] | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_role?: Database["public"]["Enums"]["app_role"] | null
          old_role?: Database["public"]["Enums"]["app_role"] | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_active_kpis: {
        Row: {
          agency_id: string | null
          archived_at: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string | null
          is_active: boolean | null
          key: string | null
          label: string | null
          role: Database["public"]["Enums"]["app_member_role"] | null
          type: string | null
        }
        Relationships: []
      }
      vw_dashboard_weekly: {
        Row: {
          agency_id: string | null
          counted_days: number | null
          cross_sells_uncovered: number | null
          end_date: string | null
          mini_reviews: number | null
          outbound_calls: number | null
          pass_days: number | null
          quoted_count: number | null
          role: Database["public"]["Enums"]["app_member_role"] | null
          sold_items: number | null
          sold_policies: number | null
          sold_premium_cents: number | null
          start_date: string | null
          talk_minutes: number | null
          team_member_id: string | null
          team_member_name: string | null
          weekly_score: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_metrics_daily_team_member_id"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dashboard_yesterday: {
        Row: {
          agency_id: string | null
          cross_sells_uncovered: number | null
          daily_score: number | null
          date: string | null
          hits: number | null
          is_counted_day: boolean | null
          is_late: boolean | null
          mini_reviews: number | null
          outbound_calls: number | null
          pass: boolean | null
          quoted_count: number | null
          quoted_entity: string | null
          role: Database["public"]["Enums"]["app_member_role"] | null
          sold_items: number | null
          sold_policies: number | null
          sold_premium_cents: number | null
          streak_count: number | null
          talk_minutes: number | null
          team_member_id: string | null
          team_member_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_metrics_daily_team_member_id"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_flattening_health: {
        Row: {
          actual_records: number | null
          expected_records: number | null
          has_valid_quoted_details: boolean | null
          status: string | null
          submission_date: string | null
          submission_id: string | null
          work_date: string | null
        }
        Relationships: []
      }
      vw_flattening_summary: {
        Row: {
          failed_flattenings: number | null
          no_quoted_details: number | null
          partial_flattenings: number | null
          submissions_with_quoted_details: number | null
          success_rate_percent: number | null
          successful_flattenings: number | null
          total_actual_records: number | null
          total_expected_records: number | null
          total_submissions: number | null
        }
        Relationships: []
      }
      vw_metrics_with_team: {
        Row: {
          agency_id: string | null
          created_at: string | null
          cross_sells_uncovered: number | null
          daily_score: number | null
          date: string | null
          final_submission_id: string | null
          hits: number | null
          id: string | null
          is_counted_day: boolean | null
          is_late: boolean | null
          kpi_version_id: string | null
          label_at_submit: string | null
          metric_slug: string | null
          mini_reviews: number | null
          outbound_calls: number | null
          pass: boolean | null
          quoted_count: number | null
          quoted_entity: string | null
          rep_name: string | null
          role: Database["public"]["Enums"]["app_member_role"] | null
          sold_items: number | null
          sold_policies: number | null
          sold_premium_cents: number | null
          streak_count: number | null
          submitted_at: string | null
          talk_minutes: number | null
          team_member_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_metrics_daily_final_submission_id"
            columns: ["final_submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_metrics_daily_final_submission_id"
            columns: ["final_submission_id"]
            isOneToOne: false
            referencedRelation: "vw_flattening_health"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "fk_metrics_daily_final_submission_id"
            columns: ["final_submission_id"]
            isOneToOne: false
            referencedRelation: "vw_submission_metrics"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "fk_metrics_daily_team_member_id"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_daily_kpi_version_id_fkey"
            columns: ["kpi_version_id"]
            isOneToOne: false
            referencedRelation: "kpi_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_submission_metrics: {
        Row: {
          outbound_calls: number | null
          quoted_count: number | null
          sold_items: number | null
          submission_id: string | null
          talk_minutes: number | null
        }
        Insert: {
          outbound_calls?: never
          quoted_count?: never
          sold_items?: never
          submission_id?: string | null
          talk_minutes?: never
        }
        Update: {
          outbound_calls?: never
          quoted_count?: never
          sold_items?: never
          submission_id?: string | null
          talk_minutes?: never
        }
        Relationships: []
      }
    }
    Functions: {
      _nz_int: { Args: { v: Json }; Returns: number }
      _nz_num: { Args: { v: Json }; Returns: number }
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
      backfill_metrics_last_n_days: {
        Args: { p_agency: string; p_days: number }
        Returns: undefined
      }
      backfill_quoted_details_for_agency: {
        Args: { p_agency_id: string; p_days_back?: number }
        Returns: Json
      }
      bind_form_kpis: { Args: { p_form: string }; Returns: undefined }
      check_form_kpi_versions: {
        Args: { p_form_id: string }
        Returns: {
          bound_label: string
          bound_version_id: string
          current_label: string
          kpi_id: string
        }[]
      }
      cleanup_field_mapping_audit_logs: { Args: never; Returns: undefined }
      compute_is_late: {
        Args: {
          p_agency_id: string
          p_settings: Json
          p_submission_date: string
          p_submitted_at: string
          p_work_date: string
        }
        Returns: boolean
      }
      create_default_scorecard_rules: {
        Args: { p_agency_id: string }
        Returns: undefined
      }
      create_default_targets: {
        Args: { p_agency_id: string }
        Returns: undefined
      }
      delete_kpi_transaction: {
        Args: { p_actor_id?: string; p_agency_id: string; p_kpi_key: string }
        Returns: Json
      }
      flatten_quoted_details: {
        Args: { p_submission: string }
        Returns: undefined
      }
      flatten_quoted_household_details: {
        Args: { p_submission: string }
        Returns: undefined
      }
      flatten_quoted_household_details_enhanced: {
        Args: { p_submission_id: string }
        Returns: Json
      }
      get_agency_dates_now: { Args: { p_agency_id: string }; Returns: Json }
      get_agency_id_by_slug: { Args: { p_slug: string }; Returns: string }
      get_agency_safe: {
        Args: { agency_id_param: string }
        Returns: {
          address_city: string
          address_line1: string
          address_line2: string
          address_state: string
          address_zip: string
          agency_email: string
          agent_cell: string
          agent_name: string
          created_at: string
          description: string
          has_contact_access: boolean
          id: string
          logo_url: string
          name: string
          phone: string
          updated_at: string
        }[]
      }
      get_current_user_role: { Args: never; Returns: string }
      get_dashboard_daily:
        | {
            Args: {
              p_agency_slug: string
              p_end: string
              p_role: string
              p_start: string
            }
            Returns: {
              cross_sells_uncovered: number
              daily_score: number
              date: string
              hits: number
              kpi_version_id: string
              label_at_submit: string
              mini_reviews: number
              outbound_calls: number
              pass: boolean
              quoted_count: number
              sold_items: number
              talk_minutes: number
              team_member_id: string
              team_member_name: string
            }[]
          }
        | {
            Args: { p_agency_id: string; p_work_date: string }
            Returns: {
              cross_sells_uncovered: number
              daily_score: number
              hits: number
              is_late: boolean
              mini_reviews: number
              outbound_calls: number
              pass: boolean
              quoted_count: number
              rep_name: string
              sold_items: number
              sold_policies: number
              sold_premium_cents: number
              status: string
              talk_minutes: number
              team_member_id: string
              work_date: string
            }[]
          }
      get_sticky_fields_for_section: {
        Args: { p_section_type: string }
        Returns: {
          field_key: string
          field_label: string
          field_type: string
          is_system_required: boolean
          order_index: number
        }[]
      }
      get_target: {
        Args: { p_agency: string; p_member: string; p_metric: string }
        Returns: number
      }
      get_team_metrics_for_day: {
        Args: { p_agency: string; p_date: string; p_role: string }
        Returns: {
          cross_sells_uncovered: number
          date: string
          mini_reviews: number
          name: string
          outbound_calls: number
          quoted_count: number
          quoted_entity: string
          role: string
          sold_items: number
          sold_policies: number
          sold_premium_cents: number
          talk_minutes: number
          team_member_id: string
        }[]
      }
      get_versioned_dashboard_data:
        | {
            Args: {
              p_agency_slug: string
              p_end: string
              p_role: string
              p_start: string
            }
            Returns: {
              daily_score: number
              date: string
              hits: number
              is_late: boolean
              kpi_key: string
              kpi_label: string
              kpi_version_id: string
              pass: boolean
              team_member_id: string
              team_member_name: string
              value: number
            }[]
          }
        | {
            Args: {
              p_agency_slug: string
              p_consolidate_versions?: boolean
              p_role: string
            }
            Returns: Json
          }
      has_agency_access: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_now_agency_time: {
        Args: { p_agency_id: string; p_hhmm: string }
        Returns: Json
      }
      list_agencies_safe: {
        Args: never
        Returns: {
          created_at: string
          description: string
          has_contact_access: boolean
          id: string
          logo_url: string
          name: string
        }[]
      }
      list_agency_kpis: {
        Args: { _agency: string }
        Returns: {
          active: boolean
          kpi_id: string
          label: string
          slug: string
        }[]
      }
      list_agency_kpis_by_role: {
        Args: { _agency: string; _role?: string }
        Returns: {
          active: boolean
          kpi_id: string
          label: string
          slug: string
        }[]
      }
      recompute_streaks_for_member: {
        Args: { p_end: string; p_member: string; p_start: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      upsert_metrics_from_submission: {
        Args: {
          p_kpi_version_id?: string
          p_label_at_submit?: string
          p_submission: string
          p_submitted_at?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_employment_type: "Full-time" | "Part-time"
      app_member_role: "Sales" | "Service" | "Hybrid" | "Manager"
      app_member_status: "active" | "inactive"
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
