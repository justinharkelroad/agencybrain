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
          call_scoring_email_enabled: boolean | null
          cc_owner_on_reminders: boolean | null
          contest_board_enabled: boolean
          created_at: string
          daily_quoted_households_target: number | null
          daily_sold_items_target: number | null
          default_commission_rate: number | null
          description: string | null
          email_from: string | null
          id: string
          logo_url: string | null
          name: string
          owner_rollup_time: string | null
          phone: string | null
          reminder_times_json: Json | null
          sales_daily_summary_enabled: boolean | null
          sales_realtime_email_enabled: boolean | null
          slug: string | null
          staff_can_upload_calls: boolean | null
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
          call_scoring_email_enabled?: boolean | null
          cc_owner_on_reminders?: boolean | null
          contest_board_enabled?: boolean
          created_at?: string
          daily_quoted_households_target?: number | null
          daily_sold_items_target?: number | null
          default_commission_rate?: number | null
          description?: string | null
          email_from?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_rollup_time?: string | null
          phone?: string | null
          reminder_times_json?: Json | null
          sales_daily_summary_enabled?: boolean | null
          sales_realtime_email_enabled?: boolean | null
          slug?: string | null
          staff_can_upload_calls?: boolean | null
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
          call_scoring_email_enabled?: boolean | null
          cc_owner_on_reminders?: boolean | null
          contest_board_enabled?: boolean
          created_at?: string
          daily_quoted_households_target?: number | null
          daily_sold_items_target?: number | null
          default_commission_rate?: number | null
          description?: string | null
          email_from?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_rollup_time?: string | null
          phone?: string | null
          reminder_times_json?: Json | null
          sales_daily_summary_enabled?: boolean | null
          sales_realtime_email_enabled?: boolean | null
          slug?: string | null
          staff_can_upload_calls?: boolean | null
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
      agency_call_scoring_settings: {
        Row: {
          agency_id: string | null
          calls_limit: number | null
          created_at: string | null
          enabled: boolean | null
          id: string
          reset_day: number | null
          updated_at: string | null
        }
        Insert: {
          agency_id?: string | null
          calls_limit?: number | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          reset_day?: number | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string | null
          calls_limit?: number | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          reset_day?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_call_scoring_settings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_calls: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          agency_id: string
          agent_talk_percent: number | null
          agent_talk_seconds: number | null
          analyzed_at: string | null
          audio_storage_path: string | null
          call_duration_seconds: number | null
          call_type: Database["public"]["Enums"]["call_type_enum"] | null
          client_profile: Json | null
          closing_attempts: Json | null
          coaching_recommendations: Json | null
          conversion_attempts: number | null
          conversion_required: boolean | null
          converted_file_size_bytes: number | null
          created_at: string | null
          critical_gaps: Json | null
          customer_talk_percent: number | null
          customer_talk_seconds: number | null
          dead_air_percent: number | null
          dead_air_seconds: number | null
          discovery_wins: Json | null
          gpt_cost: number | null
          gpt_input_tokens: number | null
          gpt_output_tokens: number | null
          id: string
          missed_signals: Json | null
          notable_quotes: Json | null
          original_file_size_bytes: number | null
          original_filename: string | null
          overall_score: number | null
          potential_rank: string | null
          premium_analysis: Json | null
          section_scores: Json | null
          skill_scores: Json | null
          staff_feedback_improvement: string | null
          staff_feedback_positive: string | null
          status: string | null
          summary: string | null
          team_member_id: string
          template_id: string
          total_cost: number | null
          transcript: string | null
          transcript_segments: Json | null
          whisper_cost: number | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agency_id: string
          agent_talk_percent?: number | null
          agent_talk_seconds?: number | null
          analyzed_at?: string | null
          audio_storage_path?: string | null
          call_duration_seconds?: number | null
          call_type?: Database["public"]["Enums"]["call_type_enum"] | null
          client_profile?: Json | null
          closing_attempts?: Json | null
          coaching_recommendations?: Json | null
          conversion_attempts?: number | null
          conversion_required?: boolean | null
          converted_file_size_bytes?: number | null
          created_at?: string | null
          critical_gaps?: Json | null
          customer_talk_percent?: number | null
          customer_talk_seconds?: number | null
          dead_air_percent?: number | null
          dead_air_seconds?: number | null
          discovery_wins?: Json | null
          gpt_cost?: number | null
          gpt_input_tokens?: number | null
          gpt_output_tokens?: number | null
          id?: string
          missed_signals?: Json | null
          notable_quotes?: Json | null
          original_file_size_bytes?: number | null
          original_filename?: string | null
          overall_score?: number | null
          potential_rank?: string | null
          premium_analysis?: Json | null
          section_scores?: Json | null
          skill_scores?: Json | null
          staff_feedback_improvement?: string | null
          staff_feedback_positive?: string | null
          status?: string | null
          summary?: string | null
          team_member_id: string
          template_id: string
          total_cost?: number | null
          transcript?: string | null
          transcript_segments?: Json | null
          whisper_cost?: number | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agency_id?: string
          agent_talk_percent?: number | null
          agent_talk_seconds?: number | null
          analyzed_at?: string | null
          audio_storage_path?: string | null
          call_duration_seconds?: number | null
          call_type?: Database["public"]["Enums"]["call_type_enum"] | null
          client_profile?: Json | null
          closing_attempts?: Json | null
          coaching_recommendations?: Json | null
          conversion_attempts?: number | null
          conversion_required?: boolean | null
          converted_file_size_bytes?: number | null
          created_at?: string | null
          critical_gaps?: Json | null
          customer_talk_percent?: number | null
          customer_talk_seconds?: number | null
          dead_air_percent?: number | null
          dead_air_seconds?: number | null
          discovery_wins?: Json | null
          gpt_cost?: number | null
          gpt_input_tokens?: number | null
          gpt_output_tokens?: number | null
          id?: string
          missed_signals?: Json | null
          notable_quotes?: Json | null
          original_file_size_bytes?: number | null
          original_filename?: string | null
          overall_score?: number | null
          potential_rank?: string | null
          premium_analysis?: Json | null
          section_scores?: Json | null
          skill_scores?: Json | null
          staff_feedback_improvement?: string | null
          staff_feedback_positive?: string | null
          status?: string | null
          summary?: string | null
          team_member_id?: string
          template_id?: string
          total_cost?: number | null
          transcript?: string | null
          transcript_segments?: Json | null
          whisper_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_calls_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_calls_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_calls_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "call_scoring_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_comp_settings: {
        Row: {
          aap_level: string
          agency_id: string
          agency_tier: string | null
          created_at: string | null
          id: string
          pif_count: number | null
          state: string
          updated_at: string | null
        }
        Insert: {
          aap_level?: string
          agency_id: string
          agency_tier?: string | null
          created_at?: string | null
          id?: string
          pif_count?: number | null
          state?: string
          updated_at?: string | null
        }
        Update: {
          aap_level?: string
          agency_id?: string
          agency_tier?: string | null
          created_at?: string | null
          id?: string
          pif_count?: number | null
          state?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_comp_settings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
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
      bonus_forecast_inputs: {
        Row: {
          agency_id: string
          created_at: string | null
          id: string
          inputs_json: Json
          updated_at: string | null
          updated_by: string | null
          updated_by_name: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          id?: string
          inputs_json?: Json
          updated_at?: string | null
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          id?: string
          inputs_json?: Json
          updated_at?: string | null
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bonus_forecast_inputs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
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
      call_scoring_templates: {
        Row: {
          agency_id: string | null
          call_type: Database["public"]["Enums"]["call_type_enum"] | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_global: boolean | null
          name: string
          output_schema: Json | null
          skill_categories: Json
          system_prompt: string
          updated_at: string | null
        }
        Insert: {
          agency_id?: string | null
          call_type?: Database["public"]["Enums"]["call_type_enum"] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          name: string
          output_schema?: Json | null
          skill_categories?: Json
          system_prompt: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string | null
          call_type?: Database["public"]["Enums"]["call_type_enum"] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          name?: string
          output_schema?: Json | null
          skill_categories?: Json
          system_prompt?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_scoring_templates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      call_usage_tracking: {
        Row: {
          agency_id: string
          billing_period_end: string
          billing_period_start: string
          calls_limit: number
          calls_used: number | null
          created_at: string | null
          id: string
          period_end: string | null
          period_start: string | null
          reset_day: number | null
        }
        Insert: {
          agency_id: string
          billing_period_end: string
          billing_period_start: string
          calls_limit: number
          calls_used?: number | null
          created_at?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          reset_day?: number | null
        }
        Update: {
          agency_id?: string
          billing_period_end?: string
          billing_period_start?: string
          calls_limit?: number
          calls_used?: number | null
          created_at?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          reset_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_usage_tracking_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      cancel_audit_activities: {
        Row: {
          activity_type: string
          agency_id: string
          created_at: string
          household_key: string
          id: string
          notes: string | null
          record_id: string
          staff_member_id: string | null
          user_display_name: string
          user_id: string | null
        }
        Insert: {
          activity_type: string
          agency_id: string
          created_at?: string
          household_key: string
          id?: string
          notes?: string | null
          record_id: string
          staff_member_id?: string | null
          user_display_name: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          agency_id?: string
          created_at?: string
          household_key?: string
          id?: string
          notes?: string | null
          record_id?: string
          staff_member_id?: string | null
          user_display_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cancel_audit_activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancel_audit_activities_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "cancel_audit_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancel_audit_activities_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      cancel_audit_records: {
        Row: {
          account_type: string | null
          agency_id: string
          agent_number: string | null
          amount_due_cents: number | null
          assigned_team_member_id: string | null
          cancel_date: string | null
          cancel_status: string | null
          created_at: string
          household_key: string
          id: string
          insured_email: string | null
          insured_first_name: string | null
          insured_last_name: string | null
          insured_phone: string | null
          insured_phone_alt: string | null
          is_active: boolean
          last_upload_id: string | null
          no_of_items: number | null
          pending_cancel_date: string | null
          policy_number: string
          premium_cents: number | null
          product_name: string | null
          renewal_effective_date: string | null
          report_type: string
          status: string
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          agency_id: string
          agent_number?: string | null
          amount_due_cents?: number | null
          assigned_team_member_id?: string | null
          cancel_date?: string | null
          cancel_status?: string | null
          created_at?: string
          household_key: string
          id?: string
          insured_email?: string | null
          insured_first_name?: string | null
          insured_last_name?: string | null
          insured_phone?: string | null
          insured_phone_alt?: string | null
          is_active?: boolean
          last_upload_id?: string | null
          no_of_items?: number | null
          pending_cancel_date?: string | null
          policy_number: string
          premium_cents?: number | null
          product_name?: string | null
          renewal_effective_date?: string | null
          report_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          agency_id?: string
          agent_number?: string | null
          amount_due_cents?: number | null
          assigned_team_member_id?: string | null
          cancel_date?: string | null
          cancel_status?: string | null
          created_at?: string
          household_key?: string
          id?: string
          insured_email?: string | null
          insured_first_name?: string | null
          insured_last_name?: string | null
          insured_phone?: string | null
          insured_phone_alt?: string | null
          is_active?: boolean
          last_upload_id?: string | null
          no_of_items?: number | null
          pending_cancel_date?: string | null
          policy_number?: string
          premium_cents?: number | null
          product_name?: string | null
          renewal_effective_date?: string | null
          report_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancel_audit_records_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancel_audit_records_assigned_team_member_id_fkey"
            columns: ["assigned_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      cancel_audit_uploads: {
        Row: {
          agency_id: string
          created_at: string
          file_name: string | null
          id: string
          records_created: number
          records_processed: number
          records_updated: number
          report_type: string
          uploaded_by_name: string
          uploaded_by_staff_id: string | null
          uploaded_by_user_id: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          file_name?: string | null
          id?: string
          records_created?: number
          records_processed?: number
          records_updated?: number
          report_type: string
          uploaded_by_name: string
          uploaded_by_staff_id?: string | null
          uploaded_by_user_id?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          file_name?: string | null
          id?: string
          records_created?: number
          records_processed?: number
          records_updated?: number
          report_type?: string
          uploaded_by_name?: string
          uploaded_by_staff_id?: string | null
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cancel_audit_uploads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancel_audit_uploads_uploaded_by_staff_id_fkey"
            columns: ["uploaded_by_staff_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_conversations: {
        Row: {
          agency_id: string | null
          created_at: string | null
          current_page: string | null
          id: string
          messages: Json | null
          portal: string
          staff_user_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string | null
          current_page?: string | null
          id?: string
          messages?: Json | null
          portal?: string
          staff_user_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string | null
          current_page?: string | null
          id?: string
          messages?: Json | null
          portal?: string
          staff_user_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_conversations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_conversations_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_faqs: {
        Row: {
          answer: string
          applies_to_portals: string[] | null
          applies_to_roles: string[] | null
          applies_to_tiers: string[] | null
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          page_context: string[] | null
          priority: number | null
          question: string
          updated_at: string | null
        }
        Insert: {
          answer: string
          applies_to_portals?: string[] | null
          applies_to_roles?: string[] | null
          applies_to_tiers?: string[] | null
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          page_context?: string[] | null
          priority?: number | null
          question: string
          updated_at?: string | null
        }
        Update: {
          answer?: string
          applies_to_portals?: string[] | null
          applies_to_roles?: string[] | null
          applies_to_tiers?: string[] | null
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          page_context?: string[] | null
          priority?: number | null
          question?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      chatbot_knowledge_base: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          version?: number
        }
        Relationships: []
      }
      chatbot_proactive_tips: {
        Row: {
          applies_to_portals: string[] | null
          applies_to_tiers: string[] | null
          created_at: string | null
          delay_seconds: number | null
          id: string
          is_active: boolean | null
          page_route: string
          sort_order: number | null
          suggested_question: string | null
          tip_message: string
          updated_at: string | null
        }
        Insert: {
          applies_to_portals?: string[] | null
          applies_to_tiers?: string[] | null
          created_at?: string | null
          delay_seconds?: number | null
          id?: string
          is_active?: boolean | null
          page_route: string
          sort_order?: number | null
          suggested_question?: string | null
          tip_message: string
          updated_at?: string | null
        }
        Update: {
          applies_to_portals?: string[] | null
          applies_to_tiers?: string[] | null
          created_at?: string | null
          delay_seconds?: number | null
          id?: string
          is_active?: boolean | null
          page_route?: string
          sort_order?: number | null
          suggested_question?: string | null
          tip_message?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      chatbot_suggested_questions: {
        Row: {
          applies_to_portals: string[] | null
          created_at: string | null
          id: string
          is_active: boolean | null
          page_route: string
          question: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          applies_to_portals?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          page_route: string
          question: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          applies_to_portals?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          page_route?: string
          question?: string
          sort_order?: number | null
          updated_at?: string | null
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
      comp_comparison_reports: {
        Row: {
          agency_id: string
          comparison_data: Json
          created_at: string | null
          created_by: string | null
          current_upload_id: string
          discrepancies_found: number | null
          id: string
          potential_underpayment_cents: number | null
          prior_upload_id: string
          summary_data: Json
        }
        Insert: {
          agency_id: string
          comparison_data: Json
          created_at?: string | null
          created_by?: string | null
          current_upload_id: string
          discrepancies_found?: number | null
          id?: string
          potential_underpayment_cents?: number | null
          prior_upload_id: string
          summary_data: Json
        }
        Update: {
          agency_id?: string
          comparison_data?: Json
          created_at?: string | null
          created_by?: string | null
          current_upload_id?: string
          discrepancies_found?: number | null
          id?: string
          potential_underpayment_cents?: number | null
          prior_upload_id?: string
          summary_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "comp_comparison_reports_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comp_comparison_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comp_comparison_reports_current_upload_id_fkey"
            columns: ["current_upload_id"]
            isOneToOne: false
            referencedRelation: "comp_statement_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comp_comparison_reports_prior_upload_id_fkey"
            columns: ["prior_upload_id"]
            isOneToOne: false
            referencedRelation: "comp_statement_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      comp_payouts: {
        Row: {
          agency_id: string
          base_commission: number | null
          bonus_amount: number | null
          chargeback_count: number | null
          chargeback_premium: number | null
          comp_plan_id: string | null
          created_at: string | null
          finalized_at: string | null
          id: string
          issued_items: number | null
          issued_points: number | null
          issued_policies: number | null
          issued_premium: number | null
          net_items: number | null
          net_premium: number | null
          paid_at: string | null
          period_month: number
          period_year: number
          rollover_premium: number | null
          status: string | null
          team_member_id: string
          tier_commission_value: number | null
          tier_threshold_met: number | null
          total_payout: number | null
          updated_at: string | null
          written_households: number | null
          written_items: number | null
          written_points: number | null
          written_policies: number | null
          written_premium: number | null
        }
        Insert: {
          agency_id: string
          base_commission?: number | null
          bonus_amount?: number | null
          chargeback_count?: number | null
          chargeback_premium?: number | null
          comp_plan_id?: string | null
          created_at?: string | null
          finalized_at?: string | null
          id?: string
          issued_items?: number | null
          issued_points?: number | null
          issued_policies?: number | null
          issued_premium?: number | null
          net_items?: number | null
          net_premium?: number | null
          paid_at?: string | null
          period_month: number
          period_year: number
          rollover_premium?: number | null
          status?: string | null
          team_member_id: string
          tier_commission_value?: number | null
          tier_threshold_met?: number | null
          total_payout?: number | null
          updated_at?: string | null
          written_households?: number | null
          written_items?: number | null
          written_points?: number | null
          written_policies?: number | null
          written_premium?: number | null
        }
        Update: {
          agency_id?: string
          base_commission?: number | null
          bonus_amount?: number | null
          chargeback_count?: number | null
          chargeback_premium?: number | null
          comp_plan_id?: string | null
          created_at?: string | null
          finalized_at?: string | null
          id?: string
          issued_items?: number | null
          issued_points?: number | null
          issued_policies?: number | null
          issued_premium?: number | null
          net_items?: number | null
          net_premium?: number | null
          paid_at?: string | null
          period_month?: number
          period_year?: number
          rollover_premium?: number | null
          status?: string | null
          team_member_id?: string
          tier_commission_value?: number | null
          tier_threshold_met?: number | null
          total_payout?: number | null
          updated_at?: string | null
          written_households?: number | null
          written_items?: number | null
          written_points?: number | null
          written_policies?: number | null
          written_premium?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comp_payouts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comp_payouts_comp_plan_id_fkey"
            columns: ["comp_plan_id"]
            isOneToOne: false
            referencedRelation: "comp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comp_payouts_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      comp_plan_assignments: {
        Row: {
          comp_plan_id: string
          created_at: string | null
          effective_date: string
          end_date: string | null
          id: string
          team_member_id: string
        }
        Insert: {
          comp_plan_id: string
          created_at?: string | null
          effective_date?: string
          end_date?: string | null
          id?: string
          team_member_id: string
        }
        Update: {
          comp_plan_id?: string
          created_at?: string | null
          effective_date?: string
          end_date?: string | null
          id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comp_plan_assignments_comp_plan_id_fkey"
            columns: ["comp_plan_id"]
            isOneToOne: false
            referencedRelation: "comp_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comp_plan_assignments_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      comp_plan_brokered_tiers: {
        Row: {
          commission_value: number
          comp_plan_id: string
          created_at: string | null
          id: string
          min_threshold: number
          sort_order: number
        }
        Insert: {
          commission_value?: number
          comp_plan_id: string
          created_at?: string | null
          id?: string
          min_threshold?: number
          sort_order?: number
        }
        Update: {
          commission_value?: number
          comp_plan_id?: string
          created_at?: string | null
          id?: string
          min_threshold?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "comp_plan_brokered_tiers_comp_plan_id_fkey"
            columns: ["comp_plan_id"]
            isOneToOne: false
            referencedRelation: "comp_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      comp_plan_tiers: {
        Row: {
          commission_value: number
          comp_plan_id: string
          created_at: string | null
          id: string
          min_threshold: number
          sort_order: number
        }
        Insert: {
          commission_value: number
          comp_plan_id: string
          created_at?: string | null
          id?: string
          min_threshold: number
          sort_order?: number
        }
        Update: {
          commission_value?: number
          comp_plan_id?: string
          created_at?: string | null
          id?: string
          min_threshold?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "comp_plan_tiers_comp_plan_id_fkey"
            columns: ["comp_plan_id"]
            isOneToOne: false
            referencedRelation: "comp_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      comp_plans: {
        Row: {
          agency_id: string
          brokered_counts_toward_tier: boolean | null
          brokered_flat_rate: number | null
          brokered_payout_type: string | null
          chargeback_rule: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          payout_type: string
          policy_type_filter: string[] | null
          tier_metric: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          brokered_counts_toward_tier?: boolean | null
          brokered_flat_rate?: number | null
          brokered_payout_type?: string | null
          chargeback_rule?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payout_type?: string
          policy_type_filter?: string[] | null
          tier_metric?: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          brokered_counts_toward_tier?: boolean | null
          brokered_flat_rate?: number | null
          brokered_payout_type?: string | null
          chargeback_rule?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payout_type?: string
          policy_type_filter?: string[] | null
          tier_metric?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comp_plans_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      comp_statement_uploads: {
        Row: {
          agency_id: string
          file_size_bytes: number | null
          filename: string
          id: string
          statement_month: number
          statement_year: number
          storage_path: string
          uploaded_at: string | null
          uploaded_by: string | null
          vc_baseline_achieved: boolean | null
        }
        Insert: {
          agency_id: string
          file_size_bytes?: number | null
          filename: string
          id?: string
          statement_month: number
          statement_year: number
          storage_path: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          vc_baseline_achieved?: boolean | null
        }
        Update: {
          agency_id?: string
          file_size_bytes?: number | null
          filename?: string
          id?: string
          statement_month?: number
          statement_year?: number
          storage_path?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          vc_baseline_achieved?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "comp_statement_uploads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comp_statement_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      core4_entries: {
        Row: {
          balance_completed: boolean | null
          balance_note: string | null
          being_completed: boolean | null
          being_note: string | null
          body_completed: boolean | null
          body_note: string | null
          business_completed: boolean | null
          business_note: string | null
          created_at: string | null
          date: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance_completed?: boolean | null
          balance_note?: string | null
          being_completed?: boolean | null
          being_note?: string | null
          body_completed?: boolean | null
          body_note?: string | null
          business_completed?: boolean | null
          business_note?: string | null
          created_at?: string | null
          date?: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance_completed?: boolean | null
          balance_note?: string | null
          being_completed?: boolean | null
          being_note?: string | null
          body_completed?: boolean | null
          body_note?: string | null
          business_completed?: boolean | null
          business_note?: string | null
          created_at?: string | null
          date?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      core4_monthly_missions: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          items: Json | null
          month_year: string
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
          weekly_measurable: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: string
          items?: Json | null
          month_year: string
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          weekly_measurable?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          items?: Json | null
          month_year?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          weekly_measurable?: string | null
        }
        Relationships: []
      }
      custom_detail_collections: {
        Row: {
          agency_id: string
          controlling_kpi_key: string | null
          created_at: string | null
          description: string | null
          field_order: number | null
          form_template_id: string
          id: string
          is_enabled: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          controlling_kpi_key?: string | null
          created_at?: string | null
          description?: string | null
          field_order?: number | null
          form_template_id: string
          id?: string
          is_enabled?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          controlling_kpi_key?: string | null
          created_at?: string | null
          description?: string | null
          field_order?: number | null
          form_template_id?: string
          id?: string
          is_enabled?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_detail_collections_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_detail_collections_form_template_id_fkey"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_detail_entries: {
        Row: {
          agency_id: string
          collection_id: string
          created_at: string | null
          entry_index: number
          field_values: Json
          id: string
          submission_id: string
          team_member_id: string
          updated_at: string | null
          work_date: string
        }
        Insert: {
          agency_id: string
          collection_id: string
          created_at?: string | null
          entry_index: number
          field_values: Json
          id?: string
          submission_id: string
          team_member_id: string
          updated_at?: string | null
          work_date: string
        }
        Update: {
          agency_id?: string
          collection_id?: string
          created_at?: string | null
          entry_index?: number
          field_values?: Json
          id?: string
          submission_id?: string
          team_member_id?: string
          updated_at?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_detail_entries_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_detail_entries_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "custom_detail_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_detail_entries_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_detail_entries_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "vw_flattening_health"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "custom_detail_entries_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "vw_submission_metrics"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "custom_detail_entries_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_detail_fields: {
        Row: {
          collection_id: string
          created_at: string | null
          field_key: string
          field_order: number | null
          field_type: string
          id: string
          is_required: boolean | null
          label: string
          options: Json | null
          updated_at: string | null
        }
        Insert: {
          collection_id: string
          created_at?: string | null
          field_key: string
          field_order?: number | null
          field_type: string
          id?: string
          is_required?: boolean | null
          label: string
          options?: Json | null
          updated_at?: string | null
        }
        Update: {
          collection_id?: string
          created_at?: string | null
          field_key?: string
          field_order?: number | null
          field_type?: string
          id?: string
          is_required?: boolean | null
          label?: string
          options?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_detail_fields_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "custom_detail_collections"
            referencedColumns: ["id"]
          },
        ]
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
      exchange_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "exchange_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "exchange_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_comments_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          participant_one: string
          participant_two: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          participant_one: string
          participant_two: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          participant_one?: string
          participant_two?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_conversations_participant_one_profiles_fkey"
            columns: ["participant_one"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_conversations_participant_two_profiles_fkey"
            columns: ["participant_two"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "exchange_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_likes_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          file_name: string | null
          file_path: string | null
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "exchange_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_messages_sender_id_profiles_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_post_tags: {
        Row: {
          id: string
          post_id: string
          tag_id: string
        }
        Insert: {
          id?: string
          post_id: string
          tag_id: string
        }
        Update: {
          id?: string
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "exchange_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "exchange_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_post_views: {
        Row: {
          id: string
          post_id: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "exchange_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_post_views_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_posts: {
        Row: {
          agency_id: string | null
          content_text: string | null
          content_type: string
          created_at: string | null
          external_url: string | null
          file_name: string | null
          file_path: string | null
          id: string
          is_admin_post: boolean | null
          is_pinned: boolean | null
          pinned_at: string | null
          pinned_by: string | null
          private_recipient_id: string | null
          source_reference: Json | null
          updated_at: string | null
          user_id: string
          visibility: Database["public"]["Enums"]["exchange_visibility"]
        }
        Insert: {
          agency_id?: string | null
          content_text?: string | null
          content_type: string
          created_at?: string | null
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          is_admin_post?: boolean | null
          is_pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
          private_recipient_id?: string | null
          source_reference?: Json | null
          updated_at?: string | null
          user_id: string
          visibility?: Database["public"]["Enums"]["exchange_visibility"]
        }
        Update: {
          agency_id?: string | null
          content_text?: string | null
          content_type?: string
          created_at?: string | null
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          is_admin_post?: boolean | null
          is_pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
          private_recipient_id?: string | null
          source_reference?: Json | null
          updated_at?: string | null
          user_id?: string
          visibility?: Database["public"]["Enums"]["exchange_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "exchange_posts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_posts_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_reports: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          reason: string
          reporter_user_id: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          reason: string
          reporter_user_id: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          reason?: string
          reporter_user_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "exchange_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_reports_reporter_user_id_profiles_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_tags: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      exchange_user_activity: {
        Row: {
          created_at: string | null
          id: string
          last_feed_view: string | null
          last_notifications_view: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_feed_view?: string | null
          last_notifications_view?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_feed_view?: string | null
          last_notifications_view?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_user_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
      flow_challenge_logs: {
        Row: {
          ai_challenge: string | null
          created_at: string | null
          id: string
          original_response: string | null
          question_id: string
          revised_response: string | null
          session_id: string
          user_action: string | null
        }
        Insert: {
          ai_challenge?: string | null
          created_at?: string | null
          id?: string
          original_response?: string | null
          question_id: string
          revised_response?: string | null
          session_id: string
          user_action?: string | null
        }
        Update: {
          ai_challenge?: string | null
          created_at?: string | null
          id?: string
          original_response?: string | null
          question_id?: string
          revised_response?: string | null
          session_id?: string
          user_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_challenge_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "flow_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_profiles: {
        Row: {
          accountability_style: string | null
          background_notes: string | null
          core_values: string[] | null
          created_at: string | null
          current_challenges: string | null
          current_goals: string | null
          faith_tradition: string | null
          feedback_preference: string | null
          full_name: string | null
          growth_edge: string | null
          id: string
          life_roles: string[] | null
          overwhelm_response: string | null
          peak_state: string | null
          preferred_name: string | null
          spiritual_beliefs: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accountability_style?: string | null
          background_notes?: string | null
          core_values?: string[] | null
          created_at?: string | null
          current_challenges?: string | null
          current_goals?: string | null
          faith_tradition?: string | null
          feedback_preference?: string | null
          full_name?: string | null
          growth_edge?: string | null
          id?: string
          life_roles?: string[] | null
          overwhelm_response?: string | null
          peak_state?: string | null
          preferred_name?: string | null
          spiritual_beliefs?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accountability_style?: string | null
          background_notes?: string | null
          core_values?: string[] | null
          created_at?: string | null
          current_challenges?: string | null
          current_goals?: string | null
          faith_tradition?: string | null
          feedback_preference?: string | null
          full_name?: string | null
          growth_edge?: string | null
          id?: string
          life_roles?: string[] | null
          overwhelm_response?: string | null
          peak_state?: string | null
          preferred_name?: string | null
          spiritual_beliefs?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      flow_sessions: {
        Row: {
          ai_analysis_json: Json | null
          completed_at: string | null
          created_at: string | null
          domain: string | null
          flow_template_id: string
          id: string
          pdf_url: string | null
          responses_json: Json
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_analysis_json?: Json | null
          completed_at?: string | null
          created_at?: string | null
          domain?: string | null
          flow_template_id: string
          id?: string
          pdf_url?: string | null
          responses_json?: Json
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_analysis_json?: Json | null
          completed_at?: string | null
          created_at?: string | null
          domain?: string | null
          flow_template_id?: string
          id?: string
          pdf_url?: string | null
          responses_json?: Json
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_sessions_flow_template_id_fkey"
            columns: ["flow_template_id"]
            isOneToOne: false
            referencedRelation: "flow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_templates: {
        Row: {
          ai_analysis_prompt: string | null
          ai_challenge_enabled: boolean | null
          ai_challenge_intensity: string | null
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          questions_json: Json
          slug: string
          updated_at: string | null
        }
        Insert: {
          ai_analysis_prompt?: string | null
          ai_challenge_enabled?: boolean | null
          ai_challenge_intensity?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          questions_json?: Json
          slug: string
          updated_at?: string | null
        }
        Update: {
          ai_analysis_prompt?: string | null
          ai_challenge_enabled?: boolean | null
          ai_challenge_intensity?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          questions_json?: Json
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      focus_items: {
        Row: {
          agency_id: string | null
          column_order: number
          column_status: string
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          priority_level: string
          source_name: string | null
          source_session_id: string | null
          source_type: string | null
          team_member_id: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agency_id?: string | null
          column_order?: number
          column_status?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority_level: string
          source_name?: string | null
          source_session_id?: string | null
          source_type?: string | null
          team_member_id?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agency_id?: string | null
          column_order?: number
          column_status?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority_level?: string
          source_name?: string | null
          source_session_id?: string | null
          source_type?: string | null
          team_member_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "focus_items_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_items_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_items_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
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
            isOneToOne: true
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
      help_videos: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          placement_description: string | null
          title: string
          updated_at: string | null
          url: string
          video_key: string
          video_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          placement_description?: string | null
          title: string
          updated_at?: string | null
          url?: string
          video_key: string
          video_type?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          placement_description?: string | null
          title?: string
          updated_at?: string | null
          url?: string
          video_key?: string
          video_type?: string
        }
        Relationships: []
      }
      key_employee_invites: {
        Row: {
          accepted_at: string | null
          agency_id: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          agency_id: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          agency_id?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_employee_invites_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      key_employees: {
        Row: {
          agency_id: string
          created_at: string | null
          id: string
          invited_by: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          id?: string
          invited_by: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          id?: string
          invited_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_employees_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
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
      kpi_definitions: {
        Row: {
          applicable_roles: string[]
          category: string
          created_at: string | null
          id: string
          is_active: boolean
          label: string
          slug: string
          sort_order: number
          type: string
        }
        Insert: {
          applicable_roles: string[]
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          label: string
          slug: string
          sort_order?: number
          type?: string
        }
        Update: {
          applicable_roles?: string[]
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          slug?: string
          sort_order?: number
          type?: string
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
          kpi_definition_id: string | null
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
          kpi_definition_id?: string | null
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
          kpi_definition_id?: string | null
          label?: string
          role?: Database["public"]["Enums"]["app_member_role"] | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpis_kpi_definition_id_fkey"
            columns: ["kpi_definition_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_source_monthly_spend: {
        Row: {
          agency_id: string
          cost_per_unit_cents: number
          created_at: string
          id: string
          lead_source_id: string
          month: string
          notes: string | null
          total_spend_cents: number
          units_count: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          cost_per_unit_cents?: number
          created_at?: string
          id?: string
          lead_source_id: string
          month: string
          notes?: string | null
          total_spend_cents?: number
          units_count?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          cost_per_unit_cents?: number
          created_at?: string
          id?: string
          lead_source_id?: string
          month?: string
          notes?: string | null
          total_spend_cents?: number
          units_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_source_monthly_spend_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_source_monthly_spend_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          agency_id: string
          bucket_id: string | null
          cost_per_lead_cents: number
          cost_type: string
          created_at: string
          id: string
          is_active: boolean
          is_self_generated: boolean
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          bucket_id?: string | null
          cost_per_lead_cents?: number
          cost_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_self_generated?: boolean
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          bucket_id?: string | null
          cost_per_lead_cents?: number
          cost_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_self_generated?: boolean
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "marketing_buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      life_targets_brainstorm: {
        Row: {
          clarity_score: number | null
          created_at: string
          domain: string
          id: string
          is_primary: boolean | null
          is_selected: boolean | null
          quarter: string
          rewritten_target: string | null
          session_id: string | null
          target_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clarity_score?: number | null
          created_at?: string
          domain: string
          id?: string
          is_primary?: boolean | null
          is_selected?: boolean | null
          quarter: string
          rewritten_target?: string | null
          session_id?: string | null
          target_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clarity_score?: number | null
          created_at?: string
          domain?: string
          id?: string
          is_primary?: boolean | null
          is_selected?: boolean | null
          quarter?: string
          rewritten_target?: string | null
          session_id?: string | null
          target_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      life_targets_quarterly: {
        Row: {
          balance_daily_actions: Json | null
          balance_daily_habit: string | null
          balance_monthly_missions: Json | null
          balance_narrative: string | null
          balance_narrative2: string | null
          balance_primary_is_target1: boolean | null
          balance_target: string | null
          balance_target2: string | null
          being_daily_actions: Json | null
          being_daily_habit: string | null
          being_monthly_missions: Json | null
          being_narrative: string | null
          being_narrative2: string | null
          being_primary_is_target1: boolean | null
          being_target: string | null
          being_target2: string | null
          body_daily_actions: Json | null
          body_daily_habit: string | null
          body_monthly_missions: Json | null
          body_narrative: string | null
          body_narrative2: string | null
          body_primary_is_target1: boolean | null
          body_target: string | null
          body_target2: string | null
          business_daily_actions: Json | null
          business_daily_habit: string | null
          business_monthly_missions: Json | null
          business_narrative: string | null
          business_narrative2: string | null
          business_primary_is_target1: boolean | null
          business_target: string | null
          business_target2: string | null
          created_at: string
          id: string
          quarter: string
          raw_session_data: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_daily_actions?: Json | null
          balance_daily_habit?: string | null
          balance_monthly_missions?: Json | null
          balance_narrative?: string | null
          balance_narrative2?: string | null
          balance_primary_is_target1?: boolean | null
          balance_target?: string | null
          balance_target2?: string | null
          being_daily_actions?: Json | null
          being_daily_habit?: string | null
          being_monthly_missions?: Json | null
          being_narrative?: string | null
          being_narrative2?: string | null
          being_primary_is_target1?: boolean | null
          being_target?: string | null
          being_target2?: string | null
          body_daily_actions?: Json | null
          body_daily_habit?: string | null
          body_monthly_missions?: Json | null
          body_narrative?: string | null
          body_narrative2?: string | null
          body_primary_is_target1?: boolean | null
          body_target?: string | null
          body_target2?: string | null
          business_daily_actions?: Json | null
          business_daily_habit?: string | null
          business_monthly_missions?: Json | null
          business_narrative?: string | null
          business_narrative2?: string | null
          business_primary_is_target1?: boolean | null
          business_target?: string | null
          business_target2?: string | null
          created_at?: string
          id?: string
          quarter: string
          raw_session_data?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_daily_actions?: Json | null
          balance_daily_habit?: string | null
          balance_monthly_missions?: Json | null
          balance_narrative?: string | null
          balance_narrative2?: string | null
          balance_primary_is_target1?: boolean | null
          balance_target?: string | null
          balance_target2?: string | null
          being_daily_actions?: Json | null
          being_daily_habit?: string | null
          being_monthly_missions?: Json | null
          being_narrative?: string | null
          being_narrative2?: string | null
          being_primary_is_target1?: boolean | null
          being_target?: string | null
          being_target2?: string | null
          body_daily_actions?: Json | null
          body_daily_habit?: string | null
          body_monthly_missions?: Json | null
          body_narrative?: string | null
          body_narrative2?: string | null
          body_primary_is_target1?: boolean | null
          body_target?: string | null
          body_target2?: string | null
          business_daily_actions?: Json | null
          business_daily_habit?: string | null
          business_monthly_missions?: Json | null
          business_narrative?: string | null
          business_narrative2?: string | null
          business_primary_is_target1?: boolean | null
          business_target?: string | null
          business_target2?: string | null
          created_at?: string
          id?: string
          quarter?: string
          raw_session_data?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lqs_households: {
        Row: {
          agency_id: string
          created_at: string
          email: string | null
          first_name: string
          first_quote_date: string | null
          household_key: string
          id: string
          last_name: string
          lead_received_date: string | null
          lead_source_id: string | null
          needs_attention: boolean
          phone: string[] | null
          products_interested: string[] | null
          sold_date: string | null
          status: string
          team_member_id: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          email?: string | null
          first_name: string
          first_quote_date?: string | null
          household_key: string
          id?: string
          last_name: string
          lead_received_date?: string | null
          lead_source_id?: string | null
          needs_attention?: boolean
          phone?: string[] | null
          products_interested?: string[] | null
          sold_date?: string | null
          status?: string
          team_member_id?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          email?: string | null
          first_name?: string
          first_quote_date?: string | null
          household_key?: string
          id?: string
          last_name?: string
          lead_received_date?: string | null
          lead_source_id?: string | null
          needs_attention?: boolean
          phone?: string[] | null
          products_interested?: string[] | null
          sold_date?: string | null
          status?: string
          team_member_id?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lqs_households_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lqs_households_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lqs_households_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      lqs_quotes: {
        Row: {
          agency_id: string
          created_at: string
          household_id: string
          id: string
          issued_policy_number: string | null
          items_quoted: number
          premium_cents: number
          product_type: string
          quote_date: string
          source: string
          source_reference_id: string | null
          team_member_id: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          household_id: string
          id?: string
          issued_policy_number?: string | null
          items_quoted?: number
          premium_cents?: number
          product_type: string
          quote_date: string
          source?: string
          source_reference_id?: string | null
          team_member_id?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          household_id?: string
          id?: string
          issued_policy_number?: string | null
          items_quoted?: number
          premium_cents?: number
          product_type?: string
          quote_date?: string
          source?: string
          source_reference_id?: string | null
          team_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lqs_quotes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lqs_quotes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "lqs_households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lqs_quotes_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      lqs_sales: {
        Row: {
          agency_id: string
          created_at: string
          household_id: string
          id: string
          items_sold: number
          linked_quote_id: string | null
          policies_sold: number
          policy_number: string | null
          premium_cents: number
          product_type: string
          sale_date: string
          source: string
          source_reference_id: string | null
          team_member_id: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          household_id: string
          id?: string
          items_sold?: number
          linked_quote_id?: string | null
          policies_sold?: number
          policy_number?: string | null
          premium_cents?: number
          product_type: string
          sale_date: string
          source?: string
          source_reference_id?: string | null
          team_member_id?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          household_id?: string
          id?: string
          items_sold?: number
          linked_quote_id?: string | null
          policies_sold?: number
          policy_number?: string | null
          premium_cents?: number
          product_type?: string
          sale_date?: string
          source?: string
          source_reference_id?: string | null
          team_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lqs_sales_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lqs_sales_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "lqs_households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lqs_sales_linked_quote_id_fkey"
            columns: ["linked_quote_id"]
            isOneToOne: false
            referencedRelation: "lqs_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lqs_sales_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_buckets: {
        Row: {
          agency_id: string
          commission_rate_percent: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          commission_rate_percent?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          commission_rate_percent?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_buckets_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_frames: {
        Row: {
          agency_id: string
          call_log_data: Json | null
          call_scoring_data: Json | null
          created_at: string | null
          created_by: string
          end_date: string
          id: string
          kpi_totals: Json | null
          meeting_notes: string | null
          quoted_data: Json | null
          sold_data: Json | null
          start_date: string
          team_member_id: string
        }
        Insert: {
          agency_id: string
          call_log_data?: Json | null
          call_scoring_data?: Json | null
          created_at?: string | null
          created_by: string
          end_date: string
          id?: string
          kpi_totals?: Json | null
          meeting_notes?: string | null
          quoted_data?: Json | null
          sold_data?: Json | null
          start_date: string
          team_member_id: string
        }
        Update: {
          agency_id?: string
          call_log_data?: Json | null
          call_scoring_data?: Json | null
          created_at?: string | null
          created_by?: string
          end_date?: string
          id?: string
          kpi_totals?: Json | null
          meeting_notes?: string | null
          quoted_data?: Json | null
          sold_data?: Json | null
          start_date?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_frames_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_frames_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
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
      period_backups: {
        Row: {
          backup_type: string
          created_at: string
          form_data: Json
          id: string
          metadata: Json | null
          period_id: string
          user_id: string
        }
        Insert: {
          backup_type?: string
          created_at?: string
          form_data: Json
          id?: string
          metadata?: Json | null
          period_id: string
          user_id: string
        }
        Update: {
          backup_type?: string
          created_at?: string
          form_data?: Json
          id?: string
          metadata?: Json | null
          period_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_backups_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      period_edit_sessions: {
        Row: {
          created_at: string
          device_fingerprint: string
          ended_at: string | null
          id: string
          ip_address: unknown
          last_heartbeat: string
          period_id: string
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint: string
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          last_heartbeat?: string
          period_id: string
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          last_heartbeat?: string
          period_id?: string
          started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_edit_sessions_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      period_versions: {
        Row: {
          change_source: string | null
          changed_by: string | null
          created_at: string
          data_completeness_score: number | null
          device_fingerprint: string | null
          end_date: string
          form_data: Json | null
          has_meaningful_data: boolean | null
          id: string
          ip_address: unknown
          period_id: string
          start_date: string
          status: string
          title: string
          user_agent: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          change_source?: string | null
          changed_by?: string | null
          created_at?: string
          data_completeness_score?: number | null
          device_fingerprint?: string | null
          end_date: string
          form_data?: Json | null
          has_meaningful_data?: boolean | null
          id?: string
          ip_address?: unknown
          period_id: string
          start_date: string
          status: string
          title: string
          user_agent?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          change_source?: string | null
          changed_by?: string | null
          created_at?: string
          data_completeness_score?: number | null
          device_fingerprint?: string | null
          end_date?: string
          form_data?: Json | null
          has_meaningful_data?: boolean | null
          id?: string
          ip_address?: unknown
          period_id?: string
          start_date?: string
          status?: string
          title?: string
          user_agent?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "period_versions_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
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
      policy_types: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_types_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
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
      product_types: {
        Row: {
          agency_id: string | null
          carrier: string | null
          category: string
          created_at: string | null
          default_points: number | null
          exclude_from_item_count: boolean | null
          exclude_from_policy_count: boolean | null
          id: string
          is_active: boolean | null
          is_vc_item: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          agency_id?: string | null
          carrier?: string | null
          category: string
          created_at?: string | null
          default_points?: number | null
          exclude_from_item_count?: boolean | null
          exclude_from_policy_count?: boolean | null
          id?: string
          is_active?: boolean | null
          is_vc_item?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string | null
          carrier?: string | null
          category?: string
          created_at?: string | null
          default_points?: number | null
          exclude_from_item_count?: boolean | null
          exclude_from_policy_count?: boolean | null
          id?: string
          is_active?: boolean | null
          is_vc_item?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_types_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          membership_tier: Database["public"]["Enums"]["membership_tier"] | null
          mrr: number | null
          profile_photo_url: string | null
          role: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          membership_tier?:
            | Database["public"]["Enums"]["membership_tier"]
            | null
          mrr?: number | null
          profile_photo_url?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          membership_tier?:
            | Database["public"]["Enums"]["membership_tier"]
            | null
          mrr?: number | null
          profile_photo_url?: string | null
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
          policy_type: string[] | null
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
          policy_type?: string[] | null
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
          policy_type?: string[] | null
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
      renewal_activities: {
        Row: {
          activity_status: string | null
          activity_type: string
          agency_id: string
          assigned_team_member_id: string | null
          comments: string | null
          completed_date: string | null
          created_at: string
          created_by: string | null
          created_by_display_name: string | null
          household_key: string | null
          id: string
          renewal_record_id: string
          scheduled_date: string | null
          send_calendar_invite: boolean | null
          subject: string | null
        }
        Insert: {
          activity_status?: string | null
          activity_type: string
          agency_id: string
          assigned_team_member_id?: string | null
          comments?: string | null
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          created_by_display_name?: string | null
          household_key?: string | null
          id?: string
          renewal_record_id: string
          scheduled_date?: string | null
          send_calendar_invite?: boolean | null
          subject?: string | null
        }
        Update: {
          activity_status?: string | null
          activity_type?: string
          agency_id?: string
          assigned_team_member_id?: string | null
          comments?: string | null
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          created_by_display_name?: string | null
          household_key?: string | null
          id?: string
          renewal_record_id?: string
          scheduled_date?: string | null
          send_calendar_invite?: boolean | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "renewal_activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_activities_record_id_fkey"
            columns: ["renewal_record_id"]
            isOneToOne: false
            referencedRelation: "renewal_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_activities_staff_member_id_fkey"
            columns: ["assigned_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_records: {
        Row: {
          account_type: string | null
          agency_id: string
          agent_number: string | null
          amount_due: number | null
          amount_due_cents: number | null
          assigned_team_member_id: string | null
          created_at: string
          current_status: string
          easy_pay: boolean | null
          email: string | null
          first_name: string | null
          household_key: string | null
          id: string
          is_active: boolean
          is_priority: boolean | null
          item_count: number | null
          last_activity_at: string | null
          last_activity_by: string | null
          last_activity_by_display_name: string | null
          last_name: string | null
          last_upload_id: string | null
          multi_line_indicator: boolean | null
          notes: string | null
          phone: string | null
          phone_alt: string | null
          policy_number: string
          premium_cents: number | null
          premium_change_dollars: number | null
          premium_change_percent: number | null
          premium_new: number | null
          premium_old: number | null
          product_name: string | null
          renewal_effective_date: string | null
          renewal_status: string
          sent_to_winback_at: string | null
          updated_at: string
          upload_id: string | null
          uploaded_by: string | null
          uploaded_by_display_name: string | null
          winback_household_id: string | null
          years_prior_insurance: number | null
        }
        Insert: {
          account_type?: string | null
          agency_id: string
          agent_number?: string | null
          amount_due?: number | null
          amount_due_cents?: number | null
          assigned_team_member_id?: string | null
          created_at?: string
          current_status?: string
          easy_pay?: boolean | null
          email?: string | null
          first_name?: string | null
          household_key?: string | null
          id?: string
          is_active?: boolean
          is_priority?: boolean | null
          item_count?: number | null
          last_activity_at?: string | null
          last_activity_by?: string | null
          last_activity_by_display_name?: string | null
          last_name?: string | null
          last_upload_id?: string | null
          multi_line_indicator?: boolean | null
          notes?: string | null
          phone?: string | null
          phone_alt?: string | null
          policy_number: string
          premium_cents?: number | null
          premium_change_dollars?: number | null
          premium_change_percent?: number | null
          premium_new?: number | null
          premium_old?: number | null
          product_name?: string | null
          renewal_effective_date?: string | null
          renewal_status?: string
          sent_to_winback_at?: string | null
          updated_at?: string
          upload_id?: string | null
          uploaded_by?: string | null
          uploaded_by_display_name?: string | null
          winback_household_id?: string | null
          years_prior_insurance?: number | null
        }
        Update: {
          account_type?: string | null
          agency_id?: string
          agent_number?: string | null
          amount_due?: number | null
          amount_due_cents?: number | null
          assigned_team_member_id?: string | null
          created_at?: string
          current_status?: string
          easy_pay?: boolean | null
          email?: string | null
          first_name?: string | null
          household_key?: string | null
          id?: string
          is_active?: boolean
          is_priority?: boolean | null
          item_count?: number | null
          last_activity_at?: string | null
          last_activity_by?: string | null
          last_activity_by_display_name?: string | null
          last_name?: string | null
          last_upload_id?: string | null
          multi_line_indicator?: boolean | null
          notes?: string | null
          phone?: string | null
          phone_alt?: string | null
          policy_number?: string
          premium_cents?: number | null
          premium_change_dollars?: number | null
          premium_change_percent?: number | null
          premium_new?: number | null
          premium_old?: number | null
          product_name?: string | null
          renewal_effective_date?: string | null
          renewal_status?: string
          sent_to_winback_at?: string | null
          updated_at?: string
          upload_id?: string | null
          uploaded_by?: string | null
          uploaded_by_display_name?: string | null
          winback_household_id?: string | null
          years_prior_insurance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "renewal_records_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_records_assigned_team_member_id_fkey"
            columns: ["assigned_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_records_assigned_to_fkey"
            columns: ["assigned_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_records_last_upload_id_fkey"
            columns: ["last_upload_id"]
            isOneToOne: false
            referencedRelation: "renewal_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_records_winback_household_id_fkey"
            columns: ["winback_household_id"]
            isOneToOne: false
            referencedRelation: "winback_households"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_uploads: {
        Row: {
          agency_id: string
          created_at: string
          date_range_end: string | null
          date_range_start: string | null
          filename: string | null
          id: string
          record_count: number | null
          uploaded_by: string | null
          uploaded_by_display_name: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          filename?: string | null
          id?: string
          record_count?: number | null
          uploaded_by?: string | null
          uploaded_by_display_name?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          filename?: string | null
          id?: string
          record_count?: number | null
          uploaded_by?: string | null
          uploaded_by_display_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "renewal_uploads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
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
          token_id: string | null
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
          token_id?: string | null
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
          token_id?: string | null
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
      sale_items: {
        Row: {
          created_at: string | null
          id: string
          is_vc_qualifying: boolean | null
          item_count: number | null
          points: number | null
          premium: number | null
          product_type_id: string | null
          product_type_name: string
          sale_id: string
          sale_policy_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_vc_qualifying?: boolean | null
          item_count?: number | null
          points?: number | null
          premium?: number | null
          product_type_id?: string | null
          product_type_name: string
          sale_id: string
          sale_policy_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_vc_qualifying?: boolean | null
          item_count?: number | null
          points?: number | null
          premium?: number | null
          product_type_id?: string | null
          product_type_name?: string
          sale_id?: string
          sale_policy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_policy_id_fkey"
            columns: ["sale_policy_id"]
            isOneToOne: false
            referencedRelation: "sale_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_policies: {
        Row: {
          created_at: string | null
          effective_date: string
          expiration_date: string | null
          id: string
          is_vc_qualifying: boolean | null
          policy_number: string | null
          policy_type_name: string
          product_type_id: string | null
          sale_id: string
          total_items: number | null
          total_points: number | null
          total_premium: number | null
        }
        Insert: {
          created_at?: string | null
          effective_date: string
          expiration_date?: string | null
          id?: string
          is_vc_qualifying?: boolean | null
          policy_number?: string | null
          policy_type_name: string
          product_type_id?: string | null
          sale_id: string
          total_items?: number | null
          total_points?: number | null
          total_premium?: number | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string
          expiration_date?: string | null
          id?: string
          is_vc_qualifying?: boolean | null
          policy_number?: string | null
          policy_type_name?: string
          product_type_id?: string | null
          sale_id?: string
          total_items?: number | null
          total_points?: number | null
          total_premium?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_policies_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_policies_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          agency_id: string
          bundle_type: string | null
          created_at: string | null
          created_by: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          customer_zip: string | null
          effective_date: string
          expiration_date: string | null
          id: string
          is_bundle: boolean | null
          is_vc_qualifying: boolean | null
          lead_source_id: string | null
          policy_number: string | null
          sale_date: string | null
          source: string | null
          source_details: Json | null
          subproducer_code: string | null
          team_member_id: string | null
          total_items: number | null
          total_points: number | null
          total_policies: number | null
          total_premium: number | null
          updated_at: string | null
          vc_items: number | null
          vc_points: number | null
          vc_premium: number | null
        }
        Insert: {
          agency_id: string
          bundle_type?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_zip?: string | null
          effective_date: string
          expiration_date?: string | null
          id?: string
          is_bundle?: boolean | null
          is_vc_qualifying?: boolean | null
          lead_source_id?: string | null
          policy_number?: string | null
          sale_date?: string | null
          source?: string | null
          source_details?: Json | null
          subproducer_code?: string | null
          team_member_id?: string | null
          total_items?: number | null
          total_points?: number | null
          total_policies?: number | null
          total_premium?: number | null
          updated_at?: string | null
          vc_items?: number | null
          vc_points?: number | null
          vc_premium?: number | null
        }
        Update: {
          agency_id?: string
          bundle_type?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_zip?: string | null
          effective_date?: string
          expiration_date?: string | null
          id?: string
          is_bundle?: boolean | null
          is_vc_qualifying?: boolean | null
          lead_source_id?: string | null
          policy_number?: string | null
          sale_date?: string | null
          source?: string | null
          source_details?: Json | null
          subproducer_code?: string | null
          team_member_id?: string | null
          total_items?: number | null
          total_points?: number | null
          total_policies?: number | null
          total_premium?: number | null
          updated_at?: string | null
          vc_items?: number | null
          vc_points?: number | null
          vc_premium?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goal_assignments: {
        Row: {
          created_at: string | null
          id: string
          sales_goal_id: string
          team_member_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          sales_goal_id: string
          team_member_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          sales_goal_id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_goal_assignments_sales_goal_id_fkey"
            columns: ["sales_goal_id"]
            isOneToOne: false
            referencedRelation: "sales_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_goal_assignments_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          agency_id: string
          bonus_amount_cents: number | null
          created_at: string | null
          description: string | null
          effective_month: string | null
          effective_year: number | null
          end_date: string | null
          goal_focus: string
          goal_name: string
          goal_type: string | null
          id: string
          is_active: boolean | null
          kpi_slug: string | null
          measurement: string
          product_type_id: string | null
          promo_source: string | null
          rank: number | null
          start_date: string | null
          target_value: number
          team_member_id: string | null
          time_period: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          bonus_amount_cents?: number | null
          created_at?: string | null
          description?: string | null
          effective_month?: string | null
          effective_year?: number | null
          end_date?: string | null
          goal_focus?: string
          goal_name: string
          goal_type?: string | null
          id?: string
          is_active?: boolean | null
          kpi_slug?: string | null
          measurement: string
          product_type_id?: string | null
          promo_source?: string | null
          rank?: number | null
          start_date?: string | null
          target_value: number
          team_member_id?: string | null
          time_period?: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          bonus_amount_cents?: number | null
          created_at?: string | null
          description?: string | null
          effective_month?: string | null
          effective_year?: number | null
          end_date?: string | null
          goal_focus?: string
          goal_name?: string
          goal_type?: string | null
          id?: string
          is_active?: boolean | null
          kpi_slug?: string | null
          measurement?: string
          product_type_id?: string | null
          promo_source?: string | null
          rank?: number | null
          start_date?: string | null
          target_value?: number
          team_member_id?: string | null
          time_period?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_goals_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_goals_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_goals_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_reports: {
        Row: {
          agency_id: string | null
          created_at: string
          id: string
          input_data: Json
          report_type: string
          results_data: Json
          title: string
          user_id: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          id?: string
          input_data: Json
          report_type: string
          results_data: Json
          title: string
          user_id: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          id?: string
          input_data?: Json
          report_type?: string
          results_data?: Json
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
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
          policy_type: string[] | null
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
          policy_type?: string[] | null
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
          policy_type?: string[] | null
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
          {
            foreignKeyName: "sold_policy_details_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sold_policy_details_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "vw_flattening_health"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "sold_policy_details_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "vw_submission_metrics"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      sp_categories: {
        Row: {
          access_tiers: string[]
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_published: boolean | null
          name: string
          published_at: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          access_tiers?: string[]
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_published?: boolean | null
          name: string
          published_at?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          access_tiers?: string[]
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_published?: boolean | null
          name?: string
          published_at?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sp_lessons: {
        Row: {
          content_html: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          document_name: string | null
          document_url: string | null
          documents_json: Json | null
          estimated_minutes: number | null
          has_quiz: boolean | null
          id: string
          is_published: boolean | null
          module_id: string
          name: string
          published_at: string | null
          slug: string
          thumbnail_url: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          content_html?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          document_name?: string | null
          document_url?: string | null
          documents_json?: Json | null
          estimated_minutes?: number | null
          has_quiz?: boolean | null
          id?: string
          is_published?: boolean | null
          module_id: string
          name: string
          published_at?: string | null
          slug: string
          thumbnail_url?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          content_html?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          document_name?: string | null
          document_url?: string | null
          documents_json?: Json | null
          estimated_minutes?: number | null
          has_quiz?: boolean | null
          id?: string
          is_published?: boolean | null
          module_id?: string
          name?: string
          published_at?: string | null
          slug?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "sp_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_modules: {
        Row: {
          category_id: string
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_published: boolean | null
          name: string
          published_at: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_published?: boolean | null
          name: string
          published_at?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_published?: boolean | null
          name?: string
          published_at?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_modules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "sp_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_progress: {
        Row: {
          ai_summary: string | null
          completed_at: string | null
          content_viewed: boolean | null
          created_at: string | null
          document_downloaded: boolean | null
          id: string
          lesson_id: string
          quiz_answers_json: Json | null
          quiz_completed: boolean | null
          quiz_passed: boolean | null
          quiz_score: number | null
          reflection_action: string | null
          reflection_result: string | null
          reflection_takeaway: string | null
          started_at: string | null
          updated_at: string | null
          user_id: string
          video_watched: boolean | null
        }
        Insert: {
          ai_summary?: string | null
          completed_at?: string | null
          content_viewed?: boolean | null
          created_at?: string | null
          document_downloaded?: boolean | null
          id?: string
          lesson_id: string
          quiz_answers_json?: Json | null
          quiz_completed?: boolean | null
          quiz_passed?: boolean | null
          quiz_score?: number | null
          reflection_action?: string | null
          reflection_result?: string | null
          reflection_takeaway?: string | null
          started_at?: string | null
          updated_at?: string | null
          user_id: string
          video_watched?: boolean | null
        }
        Update: {
          ai_summary?: string | null
          completed_at?: string | null
          content_viewed?: boolean | null
          created_at?: string | null
          document_downloaded?: boolean | null
          id?: string
          lesson_id?: string
          quiz_answers_json?: Json | null
          quiz_completed?: boolean | null
          quiz_passed?: boolean | null
          quiz_score?: number | null
          reflection_action?: string | null
          reflection_result?: string | null
          reflection_takeaway?: string | null
          started_at?: string | null
          updated_at?: string | null
          user_id?: string
          video_watched?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "sp_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_progress_staff: {
        Row: {
          ai_summary: string | null
          completed_at: string | null
          completion_email_sent: boolean | null
          completion_email_sent_at: string | null
          content_viewed: boolean | null
          created_at: string | null
          document_downloaded: boolean | null
          id: string
          lesson_id: string
          quiz_answers_json: Json | null
          quiz_completed: boolean | null
          quiz_passed: boolean | null
          quiz_score: number | null
          reflection_action: string | null
          reflection_result: string | null
          reflection_takeaway: string | null
          staff_user_id: string
          started_at: string | null
          updated_at: string | null
          video_watched: boolean | null
        }
        Insert: {
          ai_summary?: string | null
          completed_at?: string | null
          completion_email_sent?: boolean | null
          completion_email_sent_at?: string | null
          content_viewed?: boolean | null
          created_at?: string | null
          document_downloaded?: boolean | null
          id?: string
          lesson_id: string
          quiz_answers_json?: Json | null
          quiz_completed?: boolean | null
          quiz_passed?: boolean | null
          quiz_score?: number | null
          reflection_action?: string | null
          reflection_result?: string | null
          reflection_takeaway?: string | null
          staff_user_id: string
          started_at?: string | null
          updated_at?: string | null
          video_watched?: boolean | null
        }
        Update: {
          ai_summary?: string | null
          completed_at?: string | null
          completion_email_sent?: boolean | null
          completion_email_sent_at?: string | null
          content_viewed?: boolean | null
          created_at?: string | null
          document_downloaded?: boolean | null
          id?: string
          lesson_id?: string
          quiz_answers_json?: Json | null
          quiz_completed?: boolean | null
          quiz_passed?: boolean | null
          quiz_score?: number | null
          reflection_action?: string | null
          reflection_result?: string | null
          reflection_takeaway?: string | null
          staff_user_id?: string
          started_at?: string | null
          updated_at?: string | null
          video_watched?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_progress_staff_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "sp_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_progress_staff_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_quizzes: {
        Row: {
          created_at: string | null
          id: string
          lesson_id: string
          pass_threshold: number | null
          questions_json: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lesson_id: string
          pass_threshold?: number | null
          questions_json?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lesson_id?: string
          pass_threshold?: number | null
          questions_json?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "sp_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_core4_entries: {
        Row: {
          balance_completed: boolean | null
          balance_note: string | null
          being_completed: boolean | null
          being_note: string | null
          body_completed: boolean | null
          body_note: string | null
          business_completed: boolean | null
          business_note: string | null
          created_at: string | null
          date: string
          id: string
          staff_user_id: string
          updated_at: string | null
        }
        Insert: {
          balance_completed?: boolean | null
          balance_note?: string | null
          being_completed?: boolean | null
          being_note?: string | null
          body_completed?: boolean | null
          body_note?: string | null
          business_completed?: boolean | null
          business_note?: string | null
          created_at?: string | null
          date?: string
          id?: string
          staff_user_id: string
          updated_at?: string | null
        }
        Update: {
          balance_completed?: boolean | null
          balance_note?: string | null
          being_completed?: boolean | null
          being_note?: string | null
          body_completed?: boolean | null
          body_note?: string | null
          business_completed?: boolean | null
          business_note?: string | null
          created_at?: string | null
          date?: string
          id?: string
          staff_user_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_core4_entries_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_core4_monthly_missions: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          items: Json | null
          month_year: string
          staff_user_id: string
          status: string
          title: string
          updated_at: string | null
          weekly_measurable: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: string
          items?: Json | null
          month_year: string
          staff_user_id: string
          status?: string
          title: string
          updated_at?: string | null
          weekly_measurable?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          items?: Json | null
          month_year?: string
          staff_user_id?: string
          status?: string
          title?: string
          updated_at?: string | null
          weekly_measurable?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_core4_monthly_missions_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invite_tokens: {
        Row: {
          accepted_at: string | null
          created_at: string
          expires_at: string
          id: string
          staff_user_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          staff_user_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          staff_user_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invite_tokens_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_lesson_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          lesson_id: string | null
          lesson_name: string | null
          module_name: string | null
          staff_user_id: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          lesson_name?: string | null
          module_name?: string | null
          staff_user_id: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          lesson_name?: string | null
          module_name?: string | null
          staff_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "training_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_lesson_progress_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          staff_user_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          staff_user_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          staff_user_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_password_reset_tokens_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          id: string
          passed: boolean
          quiz_id: string
          score: number
          staff_user_id: string
        }
        Insert: {
          answers: Json
          created_at?: string
          id?: string
          passed: boolean
          quiz_id: string
          score: number
          staff_user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          passed?: boolean
          quiz_id?: string
          score?: number
          staff_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "training_quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_quiz_attempts_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          impersonated_by: string | null
          is_impersonation: boolean | null
          is_valid: boolean
          session_token: string
          staff_user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          impersonated_by?: string | null
          is_impersonation?: boolean | null
          is_valid?: boolean
          session_token: string
          staff_user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          impersonated_by?: string | null
          is_impersonation?: boolean | null
          is_valid?: boolean
          session_token?: string
          staff_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_sessions_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_users: {
        Row: {
          agency_id: string
          created_at: string
          display_name: string
          email: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          password_hash: string
          profile_photo_url: string | null
          team_member_id: string | null
          updated_at: string
          username: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          password_hash: string
          profile_photo_url?: string | null
          team_member_id?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          password_hash?: string
          profile_photo_url?: string | null
          team_member_id?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_users_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_users_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: true
            referencedRelation: "team_members"
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
      team_member_subproducer_codes: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          subproducer_code: string
          team_member_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          subproducer_code: string
          team_member_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          subproducer_code?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_subproducer_codes_team_member_id_fkey"
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
          sub_producer_code: string | null
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
          sub_producer_code?: string | null
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
          sub_producer_code?: string | null
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
      theta_affirmations: {
        Row: {
          approved: boolean
          category: string
          created_at: string
          edited: boolean
          id: string
          order_index: number | null
          session_id: string
          target_id: string | null
          text: string
          tone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved?: boolean
          category: string
          created_at?: string
          edited?: boolean
          id?: string
          order_index?: number | null
          session_id: string
          target_id?: string | null
          text: string
          tone: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved?: boolean
          category?: string
          created_at?: string
          edited?: boolean
          id?: string
          order_index?: number | null
          session_id?: string
          target_id?: string | null
          text?: string
          tone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "theta_affirmations_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "theta_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      theta_final_tracks: {
        Row: {
          audio_url: string
          created_at: string
          download_count: number
          duration_seconds: number
          file_size_bytes: number | null
          id: string
          last_downloaded_at: string | null
          session_id: string
          target_id: string | null
          user_id: string | null
          voice_track_id: string | null
        }
        Insert: {
          audio_url: string
          created_at?: string
          download_count?: number
          duration_seconds?: number
          file_size_bytes?: number | null
          id?: string
          last_downloaded_at?: string | null
          session_id: string
          target_id?: string | null
          user_id?: string | null
          voice_track_id?: string | null
        }
        Update: {
          audio_url?: string
          created_at?: string
          download_count?: number
          duration_seconds?: number
          file_size_bytes?: number | null
          id?: string
          last_downloaded_at?: string | null
          session_id?: string
          target_id?: string | null
          user_id?: string | null
          voice_track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "theta_final_tracks_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "theta_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theta_final_tracks_voice_track_id_fkey"
            columns: ["voice_track_id"]
            isOneToOne: false
            referencedRelation: "theta_voice_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      theta_targets: {
        Row: {
          balance: string | null
          being: string | null
          body: string | null
          business: string | null
          created_at: string
          id: string
          session_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          balance?: string | null
          being?: string | null
          body?: string | null
          business?: string | null
          created_at?: string
          id?: string
          session_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          balance?: string | null
          being?: string | null
          body?: string | null
          business?: string | null
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      theta_track_leads: {
        Row: {
          created_at: string
          email: string
          final_track_id: string | null
          full_name: string
          id: string
          opt_in_challenge: boolean
          opt_in_tips: boolean
          phone: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          final_track_id?: string | null
          full_name: string
          id?: string
          opt_in_challenge?: boolean
          opt_in_tips?: boolean
          phone?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          final_track_id?: string | null
          full_name?: string
          id?: string
          opt_in_challenge?: boolean
          opt_in_tips?: boolean
          phone?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "theta_track_leads_final_track_id_fkey"
            columns: ["final_track_id"]
            isOneToOne: false
            referencedRelation: "theta_final_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      theta_tracks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_minutes: number | null
          error_message: string | null
          id: string
          session_id: string
          status: string
          voice_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          error_message?: string | null
          id?: string
          session_id: string
          status: string
          voice_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          error_message?: string | null
          id?: string
          session_id?: string
          status?: string
          voice_id?: string
        }
        Relationships: []
      }
      theta_voice_tracks: {
        Row: {
          audio_url: string
          created_at: string
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          session_id: string
          target_id: string | null
          user_id: string | null
          voice_type: string
        }
        Insert: {
          audio_url: string
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          session_id: string
          target_id?: string | null
          user_id?: string | null
          voice_type: string
        }
        Update: {
          audio_url?: string
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          session_id?: string
          target_id?: string | null
          user_id?: string | null
          voice_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "theta_voice_tracks_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "theta_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      training_assignments: {
        Row: {
          agency_id: string
          assigned_at: string
          assigned_by: string | null
          due_date: string | null
          id: string
          module_id: string
          staff_user_id: string
        }
        Insert: {
          agency_id: string
          assigned_at?: string
          assigned_by?: string | null
          due_date?: string | null
          id?: string
          module_id: string
          staff_user_id: string
        }
        Update: {
          agency_id?: string
          assigned_at?: string
          assigned_by?: string | null
          due_date?: string | null
          id?: string
          module_id?: string
          staff_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_assignments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assignments_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      training_attachments: {
        Row: {
          agency_id: string
          created_at: string
          file_size_bytes: number | null
          file_type: string
          file_url: string
          id: string
          is_external_link: boolean | null
          lesson_id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          file_size_bytes?: number | null
          file_type: string
          file_url: string
          id?: string
          is_external_link?: boolean | null
          lesson_id: string
          name: string
          sort_order?: number | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string
          id?: string
          is_external_link?: boolean | null
          lesson_id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_attachments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attachments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "training_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      training_categories: {
        Row: {
          agency_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_categories_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      training_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          lesson_id: string
          parent_id: string | null
          updated_at: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          lesson_id: string
          parent_id?: string | null
          updated_at?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          lesson_id?: string
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "training_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      training_lesson_progress: {
        Row: {
          agency_id: string
          completed_at: string | null
          id: string
          is_completed: boolean | null
          lesson_id: string
          staff_user_id: string
          started_at: string | null
        }
        Insert: {
          agency_id: string
          completed_at?: string | null
          id?: string
          is_completed?: boolean | null
          lesson_id: string
          staff_user_id: string
          started_at?: string | null
        }
        Update: {
          agency_id?: string
          completed_at?: string | null
          id?: string
          is_completed?: boolean | null
          lesson_id?: string
          staff_user_id?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_lesson_progress_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "training_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_lesson_progress_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      training_lessons: {
        Row: {
          agency_id: string
          content_html: string | null
          created_at: string
          description: string | null
          estimated_duration_minutes: number | null
          id: string
          is_active: boolean | null
          module_id: string
          name: string
          sort_order: number | null
          thumbnail_url: string | null
          updated_at: string
          video_platform: string | null
          video_url: string | null
        }
        Insert: {
          agency_id: string
          content_html?: string | null
          created_at?: string
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          module_id: string
          name: string
          sort_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string
          video_platform?: string | null
          video_url?: string | null
        }
        Update: {
          agency_id?: string
          content_html?: string | null
          created_at?: string
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          module_id?: string
          name?: string
          sort_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string
          video_platform?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_lessons_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          agency_id: string
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_modules_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_modules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "training_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      training_quiz_attempts: {
        Row: {
          agency_id: string
          ai_feedback: string | null
          answers_json: Json
          category_name: string | null
          completed_at: string
          correct_answers: number
          feedback_viewed_at: string | null
          id: string
          lesson_name: string | null
          module_name: string | null
          quiz_id: string | null
          quiz_name: string | null
          reflection_answers_final: Json | null
          score_percent: number
          staff_user_id: string
          started_at: string
          total_questions: number
        }
        Insert: {
          agency_id: string
          ai_feedback?: string | null
          answers_json: Json
          category_name?: string | null
          completed_at: string
          correct_answers: number
          feedback_viewed_at?: string | null
          id?: string
          lesson_name?: string | null
          module_name?: string | null
          quiz_id?: string | null
          quiz_name?: string | null
          reflection_answers_final?: Json | null
          score_percent: number
          staff_user_id: string
          started_at: string
          total_questions: number
        }
        Update: {
          agency_id?: string
          ai_feedback?: string | null
          answers_json?: Json
          category_name?: string | null
          completed_at?: string
          correct_answers?: number
          feedback_viewed_at?: string | null
          id?: string
          lesson_name?: string | null
          module_name?: string | null
          quiz_id?: string | null
          quiz_name?: string | null
          reflection_answers_final?: Json | null
          score_percent?: number
          staff_user_id?: string
          started_at?: string
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_quiz_attempts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "training_quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_quiz_attempts_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      training_quiz_options: {
        Row: {
          id: string
          is_correct: boolean | null
          option_text: string
          question_id: string
          sort_order: number | null
        }
        Insert: {
          id?: string
          is_correct?: boolean | null
          option_text: string
          question_id: string
          sort_order?: number | null
        }
        Update: {
          id?: string
          is_correct?: boolean | null
          option_text?: string
          question_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "training_quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_quiz_questions: {
        Row: {
          created_at: string
          id: string
          question_text: string
          question_type: string
          quiz_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          question_text: string
          question_type: string
          quiz_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          question_text?: string
          question_type?: string
          quiz_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "training_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      training_quizzes: {
        Row: {
          agency_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          lesson_id: string
          name: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          lesson_id: string
          name: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          lesson_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_quizzes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "training_lessons"
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
      video_training_modules: {
        Row: {
          agency_id: string
          content: string
          created_at: string | null
          error_message: string | null
          id: string
          role: string
          status: string | null
          title: string
          updated_at: string | null
          used_in_huddle: boolean | null
          user_id: string
          video_deleted_at: string | null
          video_storage_path: string | null
        }
        Insert: {
          agency_id: string
          content: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          role: string
          status?: string | null
          title: string
          updated_at?: string | null
          used_in_huddle?: boolean | null
          user_id: string
          video_deleted_at?: string | null
          video_storage_path?: string | null
        }
        Update: {
          agency_id?: string
          content?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          role?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          used_in_huddle?: boolean | null
          user_id?: string
          video_deleted_at?: string | null
          video_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_training_modules_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_training_modules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      winback_activities: {
        Row: {
          activity_type: string
          agency_id: string
          created_at: string | null
          created_by_name: string | null
          created_by_team_member_id: string | null
          created_by_user_id: string | null
          household_id: string
          id: string
          new_status: string | null
          notes: string | null
          old_status: string | null
        }
        Insert: {
          activity_type: string
          agency_id: string
          created_at?: string | null
          created_by_name?: string | null
          created_by_team_member_id?: string | null
          created_by_user_id?: string | null
          household_id: string
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
        }
        Update: {
          activity_type?: string
          agency_id?: string
          created_at?: string | null
          created_by_name?: string | null
          created_by_team_member_id?: string | null
          created_by_user_id?: string | null
          household_id?: string
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "winback_activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winback_activities_created_by_team_member_id_fkey"
            columns: ["created_by_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winback_activities_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "winback_households"
            referencedColumns: ["id"]
          },
        ]
      }
      winback_households: {
        Row: {
          activity_count: number | null
          agency_id: string
          assigned_to: string | null
          city: string | null
          created_at: string
          earliest_winback_date: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          policy_count: number | null
          state: string | null
          status: string
          street_address: string | null
          total_premium_potential_cents: number | null
          updated_at: string
          zip_code: string
        }
        Insert: {
          activity_count?: number | null
          agency_id: string
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          earliest_winback_date?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          policy_count?: number | null
          state?: string | null
          status?: string
          street_address?: string | null
          total_premium_potential_cents?: number | null
          updated_at?: string
          zip_code: string
        }
        Update: {
          activity_count?: number | null
          agency_id?: string
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          earliest_winback_date?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          policy_count?: number | null
          state?: string | null
          status?: string
          street_address?: string | null
          total_premium_potential_cents?: number | null
          updated_at?: string
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "winback_households_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winback_households_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      winback_policies: {
        Row: {
          account_type: string | null
          agency_id: string
          agent_number: string | null
          anniversary_effective_date: string | null
          calculated_winback_date: string
          company_code: string | null
          created_at: string
          household_id: string
          id: string
          is_cancel_rewrite: boolean
          original_year: number | null
          policy_number: string
          policy_term_months: number
          premium_change_cents: number | null
          premium_change_percent: number | null
          premium_new_cents: number | null
          premium_old_cents: number | null
          product_code: string | null
          product_name: string
          renewal_effective_date: string | null
          termination_effective_date: string
          termination_reason: string | null
          termination_type: string | null
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          agency_id: string
          agent_number?: string | null
          anniversary_effective_date?: string | null
          calculated_winback_date: string
          company_code?: string | null
          created_at?: string
          household_id: string
          id?: string
          is_cancel_rewrite?: boolean
          original_year?: number | null
          policy_number: string
          policy_term_months?: number
          premium_change_cents?: number | null
          premium_change_percent?: number | null
          premium_new_cents?: number | null
          premium_old_cents?: number | null
          product_code?: string | null
          product_name: string
          renewal_effective_date?: string | null
          termination_effective_date: string
          termination_reason?: string | null
          termination_type?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          agency_id?: string
          agent_number?: string | null
          anniversary_effective_date?: string | null
          calculated_winback_date?: string
          company_code?: string | null
          created_at?: string
          household_id?: string
          id?: string
          is_cancel_rewrite?: boolean
          original_year?: number | null
          policy_number?: string
          policy_term_months?: number
          premium_change_cents?: number | null
          premium_change_percent?: number | null
          premium_new_cents?: number | null
          premium_old_cents?: number | null
          product_code?: string | null
          product_name?: string
          renewal_effective_date?: string | null
          termination_effective_date?: string
          termination_reason?: string | null
          termination_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "winback_policies_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winback_policies_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "winback_households"
            referencedColumns: ["id"]
          },
        ]
      }
      winback_settings: {
        Row: {
          agency_id: string
          contact_days_before: number
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          contact_days_before?: number
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          contact_days_before?: number
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "winback_settings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      winback_uploads: {
        Row: {
          agency_id: string
          created_at: string
          filename: string
          id: string
          records_new_households: number
          records_new_policies: number
          records_processed: number
          records_skipped: number
          records_updated: number
          uploaded_by_staff_id: string | null
          uploaded_by_user_id: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          filename: string
          id?: string
          records_new_households?: number
          records_new_policies?: number
          records_processed?: number
          records_skipped?: number
          records_updated?: number
          uploaded_by_staff_id?: string | null
          uploaded_by_user_id?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          filename?: string
          id?: string
          records_new_households?: number
          records_new_policies?: number
          records_processed?: number
          records_skipped?: number
          records_updated?: number
          uploaded_by_staff_id?: string | null
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "winback_uploads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winback_uploads_uploaded_by_staff_id_fkey"
            columns: ["uploaded_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winback_uploads_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          items_sold: number | null
          mini_reviews: number | null
          outbound_calls: number | null
          quoted_households: number | null
          role: Database["public"]["Enums"]["app_member_role"] | null
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
          created_at: string | null
          cross_sells_uncovered: number | null
          daily_score: number | null
          date: string | null
          final_submission_id: string | null
          hits: number | null
          id: string | null
          is_counted_day: boolean | null
          is_late: boolean | null
          items_sold: number | null
          kpi_version_id: string | null
          label_at_submit: string | null
          metric_slug: string | null
          mini_reviews: number | null
          outbound_calls: number | null
          pass: boolean | null
          quoted_entity: string | null
          quoted_households: number | null
          rep_name: string | null
          role: Database["public"]["Enums"]["app_member_role"] | null
          sold_policies: number | null
          sold_premium_cents: number | null
          streak_count: number | null
          submitted_at: string | null
          talk_minutes: number | null
          team_member_id: string | null
          team_member_name: string | null
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
          items_sold: number | null
          kpi_version_id: string | null
          label_at_submit: string | null
          metric_slug: string | null
          mini_reviews: number | null
          outbound_calls: number | null
          pass: boolean | null
          quoted_entity: string | null
          quoted_households: number | null
          rep_name: string | null
          role: Database["public"]["Enums"]["app_member_role"] | null
          sold_policies: number | null
          sold_premium_cents: number | null
          streak_count: number | null
          submitted_at: string | null
          talk_minutes: number | null
          team_member_id: string | null
          team_member_name: string | null
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
      acknowledge_call_review: {
        Args: {
          p_call_id: string
          p_feedback_improvement: string
          p_feedback_positive: string
          p_team_member_id: string
        }
        Returns: Json
      }
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
      backfill_lqs_sales_matching: {
        Args: { p_agency_id: string }
        Returns: {
          household_id: string
          match_confidence: string
          sale_id: string
          status: string
        }[]
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
      calculate_data_completeness: { Args: { data: Json }; Returns: number }
      check_and_reset_call_usage: {
        Args: { p_agency_id: string }
        Returns: {
          calls_limit: number
          calls_used: number
          period_end: string
          should_reset: boolean
        }[]
      }
      check_form_kpi_versions: {
        Args: { p_form_id: string }
        Returns: {
          bound_label: string
          bound_version_id: string
          current_label: string
          kpi_id: string
        }[]
      }
      check_meaningful_data: { Args: { data: Json }; Returns: boolean }
      cleanup_expired_staff_sessions: { Args: never; Returns: undefined }
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
      create_default_kpis: { Args: { p_agency_id: string }; Returns: undefined }
      create_default_lead_sources: {
        Args: { p_agency_id: string }
        Returns: undefined
      }
      create_default_policy_types: {
        Args: { p_agency_id: string }
        Returns: undefined
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
        Returns: undefined
      }
      flatten_sold_household_details_enhanced: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      generate_household_key: {
        Args: { p_first_name: string; p_last_name: string; p_zip_code: string }
        Returns: string
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
      get_agency_settings: { Args: { p_agency_id: string }; Returns: Json }
      get_conversation_participants: {
        Args: { participant_ids: string[] }
        Returns: {
          agency_name: string
          email: string
          full_name: string
          id: string
        }[]
      }
      get_current_user_role: { Args: never; Returns: string }
      get_dashboard_daily:
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
              items_sold: number
              kpi_version_id: string
              label_at_submit: string
              mini_reviews: number
              outbound_calls: number
              pass: boolean
              quoted_households: number
              talk_minutes: number
              team_member_id: string
              team_member_name: string
            }[]
          }
      get_key_employee_agency_id: {
        Args: { _user_id: string }
        Returns: string
      }
      get_my_agency_id: { Args: never; Returns: string }
      get_staff_call_details: {
        Args: { p_call_id: string; p_team_member_id: string }
        Returns: Json
      }
      get_staff_call_scoring_data: {
        Args: {
          p_agency_id: string
          p_page?: number
          p_page_size?: number
          p_team_member_id?: string
        }
        Returns: Json
      }
      get_staff_call_status: {
        Args: { p_agency_id: string; p_call_id: string }
        Returns: Json
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
      get_user_agency_id: { Args: { target_user_id: string }; Returns: string }
      get_user_exchange_tier: { Args: { p_user_id: string }; Returns: string }
      get_versioned_dashboard_data:
        | {
            Args: {
              p_agency_slug: string
              p_consolidate_versions?: boolean
              p_role: string
            }
            Returns: Json
          }
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
      has_agency_access: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      has_cancel_audit_access: {
        Args: { check_agency_id: string }
        Returns: boolean
      }
      has_renewal_access: {
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
      increment_call_usage: {
        Args: { p_agency_id: string; p_month?: string }
        Returns: undefined
      }
      is_agency_owner_of_staff: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      is_call_scoring_enabled: {
        Args: { p_agency_id: string }
        Returns: boolean
      }
      is_key_employee: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      is_now_agency_time: {
        Args: { p_agency_id: string; p_hhmm: string }
        Returns: Json
      }
      is_staff_assigned_to_module: {
        Args: { p_module_id: string; p_staff_user_id: string }
        Returns: boolean
      }
      link_sale_to_lqs_household: {
        Args: { p_household_id: string; p_sale_id: string }
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
      match_sale_to_lqs_household: {
        Args: { p_sale_id: string }
        Returns: {
          household_id: string
          match_confidence: string
          matched_key: string
        }[]
      }
      normalize_product_type: {
        Args: { p_product_type: string }
        Returns: string
      }
      recalculate_all_winback_dates: {
        Args: { p_agency_id: string; p_contact_days_before?: number }
        Returns: {
          updated_count: number
        }[]
      }
      recalculate_winback_household_aggregates: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      recompute_streaks_for_member: {
        Args: { p_end: string; p_member: string; p_start: string }
        Returns: undefined
      }
      search_exchange_users: {
        Args: { current_user_id: string; search_term: string }
        Returns: {
          agency_name: string
          email: string
          full_name: string
          id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      upsert_cancel_audit_record: {
        Args: {
          p_account_type: string
          p_agency_id: string
          p_agent_number: string
          p_amount_due_cents: number
          p_cancel_date: string
          p_household_key: string
          p_insured_email: string
          p_insured_first_name: string
          p_insured_last_name: string
          p_insured_phone: string
          p_insured_phone_alt: string
          p_last_upload_id: string
          p_no_of_items: number
          p_pending_cancel_date: string
          p_policy_number: string
          p_premium_cents: number
          p_product_name: string
          p_renewal_effective_date: string
          p_report_type: string
        }
        Returns: {
          id: string
          was_created: boolean
        }[]
      }
      upsert_exchange_activity: {
        Args: {
          p_update_feed?: boolean
          p_update_notifications?: boolean
          p_user_id: string
        }
        Returns: undefined
      }
      upsert_metrics_from_submission: {
        Args: {
          p_kpi_version_id?: string
          p_label_at_submit?: string
          p_submission: string
        }
        Returns: undefined
      }
      upsert_renewal_record: {
        Args: {
          p_account_type?: string
          p_agency_id: string
          p_agent_number?: string
          p_amount_due?: number
          p_easy_pay?: boolean
          p_email?: string
          p_first_name?: string
          p_household_key?: string
          p_item_count?: number
          p_last_name?: string
          p_multi_line_indicator?: boolean
          p_phone?: string
          p_phone_alt?: string
          p_policy_number: string
          p_premium_change_dollars?: number
          p_premium_change_percent?: number
          p_premium_new?: number
          p_premium_old?: number
          p_product_name?: string
          p_renewal_effective_date: string
          p_renewal_status?: string
          p_upload_id: string
          p_uploaded_by?: string
          p_uploaded_by_display_name?: string
          p_years_prior_insurance?: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_employment_type: "Full-time" | "Part-time"
      app_member_role: "Sales" | "Service" | "Hybrid" | "Manager" | "Owner"
      app_member_status: "active" | "inactive"
      app_role: "admin" | "user"
      call_type_enum: "sales" | "service"
      exchange_visibility: "call_scoring" | "boardroom" | "one_on_one"
      membership_tier:
        | "1:1 Coaching"
        | "Boardroom"
        | "Call Scoring 30"
        | "Call Scoring 50"
        | "Call Scoring 100"
        | "Inactive"
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
      app_member_role: ["Sales", "Service", "Hybrid", "Manager", "Owner"],
      app_member_status: ["active", "inactive"],
      app_role: ["admin", "user"],
      call_type_enum: ["sales", "service"],
      exchange_visibility: ["call_scoring", "boardroom", "one_on_one"],
      membership_tier: [
        "1:1 Coaching",
        "Boardroom",
        "Call Scoring 30",
        "Call Scoring 50",
        "Call Scoring 100",
        "Inactive",
      ],
    },
  },
} as const
