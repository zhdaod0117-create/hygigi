import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTodayDateString, getDayNumber } from "@/lib/date";
import type { DiaryEntry, Reaction } from "@/lib/types";
import DiaryClient from "@/components/DiaryClient";
import TabNav from "@/components/TabNav";

export default async function DiaryPage() {
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
  const today = getTodayDateString();

  const [{ data: todayEntries }, { data: partnerWritten }, { data: questions }] =
    await Promise.all([
      supabase
        .from("diary_entries")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("entry_date", today),
      supabase.rpc("diary_partner_written", {
        p_workspace_id: workspaceId,
        p_entry_date: today,
      }),
      supabase.from("diary_questions").select("id, content").eq("is_active", true).order("id"),
    ]);

  const entries = (todayEntries as DiaryEntry[]) ?? [];
  const myEntry = entries.find((e) => e.user_id === user.id) ?? null;
  const partnerEntry = entries.find((e) => e.user_id !== user.id) ?? null;

  // Same deterministic pick as saveDiaryEntry; if I already wrote, trust the
  // stored question_id (bank may change later).
  let question: { id: number; content: string } | null = null;
  if (questions && questions.length > 0) {
    if (myEntry) {
      question = questions.find((q) => q.id === myEntry.question_id) ?? null;
    }
    question ??= questions[getDayNumber(today) % questions.length];
  }

  const entryIds = entries.map((e) => e.id);
  const { data: reactions } = entryIds.length
    ? await supabase
        .from("reactions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("target_type", "diary_entry")
        .in("target_id", entryIds)
    : { data: [] };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 pb-24">
      <DiaryClient
        workspaceId={workspaceId}
        currentUserId={user.id}
        today={today}
        question={question}
        initialMyEntry={myEntry}
        initialPartnerEntry={partnerEntry}
        initialPartnerWritten={partnerWritten === true}
        initialReactions={(reactions as Reaction[]) ?? []}
      />
      <TabNav />
    </main>
  );
}
