"use server";

import { createClient } from "@/lib/supabase/server";
import type { MealPost, MealType } from "@/lib/types";

const VALID_MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const CAPTION_MAX_LENGTH = 100;
// Keep in sync with MEAL_URL_TTL_SECONDS in lib/constants.ts
const MEAL_URL_TTL_SECONDS = 60 * 60;

// The photo itself is uploaded from the browser (storage RLS enforces
// workspace membership via the path prefix); this records the post row.
export async function addMealPost(input: {
  workspaceId: string;
  mealType: MealType;
  imagePath: string;
  caption?: string;
}): Promise<{ data: (MealPost & { imageUrl: string | null }) | null; error: string | null }> {
  if (!VALID_MEAL_TYPES.includes(input.mealType)) {
    return { data: null, error: "알 수 없는 끼니예요." };
  }
  const caption = input.caption?.trim() || null;
  if (caption && caption.length > CAPTION_MAX_LENGTH) {
    return { data: null, error: `한 줄은 ${CAPTION_MAX_LENGTH}자 이내로 써주세요.` };
  }
  if (!input.imagePath.startsWith(`${input.workspaceId}/`)) {
    return { data: null, error: "이미지 경로가 올바르지 않아요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "로그인이 필요해요." };

  const { data, error } = await supabase
    .from("meal_posts")
    .insert({
      workspace_id: input.workspaceId,
      user_id: user.id,
      meal_type: input.mealType,
      image_path: input.imagePath,
      caption,
    })
    .select()
    .single();

  if (error) {
    console.error("addMealPost failed:", error.message);
    return { data: null, error: "밥상 올리기에 실패했어요. 잠시 후 다시 시도해주세요." };
  }

  const { data: signed } = await supabase.storage
    .from("meals")
    .createSignedUrl(input.imagePath, MEAL_URL_TTL_SECONDS);

  return { data: { ...(data as MealPost), imageUrl: signed?.signedUrl ?? null }, error: null };
}

export async function deleteMealPost(input: {
  id: string;
  imagePath: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("meal_posts").delete().eq("id", input.id);
  if (error) {
    console.error("deleteMealPost failed:", error.message);
    return { error: "삭제에 실패했어요." };
  }
  // Best-effort: storage delete is RLS-guarded to the uploader anyway.
  await supabase.storage.from("meals").remove([input.imagePath]);
  return { error: null };
}

// Used when a realtime event delivers a post whose signed URL we don't have.
export async function getMealImageUrl(
  imagePath: string
): Promise<{ data: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("meals")
    .createSignedUrl(imagePath, MEAL_URL_TTL_SECONDS);
  if (error) {
    console.error("getMealImageUrl failed:", error.message);
    return { data: null, error: "이미지를 불러오지 못했어요." };
  }
  return { data: data.signedUrl, error: null };
}
