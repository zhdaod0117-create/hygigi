import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTodayDateString, kstDayStartISO } from "@/lib/date";
import type { MoodLog, WorkStatusLog } from "@/lib/types";
import Header from "@/components/Header";
import DashboardClient from "@/components/DashboardClient";
import OnboardingCard from "@/components/OnboardingCard";
import TabNav from "@/components/TabNav";
import MealSection, { type MealPostWithUrl } from "@/components/MealSection";
import WeekendSection from "@/components/WeekendSection";
import { MEAL_URL_TTL_SECONDS } from "@/lib/constants";
import type { MealPost, WeekendWish } from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return <OnboardingCard initialErrorCode={searchParams.error} />;
  }

  const workspaceId = membership.workspace_id;
  const today = getTodayDateString();

  const [
    { data: workspace },
    { data: members },
    { data: todos },
    { data: notes },
    { data: todayMoods },
    { data: todayStatuses },
    { data: myDiaryEntry },
    { data: partnerWroteDiary },
    { data: weekendWishes },
    { data: todayMeals },
  ] = await Promise.all([
    supabase.from("couple_workspaces").select("*").eq("id", workspaceId).single(),
    supabase.from("workspace_members").select("user_id").eq("workspace_id", workspaceId),
    supabase
      .from("todos")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("due_date", { ascending: true }),
    supabase
      .from("notes")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("mood_logs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("created_at", kstDayStartISO(today))
      .order("created_at", { ascending: false }),
    supabase
      .from("work_status_logs")
      .select("*")
      .eq("workspace_id", workspaceId)
      // 새벽 4시(KST) 이전 기록은 "어제의 상태"로 취급
      .gte("created_at", kstDayStartISO(today, 4))
      .order("created_at", { ascending: false }),
    supabase
      .from("diary_entries")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .eq("entry_date", today)
      .maybeSingle(),
    supabase.rpc("diary_partner_written", {
      p_workspace_id: workspaceId,
      p_entry_date: today,
    }),
    supabase
      .from("weekend_wishes")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    supabase
      .from("meal_posts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("created_at", kstDayStartISO(today))
      .order("created_at", { ascending: false }),
  ]);

  // Meal photos live in a private bucket — attach short-lived signed URLs.
  const mealPosts = (todayMeals as MealPost[]) ?? [];
  let mealPostsWithUrls: MealPostWithUrl[] = [];
  if (mealPosts.length > 0) {
    const { data: signed } = await supabase.storage
      .from("meals")
      .createSignedUrls(
        mealPosts.map((p) => p.image_path),
        MEAL_URL_TTL_SECONDS
      );
    const urlByPath = new Map(signed?.map((s) => [s.path, s.signedUrl]) ?? []);
    mealPostsWithUrls = mealPosts.map((p) => ({
      ...p,
      imageUrl: urlByPath.get(p.image_path) ?? null,
    }));
  }

  const partnerId = members?.find((m) => m.user_id !== user.id)?.user_id ?? null;

  const latestOf = <T extends { user_id: string }>(rows: T[] | null, userId: string | null) =>
    userId ? rows?.find((r) => r.user_id === userId) ?? null : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-4 pb-24">
      <Header inviteCode={workspace?.invite_code ?? "------"} />
      <DashboardClient
        workspaceId={workspaceId}
        currentUserId={user.id}
        partnerId={partnerId}
        initialTodos={todos ?? []}
        initialNotes={notes ?? []}
        initialMyMood={latestOf<MoodLog>((todayMoods as MoodLog[]) ?? null, user.id)}
        initialPartnerMood={latestOf<MoodLog>((todayMoods as MoodLog[]) ?? null, partnerId)}
        initialMyStatus={latestOf<WorkStatusLog>(
          (todayStatuses as WorkStatusLog[]) ?? null,
          user.id
        )}
        initialPartnerStatus={latestOf<WorkStatusLog>(
          (todayStatuses as WorkStatusLog[]) ?? null,
          partnerId
        )}
        partnerWroteDiaryToday={partnerWroteDiary === true}
        iWroteDiaryToday={Boolean(myDiaryEntry)}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MealSection
          workspaceId={workspaceId}
          currentUserId={user.id}
          initialPosts={mealPostsWithUrls}
        />
        <WeekendSection
          workspaceId={workspaceId}
          initialWishes={(weekendWishes as WeekendWish[]) ?? []}
        />
      </div>
      <TabNav />
    </main>
  );
}
