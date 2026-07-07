"use server";

import { createClient } from "@/lib/supabase/server";
import { REACTION_EMOJIS } from "@/lib/constants";
import type { Reaction, ReactionTarget } from "@/lib/types";

// Tapping the same emoji again removes it; a different emoji replaces it.
export async function toggleReaction(input: {
  workspaceId: string;
  targetType: ReactionTarget;
  targetId: string;
  emoji: string;
}): Promise<{ data: Reaction | null; removed: boolean; error: string | null }> {
  if (!(REACTION_EMOJIS as readonly string[]).includes(input.emoji)) {
    return { data: null, removed: false, error: "사용할 수 없는 이모지예요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, removed: false, error: "로그인이 필요해요." };

  const { data: existing } = await supabase
    .from("reactions")
    .select("id, emoji")
    .eq("user_id", user.id)
    .eq("target_type", input.targetType)
    .eq("target_id", input.targetId)
    .maybeSingle();

  if (existing && existing.emoji === input.emoji) {
    const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
    if (error) {
      console.error("toggleReaction(delete) failed:", error.message);
      return { data: null, removed: false, error: "리액션 취소에 실패했어요." };
    }
    return { data: null, removed: true, error: null };
  }

  if (existing) {
    const { data, error } = await supabase
      .from("reactions")
      .update({ emoji: input.emoji })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) {
      console.error("toggleReaction(update) failed:", error.message);
      return { data: null, removed: false, error: "리액션 변경에 실패했어요." };
    }
    return { data: data as Reaction, removed: false, error: null };
  }

  const { data, error } = await supabase
    .from("reactions")
    .insert({
      workspace_id: input.workspaceId,
      user_id: user.id,
      target_type: input.targetType,
      target_id: input.targetId,
      emoji: input.emoji,
    })
    .select()
    .single();

  if (error) {
    console.error("toggleReaction(insert) failed:", error.message);
    return { data: null, removed: false, error: "리액션에 실패했어요." };
  }
  return { data: data as Reaction, removed: false, error: null };
}
