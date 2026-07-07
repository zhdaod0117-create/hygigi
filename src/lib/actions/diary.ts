"use server";

import { createClient } from "@/lib/supabase/server";
import { getTodayDateString, getDayNumber } from "@/lib/date";
import type { DiaryEntry } from "@/lib/types";

const CONTENT_MAX_LENGTH = 2000;

// Today's question is picked deterministically from the active bank so both
// partners always get the same one: dayNumber % bankSize.
export async function saveDiaryEntry(input: {
  workspaceId: string;
  content: string;
}): Promise<{ data: DiaryEntry | null; error: string | null }> {
  const content = input.content.trim();
  if (!content) return { data: null, error: "일기 내용을 입력해주세요." };
  if (content.length > CONTENT_MAX_LENGTH)
    return { data: null, error: `일기는 ${CONTENT_MAX_LENGTH}자 이내로 써주세요.` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "로그인이 필요해요." };

  const today = getTodayDateString();

  const { data: existing } = await supabase
    .from("diary_entries")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", user.id)
    .eq("entry_date", today)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("diary_entries")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) {
      console.error("saveDiaryEntry(update) failed:", error.message);
      return { data: null, error: "일기 수정에 실패했어요. 잠시 후 다시 시도해주세요." };
    }
    return { data: data as DiaryEntry, error: null };
  }

  const { data: questions, error: qError } = await supabase
    .from("diary_questions")
    .select("id")
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (qError || !questions || questions.length === 0) {
    console.error("saveDiaryEntry: question bank unavailable:", qError?.message);
    return { data: null, error: "오늘의 질문을 불러오지 못했어요." };
  }

  const questionId = questions[getDayNumber(today) % questions.length].id;

  const { data, error } = await supabase
    .from("diary_entries")
    .insert({
      workspace_id: input.workspaceId,
      user_id: user.id,
      entry_date: today,
      question_id: questionId,
      content,
    })
    .select()
    .single();

  if (error) {
    console.error("saveDiaryEntry(insert) failed:", error.message);
    return { data: null, error: "일기 저장에 실패했어요. 잠시 후 다시 시도해주세요." };
  }
  return { data: data as DiaryEntry, error: null };
}

export async function markDiaryRead(entryId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_diary_read", { p_entry_id: entryId });
  if (error) {
    console.error("markDiaryRead failed:", error.message);
    return { error: "읽음 처리에 실패했어요." };
  }
  return { error: null };
}
