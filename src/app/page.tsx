import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import DashboardClient from "@/components/DashboardClient";
import OnboardingCard from "@/components/OnboardingCard";

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

  const [{ data: workspace }, { data: members }, { data: todos }, { data: notes }] =
    await Promise.all([
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
    ]);

  const partnerId = members?.find((m) => m.user_id !== user.id)?.user_id ?? null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-4">
      <Header inviteCode={workspace?.invite_code ?? "------"} />
      <DashboardClient
        workspaceId={workspaceId}
        currentUserId={user.id}
        partnerId={partnerId}
        initialTodos={todos ?? []}
        initialNotes={notes ?? []}
      />
    </main>
  );
}
