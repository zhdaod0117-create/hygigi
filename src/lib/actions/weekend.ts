"use server";

import { createClient } from "@/lib/supabase/server";
import type { WeekendWish } from "@/lib/types";

const TITLE_MAX_LENGTH = 100;

export async function addWeekendWish(input: {
  workspaceId: string;
  title: string;
}): Promise<{ data: WeekendWish | null; error: string | null }> {
  const title = input.title.trim();
  if (!title) return { data: null, error: "하고 싶은 걸 입력해주세요." };
  if (title.length > TITLE_MAX_LENGTH)
    return { data: null, error: `${TITLE_MAX_LENGTH}자 이내로 입력해주세요.` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "로그인이 필요해요." };

  const { data, error } = await supabase
    .from("weekend_wishes")
    .insert({ workspace_id: input.workspaceId, created_by: user.id, title })
    .select()
    .single();

  if (error) {
    console.error("addWeekendWish failed:", error.message);
    return { data: null, error: "추가에 실패했어요. 잠시 후 다시 시도해주세요." };
  }
  return { data: data as WeekendWish, error: null };
}

export async function toggleWeekendWish(
  id: string,
  isDone: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("weekend_wishes").update({ is_done: isDone }).eq("id", id);
  if (error) {
    console.error("toggleWeekendWish failed:", error.message);
    return { error: "업데이트에 실패했어요." };
  }
  return { error: null };
}

export async function deleteWeekendWish(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("weekend_wishes").delete().eq("id", id);
  if (error) {
    console.error("deleteWeekendWish failed:", error.message);
    return { error: "삭제에 실패했어요." };
  }
  return { error: null };
}
