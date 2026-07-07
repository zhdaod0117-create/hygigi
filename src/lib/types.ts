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

export type Mood = "sunny" | "partly" | "cloudy" | "rainy" | "stormy";
export type WorkStatus = "working" | "off" | "overtime" | "meeting";
export type ReactionTarget = "diary_entry" | "mood_log" | "note" | "todo";

export type DiaryQuestion = {
  id: number;
  content: string;
  is_active: boolean;
};

export type DiaryEntry = {
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

export type MoodLog = {
  id: string;
  workspace_id: string;
  user_id: string;
  mood: Mood;
  note: string | null;
  created_at: string;
};

export type WorkStatusLog = {
  id: string;
  workspace_id: string;
  user_id: string;
  status: WorkStatus;
  created_at: string;
};

export type Reaction = {
  id: string;
  workspace_id: string;
  user_id: string;
  target_type: ReactionTarget;
  target_id: string;
  emoji: string;
  created_at: string;
};

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type WeekendWish = {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  is_done: boolean;
  created_at: string;
};

export type MealPost = {
  id: string;
  workspace_id: string;
  user_id: string;
  meal_type: MealType;
  image_path: string;
  caption: string | null;
  created_at: string;
};
