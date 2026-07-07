import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Some Supabase email templates link with token_hash/type instead of a
  // PKCE code (e.g. when the link is opened in a different browser than the
  // one that requested it). Support both so magic links always work.
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type") as EmailOtpType | null;
  const inviteCode = searchParams.get("invite");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }
  } else if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash });
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_session`);
  }

  const { data: existingMembership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingMembership) {
    if (inviteCode) {
      const { error: joinError } = await supabase.rpc("join_workspace", {
        p_invite_code: inviteCode,
      });
      if (joinError) {
        const reason =
          joinError.message === "WORKSPACE_FULL"
            ? "invite_full"
            : joinError.message === "INVALID_INVITE_CODE"
              ? "invite_invalid"
              : "invite_error";
        // Login itself succeeded — send to the dashboard, where OnboardingCard
        // lets the user retry the code instead of bouncing back to /login.
        return NextResponse.redirect(`${origin}/?error=${reason}`);
      }
    } else {
      const { error: createError } = await supabase.rpc("create_workspace");
      if (createError) {
        return NextResponse.redirect(`${origin}/?error=workspace_create_failed`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
