"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createWorkspaceAction(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_workspace");
  if (error) {
    console.error("create_workspace failed:", error.message);
    return { error: "공간을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." };
  }
  revalidatePath("/");
  return { error: null };
}

export async function joinWorkspaceAction(
  inviteCode: string
): Promise<{ error: string | null }> {
  const code = inviteCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return { error: "초대 코드는 6자리 영문/숫자예요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_workspace", { p_invite_code: code });
  if (error) {
    if (error.message === "INVALID_INVITE_CODE") return { error: "유효하지 않은 초대 코드예요." };
    if (error.message === "WORKSPACE_FULL") return { error: "이 공간은 이미 두 명이 꽉 찼어요." };
    if (error.message === "ALREADY_IN_ANOTHER_WORKSPACE")
      return { error: "이미 다른 공간에 참여하고 있어요." };
    console.error("join_workspace failed:", error.message);
    return { error: "초대 코드로 참여하는 중 문제가 생겼어요." };
  }
  revalidatePath("/");
  return { error: null };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
