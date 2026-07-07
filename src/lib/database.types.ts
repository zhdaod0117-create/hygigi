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
    };
    Views: Record<string, never>;
    Functions: {
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
