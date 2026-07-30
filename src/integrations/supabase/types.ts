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
      column_bank_accounts: {
        Row: {
          account_number_id: string | null
          account_number_masked: string | null
          account_type: string
          balances: Json
          bank_account_id: string
          created_at: string
          description: string | null
          entity_id: string
          id: string
          is_overdrawn: boolean
          routing_number: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number_id?: string | null
          account_number_masked?: string | null
          account_type?: string
          balances?: Json
          bank_account_id: string
          created_at?: string
          description?: string | null
          entity_id: string
          id?: string
          is_overdrawn?: boolean
          routing_number?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number_id?: string | null
          account_number_masked?: string | null
          account_type?: string
          balances?: Json
          bank_account_id?: string
          created_at?: string
          description?: string | null
          entity_id?: string
          id?: string
          is_overdrawn?: boolean
          routing_number?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      column_counterparties: {
        Row: {
          account_number_last4: string
          counterparty_id: string
          created_at: string
          id: string
          name: string | null
          raw: Json
          routing_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number_last4: string
          counterparty_id: string
          created_at?: string
          id?: string
          name?: string | null
          raw?: Json
          routing_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number_last4?: string
          counterparty_id?: string
          created_at?: string
          id?: string
          name?: string | null
          raw?: Json
          routing_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      column_entities: {
        Row: {
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          id: string
          updated_at: string
          user_id: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          details?: Json
          entity_id: string
          entity_type?: string
          id?: string
          updated_at?: string
          user_id: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
          user_id?: string
          verification_status?: string
        }
        Relationships: []
      }
      column_transfers: {
        Row: {
          amount_cents: number
          bank_account_id: string | null
          created_at: string
          currency: string
          description: string | null
          direction: string
          id: string
          occurred_at: string
          raw: Json
          status: string
          transfer_id: string
          transfer_type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number
          bank_account_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          direction?: string
          id?: string
          occurred_at?: string
          raw?: Json
          status?: string
          transfer_id: string
          transfer_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          bank_account_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          direction?: string
          id?: string
          occurred_at?: string
          raw?: Json
          status?: string
          transfer_id?: string
          transfer_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
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
      notification_preferences: {
        Row: {
          created_at: string
          email_marketing: boolean
          email_statements: boolean
          id: string
          large_txn_amount: number
          low_balance_amount: number
          push_card: boolean
          push_deposits: boolean
          push_low_balance: boolean
          push_security: boolean
          push_transfers: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_marketing?: boolean
          email_statements?: boolean
          id?: string
          large_txn_amount?: number
          low_balance_amount?: number
          push_card?: boolean
          push_deposits?: boolean
          push_low_balance?: boolean
          push_security?: boolean
          push_transfers?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_marketing?: boolean
          email_statements?: boolean
          id?: string
          large_txn_amount?: number
          low_balance_amount?: number
          push_card?: boolean
          push_deposits?: boolean
          push_low_balance?: boolean
          push_security?: boolean
          push_transfers?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          dedupe_key: string | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          dedupe_key?: string | null
          id?: string
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          dedupe_key?: string | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
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
          date_of_birth: string | null
          email: string | null
          employer: string | null
          employment_status: string | null
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
          date_of_birth?: string | null
          email?: string | null
          employer?: string | null
          employment_status?: string | null
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
          date_of_birth?: string | null
          email?: string | null
          employer?: string | null
          employment_status?: string | null
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
      scheduled_transfer_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          occurrence_key: string
          schedule_id: string
          started_at: string
          status: string
          transaction_ref: string | null
          user_id: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          occurrence_key: string
          schedule_id: string
          started_at?: string
          status?: string
          transaction_ref?: string | null
          user_id: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          occurrence_key?: string
          schedule_id?: string
          started_at?: string
          status?: string
          transaction_ref?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_transfer_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "scheduled_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_transfers: {
        Row: {
          amount: number
          consecutive_failures: number
          created_at: string
          currency: string
          frequency: string
          from_account: string
          id: string
          kind: string
          last_error: string | null
          last_run_at: string | null
          last_transaction_ref: string | null
          memo: string | null
          metadata: Json
          needs_attention: boolean
          next_run_at: string | null
          scheduled_for: string
          status: string
          timezone: string
          to_label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          consecutive_failures?: number
          created_at?: string
          currency?: string
          frequency?: string
          from_account: string
          id?: string
          kind: string
          last_error?: string | null
          last_run_at?: string | null
          last_transaction_ref?: string | null
          memo?: string | null
          metadata?: Json
          needs_attention?: boolean
          next_run_at?: string | null
          scheduled_for: string
          status?: string
          timezone?: string
          to_label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          consecutive_failures?: number
          created_at?: string
          currency?: string
          frequency?: string
          from_account?: string
          id?: string
          kind?: string
          last_error?: string | null
          last_run_at?: string | null
          last_transaction_ref?: string | null
          memo?: string | null
          metadata?: Json
          needs_attention?: boolean
          next_run_at?: string | null
          scheduled_for?: string
          status?: string
          timezone?: string
          to_label?: string
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      transaction_categories: {
        Row: {
          category: string
          created_at: string
          id: string
          is_override: boolean
          merchant_normalized: string | null
          transaction_ref: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_override?: boolean
          merchant_normalized?: string | null
          transaction_ref: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_override?: boolean
          merchant_normalized?: string | null
          transaction_ref?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_category_rules: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          pattern: string
          priority: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          id?: string
          pattern: string
          priority?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          pattern?: string
          priority?: number
          updated_at?: string
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
      user_security_settings: {
        Row: {
          biometric_enabled: boolean
          created_at: string
          id: string
          passcode_hash: string | null
          passcode_salt: string | null
          passcode_updated_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          biometric_enabled?: boolean
          created_at?: string
          id?: string
          passcode_hash?: string | null
          passcode_salt?: string | null
          passcode_updated_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          biometric_enabled?: boolean
          created_at?: string
          id?: string
          passcode_hash?: string | null
          passcode_salt?: string | null
          passcode_updated_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webauthn_credentials: {
        Row: {
          created_at: string
          credential_id: string
          device_id: string | null
          id: string
          label: string
          last_used_at: string | null
          public_key: string | null
          transports: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_id: string
          device_id?: string | null
          id?: string
          label?: string
          last_used_at?: string | null
          public_key?: string | null
          transports?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          credential_id?: string
          device_id?: string | null
          id?: string
          label?: string
          last_used_at?: string | null
          public_key?: string | null
          transports?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          attempts: number
          error: string | null
          event_id: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          signature: string | null
          status: string
        }
        Insert: {
          attempts?: number
          error?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider: string
          received_at?: string
          signature?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          error?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          signature?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
