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
          title?: string
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
          user_id?: string
          watched_date?: string | null
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
      series: {
        Row: {
          created_at: string
          episodes_watched: number | null
          id: string
          name: string
          platform: string | null
          rating: number | null
          review: string | null
          season: number | null
          status: string | null
          total_episodes: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          episodes_watched?: number | null
          id?: string
          name: string
          platform?: string | null
          rating?: number | null
          review?: string | null
          season?: number | null
          status?: string | null
          total_episodes?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          episodes_watched?: number | null
          id?: string
          name?: string
          platform?: string | null
          rating?: number | null
          review?: string | null
          season?: number | null
          status?: string | null
          total_episodes?: number | null
          user_id?: string
        }
        Relationships: []
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
