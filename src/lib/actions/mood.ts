"use server";

import { createClient } from "@/lib/supabase/server";
import type { Mood, MoodLog } from "@/lib/types";

const VALID_MOODS: Mood[] = ["sunny", "partly", "cloudy", "rainy", "stormy"];
const NOTE_MAX_LENGTH = 80;

export async function addMoodLog(input: {
  workspaceId: string;
  mood: Mood;
  note?: string;
}): Promise<{ data: MoodLog | null; error: string | null }> {
  if (!VALID_MOODS.includes(input.mood)) {
    return { data: null, error: "알 수 없는 감정이에요." };
  }
  const note = input.note?.trim() || null;
  if (note && note.length > NOTE_MAX_LENGTH) {
    return { data: null, error: `메모는 ${NOTE_MAX_LENGTH}자 이내로 써주세요.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "로그인이 필요해요." };

  const { data, error } = await supabase
    .from("mood_logs")
    .insert({
      workspace_id: input.workspaceId,
      user_id: user.id,
      mood: input.mood,
      note,
    })
    .select()
    .single();

  if (error) {
    console.error("addMoodLog failed:", error.message);
    return { data: null, error: "감정 기록에 실패했어요. 잠시 후 다시 시도해주세요." };
  }
  return { data: data as MoodLog, error: null };
}

export async function deleteMoodLog(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("mood_logs").delete().eq("id", id);
  if (error) {
    console.error("deleteMoodLog failed:", error.message);
    return { error: "삭제에 실패했어요." };
  }
  return { error: null };
}
