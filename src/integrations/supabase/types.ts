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
    PostgrestVersion: "14.1"
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
          active: boolean
          background_color: string | null
          category: string | null
          created_at: string
          cta_text: string | null
          id: string
          image_style: string | null
          image_url: string | null
          link_url: string | null
          position: number
          subtitle: string | null
          title: string
        }
        Insert: {
          active?: boolean
          background_color?: string | null
          category?: string | null
          created_at?: string
          cta_text?: string | null
          id?: string
          image_style?: string | null
          image_url?: string | null
          link_url?: string | null
          position?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          active?: boolean
          background_color?: string | null
          category?: string | null
          created_at?: string
          cta_text?: string | null
          id?: string
          image_style?: string | null
          image_url?: string | null
          link_url?: string | null
          position?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: []
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
          sold_at: string
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
          sold_at?: string
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
          sold_at?: string
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
      ct_clients: {
        Row: {
          created_at: string
          id: string
          monthly_value: number
          next_billing: string | null
          notes: string | null
          plan_id: string | null
          start_date: string
          status: string
          telegram: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_value?: number
          next_billing?: string | null
          notes?: string | null
          plan_id?: string | null
          start_date?: string
          status?: string
          telegram?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          monthly_value?: number
          next_billing?: string | null
          notes?: string | null
          plan_id?: string | null
          start_date?: string
          status?: string
          telegram?: string | null
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
      fb_finance_caixas: {
        Row: {
          alvo_percent: number
          created_at: string
          id: string
          nome: string
          saldo_atual: number
          tipo: string
          updated_at: string
        }
        Insert: {
          alvo_percent?: number
          created_at?: string
          id?: string
          nome: string
          saldo_atual?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          alvo_percent?: number
          created_at?: string
          id?: string
          nome?: string
          saldo_atual?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      fb_finance_config: {
        Row: {
          created_at: string
          distribution_percentages: Json
          id: string
          password_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          distribution_percentages?: Json
          id?: string
          password_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          distribution_percentages?: Json
          id?: string
          password_hash?: string
          updated_at?: string
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
      order_bumps: {
        Row: {
          active: boolean
          bump_product_id: string
          bump_type: string
          created_at: string
          discount_percent: number
          fixed_price: number | null
          id: string
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
          payment_expiry: string | null
          payment_last4: string | null
          payment_method: string | null
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
          payment_expiry?: string | null
          payment_last4?: string | null
          payment_method?: string | null
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
          payment_expiry?: string | null
          payment_last4?: string | null
          payment_method?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      partners: {
        Row: {
          balance: number
          commission_rate: number
          created_at: string
          guarantee_days: number
          id: string
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
          slug?: string
          status?: string
          total_earned?: number
          total_referrals?: number
          updated_at?: string
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
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
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
          name: string
          price: number
          price_label: string | null
          slug: string | null
          status: string
          stock: number
          tags: string[] | null
          updated_at: string
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
          name: string
          price?: number
          price_label?: string | null
          slug?: string | null
          status?: string
          stock?: number
          tags?: string[] | null
          updated_at?: string
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
          name?: string
          price?: number
          price_label?: string | null
          slug?: string | null
          status?: string
          stock?: number
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
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
          document_url: string | null
          estado: string | null
          fbx_balance: number
          first_login_at: string | null
          full_name: string | null
          id: string
          numero: string | null
          phone: string | null
          rua: string | null
          status: string
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          address?: string | null
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
          document_url?: string | null
          estado?: string | null
          fbx_balance?: number
          first_login_at?: string | null
          full_name?: string | null
          id?: string
          numero?: string | null
          phone?: string | null
          rua?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          address?: string | null
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
          document_url?: string | null
          estado?: string | null
          fbx_balance?: number
          first_login_at?: string | null
          full_name?: string | null
          id?: string
          numero?: string | null
          phone?: string | null
          rua?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
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
      safe_bm_vaults: {
        Row: {
          backup_link: string | null
          backup_link_set_at: string | null
          bm_link: string
          bm_name: string
          bm_tracking_id: string | null
          client_name: string | null
          created_at: string
          id: string
          link_health: string
          link_health_checked_at: string | null
          link_regenerations: number
          notes: string | null
          perfil_backup: string | null
          protection_start: string
          purchase_date: string | null
          status: string
          subscription_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_link?: string | null
          backup_link_set_at?: string | null
          bm_link: string
          bm_name: string
          bm_tracking_id?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          link_health?: string
          link_health_checked_at?: string | null
          link_regenerations?: number
          notes?: string | null
          perfil_backup?: string | null
          protection_start?: string
          purchase_date?: string | null
          status?: string
          subscription_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_link?: string | null
          backup_link_set_at?: string | null
          bm_link?: string
          bm_name?: string
          bm_tracking_id?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          link_health?: string
          link_health_checked_at?: string | null
          link_regenerations?: number
          notes?: string | null
          perfil_backup?: string | null
          protection_start?: string
          purchase_date?: string | null
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
          id: string
          name: string
          product_id: string | null
          raw_data: Json | null
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
          id?: string
          name: string
          product_id?: string | null
          raw_data?: Json | null
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
          id?: string
          name?: string
          product_id?: string | null
          raw_data?: Json | null
          start_date?: string
          status?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
          ticket_id: string
        }
        Insert: {
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          read?: boolean
          sender?: string
          ticket_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          sender?: string
          ticket_id?: string
        }
        Relationships: [
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
          code: string
          created_at: string
          id: string
          link: string | null
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          link?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          link?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tutorials: {
        Row: {
          category: string | null
          content: string | null
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
          category?: string | null
          content?: string | null
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
          category?: string | null
          content?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fulfill_order_item: {
        Args: { p_order_item_id: string; p_product_id: string }
        Returns: Json
      }
      get_client_count: { Args: never; Returns: number }
      get_total_wallet_balance: { Args: never; Returns: number }
      get_user_id_by_email: { Args: { target_email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
