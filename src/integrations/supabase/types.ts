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
      admin_notifications: {
        Row: {
          created_at: string
          created_by: string | null
          cta_color: string | null
          cta_text: string | null
          global: boolean
          id: string
          image_url: string | null
          is_active: boolean
          link: string | null
          message: string
          scheduled_at: string | null
          status: string
          target_user_ids: string[] | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cta_color?: string | null
          cta_text?: string | null
          global?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          link?: string | null
          message?: string
          scheduled_at?: string | null
          status?: string
          target_user_ids?: string[] | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cta_color?: string | null
          cta_text?: string | null
          global?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          link?: string | null
          message?: string
          scheduled_at?: string | null
          status?: string
          target_user_ids?: string[] | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ads: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          image_url: string | null
          name: string
          position_name: string
          position_price: number
          start_date: string | null
          status: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          name: string
          position_name: string
          position_price?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          name?: string
          position_name?: string
          position_price?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      affiliates: {
        Row: {
          commission_rate: number
          created_at: string
          id: string
          referral_code: string
          status: string
          total_earned: number
          total_referrals: number
          user_id: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          id?: string
          referral_code: string
          status?: string
          total_earned?: number
          total_referrals?: number
          user_id: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          id?: string
          referral_code?: string
          status?: string
          total_earned?: number
          total_referrals?: number
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          abbreviation: string
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          abbreviation?: string
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          abbreviation?: string
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      b2b_tokens: {
        Row: {
          created_at: string
          id: string
          name: string | null
          status: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          status?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          status?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      banner_categories: {
        Row: {
          created_at: string
          id: string
          label: string
          position: number
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          position?: number
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          position?: number
          value?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          accent_color: string | null
          active: boolean
          audience: string
          background_color: string | null
          badge_text: string | null
          category: string | null
          created_at: string
          cta_text: string | null
          id: string
          image_pos_x: number
          image_pos_y: number
          image_style: string | null
          image_url: string | null
          image_zoom: number
          kind: string
          link_url: string | null
          position: number
          reseller_id: string | null
          subtitle: string | null
          title: string
        }
        Insert: {
          accent_color?: string | null
          active?: boolean
          audience?: string
          background_color?: string | null
          badge_text?: string | null
          category?: string | null
          created_at?: string
          cta_text?: string | null
          id?: string
          image_pos_x?: number
          image_pos_y?: number
          image_style?: string | null
          image_url?: string | null
          image_zoom?: number
          kind?: string
          link_url?: string | null
          position?: number
          reseller_id?: string | null
          subtitle?: string | null
          title: string
        }
        Update: {
          accent_color?: string | null
          active?: boolean
          audience?: string
          background_color?: string | null
          badge_text?: string | null
          category?: string | null
          created_at?: string
          cta_text?: string | null
          id?: string
          image_pos_x?: number
          image_pos_y?: number
          image_style?: string | null
          image_url?: string | null
          image_zoom?: number
          kind?: string
          link_url?: string | null
          position?: number
          reseller_id?: string | null
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      block_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      bm_tracking: {
        Row: {
          bm_link: string
          client_email: string | null
          client_name: string | null
          client_user_id: string
          created_at: string
          expires_at: string
          id: string
          notes: string | null
          notified_at: string | null
          order_id: string | null
          order_item_id: string | null
          product_name: string
          removed_at: string | null
          sale_price: number
          sold_at: string | null
          status: string
          stock_item_id: string | null
          updated_at: string
        }
        Insert: {
          bm_link: string
          client_email?: string | null
          client_name?: string | null
          client_user_id: string
          created_at?: string
          expires_at?: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_name: string
          removed_at?: string | null
          sale_price?: number
          sold_at?: string | null
          status?: string
          stock_item_id?: string | null
          updated_at?: string
        }
        Update: {
          bm_link?: string
          client_email?: string | null
          client_name?: string | null
          client_user_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_name?: string
          removed_at?: string | null
          sale_price?: number
          sold_at?: string | null
          status?: string
          stock_item_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bm_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bm_tracking_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bm_tracking_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          cash_register_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          reference_id: string | null
          source: string
          type: string
        }
        Insert: {
          amount?: number
          cash_register_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          source?: string
          type?: string
        }
        Update: {
          amount?: number
          cash_register_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          source?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_register"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register: {
        Row: {
          bank_balance: number | null
          closed_at: string | null
          created_at: string
          deposits: number
          difference: number
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_balance: number
          status: string
          system_balance: number
          system_expenses: number
          system_revenue: number
          updated_at: string
          withdrawals: number
        }
        Insert: {
          bank_balance?: number | null
          closed_at?: string | null
          created_at?: string
          deposits?: number
          difference?: number
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_balance?: number
          status?: string
          system_balance?: number
          system_expenses?: number
          system_revenue?: number
          updated_at?: string
          withdrawals?: number
        }
        Update: {
          bank_balance?: number | null
          closed_at?: string | null
          created_at?: string
          deposits?: number
          difference?: number
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_balance?: number
          status?: string
          system_balance?: number
          system_expenses?: number
          system_revenue?: number
          updated_at?: string
          withdrawals?: number
        }
        Relationships: []
      }
      client_notes: {
        Row: {
          admin_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_warming_profiles: {
        Row: {
          created_at: string
          current_day: number
          id: string
          notes: string | null
          profile_code: string
          profile_name: string | null
          start_date: string
          status: string
          track_days: number
          track_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_day?: number
          id?: string
          notes?: string | null
          profile_code: string
          profile_name?: string | null
          start_date?: string
          status?: string
          track_days?: number
          track_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_day?: number
          id?: string
          notes?: string | null
          profile_code?: string
          profile_name?: string | null
          start_date?: string
          status?: string
          track_days?: number
          track_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_warming_tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          day_number: number
          description: string | null
          id: string
          profile_id: string
          title: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          day_number: number
          description?: string | null
          id?: string
          profile_id: string
          title: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          day_number?: number
          description?: string | null
          id?: string
          profile_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_warming_tasks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_warming_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          policy_version: string | null
          preferences: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          policy_version?: string | null
          preferences?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          policy_version?: string | null
          preferences?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_transfers: {
        Row: {
          conversation_phone: string | null
          created_at: string
          created_by: string
          from_department_id: string | null
          from_user_id: string | null
          id: string
          kind: string
          note: string | null
          ticket_id: string | null
          to_department_id: string | null
          to_user_id: string | null
        }
        Insert: {
          conversation_phone?: string | null
          created_at?: string
          created_by: string
          from_department_id?: string | null
          from_user_id?: string | null
          id?: string
          kind: string
          note?: string | null
          ticket_id?: string | null
          to_department_id?: string | null
          to_user_id?: string | null
        }
        Update: {
          conversation_phone?: string | null
          created_at?: string
          created_by?: string
          from_department_id?: string | null
          from_user_id?: string | null
          id?: string
          kind?: string
          note?: string | null
          ticket_id?: string | null
          to_department_id?: string | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_transfers_from_department_id_fkey"
            columns: ["from_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_transfers_to_department_id_fkey"
            columns: ["to_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_center: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          description: string | null
          id: string
          name: string
          recurrence: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          recurrence?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          recurrence?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number
          product_id: string | null
          reseller_id: string | null
          status: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number
          product_id?: string | null
          reseller_id?: string | null
          status?: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number
          product_id?: string | null
          reseller_id?: string | null
          status?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_client_proxies: {
        Row: {
          assigned_at: string
          created_at: string
          ct_client_id: string
          id: string
          released_at: string | null
          subscription_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          ct_client_id: string
          id?: string
          released_at?: string | null
          subscription_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          ct_client_id?: string
          id?: string
          released_at?: string | null
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_client_proxies_ct_client_id_fkey"
            columns: ["ct_client_id"]
            isOneToOne: false
            referencedRelation: "ct_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_client_proxies_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_clients: {
        Row: {
          created_at: string
          id: string
          last_payment_at: string | null
          last_payment_id: string | null
          lauth_email: string | null
          lauth_status: string
          monthly_value: number
          next_billing: string | null
          notes: string | null
          payment_method: string | null
          plan_id: string | null
          start_date: string
          status: string
          telegram: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_payment_at?: string | null
          last_payment_id?: string | null
          lauth_email?: string | null
          lauth_status?: string
          monthly_value?: number
          next_billing?: string | null
          notes?: string | null
          payment_method?: string | null
          plan_id?: string | null
          start_date?: string
          status?: string
          telegram?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_payment_at?: string | null
          last_payment_id?: string | null
          lauth_email?: string | null
          lauth_status?: string
          monthly_value?: number
          next_billing?: string | null
          notes?: string | null
          payment_method?: string | null
          plan_id?: string | null
          start_date?: string
          status?: string
          telegram?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_clients_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ct_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_extra_charges: {
        Row: {
          amount: number
          created_at: string
          ct_client_id: string
          description: string
          id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          ct_client_id: string
          description: string
          id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          ct_client_id?: string
          description?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_extra_charges_ct_client_id_fkey"
            columns: ["ct_client_id"]
            isOneToOne: false
            referencedRelation: "ct_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_items: {
        Row: {
          created_at: string
          ct_client_id: string
          id: string
          identifier: string | null
          metadata: Json | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ct_client_id: string
          id?: string
          identifier?: string | null
          metadata?: Json | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ct_client_id?: string
          id?: string
          identifier?: string | null
          metadata?: Json | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_items_ct_client_id_fkey"
            columns: ["ct_client_id"]
            isOneToOne: false
            referencedRelation: "ct_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_plans: {
        Row: {
          accounts_qty: number
          active: boolean
          bms_qty: number
          combo_config: Json
          created_at: string
          id: string
          name: string
          price: number
          profiles_qty: number
          proxies_qty: number
          replacements_qty: number
          tier: string
          updated_at: string
        }
        Insert: {
          accounts_qty?: number
          active?: boolean
          bms_qty?: number
          combo_config?: Json
          created_at?: string
          id?: string
          name: string
          price?: number
          profiles_qty?: number
          proxies_qty?: number
          replacements_qty?: number
          tier?: string
          updated_at?: string
        }
        Update: {
          accounts_qty?: number
          active?: boolean
          bms_qty?: number
          combo_config?: Json
          created_at?: string
          id?: string
          name?: string
          price?: number
          profiles_qty?: number
          proxies_qty?: number
          replacements_qty?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      ct_pool_items: {
        Row: {
          assigned_at: string | null
          assigned_ct_client_id: string | null
          created_at: string
          id: string
          identifier: string | null
          metadata: Json
          notes: string | null
          plan_id: string | null
          released_at: string | null
          reserved_for_user_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_ct_client_id?: string | null
          created_at?: string
          id?: string
          identifier?: string | null
          metadata?: Json
          notes?: string | null
          plan_id?: string | null
          released_at?: string | null
          reserved_for_user_id?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_ct_client_id?: string | null
          created_at?: string
          id?: string
          identifier?: string | null
          metadata?: Json
          notes?: string | null
          plan_id?: string | null
          released_at?: string | null
          reserved_for_user_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_pool_items_assigned_ct_client_id_fkey"
            columns: ["assigned_ct_client_id"]
            isOneToOne: false
            referencedRelation: "ct_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_pool_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ct_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_replacements: {
        Row: {
          created_at: string
          ct_client_id: string
          id: string
          item_type: string
          new_item_id: string | null
          old_item_id: string | null
          performed_by: string | null
          reason: string | null
        }
        Insert: {
          created_at?: string
          ct_client_id: string
          id?: string
          item_type: string
          new_item_id?: string | null
          old_item_id?: string | null
          performed_by?: string | null
          reason?: string | null
        }
        Update: {
          created_at?: string
          ct_client_id?: string
          id?: string
          item_type?: string
          new_item_id?: string | null
          old_item_id?: string | null
          performed_by?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ct_replacements_ct_client_id_fkey"
            columns: ["ct_client_id"]
            isOneToOne: false
            referencedRelation: "ct_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_replacements_new_item_id_fkey"
            columns: ["new_item_id"]
            isOneToOne: false
            referencedRelation: "ct_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ct_replacements_old_item_id_fkey"
            columns: ["old_item_id"]
            isOneToOne: false
            referencedRelation: "ct_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ct_tickets: {
        Row: {
          created_at: string
          ct_client_id: string
          id: string
          message: string | null
          priority: string
          resolved_at: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ct_client_id: string
          id?: string
          message?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ct_client_id?: string
          id?: string
          message?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ct_tickets_ct_client_id_fkey"
            columns: ["ct_client_id"]
            isOneToOne: false
            referencedRelation: "ct_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      data_subject_requests: {
        Row: {
          created_at: string
          details: string | null
          id: string
          processed_at: string | null
          processed_by: string | null
          request_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          request_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          request_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      fb_backup_files: {
        Row: {
          account_type: string | null
          created_at: string
          fb_id: string | null
          file_name: string
          folder_id: string
          id: string
          purchase_date: string | null
          size_bytes: number | null
          storage_path: string
          unit_price: number | null
          uploaded_by: string | null
        }
        Insert: {
          account_type?: string | null
          created_at?: string
          fb_id?: string | null
          file_name: string
          folder_id: string
          id?: string
          purchase_date?: string | null
          size_bytes?: number | null
          storage_path: string
          unit_price?: number | null
          uploaded_by?: string | null
        }
        Update: {
          account_type?: string | null
          created_at?: string
          fb_id?: string | null
          file_name?: string
          folder_id?: string
          id?: string
          purchase_date?: string | null
          size_bytes?: number | null
          storage_path?: string
          unit_price?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fb_backup_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "fb_backup_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_backup_folders: {
        Row: {
          client_name: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          purchase_date: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          client_name: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          purchase_date?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          purchase_date?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      fb_finance_caixas: {
        Row: {
          alvo_percent: number
          created_at: string
          id: string
          meta: number
          nome: string
          saldo_atual: number
          tipo: string
          updated_at: string
        }
        Insert: {
          alvo_percent?: number
          created_at?: string
          id?: string
          meta?: number
          nome: string
          saldo_atual?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          alvo_percent?: number
          created_at?: string
          id?: string
          meta?: number
          nome?: string
          saldo_atual?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      fb_finance_config: {
        Row: {
          capital_giro_debt: number
          created_at: string
          distribution_percentages: Json
          id: string
          password_hash: string
          personal_distribution_percentages: Json
          updated_at: string
        }
        Insert: {
          capital_giro_debt?: number
          created_at?: string
          distribution_percentages?: Json
          id?: string
          password_hash: string
          personal_distribution_percentages?: Json
          updated_at?: string
        }
        Update: {
          capital_giro_debt?: number
          created_at?: string
          distribution_percentages?: Json
          id?: string
          password_hash?: string
          personal_distribution_percentages?: Json
          updated_at?: string
        }
        Relationships: []
      }
      fb_finance_custos_pessoais: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          dia_vencimento: number
          id: string
          nome: string
          notas: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          dia_vencimento?: number
          id?: string
          nome: string
          notas?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          dia_vencimento?: number
          id?: string
          nome?: string
          notas?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      fb_finance_despesas_planejadas: {
        Row: {
          categoria: string
          created_at: string
          dia_vencimento: number
          id: string
          mes_ref: string
          nome: string
          pago: boolean
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string
          created_at?: string
          dia_vencimento?: number
          id?: string
          mes_ref?: string
          nome: string
          pago?: boolean
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          dia_vencimento?: number
          id?: string
          mes_ref?: string
          nome?: string
          pago?: boolean
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      fb_finance_distribuicoes: {
        Row: {
          aplicado: boolean
          created_at: string
          data: string
          entrada_dia: number
          id: string
          percentuais: Json
          valores_alocados: Json
        }
        Insert: {
          aplicado?: boolean
          created_at?: string
          data?: string
          entrada_dia?: number
          id?: string
          percentuais?: Json
          valores_alocados?: Json
        }
        Update: {
          aplicado?: boolean
          created_at?: string
          data?: string
          entrada_dia?: number
          id?: string
          percentuais?: Json
          valores_alocados?: Json
        }
        Relationships: []
      }
      fb_finance_lancamentos: {
        Row: {
          caixa_destino_id: string | null
          categoria: string
          created_at: string
          data: string
          descricao: string | null
          entrada: number
          id: string
          saida: number
          tipo: string
        }
        Insert: {
          caixa_destino_id?: string | null
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string | null
          entrada?: number
          id?: string
          saida?: number
          tipo?: string
        }
        Update: {
          caixa_destino_id?: string | null
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string | null
          entrada?: number
          id?: string
          saida?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fb_finance_lancamentos_caixa_destino_id_fkey"
            columns: ["caixa_destino_id"]
            isOneToOne: false
            referencedRelation: "fb_finance_caixas"
            referencedColumns: ["id"]
          },
        ]
      }
      fbx_orders: {
        Row: {
          created_at: string
          fee_amount: number
          fee_rate: number
          id: string
          matched_at: string | null
          matched_user_id: string | null
          notes: string | null
          pix_key: string | null
          pix_qr_code: string | null
          quantity: number
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fee_amount?: number
          fee_rate?: number
          id?: string
          matched_at?: string | null
          matched_user_id?: string | null
          notes?: string | null
          pix_key?: string | null
          pix_qr_code?: string | null
          quantity: number
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fee_amount?: number
          fee_rate?: number
          id?: string
          matched_at?: string | null
          matched_user_id?: string | null
          notes?: string | null
          pix_key?: string | null
          pix_qr_code?: string | null
          quantity?: number
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fbx_transactions: {
        Row: {
          amount: number
          balance_after: number
          counterpart_user_id: string | null
          created_at: string
          description: string | null
          fee: number
          id: string
          net_amount: number
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number
          counterpart_user_id?: string | null
          created_at?: string
          description?: string | null
          fee?: number
          id?: string
          net_amount: number
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          counterpart_user_id?: string | null
          created_at?: string
          description?: string | null
          fee?: number
          id?: string
          net_amount?: number
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      friend_request_targets: {
        Row: {
          added: boolean
          added_at: string | null
          batch_id: string | null
          blocked_at: string | null
          blocked_reason: string | null
          created_at: string
          created_by: string | null
          friends_count: number | null
          friends_goal: number
          friends_updated_at: string | null
          id: string
          is_blocked: boolean
          notes: string | null
          profile_name: string | null
          profile_url: string
        }
        Insert: {
          added?: boolean
          added_at?: string | null
          batch_id?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          created_by?: string | null
          friends_count?: number | null
          friends_goal?: number
          friends_updated_at?: string | null
          id?: string
          is_blocked?: boolean
          notes?: string | null
          profile_name?: string | null
          profile_url: string
        }
        Update: {
          added?: boolean
          added_at?: string | null
          batch_id?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          created_by?: string | null
          friends_count?: number | null
          friends_goal?: number
          friends_updated_at?: string | null
          id?: string
          is_blocked?: boolean
          notes?: string | null
          profile_name?: string | null
          profile_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_request_targets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "supplier_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_folders: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      funnel_projects: {
        Row: {
          created_at: string
          edges: Json
          folder_id: string | null
          id: string
          name: string
          nodes: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          edges?: Json
          folder_id?: string | null
          id?: string
          name: string
          nodes?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          edges?: Json
          folder_id?: string | null
          id?: string
          name?: string
          nodes?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_projects_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "funnel_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_proxy_configs: {
        Row: {
          alt_http_port: number
          converted_host: string | null
          country_code: string
          created_at: string
          host: string | null
          http_port: number
          id: string
          label: string
          last_verified_at: string | null
          notes: string | null
          password: string | null
          provider_slug: string
          socks5_port: number
          source: string
          status: string
          updated_at: string
          username: string | null
        }
        Insert: {
          alt_http_port?: number
          converted_host?: string | null
          country_code?: string
          created_at?: string
          host?: string | null
          http_port?: number
          id?: string
          label?: string
          last_verified_at?: string | null
          notes?: string | null
          password?: string | null
          provider_slug?: string
          socks5_port?: number
          source?: string
          status?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          alt_http_port?: number
          converted_host?: string | null
          country_code?: string
          created_at?: string
          host?: string | null
          http_port?: number
          id?: string
          label?: string
          last_verified_at?: string | null
          notes?: string | null
          password?: string | null
          provider_slug?: string
          socks5_port?: number
          source?: string
          status?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      invoice_links: {
        Row: {
          amount: number
          client_email: string | null
          client_name: string | null
          client_user_id: string
          code: string
          created_at: string
          created_by: string
          description: string | null
          expires_at: string
          id: string
          mp_payment_id: string | null
          paid_at: string | null
          payment_id: string | null
          product_id: string | null
          product_name: string
          qr_code: string | null
          qr_code_base64: string | null
          reference_date: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_email?: string | null
          client_name?: string | null
          client_user_id: string
          code?: string
          created_at?: string
          created_by: string
          description?: string | null
          expires_at?: string
          id?: string
          mp_payment_id?: string | null
          paid_at?: string | null
          payment_id?: string | null
          product_id?: string | null
          product_name: string
          qr_code?: string | null
          qr_code_base64?: string | null
          reference_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_email?: string | null
          client_name?: string | null
          client_user_id?: string
          code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          expires_at?: string
          id?: string
          mp_payment_id?: string | null
          paid_at?: string | null
          payment_id?: string | null
          product_id?: string | null
          product_name?: string
          qr_code?: string | null
          qr_code_base64?: string | null
          reference_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_links_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_bm_finance: {
        Row: {
          bm_id: string
          cost: number
          created_at: string
          tax_percent: number
          updated_at: string
        }
        Insert: {
          bm_id: string
          cost?: number
          created_at?: string
          tax_percent?: number
          updated_at?: string
        }
        Update: {
          bm_id?: string
          cost?: number
          created_at?: string
          tax_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_bm_finance_bm_id_fkey"
            columns: ["bm_id"]
            isOneToOne: true
            referencedRelation: "marketplace_bms"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_bm_leads: {
        Row: {
          accounts: number | null
          asking_price: number
          bm_name: string
          country: string
          created_at: string
          created_year: string | null
          gasto_total: number | null
          id: string
          limit_daily: string | null
          method: string | null
          notes: string | null
          risk: string | null
          seller_name: string
          seller_whatsapp: string
          status: string
          verification: string | null
        }
        Insert: {
          accounts?: number | null
          asking_price: number
          bm_name: string
          country?: string
          created_at?: string
          created_year?: string | null
          gasto_total?: number | null
          id?: string
          limit_daily?: string | null
          method?: string | null
          notes?: string | null
          risk?: string | null
          seller_name: string
          seller_whatsapp: string
          status?: string
          verification?: string | null
        }
        Update: {
          accounts?: number | null
          asking_price?: number
          bm_name?: string
          country?: string
          created_at?: string
          created_year?: string | null
          gasto_total?: number | null
          id?: string
          limit_daily?: string | null
          method?: string | null
          notes?: string | null
          risk?: string | null
          seller_name?: string
          seller_whatsapp?: string
          status?: string
          verification?: string | null
        }
        Relationships: []
      }
      marketplace_bms: {
        Row: {
          accounts: number
          bm_id: string | null
          code: string
          country: string
          created_at: string
          created_year: string
          details: Json | null
          gasto_total: number
          id: string
          is_active: boolean
          limit_daily: string
          method: string
          name: string
          price: number
          risk: string
          sort_order: number
          updated_at: string
          verification: string
        }
        Insert: {
          accounts?: number
          bm_id?: string | null
          code?: string
          country?: string
          created_at?: string
          created_year?: string
          details?: Json | null
          gasto_total?: number
          id?: string
          is_active?: boolean
          limit_daily?: string
          method?: string
          name: string
          price?: number
          risk?: string
          sort_order?: number
          updated_at?: string
          verification?: string
        }
        Update: {
          accounts?: number
          bm_id?: string | null
          code?: string
          country?: string
          created_at?: string
          created_year?: string
          details?: Json | null
          gasto_total?: number
          id?: string
          is_active?: boolean
          limit_daily?: string
          method?: string
          name?: string
          price?: number
          risk?: string
          sort_order?: number
          updated_at?: string
          verification?: string
        }
        Relationships: []
      }
      migration_tracking: {
        Row: {
          added_by: string | null
          contacted: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          migrated_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          contacted?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          migrated_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          contacted?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          migrated_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      moderator_permissions: {
        Row: {
          allowed_paths: string[]
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_paths?: string[]
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_paths?: string[]
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_sounds: {
        Row: {
          active: boolean
          created_at: string
          event_key: string
          file_name: string | null
          id: string
          label: string
          sound_url: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          event_key: string
          file_name?: string | null
          id?: string
          label: string
          sound_url?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          event_key?: string
          file_name?: string | null
          id?: string
          label?: string
          sound_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          campaign_id: string | null
          created_at: string
          cta_color: string | null
          cta_text: string | null
          global: boolean
          id: string
          image_url: string | null
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          cta_color?: string | null
          cta_text?: string | null
          global?: boolean
          id?: string
          image_url?: string | null
          link?: string | null
          message: string
          read?: boolean
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          cta_color?: string | null
          cta_text?: string | null
          global?: boolean
          id?: string
          image_url?: string | null
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "admin_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      openpix_saved_pix_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          pix_key: string
          pix_key_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          pix_key: string
          pix_key_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          pix_key?: string
          pix_key_type?: string
        }
        Relationships: []
      }
      openpix_withdrawals: {
        Row: {
          amount: number
          confirmation_code: string
          confirmed_at: string | null
          created_at: string
          description: string | null
          error_message: string | null
          executed_at: string | null
          expires_at: string
          id: string
          openpix_transaction_id: string | null
          pix_key: string
          pix_key_name: string | null
          pix_key_type: string
          requested_by: string
          status: string
        }
        Insert: {
          amount: number
          confirmation_code: string
          confirmed_at?: string | null
          created_at?: string
          description?: string | null
          error_message?: string | null
          executed_at?: string | null
          expires_at: string
          id?: string
          openpix_transaction_id?: string | null
          pix_key: string
          pix_key_name?: string | null
          pix_key_type: string
          requested_by: string
          status?: string
        }
        Update: {
          amount?: number
          confirmation_code?: string
          confirmed_at?: string | null
          created_at?: string
          description?: string | null
          error_message?: string | null
          executed_at?: string | null
          expires_at?: string
          id?: string
          openpix_transaction_id?: string | null
          pix_key?: string
          pix_key_name?: string | null
          pix_key_type?: string
          requested_by?: string
          status?: string
        }
        Relationships: []
      }
      operator_earnings: {
        Row: {
          amount: number
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string | null
          frozen_at: string | null
          id: string
          profile_code: string
          profile_id: string | null
          status: string
          task_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          frozen_at?: string | null
          id?: string
          profile_code: string
          profile_id?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          frozen_at?: string | null
          id?: string
          profile_code?: string
          profile_id?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_earnings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "warming_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_financials: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          pix_bank: string | null
          pix_holder_name: string | null
          pix_key: string | null
          pix_key_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          pix_bank?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          pix_bank?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      operator_withdrawals: {
        Row: {
          amount: number
          approved_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          requested_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          requested_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          requested_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_bumps: {
        Row: {
          active: boolean
          bump_product_id: string
          bump_type: string
          created_at: string
          discount_percent: number
          fixed_price: number | null
          id: string
          is_combo: boolean | null
          label: string | null
          position: number
          product_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bump_product_id: string
          bump_type?: string
          created_at?: string
          discount_percent?: number
          fixed_price?: number | null
          id?: string
          is_combo?: boolean | null
          label?: string | null
          position?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bump_product_id?: string
          bump_type?: string
          created_at?: string
          discount_percent?: number
          fixed_price?: number | null
          id?: string
          is_combo?: boolean | null
          label?: string | null
          position?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_bumps_bump_product_id_fkey"
            columns: ["bump_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_bumps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          delivery_data: Json | null
          description: string | null
          id: string
          name: string
          order_id: string
          price: number
          product_id: string | null
          quantity: number
        }
        Insert: {
          created_at?: string
          delivery_data?: Json | null
          description?: string | null
          id?: string
          name: string
          order_id: string
          price: number
          product_id?: string | null
          quantity?: number
        }
        Update: {
          created_at?: string
          delivery_data?: Json | null
          description?: string | null
          id?: string
          name?: string
          order_id?: string
          price?: number
          product_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          code: string
          coupon_code: string | null
          created_at: string
          discount: number
          id: string
          partner_id: string | null
          payment_expiry: string | null
          payment_last4: string | null
          payment_method: string | null
          push_notified_at: string | null
          reseller_id: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          coupon_code?: string | null
          created_at?: string
          discount?: number
          id?: string
          partner_id?: string | null
          payment_expiry?: string | null
          payment_last4?: string | null
          payment_method?: string | null
          push_notified_at?: string | null
          reseller_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          coupon_code?: string | null
          created_at?: string
          discount?: number
          id?: string
          partner_id?: string | null
          payment_expiry?: string | null
          payment_last4?: string | null
          payment_method?: string | null
          push_notified_at?: string | null
          reseller_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      page_requests: {
        Row: {
          all_on_one_profile: boolean
          client_name: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          order_code: string
          order_item_id: string
          product_name: string
          profile_links: string[]
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_on_one_profile?: boolean
          client_name?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          order_code: string
          order_item_id: string
          product_name: string
          profile_links?: string[]
          quantity?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_on_one_profile?: boolean
          client_name?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          order_code?: string
          order_item_id?: string
          product_name?: string
          profile_links?: string[]
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_banners: {
        Row: {
          active: boolean | null
          background_color: string | null
          category: string | null
          created_at: string | null
          cta_text: string | null
          id: string
          image_style: string | null
          image_url: string | null
          link_url: string | null
          position: number | null
          subtitle: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          background_color?: string | null
          category?: string | null
          created_at?: string | null
          cta_text?: string | null
          id?: string
          image_style?: string | null
          image_url?: string | null
          link_url?: string | null
          position?: number | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          background_color?: string | null
          category?: string | null
          created_at?: string | null
          cta_text?: string | null
          id?: string
          image_style?: string | null
          image_url?: string | null
          link_url?: string | null
          position?: number | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      partner_campaigns: {
        Row: {
          clicks: number
          conversions: number
          created_at: string
          destination_url: string
          id: string
          name: string
          partner_id: string
          short_code: string
          status: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          clicks?: number
          conversions?: number
          created_at?: string
          destination_url: string
          id?: string
          name: string
          partner_id: string
          short_code: string
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          clicks?: number
          conversions?: number
          created_at?: string
          destination_url?: string
          id?: string
          name?: string
          partner_id?: string
          short_code?: string
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_campaigns_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_creatives: {
        Row: {
          copy_text: string | null
          created_at: string
          description: string | null
          id: string
          media_url: string | null
          product_id: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          copy_text?: string | null
          created_at?: string
          description?: string | null
          id?: string
          media_url?: string | null
          product_id?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          copy_text?: string | null
          created_at?: string
          description?: string | null
          id?: string
          media_url?: string | null
          product_id?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_journey_events: {
        Row: {
          amount: number | null
          commission_amount: number | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          order_id: string | null
          partner_id: string | null
          product_id: string | null
          product_name: string | null
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          amount?: number | null
          commission_amount?: number | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
          partner_id?: string | null
          product_id?: string | null
          product_name?: string | null
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          amount?: number | null
          commission_amount?: number | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
          partner_id?: string | null
          product_id?: string | null
          product_name?: string | null
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_journey_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_journey_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_journey_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_pixels: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          partner_id: string
          pixel_id: string
          platform: string
          status: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          partner_id: string
          pixel_id: string
          platform: string
          status?: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          partner_id?: string
          pixel_id?: string
          platform?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_pixels_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_referrals: {
        Row: {
          commission_amount: number
          created_at: string
          credited_at: string | null
          id: string
          order_id: string | null
          order_total: number
          partner_id: string
          referred_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          credited_at?: string | null
          id?: string
          order_id?: string | null
          order_total?: number
          partner_id: string
          referred_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          credited_at?: string | null
          id?: string
          order_id?: string | null
          order_total?: number
          partner_id?: string
          referred_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_referrals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          holder_name: string | null
          id: string
          paid_at: string | null
          partner_id: string
          pix_key: string
          pix_key_type: string
          rejected_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          holder_name?: string | null
          id?: string
          paid_at?: string | null
          partner_id: string
          pix_key: string
          pix_key_type?: string
          rejected_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          holder_name?: string | null
          id?: string
          paid_at?: string | null
          partner_id?: string
          pix_key?: string
          pix_key_type?: string
          rejected_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_withdrawals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          balance: number
          commission_rate: number
          created_at: string
          guarantee_days: number
          id: string
          pix_bank: string | null
          pix_holder_document: string | null
          pix_holder_name: string | null
          pix_key: string | null
          pix_key_type: string | null
          slug: string
          status: string
          total_earned: number
          total_referrals: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          commission_rate?: number
          created_at?: string
          guarantee_days?: number
          id?: string
          pix_bank?: string | null
          pix_holder_document?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          slug: string
          status?: string
          total_earned?: number
          total_referrals?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          commission_rate?: number
          created_at?: string
          guarantee_days?: number
          id?: string
          pix_bank?: string | null
          pix_holder_document?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          slug?: string
          status?: string
          total_earned?: number
          total_referrals?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          phone: string
          used: boolean
          user_id: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          phone: string
          used?: boolean
          user_id: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          phone?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          code: string
          created_at: string
          gateway: string
          gateway_reference: string | null
          id: string
          metadata: Json | null
          order_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          gateway: string
          gateway_reference?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          gateway?: string
          gateway_reference?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_templates: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          position: number
          tasks: Json
          track_days: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          position?: number
          tasks?: Json
          track_days?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          tasks?: Json
          track_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_feedback: {
        Row: {
          created_at: string
          id: string
          label: string
          rating: number
          suggestion: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          rating: number
          suggestion?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          rating?: number
          suggestion?: string | null
          user_id?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          restricted_to: string[] | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          restricted_to?: string[] | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          restricted_to?: string[] | null
          slug?: string
        }
        Relationships: []
      }
      product_costs: {
        Row: {
          created_at: string
          id: string
          labor_cost: number
          notes: string | null
          other_costs: number
          product_id: string
          tax_percent: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          labor_cost?: number
          notes?: string | null
          other_costs?: number
          product_id: string
          tax_percent?: number
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          labor_cost?: number
          notes?: string | null
          other_costs?: number
          product_id?: string
          tax_percent?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_defaults: {
        Row: {
          created_at: string
          default_image: string | null
          description: string | null
          id: string
          name: string
          price: number
          tags: string[]
          tempo_plataforma: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_image?: string | null
          description?: string | null
          id?: string
          name: string
          price?: number
          tags?: string[]
          tempo_plataforma?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_image?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number
          tags?: string[]
          tempo_plataforma?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_exchanges: {
        Row: {
          client_name: string | null
          client_user_id: string
          created_at: string
          id: string
          new_product_id: string | null
          new_product_name: string
          new_stock_item_id: string | null
          order_id: string
          order_item_id: string
          original_product_id: string | null
          original_product_name: string
          original_stock_item_id: string | null
          performed_by: string
          price_difference: number
          reason: string | null
          wallet_adjusted: boolean
        }
        Insert: {
          client_name?: string | null
          client_user_id: string
          created_at?: string
          id?: string
          new_product_id?: string | null
          new_product_name: string
          new_stock_item_id?: string | null
          order_id: string
          order_item_id: string
          original_product_id?: string | null
          original_product_name: string
          original_stock_item_id?: string | null
          performed_by: string
          price_difference?: number
          reason?: string | null
          wallet_adjusted?: boolean
        }
        Update: {
          client_name?: string | null
          client_user_id?: string
          created_at?: string
          id?: string
          new_product_id?: string | null
          new_product_name?: string
          new_stock_item_id?: string | null
          order_id?: string
          order_item_id?: string
          original_product_id?: string | null
          original_product_name?: string
          original_stock_item_id?: string | null
          performed_by?: string
          price_difference?: number
          reason?: string | null
          wallet_adjusted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_exchanges_new_product_id_fkey"
            columns: ["new_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_exchanges_new_stock_item_id_fkey"
            columns: ["new_stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_exchanges_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_exchanges_original_product_id_fkey"
            columns: ["original_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_exchanges_original_stock_item_id_fkey"
            columns: ["original_stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          url: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          name: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          url?: string
        }
        Relationships: []
      }
      product_views: {
        Row: {
          id: string
          product_id: string
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          product_id: string
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: []
      }
      product_waitlist: {
        Row: {
          created_at: string
          id: string
          product_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_waitlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean
          badge_color: string | null
          badge_icon: string | null
          badge_text: string | null
          category_id: string | null
          created_at: string
          description: string | null
          external_id: string | null
          icon_type: string | null
          id: string
          image_url: string | null
          included_proxy_product_id: string | null
          included_proxy_qty: number
          name: string
          price: number
          price_label: string | null
          reseller_cost: number
          slug: string | null
          status: string
          stock: number
          tags: string[] | null
          updated_at: string
          whatsapp_group_link: string | null
        }
        Insert: {
          available?: boolean
          badge_color?: string | null
          badge_icon?: string | null
          badge_text?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          icon_type?: string | null
          id?: string
          image_url?: string | null
          included_proxy_product_id?: string | null
          included_proxy_qty?: number
          name: string
          price?: number
          price_label?: string | null
          reseller_cost?: number
          slug?: string | null
          status?: string
          stock?: number
          tags?: string[] | null
          updated_at?: string
          whatsapp_group_link?: string | null
        }
        Update: {
          available?: boolean
          badge_color?: string | null
          badge_icon?: string | null
          badge_text?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          icon_type?: string | null
          id?: string
          image_url?: string | null
          included_proxy_product_id?: string | null
          included_proxy_qty?: number
          name?: string
          price?: number
          price_label?: string | null
          reseller_cost?: number
          slug?: string | null
          status?: string
          stock?: number
          tags?: string[] | null
          updated_at?: string
          whatsapp_group_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_included_proxy_product_id_fkey"
            columns: ["included_proxy_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          automatic_invoice: boolean | null
          avatar_url: string | null
          bairro: string | null
          balance: number
          birth_date: string | null
          card_payment_enabled: boolean
          cep: string | null
          cidade: string | null
          cpf: string | null
          created_at: string
          department: string | null
          department_id: string | null
          document_url: string | null
          estado: string | null
          fbx_balance: number
          first_login_at: string | null
          full_name: string | null
          id: string
          is_api_authorized: boolean | null
          lauth_email: string | null
          lauth_enabled: boolean | null
          numero: string | null
          phone: string | null
          preferred_proxy_city: string | null
          proxy_fixed_price: number | null
          proxy_price_multiplier: number | null
          referrer_id: string | null
          reseller_id: string | null
          rua: string | null
          show_proxy_city_on_checkout: boolean
          status: string
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
          verified: boolean
          wa_signature: string | null
        }
        Insert: {
          address?: string | null
          automatic_invoice?: boolean | null
          avatar_url?: string | null
          bairro?: string | null
          balance?: number
          birth_date?: string | null
          card_payment_enabled?: boolean
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          document_url?: string | null
          estado?: string | null
          fbx_balance?: number
          first_login_at?: string | null
          full_name?: string | null
          id?: string
          is_api_authorized?: boolean | null
          lauth_email?: string | null
          lauth_enabled?: boolean | null
          numero?: string | null
          phone?: string | null
          preferred_proxy_city?: string | null
          proxy_fixed_price?: number | null
          proxy_price_multiplier?: number | null
          referrer_id?: string | null
          reseller_id?: string | null
          rua?: string | null
          show_proxy_city_on_checkout?: boolean
          status?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
          wa_signature?: string | null
        }
        Update: {
          address?: string | null
          automatic_invoice?: boolean | null
          avatar_url?: string | null
          bairro?: string | null
          balance?: number
          birth_date?: string | null
          card_payment_enabled?: boolean
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          document_url?: string | null
          estado?: string | null
          fbx_balance?: number
          first_login_at?: string | null
          full_name?: string | null
          id?: string
          is_api_authorized?: boolean | null
          lauth_email?: string | null
          lauth_enabled?: boolean | null
          numero?: string | null
          phone?: string | null
          preferred_proxy_city?: string | null
          proxy_fixed_price?: number | null
          proxy_price_multiplier?: number | null
          referrer_id?: string | null
          reseller_id?: string | null
          rua?: string | null
          show_proxy_city_on_checkout?: boolean
          status?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
          wa_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      proxy_usage_alerts: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          metric: string
          period: string
          threshold: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metric: string
          period: string
          threshold: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metric?: string
          period?: string
          threshold?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      proxy_usage_logs: {
        Row: {
          bytes_downloaded: number | null
          bytes_uploaded: number | null
          created_at: string | null
          id: string
          period_end: string
          period_start: string
          subscription_id: string | null
          supplier: string | null
          user_id: string | null
        }
        Insert: {
          bytes_downloaded?: number | null
          bytes_uploaded?: number | null
          created_at?: string | null
          id?: string
          period_end: string
          period_start: string
          subscription_id?: string | null
          supplier?: string | null
          user_id?: string | null
        }
        Update: {
          bytes_downloaded?: number | null
          bytes_uploaded?: number | null
          created_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          subscription_id?: string | null
          supplier?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proxy_usage_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          created_at: string
          description: string | null
          id: string
          quantity: number
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          quantity?: number
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          quantity?: number
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string
          description: string | null
          id: string
          item_type: string
          provider_link: string | null
          provider_name: string
          purchase_date: string
          quantity: number
          sale_price: number
          tax_rate: number
          total_value: number
          unit_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          item_type: string
          provider_link?: string | null
          provider_name: string
          purchase_date: string
          quantity?: number
          sale_price?: number
          tax_rate?: number
          total_value?: number
          unit_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          item_type?: string
          provider_link?: string | null
          provider_name?: string
          purchase_date?: string
          quantity?: number
          sale_price?: number
          tax_rate?: number
          total_value?: number
          unit_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          scope: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          scope?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          scope?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      replacements: {
        Row: {
          client_name: string | null
          client_user_id: string
          created_at: string
          created_by: string
          id: string
          item_name: string
          item_value: number
          new_stock_item_id: string | null
          notes: string | null
          order_id: string | null
          order_item_id: string | null
          product_name: string
          reason: string
          stock_item_id: string | null
        }
        Insert: {
          client_name?: string | null
          client_user_id: string
          created_at?: string
          created_by: string
          id?: string
          item_name: string
          item_value?: number
          new_stock_item_id?: string | null
          notes?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_name: string
          reason: string
          stock_item_id?: string | null
        }
        Update: {
          client_name?: string | null
          client_user_id?: string
          created_at?: string
          created_by?: string
          id?: string
          item_name?: string
          item_value?: number
          new_stock_item_id?: string | null
          notes?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_name?: string
          reason?: string
          stock_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replacements_new_stock_item_id_fkey"
            columns: ["new_stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacements_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacements_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_commissions: {
        Row: {
          commission_amount: number
          created_at: string
          credited_at: string | null
          id: string
          order_id: string | null
          order_total: number
          referred_user_id: string | null
          reseller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          commission_amount: number
          created_at?: string
          credited_at?: string | null
          id?: string
          order_id?: string | null
          order_total: number
          referred_user_id?: string | null
          reseller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          credited_at?: string | null
          id?: string
          order_id?: string | null
          order_total?: number
          referred_user_id?: string | null
          reseller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_commissions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_credit_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          reseller_id: string
          type: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reseller_id: string
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reseller_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_credit_ledger_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_price_overrides: {
        Row: {
          created_at: string
          custom_price: number
          enabled: boolean
          id: string
          product_id: string
          reseller_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_price: number
          enabled?: boolean
          id?: string
          product_id: string
          reseller_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_price?: number
          enabled?: boolean
          id?: string
          product_id?: string
          reseller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_price_overrides_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_product_tags: {
        Row: {
          created_at: string
          id: string
          product_id: string
          reseller_id: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          reseller_id: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          reseller_id?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_product_tags_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          about_text: string | null
          accent_color: string | null
          balance_credits: number
          brand_name: string | null
          cnpj: string | null
          commission_rate: number
          company_name: string
          created_at: string
          custom_domain: string | null
          domain_status: string | null
          domain_verification_token: string | null
          domain_verified_at: string | null
          favicon_url: string | null
          gateway_mp_access_token: string | null
          gateway_mp_public_key: string | null
          gateway_openpix_app_id: string | null
          gateway_provider: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          logo_url: string | null
          lovable_verify_token: string | null
          maintenance_day_price: number
          maintenance_swap_price: number
          min_monthly_recharge: number
          min_proxies_per_month: number
          model: string
          openpix_pix_key: string | null
          openpix_pix_key_type: string | null
          primary_color: string | null
          proxy_fixed_price: number | null
          proxy_price_mode: string
          proxy_price_multiplier: number
          proxy_unit_cost: number
          slug: string
          status: string
          support_email: string | null
          support_whatsapp: string | null
          total_commissions_earned: number
          total_gmv: number
          total_referrals: number
          updated_at: string
          user_id: string
        }
        Insert: {
          about_text?: string | null
          accent_color?: string | null
          balance_credits?: number
          brand_name?: string | null
          cnpj?: string | null
          commission_rate?: number
          company_name: string
          created_at?: string
          custom_domain?: string | null
          domain_status?: string | null
          domain_verification_token?: string | null
          domain_verified_at?: string | null
          favicon_url?: string | null
          gateway_mp_access_token?: string | null
          gateway_mp_public_key?: string | null
          gateway_openpix_app_id?: string | null
          gateway_provider?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          logo_url?: string | null
          lovable_verify_token?: string | null
          maintenance_day_price?: number
          maintenance_swap_price?: number
          min_monthly_recharge?: number
          min_proxies_per_month?: number
          model?: string
          openpix_pix_key?: string | null
          openpix_pix_key_type?: string | null
          primary_color?: string | null
          proxy_fixed_price?: number | null
          proxy_price_mode?: string
          proxy_price_multiplier?: number
          proxy_unit_cost?: number
          slug: string
          status?: string
          support_email?: string | null
          support_whatsapp?: string | null
          total_commissions_earned?: number
          total_gmv?: number
          total_referrals?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          about_text?: string | null
          accent_color?: string | null
          balance_credits?: number
          brand_name?: string | null
          cnpj?: string | null
          commission_rate?: number
          company_name?: string
          created_at?: string
          custom_domain?: string | null
          domain_status?: string | null
          domain_verification_token?: string | null
          domain_verified_at?: string | null
          favicon_url?: string | null
          gateway_mp_access_token?: string | null
          gateway_mp_public_key?: string | null
          gateway_openpix_app_id?: string | null
          gateway_provider?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          logo_url?: string | null
          lovable_verify_token?: string | null
          maintenance_day_price?: number
          maintenance_swap_price?: number
          min_monthly_recharge?: number
          min_proxies_per_month?: number
          model?: string
          openpix_pix_key?: string | null
          openpix_pix_key_type?: string | null
          primary_color?: string | null
          proxy_fixed_price?: number | null
          proxy_price_mode?: string
          proxy_price_multiplier?: number
          proxy_unit_cost?: number
          slug?: string
          status?: string
          support_email?: string | null
          support_whatsapp?: string | null
          total_commissions_earned?: number
          total_gmv?: number
          total_referrals?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      safe_bm_renewals: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          new_bm_link: string | null
          order_id: string | null
          paid_at: string | null
          status: string
          updated_at: string
          user_id: string
          vault_id: string | null
          verified_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          new_bm_link?: string | null
          order_id?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vault_id?: string | null
          verified_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          new_bm_link?: string | null
          order_id?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vault_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safe_bm_renewals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safe_bm_renewals_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "safe_bm_vaults"
            referencedColumns: ["id"]
          },
        ]
      }
      safe_bm_vaults: {
        Row: {
          auto_renew: boolean | null
          backup_link: string | null
          backup_link_set_at: string | null
          billing_status: string | null
          bm_link: string
          bm_name: string
          bm_tracking_id: string | null
          client_name: string | null
          created_at: string
          grace_notifications: Json | null
          id: string
          last_billing_at: string | null
          link_health: string
          link_health_checked_at: string | null
          link_regenerations: number
          next_billing_at: string | null
          notes: string | null
          perfil_backup: string | null
          protection_start: string
          purchase_date: string | null
          safe_email: string | null
          status: string
          subscription_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean | null
          backup_link?: string | null
          backup_link_set_at?: string | null
          billing_status?: string | null
          bm_link: string
          bm_name: string
          bm_tracking_id?: string | null
          client_name?: string | null
          created_at?: string
          grace_notifications?: Json | null
          id?: string
          last_billing_at?: string | null
          link_health?: string
          link_health_checked_at?: string | null
          link_regenerations?: number
          next_billing_at?: string | null
          notes?: string | null
          perfil_backup?: string | null
          protection_start?: string
          purchase_date?: string | null
          safe_email?: string | null
          status?: string
          subscription_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean | null
          backup_link?: string | null
          backup_link_set_at?: string | null
          billing_status?: string | null
          bm_link?: string
          bm_name?: string
          bm_tracking_id?: string | null
          client_name?: string | null
          created_at?: string
          grace_notifications?: Json | null
          id?: string
          last_billing_at?: string | null
          link_health?: string
          link_health_checked_at?: string | null
          link_regenerations?: number
          next_billing_at?: string | null
          notes?: string | null
          perfil_backup?: string | null
          protection_start?: string
          purchase_date?: string | null
          safe_email?: string | null
          status?: string
          subscription_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safe_bm_vaults_bm_tracking_id_fkey"
            columns: ["bm_tracking_id"]
            isOneToOne: false
            referencedRelation: "bm_tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      ss_favorites: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ss_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ss_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      ss_listings: {
        Row: {
          account_age_months: number | null
          created_at: string
          currency: string
          description: string | null
          engagement_rate: number | null
          featured: boolean
          followers: number
          has_original_email: boolean
          id: string
          is_monetized: boolean
          is_verified: boolean
          metrics: Json | null
          niche: string | null
          platform: string
          price: number
          screenshots: Json | null
          seller_id: string
          slug: string | null
          status: string
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          account_age_months?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          engagement_rate?: number | null
          featured?: boolean
          followers?: number
          has_original_email?: boolean
          id?: string
          is_monetized?: boolean
          is_verified?: boolean
          metrics?: Json | null
          niche?: string | null
          platform?: string
          price?: number
          screenshots?: Json | null
          seller_id: string
          slug?: string | null
          status?: string
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          account_age_months?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          engagement_rate?: number | null
          featured?: boolean
          followers?: number
          has_original_email?: boolean
          id?: string
          is_monetized?: boolean
          is_verified?: boolean
          metrics?: Json | null
          niche?: string | null
          platform?: string
          price?: number
          screenshots?: Json | null
          seller_id?: string
          slug?: string | null
          status?: string
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      ss_messages: {
        Row: {
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          read: boolean
          sender_id: string
          transaction_id: string
        }
        Insert: {
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id: string
          transaction_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ss_messages_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "ss_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ss_messages_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "ss_transactions_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      ss_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewed_user_id: string
          reviewer_id: string
          transaction_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewed_user_id: string
          reviewer_id: string
          transaction_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewed_user_id?: string
          reviewer_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ss_reviews_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "ss_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ss_reviews_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "ss_transactions_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      ss_transactions: {
        Row: {
          account_credentials: Json | null
          amount: number
          buyer_id: string
          confirmed_at: string | null
          created_at: string
          delivered_at: string | null
          dispute_reason: string | null
          dispute_resolution: string | null
          disputed_at: string | null
          fee_rate: number
          id: string
          listing_id: string
          notes: string | null
          platform_fee: number
          seller_id: string
          status: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_checklist: Json | null
        }
        Insert: {
          account_credentials?: Json | null
          amount?: number
          buyer_id: string
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          dispute_reason?: string | null
          dispute_resolution?: string | null
          disputed_at?: string | null
          fee_rate?: number
          id?: string
          listing_id: string
          notes?: string | null
          platform_fee?: number
          seller_id: string
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_checklist?: Json | null
        }
        Update: {
          account_credentials?: Json | null
          amount?: number
          buyer_id?: string
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          dispute_reason?: string | null
          dispute_resolution?: string | null
          disputed_at?: string | null
          fee_rate?: number
          id?: string
          listing_id?: string
          notes?: string | null
          platform_fee?: number
          seller_id?: string
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_checklist?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ss_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ss_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_folders: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          created_at: string
          data: Json | null
          deleted_at: string | null
          folder: string | null
          id: string
          identification: string | null
          identification_link: string | null
          name: string
          order_item_id: string | null
          parent_id: string | null
          product_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          deleted_at?: string | null
          folder?: string | null
          id?: string
          identification?: string | null
          identification_link?: string | null
          name: string
          order_item_id?: string | null
          parent_id?: string | null
          product_id?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          deleted_at?: string | null
          folder?: string | null
          id?: string
          identification?: string | null
          identification_link?: string | null
          name?: string
          order_item_id?: string | null
          parent_id?: string | null
          product_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          auto_renew: boolean
          cancelled_at: string | null
          created_at: string
          end_date: string | null
          grace_notifications: Json | null
          id: string
          included_in_ct_client_id: string | null
          name: string
          notifications_enabled: boolean
          product_id: string | null
          raw_data: Json | null
          reseller_id: string | null
          start_date: string
          status: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          cancelled_at?: string | null
          created_at?: string
          end_date?: string | null
          grace_notifications?: Json | null
          id?: string
          included_in_ct_client_id?: string | null
          name: string
          notifications_enabled?: boolean
          product_id?: string | null
          raw_data?: Json | null
          reseller_id?: string | null
          start_date?: string
          status?: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          cancelled_at?: string | null
          created_at?: string
          end_date?: string | null
          grace_notifications?: Json | null
          id?: string
          included_in_ct_client_id?: string | null
          name?: string
          notifications_enabled?: boolean
          product_id?: string | null
          raw_data?: Json | null
          reseller_id?: string | null
          start_date?: string
          status?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_included_in_ct_client_id_fkey"
            columns: ["included_in_ct_client_id"]
            isOneToOne: false
            referencedRelation: "ct_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_accounts: {
        Row: {
          account_year: number | null
          batch_id: string
          birth_date: string | null
          client_name: string | null
          country: string | null
          created_at: string
          email_alt: string | null
          email_password: string | null
          email_password_enc: string | null
          email_principal: string | null
          has_bm: boolean
          id: string
          is_replacement: boolean | null
          logged_in: boolean
          login: string | null
          login_result: string | null
          notes: string | null
          password: string | null
          password_enc: string | null
          profile_link: string | null
          profile_name: string | null
          sold: boolean
          sold_at: string | null
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          account_year?: number | null
          batch_id: string
          birth_date?: string | null
          client_name?: string | null
          country?: string | null
          created_at?: string
          email_alt?: string | null
          email_password?: string | null
          email_password_enc?: string | null
          email_principal?: string | null
          has_bm?: boolean
          id?: string
          is_replacement?: boolean | null
          logged_in?: boolean
          login?: string | null
          login_result?: string | null
          notes?: string | null
          password?: string | null
          password_enc?: string | null
          profile_link?: string | null
          profile_name?: string | null
          sold?: boolean
          sold_at?: string | null
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          account_year?: number | null
          batch_id?: string
          birth_date?: string | null
          client_name?: string | null
          country?: string | null
          created_at?: string
          email_alt?: string | null
          email_password?: string | null
          email_password_enc?: string | null
          email_principal?: string | null
          has_bm?: boolean
          id?: string
          is_replacement?: boolean | null
          logged_in?: boolean
          login?: string | null
          login_result?: string | null
          notes?: string | null
          password?: string | null
          password_enc?: string | null
          profile_link?: string | null
          profile_name?: string | null
          sold?: boolean
          sold_at?: string | null
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_accounts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "supplier_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_accounts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_batches: {
        Row: {
          created_at: string
          created_by: string | null
          friends_goal: number
          id: string
          name: string
          notes: string | null
          purchased_at: string
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          supplier_id: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          friends_goal?: number
          id?: string
          name: string
          notes?: string | null
          purchased_at?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          supplier_id: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          friends_goal?: number
          id?: string
          name?: string
          notes?: string | null
          purchased_at?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          supplier_id?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payment_methods: {
        Row: {
          created_at: string
          details: string
          id: string
          is_primary: boolean | null
          supplier_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details: string
          id?: string
          is_primary?: boolean | null
          supplier_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          is_primary?: boolean | null
          supplier_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payment_methods_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_request_items: {
        Row: {
          account_id: string | null
          created_at: string | null
          details: string | null
          id: string
          reason: string | null
          request_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string | null
          request_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string | null
          request_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_request_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "supplier_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_requests: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          priority: string | null
          reason: string | null
          status: string | null
          supplier_id: string | null
          title: string
          type: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          reason?: string | null
          status?: string | null
          supplier_id?: string | null
          title: string
          type?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          reason?: string | null
          status?: string | null
          supplier_id?: string | null
          title?: string
          type?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_submissions: {
        Row: {
          batch_id: string | null
          created_at: string
          data: Json
          id: string
          identification: string | null
          identification_link: string | null
          name: string
          paid_at: string | null
          payout_amount: number
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sold_at: string | null
          status: string
          stock_item_id: string | null
          supplier_id: string
          type: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          identification?: string | null
          identification_link?: string | null
          name: string
          paid_at?: string | null
          payout_amount?: number
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sold_at?: string | null
          status?: string
          stock_item_id?: string | null
          supplier_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          identification?: string | null
          identification_link?: string | null
          name?: string
          paid_at?: string | null
          payout_amount?: number
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sold_at?: string | null
          status?: string
          stock_item_id?: string | null
          supplier_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_submissions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "supplier_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_submissions_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_submissions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          access_token: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          recipient_id: string | null
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          recipient_id?: string | null
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          recipient_id?: string | null
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          read: boolean
          sender: string
          sender_department_id: string | null
          sender_user_id: string | null
          ticket_id: string
        }
        Insert: {
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          read?: boolean
          sender?: string
          sender_department_id?: string | null
          sender_user_id?: string | null
          ticket_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          sender?: string
          sender_department_id?: string | null
          sender_user_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_sender_department_id_fkey"
            columns: ["sender_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          ticket_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          ticket_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_ratings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          code: string
          created_at: string
          department_id: string | null
          id: string
          link: string | null
          priority: string
          reseller_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          code: string
          created_at?: string
          department_id?: string | null
          id?: string
          link?: string | null
          priority?: string
          reseller_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          code?: string
          created_at?: string
          department_id?: string | null
          id?: string
          link?: string | null
          priority?: string
          reseller_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_feedback: {
        Row: {
          comment: string | null
          created_at: string
          helpful: boolean | null
          id: string
          tutorial_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          helpful?: boolean | null
          id?: string
          tutorial_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          helpful?: boolean | null
          id?: string
          tutorial_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_feedback_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorials: {
        Row: {
          attachments: Json
          category: string | null
          content: string | null
          copy_items: Json
          created_at: string
          description: string | null
          id: string
          position: number
          published: boolean
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          attachments?: Json
          category?: string | null
          content?: string | null
          copy_items?: Json
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          published?: boolean
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          attachments?: Json
          category?: string | null
          content?: string | null
          copy_items?: Json
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          published?: boolean
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          created_at: string
          is_online: boolean
          last_path: string | null
          last_seen_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_online?: boolean
          last_path?: string | null
          last_seen_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_online?: boolean
          last_path?: string | null
          last_seen_at?: string
          updated_at?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          id: string
          invoice_status: string | null
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          id?: string
          invoice_status?: string | null
          reference_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          id?: string
          invoice_status?: string | null
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      warming_operator_goals: {
        Row: {
          active: boolean
          created_at: string
          goal_type: string
          id: string
          operator_id: string
          target_profiles: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          goal_type?: string
          id?: string
          operator_id: string
          target_profiles?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          goal_type?: string
          id?: string
          operator_id?: string
          target_profiles?: number
          updated_at?: string
        }
        Relationships: []
      }
      warming_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          current_day: number
          id: string
          notes: string | null
          profile_code: string
          profile_name: string | null
          start_date: string
          status: string
          track_days: number
          track_type: string
          trust_tier: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_day?: number
          id?: string
          notes?: string | null
          profile_code: string
          profile_name?: string | null
          start_date?: string
          status?: string
          track_days?: number
          track_type?: string
          trust_tier?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_day?: number
          id?: string
          notes?: string | null
          profile_code?: string
          profile_name?: string | null
          start_date?: string
          status?: string
          track_days?: number
          track_type?: string
          trust_tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      warming_tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          day_number: number
          description: string | null
          duration_seconds: number | null
          id: string
          profile_id: string
          title: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          day_number: number
          description?: string | null
          duration_seconds?: number | null
          id?: string
          profile_id: string
          title: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          day_number?: number
          description?: string | null
          duration_seconds?: number | null
          id?: string
          profile_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "warming_tasks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "warming_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contact_lists: {
        Row: {
          contacts: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          contacts?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          contacts?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          avatar_url: string | null
          client_user_id: string | null
          contact_name: string | null
          department_id: string | null
          internal_notes: string | null
          last_message_at: string
          last_message_preview: string | null
          phone: string
          status: string
          tags: string[]
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          avatar_url?: string | null
          client_user_id?: string | null
          contact_name?: string | null
          department_id?: string | null
          internal_notes?: string | null
          last_message_at?: string
          last_message_preview?: string | null
          phone: string
          status?: string
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          avatar_url?: string | null
          client_user_id?: string | null
          contact_name?: string | null
          department_id?: string | null
          internal_notes?: string | null
          last_message_at?: string
          last_message_preview?: string | null
          phone?: string
          status?: string
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_flow_steps: {
        Row: {
          content: string | null
          created_at: string
          delay_minutes: number
          flow_id: string
          id: string
          message_type: string
          metadata: Json | null
          step_order: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          delay_minutes?: number
          flow_id: string
          id?: string
          message_type: string
          metadata?: Json | null
          step_order: number
        }
        Update: {
          content?: string | null
          created_at?: string
          delay_minutes?: number
          flow_id?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_flow_steps_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_flows: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          audio_url: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          event_key: string | null
          id: string
          image_url: string | null
          message_sent: string
          message_type: string
          metadata: Json | null
          phone: string
          read_at: string | null
          replied_at: string | null
          reply_message: string | null
          scheduled_at: string | null
          status: string
          template_id: string | null
          updated_at: string
          user_id: string | null
          wapi_message_id: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_key?: string | null
          id?: string
          image_url?: string | null
          message_sent: string
          message_type?: string
          metadata?: Json | null
          phone: string
          read_at?: string | null
          replied_at?: string | null
          reply_message?: string | null
          scheduled_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string | null
          wapi_message_id?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_key?: string | null
          id?: string
          image_url?: string | null
          message_sent?: string
          message_type?: string
          metadata?: Json | null
          phone?: string
          read_at?: string | null
          replied_at?: string | null
          reply_message?: string | null
          scheduled_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string | null
          wapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          chat_id: string | null
          contact_name: string | null
          created_at: string
          direction: string
          from_me: boolean
          id: string
          media_url: string | null
          message_type: string | null
          phone: string
          raw: Json | null
          sender_department_id: string | null
          sender_user_id: string | null
          status: string | null
          wapi_message_id: string | null
        }
        Insert: {
          body?: string | null
          chat_id?: string | null
          contact_name?: string | null
          created_at?: string
          direction: string
          from_me?: boolean
          id?: string
          media_url?: string | null
          message_type?: string | null
          phone: string
          raw?: Json | null
          sender_department_id?: string | null
          sender_user_id?: string | null
          status?: string | null
          wapi_message_id?: string | null
        }
        Update: {
          body?: string | null
          chat_id?: string | null
          contact_name?: string | null
          created_at?: string
          direction?: string
          from_me?: boolean
          id?: string
          media_url?: string | null
          message_type?: string | null
          phone?: string
          raw?: Json | null
          sender_department_id?: string | null
          sender_user_id?: string | null
          status?: string | null
          wapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_sender_department_id_fkey"
            columns: ["sender_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_quick_replies: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          shortcut: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          active: boolean
          created_at: string
          event_key: string
          id: string
          message_body: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          event_key: string
          id?: string
          message_body: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          event_key?: string
          id?: string
          message_body?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      fbx_orders_public: {
        Row: {
          created_at: string | null
          fee_amount: number | null
          fee_rate: number | null
          id: string | null
          quantity: number | null
          status: string | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          fee_amount?: number | null
          fee_rate?: number | null
          id?: string | null
          quantity?: number | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          fee_amount?: number | null
          fee_rate?: number | null
          id?: string | null
          quantity?: number | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ss_transactions_safe: {
        Row: {
          account_credentials: Json | null
          amount: number | null
          buyer_id: string | null
          confirmed_at: string | null
          created_at: string | null
          delivered_at: string | null
          dispute_reason: string | null
          dispute_resolution: string | null
          disputed_at: string | null
          fee_rate: number | null
          id: string | null
          listing_id: string | null
          notes: string | null
          platform_fee: number | null
          seller_id: string | null
          status: string | null
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
          validation_checklist: Json | null
        }
        Insert: {
          account_credentials?: never
          amount?: number | null
          buyer_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          dispute_reason?: string | null
          dispute_resolution?: string | null
          disputed_at?: string | null
          fee_rate?: number | null
          id?: string | null
          listing_id?: string | null
          notes?: string | null
          platform_fee?: number | null
          seller_id?: string | null
          status?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_checklist?: Json | null
        }
        Update: {
          account_credentials?: never
          amount?: number | null
          buyer_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          dispute_reason?: string | null
          dispute_resolution?: string | null
          disputed_at?: string | null
          fee_rate?: number | null
          id?: string | null
          listing_id?: string | null
          notes?: string | null
          platform_fee?: number | null
          seller_id?: string | null
          status?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_checklist?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ss_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ss_listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _supplier_enc_key: { Args: never; Returns: string }
      admin_refund_and_restock_order: {
        Args: { _credit_wallet?: boolean; _order_id: string }
        Returns: Json
      }
      buy_extra_exchange_quota: {
        Args: { _qty: number; _subscription_id: string }
        Returns: Json
      }
      can_access_whatsapp_phone: { Args: { _phone: string }; Returns: boolean }
      check_reseller_checkout_capacity: {
        Args: {
          _product_ids: string[]
          _quantities: number[]
          _reseller_id: string
        }
        Returns: {
          can_cover: boolean
          total_cost: number
        }[]
      }
      check_supplier_token: { Args: { token: string }; Returns: string }
      fulfill_order_item: {
        Args: { p_order_item_id: string; p_product_id: string }
        Returns: Json
      }
      get_client_count: { Args: never; Returns: number }
      get_public_client_avatars: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
        }[]
      }
      get_public_client_testimonials: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          full_name: string
        }[]
      }
      get_reseller_checkout_prices: {
        Args: { _product_ids: string[]; _slug: string }
        Returns: {
          enabled: boolean
          final_price: number
          product_id: string
          reseller_id: string
        }[]
      }
      get_reseller_public_by_slug: {
        Args: { _slug: string }
        Returns: {
          about_text: string
          accent_color: string
          brand_name: string
          company_name: string
          favicon_url: string
          hero_subtitle: string
          hero_title: string
          id: string
          logo_url: string
          primary_color: string
          proxy_fixed_price: number
          proxy_price_mode: string
          proxy_price_multiplier: number
          slug: string
          status: string
          support_email: string
          support_whatsapp: string
        }[]
      }
      get_reseller_slug_by_domain: {
        Args: { _domain: string }
        Returns: string
      }
      get_ss_transaction_credentials: {
        Args: { _transaction_id: string }
        Returns: Json
      }
      get_supplier_account_credentials: {
        Args: { _account_id: string }
        Returns: {
          email_password: string
          password: string
        }[]
      }
      get_total_wallet_balance: { Args: never; Returns: number }
      get_user_id_by_email: { Args: { target_email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_reseller_owner: { Args: { _reseller_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      notify_admins_push: {
        Args: { _body?: string; _tag?: string; _title: string; _url?: string }
        Returns: undefined
      }
      notify_order_sale: { Args: { _order_id: string }; Returns: undefined }
      notify_user_push: {
        Args: {
          _body: string
          _tag?: string
          _title: string
          _url?: string
          _user_id: string
        }
        Returns: undefined
      }
      partner_campaign_increment_click: {
        Args: { _short_code: string }
        Returns: {
          campaign_id: string
          destination_url: string
          partner_id: string
          utm_campaign: string
          utm_content: string
          utm_medium: string
          utm_source: string
          utm_term: string
        }[]
      }
      partner_journey_claim_visitor: {
        Args: { _user_id: string; _visitor_id: string }
        Returns: number
      }
      pay_method_label: { Args: { _m: string }; Returns: string }
      process_whatsapp_queue: { Args: never; Returns: undefined }
      release_partner_commissions: { Args: never; Returns: number }
      release_reseller_commissions: { Args: never; Returns: number }
      search_stock_items_global: {
        Args: { q: string }
        Returns: {
          created_at: string
          data: Json
          id: string
          identification: string
          name: string
          status: string
          type: string
        }[]
      }
      validate_coupon:
        | {
            Args: { _code: string }
            Returns: {
              code: string
              discount_type: string
              discount_value: number
              expires_at: string
              id: string
              max_uses: number
              product_id: string
              status: string
              used_count: number
            }[]
          }
        | {
            Args: { _code: string; _reseller_id?: string }
            Returns: {
              code: string
              discount_type: string
              discount_value: number
              expires_at: string
              id: string
              max_uses: number
              product_id: string
              reseller_id: string
              status: string
              used_count: number
            }[]
          }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
