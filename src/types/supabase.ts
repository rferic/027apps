export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scope: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scope?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scope?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      group_app_access: {
        Row: {
          app_slug: string
          created_at: string
          group_id: string
          id: string
        }
        Insert: {
          app_slug: string
          created_at?: string
          group_id: string
          id?: string
        }
        Update: {
          app_slug?: string
          created_at?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_app_access_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          invited_by: string | null
          joined_at: string
          role: Database["public"]["Enums"]["group_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_settings: {
        Row: {
          active_locales: string[]
          created_at: string
          default_locale: string
          group_id: string
          updated_at: string
        }
        Insert: {
          active_locales?: string[]
          created_at?: string
          default_locale?: string
          group_id: string
          updated_at?: string
        }
        Update: {
          active_locales?: string[]
          created_at?: string
          default_locale?: string
          group_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      inspiration_comments: {
        Row: {
          body: string
          created_at: string
          github_comment_id: number | null
          id: string
          request_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          github_comment_id?: number | null
          id?: string
          request_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          github_comment_id?: number | null
          id?: string
          request_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspiration_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "inspiration_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      inspiration_requests: {
        Row: {
          app_slug: string | null
          created_at: string
          description: string
          github_issue_number: number | null
          github_issue_url: string | null
          id: string
          status: Database["public"]["Enums"]["inspiration_status"]
          title: string
          type: Database["public"]["Enums"]["inspiration_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          app_slug?: string | null
          created_at?: string
          description?: string
          github_issue_number?: number | null
          github_issue_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["inspiration_status"]
          title: string
          type: Database["public"]["Enums"]["inspiration_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          app_slug?: string | null
          created_at?: string
          description?: string
          github_issue_number?: number | null
          github_issue_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["inspiration_status"]
          title?: string
          type?: Database["public"]["Enums"]["inspiration_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inspiration_votes: {
        Row: {
          created_at: string
          id: string
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspiration_votes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "inspiration_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      installed_apps: {
        Row: {
          config: Json
          display_order: number
          error: string | null
          id: string
          installed_at: string
          slug: string
          status: string
          table_prefix: string | null
          updated_at: string
          version: string
          visibility: string
        }
        Insert: {
          config?: Json
          display_order?: number
          error?: string | null
          id?: string
          installed_at?: string
          slug: string
          status: string
          table_prefix?: string | null
          updated_at?: string
          version: string
          visibility?: string
        }
        Update: {
          config?: Json
          display_order?: number
          error?: string | null
          id?: string
          installed_at?: string
          slug?: string
          status?: string
          table_prefix?: string | null
          updated_at?: string
          version?: string
          visibility?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string | null
          expires_at: string | null
          group_ids: string[]
          id: string
          invited_by: string
          locale: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["group_role"]
          title: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string | null
          group_ids?: string[]
          id?: string
          invited_by: string
          locale?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["group_role"]
          title: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string | null
          group_ids?: string[]
          id?: string
          invited_by?: string
          locale?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["group_role"]
          title?: string
          token?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          last_login_at: string | null
          locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          last_login_at?: string | null
          locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_login_at?: string | null
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          group_id: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      split_expenses_expenses: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          expense_group_id: string
          id: string
          paid_by: string
          tag_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          expense_group_id: string
          id?: string
          paid_by: string
          tag_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          expense_group_id?: string
          id?: string
          paid_by?: string
          tag_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_expenses_expenses_expense_group_id_fkey"
            columns: ["expense_group_id"]
            isOneToOne: false
            referencedRelation: "split_expenses_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_expenses_expenses_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "split_expenses_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      split_expenses_groups: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          emoji: string
          group_id: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          emoji?: string
          group_id: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          emoji?: string
          group_id?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_expenses_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      split_expenses_members: {
        Row: {
          active: boolean
          created_at: string
          expense_group_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expense_group_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expense_group_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_expenses_members_expense_group_id_fkey"
            columns: ["expense_group_id"]
            isOneToOne: false
            referencedRelation: "split_expenses_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      split_expenses_settlements: {
        Row: {
          created_at: string
          expense_group_id: string
          id: string
          note: string | null
          settled_by: string
        }
        Insert: {
          created_at?: string
          expense_group_id: string
          id?: string
          note?: string | null
          settled_by: string
        }
        Update: {
          created_at?: string
          expense_group_id?: string
          id?: string
          note?: string | null
          settled_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_expenses_settlements_expense_group_id_fkey"
            columns: ["expense_group_id"]
            isOneToOne: false
            referencedRelation: "split_expenses_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      split_expenses_shares: {
        Row: {
          amount: number
          created_at: string
          expense_id: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expense_id: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expense_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_expenses_shares_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "split_expenses_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      split_expenses_tags: {
        Row: {
          color: string
          created_at: string
          expense_group_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          expense_group_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          expense_group_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_expenses_tags_expense_group_id_fkey"
            columns: ["expense_group_id"]
            isOneToOne: false
            referencedRelation: "split_expenses_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      split_expenses_transfers: {
        Row: {
          amount: number
          created_at: string
          expense_group_id: string
          from_user: string
          id: string
          is_manual: boolean
          note: string | null
          settlement_id: string | null
          status: string
          to_user: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          expense_group_id: string
          from_user: string
          id?: string
          is_manual?: boolean
          note?: string | null
          settlement_id?: string | null
          status?: string
          to_user: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          expense_group_id?: string
          from_user?: string
          id?: string
          is_manual?: boolean
          note?: string | null
          settlement_id?: string | null
          status?: string
          to_user?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_expenses_transfers_expense_group_id_fkey"
            columns: ["expense_group_id"]
            isOneToOne: false
            referencedRelation: "split_expenses_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_expenses_transfers_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "split_expenses_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_categories: {
        Row: {
          color: string
          created_at: string
          display_order: number
          emoji: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          display_order?: number
          emoji?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          display_order?: number
          emoji?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      todo_items: {
        Row: {
          assigned_to: string | null
          category_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          group_id: string
          id: string
          priority: string
          repeat_end_date: string | null
          repeat_interval: string | null
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          assigned_to?: string | null
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          group_id: string
          id?: string
          priority?: string
          repeat_end_date?: string | null
          repeat_interval?: string | null
          status?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          assigned_to?: string | null
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          group_id?: string
          id?: string
          priority?: string
          repeat_end_date?: string | null
          repeat_interval?: string | null
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "todo_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_notification_prefs: {
        Row: {
          on_assigned: boolean
          on_status_change: boolean
          on_updated: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          on_assigned?: boolean
          on_status_change?: boolean
          on_updated?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          on_assigned?: boolean
          on_status_change?: boolean
          on_updated?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_app_setting: { Args: { p_key: string }; Returns: undefined }
      exec_sql: { Args: { sql: string }; Returns: undefined }
      get_app_setting: { Args: { p_key: string }; Returns: Json }
      get_inspiration_requests_aggregate: {
        Args: {
          app_slug?: string
          limit_val?: number
          my_user_id?: string
          offset_val?: number
          search?: string
          sort_type: string
          statuses?: string[]
          types?: string[]
        }
        Returns: Json
      }
      set_app_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: undefined
      }
      split_expenses_is_creator_or_admin: {
        Args: { expense_group_id: string }
        Returns: boolean
      }
      split_expenses_is_group_member: {
        Args: { expense_group_id: string }
        Returns: boolean
      }
    }
    Enums: {
      group_role: "admin" | "member"
      inspiration_status:
        | "pending"
        | "reviewing"
        | "approved"
        | "in_progress"
        | "completed"
        | "rejected"
        | "on_hold"
        | "duplicate"
      inspiration_type:
        | "bug"
        | "improvement"
        | "new_app"
        | "new_app_feature"
        | "new_general_functionality"
        | "other"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      group_role: ["admin", "member"],
      inspiration_status: [
        "pending",
        "reviewing",
        "approved",
        "in_progress",
        "completed",
        "rejected",
        "on_hold",
        "duplicate",
      ],
      inspiration_type: [
        "bug",
        "improvement",
        "new_app",
        "new_app_feature",
        "new_general_functionality",
        "other",
      ],
    },
  },
} as const
