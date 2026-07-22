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
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      beneficiaries: {
        Row: {
          account_number_last4: string | null
          address: string | null
          bank_name: string | null
          country: string | null
          created_at: string
          email: string | null
          favorite: boolean
          full_name: string
          iban: string | null
          id: string
          kind: string
          last_used_at: string | null
          memo: string | null
          nickname: string
          routing_number: string | null
          swift_bic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number_last4?: string | null
          address?: string | null
          bank_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          favorite?: boolean
          full_name: string
          iban?: string | null
          id?: string
          kind?: string
          last_used_at?: string | null
          memo?: string | null
          nickname: string
          routing_number?: string | null
          swift_bic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number_last4?: string | null
          address?: string | null
          bank_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          favorite?: boolean
          full_name?: string
          iban?: string | null
          id?: string
          kind?: string
          last_used_at?: string | null
          memo?: string | null
          nickname?: string
          routing_number?: string | null
          swift_bic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fee_config: {
        Row: {
          active: boolean
          amount_cents: number
          created_at: string
          currency: string
          id: string
          key: string
          label: string
          percent_bps: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          key: string
          label: string
          percent_bps?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          key?: string
          label?: string
          percent_bps?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      kyc_profiles: {
        Row: {
          city: string
          column_person_id: string | null
          country: string
          created_at: string
          date_of_birth: string
          employment_status: string | null
          iberbanco_status_raw: string | null
          iberbanco_user_number: string | null
          id: string
          id_number_last4: string
          id_type: string
          legal_first_name: string
          legal_last_name: string
          postal_code: string
          region: string
          rejection_reason: string | null
          reviewed_at: string | null
          ssn_last4: string
          status: Database["public"]["Enums"]["kyc_status"]
          street: string
          submitted_at: string
          updated_at: string
          user_id: string
          verification_tags: string[] | null
        }
        Insert: {
          city: string
          column_person_id?: string | null
          country?: string
          created_at?: string
          date_of_birth: string
          employment_status?: string | null
          iberbanco_status_raw?: string | null
          iberbanco_user_number?: string | null
          id?: string
          id_number_last4: string
          id_type: string
          legal_first_name: string
          legal_last_name: string
          postal_code: string
          region: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          ssn_last4: string
          status?: Database["public"]["Enums"]["kyc_status"]
          street: string
          submitted_at?: string
          updated_at?: string
          user_id: string
          verification_tags?: string[] | null
        }
        Update: {
          city?: string
          column_person_id?: string | null
          country?: string
          created_at?: string
          date_of_birth?: string
          employment_status?: string | null
          iberbanco_status_raw?: string | null
          iberbanco_user_number?: string | null
          id?: string
          id_number_last4?: string
          id_type?: string
          legal_first_name?: string
          legal_last_name?: string
          postal_code?: string
          region?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          ssn_last4?: string
          status?: Database["public"]["Enums"]["kyc_status"]
          street?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
          verification_tags?: string[] | null
        }
        Relationships: []
      }
      login_history: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          ip_hint: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip_hint?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip_hint?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          note: string | null
          paid_transaction_id: string | null
          payer_email: string | null
          payer_id: string | null
          payer_name: string | null
          requester_id: string
          status: Database["public"]["Enums"]["payment_request_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          paid_transaction_id?: string | null
          payer_email?: string | null
          payer_id?: string | null
          payer_name?: string | null
          requester_id: string
          status?: Database["public"]["Enums"]["payment_request_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          paid_transaction_id?: string | null
          payer_email?: string | null
          payer_id?: string | null
          payer_name?: string | null
          requester_id?: string
          status?: Database["public"]["Enums"]["payment_request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          address_city: string | null
          address_postal_code: string | null
          address_region: string | null
          address_street: string | null
          annual_income: string | null
          business_name: string | null
          citizenship: string | null
          country: string | null
          created_at: string
          email: string | null
          employer: string | null
          id: string
          occupation: string | null
          onboarded_at: string | null
          phone: string | null
          preferred_currency: string | null
          preferred_name: string | null
          privacy_accepted_at: string | null
          source_of_funds: string | null
          tax_country: string | null
          tax_id_number: string | null
          tos_accepted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string | null
          address_city?: string | null
          address_postal_code?: string | null
          address_region?: string | null
          address_street?: string | null
          annual_income?: string | null
          business_name?: string | null
          citizenship?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          employer?: string | null
          id?: string
          occupation?: string | null
          onboarded_at?: string | null
          phone?: string | null
          preferred_currency?: string | null
          preferred_name?: string | null
          privacy_accepted_at?: string | null
          source_of_funds?: string | null
          tax_country?: string | null
          tax_id_number?: string | null
          tos_accepted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string | null
          address_city?: string | null
          address_postal_code?: string | null
          address_region?: string | null
          address_street?: string | null
          annual_income?: string | null
          business_name?: string | null
          citizenship?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          employer?: string | null
          id?: string
          occupation?: string | null
          onboarded_at?: string | null
          phone?: string | null
          preferred_currency?: string | null
          preferred_name?: string | null
          privacy_accepted_at?: string | null
          source_of_funds?: string | null
          tax_country?: string | null
          tax_id_number?: string | null
          tos_accepted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          author: Database["public"]["Enums"]["support_message_author"]
          body: string
          created_at: string
          id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          author?: Database["public"]["Enums"]["support_message_author"]
          body: string
          created_at?: string
          id?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          author?: Database["public"]["Enums"]["support_message_author"]
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          body: string
          category: Database["public"]["Enums"]["support_ticket_category"]
          created_at: string
          id: string
          last_agent_reply_at: string | null
          last_customer_reply_at: string | null
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          related_transaction_id: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          category?: Database["public"]["Enums"]["support_ticket_category"]
          created_at?: string
          id?: string
          last_agent_reply_at?: string | null
          last_customer_reply_at?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          related_transaction_id?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          category?: Database["public"]["Enums"]["support_ticket_category"]
          created_at?: string
          id?: string
          last_agent_reply_at?: string | null
          last_customer_reply_at?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          related_transaction_id?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trusted_devices: {
        Row: {
          created_at: string
          device_id: string
          id: string
          label: string
          last_seen_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          label: string
          last_seen_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          label?: string
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          error: string | null
          event_type: string
          id: string
          payload: Json
          provider: string
          received_at: string
          status: string
        }
        Insert: {
          error?: string | null
          event_type: string
          id?: string
          payload?: Json
          provider: string
          received_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          provider?: string
          received_at?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "compliance" | "support" | "user"
      kyc_status: "unverified" | "pending" | "verified" | "rejected"
      payment_request_status:
        | "pending"
        | "paid"
        | "declined"
        | "cancelled"
        | "expired"
      support_message_author: "customer" | "agent" | "system"
      support_ticket_category:
        | "question"
        | "problem"
        | "dispute"
        | "feature_request"
        | "other"
      support_ticket_priority: "low" | "normal" | "high" | "urgent"
      support_ticket_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "resolved"
        | "closed"
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
      app_role: ["admin", "compliance", "support", "user"],
      kyc_status: ["unverified", "pending", "verified", "rejected"],
      payment_request_status: [
        "pending",
        "paid",
        "declined",
        "cancelled",
        "expired",
      ],
      support_message_author: ["customer", "agent", "system"],
      support_ticket_category: [
        "question",
        "problem",
        "dispute",
        "feature_request",
        "other",
      ],
      support_ticket_priority: ["low", "normal", "high", "urgent"],
      support_ticket_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "resolved",
        "closed",
      ],
    },
  },
} as const
