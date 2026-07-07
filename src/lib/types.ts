export type Todo = {
  id: string;
  workspace_id: string;
  title: string;
  due_date: string;
  is_done: boolean;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
};

export type Note = {
  id: string;
  workspace_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type Workspace = {
  id: string;
  invite_code: string;
  created_at: string;
};

export type Member = {
  user_id: string;
  email: string;
};
