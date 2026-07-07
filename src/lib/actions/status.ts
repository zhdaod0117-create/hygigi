"use server";

import { createClient } from "@/lib/supabase/server";
import type { WorkStatus, WorkStatusLog } from "@/lib/types";

const VALID_STATUSES: WorkStatus[] = ["working", "off", "overtime", "meeting"];

export async function setWorkStatus(input: {
  workspaceId: string;
  status: WorkStatus;
}): Promise<{ data: WorkStatusLog | null; error: string | null }> {
  if (!VALID_STATUSES.includes(input.status)) {
    return { data: null, error: "알 수 없는 상태예요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "로그인이 필요해요." };

  const { data, error } = await supabase
    .from("work_status_logs")
    .insert({
      workspace_id: input.workspaceId,
      user_id: user.id,
      status: input.status,
    })
    .select()
    .single();

  if (error) {
    console.error("setWorkStatus failed:", error.message);
    return { data: null, error: "상태 기록에 실패했어요. 잠시 후 다시 시도해주세요." };
  }
  return { data: data as WorkStatusLog, error: null };
}
