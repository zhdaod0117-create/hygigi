// Hand-written types matching supabase/schema.sql.
// If you prefer generated types, run:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/lib/database.types.ts

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string; created_at: string };
        Insert: { id: string; email: string; created_at?: string };
        Update: { id?: string; email?: string; created_at?: string };
        Relationships: [];
      };
      couple_workspaces: {
        Row: { id: string; invite_code: string; created_at: string };
        Insert: { id?: string; invite_code: string; created_at?: string };
        Update: { id?: string; invite_code?: string; created_at?: string };
        Relationships: [];
      };
      workspace_members: {
        Row: { id: string; workspace_id: string; user_id: string; created_at: string };
        Insert: { id?: string; workspace_id: string; user_id: string; created_at?: string };
        Update: { id?: string; workspace_id?: string; user_id?: string; created_at?: string };
        Relationships: [];
      };
      todos: {
        Row: {
          id: string;
          workspace_id: string;
          title: string;
          due_date: string;
          is_done: boolean;
          assigned_to: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          title: string;
          due_date?: string;
          is_done?: boolean;
          assigned_to?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          title?: string;
          due_date?: string;
          is_done?: boolean;
          assigned_to?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      diary_questions: {
        Row: { id: number; content: string; is_active: boolean };
        Insert: { id: number; content: string; is_active?: boolean };
        Update: { id?: number; content?: string; is_active?: boolean };
        Relationships: [];
      };
      diary_entries: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          entry_date: string;
          question_id: number;
          content: string;
          read_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          entry_date: string;
          question_id: number;
          content: string;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          entry_date?: string;
          question_id?: number;
          content?: string;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mood_logs: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          mood: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          mood: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          mood?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      work_status_logs: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          status: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      reactions: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          target_type: string;
          target_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          target_type: string;
          target_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          target_type?: string;
          target_id?: string;
          emoji?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      weekend_wishes: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string;
          title: string;
          is_done: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          created_by: string;
          title: string;
          is_done?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          created_by?: string;
          title?: string;
          is_done?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      meal_posts: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          meal_type: string;
          image_path: string;
          caption: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          meal_type: string;
          image_path: string;
          caption?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          meal_type?: string;
          image_path?: string;
          caption?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_own_diary_entry: {
        Args: { p_workspace_id: string; p_entry_date: string };
        Returns: boolean;
      };
      diary_partner_written: {
        Args: { p_workspace_id: string; p_entry_date: string };
        Returns: boolean;
      };
      mark_diary_read: {
        Args: { p_entry_id: string };
        Returns: undefined;
      };
      create_workspace: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; invite_code: string; created_at: string };
      };
      join_workspace: {
        Args: { p_invite_code: string };
        Returns: { id: string; invite_code: string; created_at: string };
      };
      is_workspace_member: {
        Args: { p_workspace_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
