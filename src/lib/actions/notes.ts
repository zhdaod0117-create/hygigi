"use server";

import { createClient } from "@/lib/supabase/server";
import type { Note } from "@/lib/types";

const CONTENT_MAX_LENGTH = 500;

export async function addNote(input: {
  workspaceId: string;
  content: string;
}): Promise<{ data: Note | null; error: string | null }> {
  const content = input.content.trim();
  if (!content) return { data: null, error: "메모 내용을 입력해주세요." };
  if (content.length > CONTENT_MAX_LENGTH)
    return { data: null, error: `메모는 ${CONTENT_MAX_LENGTH}자 이내로 입력해주세요.` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "로그인이 필요해요." };

  const { data, error } = await supabase
    .from("notes")
    .insert({
      workspace_id: input.workspaceId,
      user_id: user.id,
      content,
    })
    .select()
    .single();

  if (error) {
    console.error("addNote failed:", error.message);
    return { data: null, error: "메모 추가에 실패했어요. 잠시 후 다시 시도해주세요." };
  }
  return { data, error: null };
}

export async function deleteNote(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) {
    console.error("deleteNote failed:", error.message);
    return { error: "삭제에 실패했어요. 잠시 후 다시 시도해주세요." };
  }
  return { error: null };
}
