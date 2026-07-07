"use server";

import { createClient } from "@/lib/supabase/server";
import type { Todo } from "@/lib/types";

// NOTE: server actions must RETURN errors instead of throwing them —
// Next.js masks thrown error messages in production, so the client
// would never see our friendly Korean messages.

const TITLE_MAX_LENGTH = 200;

export async function addTodo(input: {
  workspaceId: string;
  title: string;
  dueDate: string;
  assignedTo: string | null;
}): Promise<{ data: Todo | null; error: string | null }> {
  const title = input.title.trim();
  if (!title) return { data: null, error: "할 일 내용을 입력해주세요." };
  if (title.length > TITLE_MAX_LENGTH)
    return { data: null, error: `할 일은 ${TITLE_MAX_LENGTH}자 이내로 입력해주세요.` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate))
    return { data: null, error: "날짜 형식이 올바르지 않아요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "로그인이 필요해요." };

  const { data, error } = await supabase
    .from("todos")
    .insert({
      workspace_id: input.workspaceId,
      title,
      due_date: input.dueDate,
      assigned_to: input.assignedTo,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("addTodo failed:", error.message);
    return { data: null, error: "할 일 추가에 실패했어요. 잠시 후 다시 시도해주세요." };
  }
  return { data, error: null };
}

export async function toggleTodo(
  id: string,
  isDone: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("todos").update({ is_done: isDone }).eq("id", id);
  if (error) {
    console.error("toggleTodo failed:", error.message);
    return { error: "업데이트에 실패했어요. 잠시 후 다시 시도해주세요." };
  }
  return { error: null };
}

export async function deleteTodo(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) {
    console.error("deleteTodo failed:", error.message);
    return { error: "삭제에 실패했어요. 잠시 후 다시 시도해주세요." };
  }
  return { error: null };
}
