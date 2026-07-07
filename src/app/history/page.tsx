import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DiaryEntry, MealPost, MoodLog, Reaction } from "@/lib/types";
import { MEAL_URL_TTL_SECONDS } from "@/lib/constants";
import HistoryClient from "@/components/HistoryClient";
import MoodCalendar from "@/components/MoodCalendar";
import TabNav from "@/components/TabNav";
import type { MealPostWithUrl } from "@/components/MealSection";

export default async function HistoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/");

  const workspaceId = membership.workspace_id;

  const [{ data: moodLogs }, { data: diaryEntries }, { data: questions }, { data: mealPosts }] =
    await Promise.all([
    supabase
      .from("mood_logs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(200),
    // RLS만으로 충분: 내 일기 전체 + 공개된(둘 다 쓴 날) 상대 일기만 내려옴
    supabase
      .from("diary_entries")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("entry_date", { ascending: false })
      .limit(60),
    supabase.from("diary_questions").select("id, content"),
    supabase
      .from("meal_posts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const meals = (mealPosts as MealPost[]) ?? [];
  let mealsWithUrls: MealPostWithUrl[] = [];
  if (meals.length > 0) {
    const { data: signed } = await supabase.storage
      .from("meals")
      .createSignedUrls(
        meals.map((p) => p.image_path),
        MEAL_URL_TTL_SECONDS
      );
    const urlByPath = new Map(signed?.map((s) => [s.path, s.signedUrl]) ?? []);
    mealsWithUrls = meals.map((p) => ({ ...p, imageUrl: urlByPath.get(p.image_path) ?? null }));
  }

  const targetIds = [
    ...((moodLogs as MoodLog[]) ?? []).map((m) => m.id),
    ...((diaryEntries as DiaryEntry[]) ?? []).map((d) => d.id),
  ];
  const { data: reactions } = targetIds.length
    ? await supabase
        .from("reactions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("target_id", targetIds)
    : { data: [] };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 pb-24">
      <MoodCalendar workspaceId={workspaceId} currentUserId={user.id} />
      <HistoryClient
        workspaceId={workspaceId}
        currentUserId={user.id}
        initialMoodLogs={(moodLogs as MoodLog[]) ?? []}
        initialDiaryEntries={(diaryEntries as DiaryEntry[]) ?? []}
        initialMealPosts={mealsWithUrls}
        questions={(questions as { id: number; content: string }[]) ?? []}
        initialReactions={(reactions as Reaction[]) ?? []}
      />
      <TabNav />
    </main>
  );
}
