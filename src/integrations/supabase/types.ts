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
      accounts: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          icon: string | null
          id: string
          initial_balance: number
          initial_balance_date: string
          name: string
          notes: string | null
          type: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          initial_balance?: number
          initial_balance_date?: string
          name: string
          notes?: string | null
          type?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          initial_balance?: number
          initial_balance_date?: string
          name?: string
          notes?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      birthdays: {
        Row: {
          category: string | null
          created_at: string
          date: string
          gift_ideas: string | null
          id: string
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          date: string
          gift_ideas?: string | null
          id?: string
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          date?: string
          gift_ideas?: string | null
          id?: string
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      books: {
        Row: {
          author: string | null
          category: string | null
          created_at: string
          end_date: string | null
          id: string
          pages: number | null
          quotes: string | null
          rating: number | null
          review: string | null
          start_date: string | null
          status: string | null
          tags: string[] | null
          title: string
          user_id: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          pages?: number | null
          quotes?: string | null
          rating?: number | null
          review?: string | null
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          user_id: string
        }
        Update: {
          author?: string | null
          category?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          pages?: number | null
          quotes?: string | null
          rating?: number | null
          review?: string | null
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          id: string
          kind: string
          label: string | null
          month: string
          realized_amount: number | null
          ref_id: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          month: string
          realized_amount?: number | null
          ref_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          month?: string
          realized_amount?: number | null
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credit_cards: {
        Row: {
          card_limit: number
          closing_day: number
          color: string | null
          created_at: string
          due_day: number
          id: string
          name: string
          user_id: string
        }
        Insert: {
          card_limit?: number
          closing_day?: number
          color?: string | null
          created_at?: string
          due_day?: number
          id?: string
          name: string
          user_id: string
        }
        Update: {
          card_limit?: number
          closing_day?: number
          color?: string | null
          created_at?: string
          due_day?: number
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      diary_entries: {
        Row: {
          anxiety: number | null
          content: string | null
          created_at: string
          date: string
          energy: number | null
          favorite: boolean
          gratitude: string | null
          id: string
          mood: number | null
          rating: number | null
          tags: string[] | null
          title: string | null
          user_id: string
        }
        Insert: {
          anxiety?: number | null
          content?: string | null
          created_at?: string
          date: string
          energy?: number | null
          favorite?: boolean
          gratitude?: string | null
          id?: string
          mood?: number | null
          rating?: number | null
          tags?: string[] | null
          title?: string | null
          user_id: string
        }
        Update: {
          anxiety?: number | null
          content?: string | null
          created_at?: string
          date?: string
          energy?: number | null
          favorite?: boolean
          gratitude?: string | null
          id?: string
          mood?: number | null
          rating?: number | null
          tags?: string[] | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          completed: boolean
          created_at: string
          date: string
          description: string | null
          id: string
          time_str: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          date: string
          description?: string | null
          id?: string
          time_str?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          time_str?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      finance_categories: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          type: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          type: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_settings: {
        Row: {
          created_at: string
          id: string
          initial_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          initial_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          initial_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finances: {
        Row: {
          account_id: string | null
          amount: number
          card_id: string | null
          category: string | null
          created_at: string
          date: string
          description: string | null
          fitid: string | null
          id: string
          installments: number | null
          invoice_month: string | null
          kind: string
          notes: string | null
          ofx_import_id: string | null
          paid: boolean
          payment_method: string | null
          tags: string[] | null
          to_account_id: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          card_id?: string | null
          category?: string | null
          created_at?: string
          date?: string
          description?: string | null
          fitid?: string | null
          id?: string
          installments?: number | null
          invoice_month?: string | null
          kind?: string
          notes?: string | null
          ofx_import_id?: string | null
          paid?: boolean
          payment_method?: string | null
          tags?: string[] | null
          to_account_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          card_id?: string | null
          category?: string | null
          created_at?: string
          date?: string
          description?: string | null
          fitid?: string | null
          id?: string
          installments?: number | null
          invoice_month?: string | null
          kind?: string
          notes?: string | null
          ofx_import_id?: string | null
          paid?: boolean
          payment_method?: string | null
          tags?: string[] | null
          to_account_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          completed: boolean
          created_at: string
          description: string | null
          id: string
          progress: number | null
          target: number | null
          title: string
          user_id: string
          year: number | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          progress?: number | null
          target?: number | null
          title: string
          user_id: string
          year?: number | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          progress?: number | null
          target?: number | null
          title?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          date: string
          done: boolean
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          date: string
          done?: boolean
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          date?: string
          done?: boolean
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      investment_movements: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          date: string
          id: string
          investment_id: string
          kind: string
          notes: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          date: string
          id?: string
          investment_id: string
          kind: string
          notes?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          date?: string
          id?: string
          investment_id?: string
          kind?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_movements_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          category: string | null
          created_at: string
          current_amount: number
          id: string
          institution: string | null
          invested_amount: number
          invested_date: string | null
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          current_amount?: number
          id?: string
          institution?: string | null
          invested_amount?: number
          invested_date?: string | null
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          current_amount?: number
          id?: string
          institution?: string | null
          invested_amount?: number
          invested_date?: string | null
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      list_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          scope: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          scope?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          scope?: string
          user_id?: string
        }
        Relationships: []
      }
      movies: {
        Row: {
          created_at: string
          favorite: boolean
          genre: string | null
          id: string
          name: string
          platform: string | null
          rating: number | null
          review: string | null
          tags: string[] | null
          user_id: string
          watched_date: string | null
        }
        Insert: {
          created_at?: string
          favorite?: boolean
          genre?: string | null
          id?: string
          name: string
          platform?: string | null
          rating?: number | null
          review?: string | null
          tags?: string[] | null
          user_id: string
          watched_date?: string | null
        }
        Update: {
          created_at?: string
          favorite?: boolean
          genre?: string | null
          id?: string
          name?: string
          platform?: string | null
          rating?: number | null
          review?: string | null
          tags?: string[] | null
          user_id?: string
          watched_date?: string | null
        }
        Relationships: []
      }
      ofx_category_rules: {
        Row: {
          cat_type: string
          category: string
          created_at: string
          hits: number
          id: string
          pattern: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cat_type?: string
          category: string
          created_at?: string
          hits?: number
          id?: string
          pattern: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cat_type?: string
          category?: string
          created_at?: string
          hits?: number
          id?: string
          pattern?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ofx_imports: {
        Row: {
          account_id: string | null
          card_id: string | null
          created_at: string
          duplicate_count: number
          file_name: string | null
          found_count: number
          id: string
          imported_count: number
          period_end: string | null
          period_start: string | null
          skipped_count: number
          source_type: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          card_id?: string | null
          created_at?: string
          duplicate_count?: number
          file_name?: string | null
          found_count?: number
          id?: string
          imported_count?: number
          period_end?: string | null
          period_start?: string | null
          skipped_count?: number
          source_type?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          card_id?: string | null
          created_at?: string
          duplicate_count?: number
          file_name?: string | null
          found_count?: number
          id?: string
          imported_count?: number
          period_end?: string | null
          period_start?: string | null
          skipped_count?: number
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ofx_imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ofx_imports_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_incomes: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          description: string
          expected_date: string | null
          id: string
          month: string
          notes: string | null
          received: boolean
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          description: string
          expected_date?: string | null
          id?: string
          month: string
          notes?: string | null
          received?: boolean
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          expected_date?: string | null
          id?: string
          month?: string
          notes?: string | null
          received?: boolean
          user_id?: string
        }
        Relationships: []
      }
      podcast_episodes: {
        Row: {
          created_at: string
          duration_seconds: number | null
          favorite: boolean
          id: string
          listened_date: string | null
          notes: string | null
          rating: number | null
          show_id: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          favorite?: boolean
          id?: string
          listened_date?: string | null
          notes?: string | null
          rating?: number | null
          show_id: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          favorite?: boolean
          id?: string
          listened_date?: string | null
          notes?: string | null
          rating?: number | null
          show_id?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_episodes_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "podcast_shows"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_shows: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          favorite: boolean
          id: string
          interest_status: string
          name: string
          platform: string | null
          show_status: string
          tags: string[] | null
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          favorite?: boolean
          id?: string
          interest_status?: string
          name: string
          platform?: string | null
          show_status?: string
          tags?: string[] | null
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          favorite?: boolean
          id?: string
          interest_status?: string
          name?: string
          platform?: string | null
          show_status?: string
          tags?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      podcasts: {
        Row: {
          category: string | null
          created_at: string
          date: string | null
          duration_min: number | null
          episode: string | null
          favorite: boolean
          id: string
          name: string
          notes: string | null
          rating: number | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          date?: string | null
          duration_min?: number | null
          episode?: string | null
          favorite?: boolean
          id?: string
          name: string
          notes?: string | null
          rating?: number | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          date?: string | null
          duration_min?: number | null
          episode?: string | null
          favorite?: boolean
          id?: string
          name?: string
          notes?: string | null
          rating?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      savings_jars: {
        Row: {
          account_id: string | null
          color: string | null
          created_at: string
          current_amount: number
          goal: number | null
          icon: string | null
          id: string
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          color?: string | null
          created_at?: string
          current_amount?: number
          goal?: number | null
          icon?: string | null
          id?: string
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          color?: string | null
          created_at?: string
          current_amount?: number
          goal?: number | null
          icon?: string | null
          id?: string
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      savings_movements: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          date: string
          id: string
          jar_id: string
          kind: string
          notes: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          created_at?: string
          date?: string
          id?: string
          jar_id: string
          kind?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          date?: string
          id?: string
          jar_id?: string
          kind?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          created_at: string
          end_date: string | null
          episodes_watched: number | null
          id: string
          kind: string | null
          name: string
          platform: string | null
          rating: number | null
          review: string | null
          season: number | null
          status: string | null
          tags: string[] | null
          total_episodes: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          episodes_watched?: number | null
          id?: string
          kind?: string | null
          name: string
          platform?: string | null
          rating?: number | null
          review?: string | null
          season?: number | null
          status?: string | null
          tags?: string[] | null
          total_episodes?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          episodes_watched?: number | null
          id?: string
          kind?: string | null
          name?: string
          platform?: string | null
          rating?: number | null
          review?: string | null
          season?: number | null
          status?: string | null
          tags?: string[] | null
          total_episodes?: number | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          date: string
          description: string | null
          due_date: string | null
          goal_id: string | null
          id: string
          priority: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          date?: string
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          priority?: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          date?: string
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          priority?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      wishes: {
        Row: {
          added_date: string
          category: string | null
          created_at: string
          description: string | null
          estimated_value: number | null
          goal_id: string | null
          id: string
          image_url: string | null
          link: string | null
          name: string
          notes: string | null
          paid_value: number | null
          priority: string
          realized_date: string | null
          status: string
          tags: string[] | null
          updated_at: string
          user_id: string
          wish_type: string
        }
        Insert: {
          added_date?: string
          category?: string | null
          created_at?: string
          description?: string | null
          estimated_value?: number | null
          goal_id?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          name: string
          notes?: string | null
          paid_value?: number | null
          priority?: string
          realized_date?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
          wish_type?: string
        }
        Update: {
          added_date?: string
          category?: string | null
          created_at?: string
          description?: string | null
          estimated_value?: number | null
          goal_id?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          name?: string
          notes?: string | null
          paid_value?: number | null
          priority?: string
          realized_date?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          wish_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishes_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
