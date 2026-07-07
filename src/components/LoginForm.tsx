"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createWorkspaceAction, joinWorkspaceAction } from "@/lib/actions/workspace";

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "로그인 링크가 만료됐거나 이미 사용됐어요. 다시 로그인해주세요.",
  no_session: "로그인 세션을 찾을 수 없어요. 다시 시도해주세요.",
  missing_code: "로그인 링크가 올바르지 않아요.",
};

export default function LoginForm({ initialErrorCode }: { initialErrorCode?: string }) {
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "verifying" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState(
    initialErrorCode
      ? ERROR_MESSAGES[initialErrorCode] ?? "문제가 발생했어요. 다시 시도해주세요."
      : ""
  );

  // Supabase's verify endpoint reports failures in the URL hash
  // (#error_code=otp_expired&...), which never reaches the server — read it
  // here so the user sees the real reason instead of a generic message.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.slice(1));
    if (params.get("error_code") === "otp_expired") {
      setErrorMessage(
        "로그인 링크가 만료됐거나 이미 사용된 링크예요. 가장 최근에 받은 메일의 링크만 유효하니, 아래에서 새 링크를 다시 요청해주세요."
      );
    } else if (params.get("error")) {
      setErrorMessage(
        params.get("error_description") ?? "로그인에 실패했어요. 다시 시도해주세요."
      );
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const origin = window.location.origin;
    const trimmedCode = inviteCode.trim().toUpperCase();
    const redirectTo = trimmedCode
      ? `${origin}/auth/callback?invite=${encodeURIComponent(trimmedCode)}`
      : `${origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(
        error.status === 429
          ? "메일을 너무 자주 요청했어요. 잠시 후(약 1분) 다시 시도해주세요."
          : "로그인 링크를 보내지 못했어요. 이메일 주소를 확인하고 잠시 후 다시 시도해주세요."
      );
      return;
    }

    setStatus("sent");
    setOtpCode("");
  }

  // Fallback for when the link fails (expired / consumed by mail scanners):
  // type the 6-digit code from the same email instead.
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setStatus("verifying");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode.trim(),
      type: "email",
    });

    if (error) {
      setStatus("sent");
      setErrorMessage("코드가 올바르지 않거나 만료됐어요. 가장 최근 메일의 코드인지 확인해주세요.");
      return;
    }

    // Mirror the magic-link callback: join with the invite code if one was
    // entered, otherwise auto-create a workspace. Failures here are fine —
    // the dashboard's onboarding card lets the user retry.
    const trimmedInvite = inviteCode.trim().toUpperCase();
    if (trimmedInvite) {
      await joinWorkspaceAction(trimmedInvite);
    } else {
      await createWorkspaceAction();
    }
    window.location.href = "/";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
      <div className="w-full max-w-sm rounded-3xl border-4 border-brown-500 bg-cream-100 p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">🐾</div>
          <h1 className="text-2xl font-bold text-brown-700">Retriever Nest</h1>
          <p className="mt-1 text-sm text-brown-500">우리 둘만의 작은 공간</p>
        </div>

        {status === "sent" || status === "verifying" ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-butter-100 p-4 text-center text-sm text-brown-700">
              <p className="font-semibold">메일함을 확인해주세요! 📬</p>
              <p className="mt-1">{email} 주소로 로그인 메일을 보냈어요.</p>
              <p className="mt-2 text-xs text-brown-500">
                링크를 클릭하거나, 메일에 적힌 6자리 코드를 아래에 입력하세요.
                메일이 안 보이면 스팸함도 확인해주세요.
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6자리 코드"
                className="min-w-0 flex-1 rounded-xl border-2 border-brown-400/40 bg-white px-4 py-2 tracking-widest text-brown-800 outline-none focus:border-brown-500"
              />
              <button
                type="submit"
                disabled={status === "verifying" || otpCode.length < 6}
                className="shrink-0 rounded-xl bg-brown-500 px-4 py-2 text-sm font-semibold text-cream-50 transition hover:bg-brown-600 disabled:opacity-60"
              >
                {status === "verifying" ? "확인 중..." : "코드로 로그인"}
              </button>
            </form>

            {errorMessage && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
            )}

            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setErrorMessage("");
              }}
              className="w-full rounded-xl border-2 border-brown-400/40 py-2 text-sm font-semibold text-brown-500 transition hover:bg-butter-100"
            >
              다른 이메일로 다시 보내기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-brown-600">이메일</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border-2 border-brown-400/40 bg-white px-4 py-2 text-brown-800 outline-none focus:border-brown-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-brown-600">
                초대 코드 <span className="font-normal text-brown-400">(선택 — 없으면 새 공간 생성)</span>
              </label>
              <input
                type="text"
                maxLength={6}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="w-full rounded-xl border-2 border-brown-400/40 bg-white px-4 py-2 uppercase tracking-widest text-brown-800 outline-none focus:border-brown-500"
              />
            </div>

            {errorMessage && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-xl bg-brown-500 py-2.5 font-semibold text-cream-50 transition hover:bg-brown-600 disabled:opacity-60"
            >
              {status === "sending" ? "전송 중..." : "로그인 메일 받기"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
