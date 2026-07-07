"use client";

import { useState, useTransition } from "react";
import {
  createWorkspaceAction,
  joinWorkspaceAction,
  signOutAction,
} from "@/lib/actions/workspace";

const ERROR_MESSAGES: Record<string, string> = {
  invite_full: "이 초대 코드의 공간은 이미 두 명이 꽉 찼어요.",
  invite_invalid: "유효하지 않은 초대 코드예요. 다시 확인해주세요.",
  invite_error: "초대 코드로 참여하는 중 문제가 생겼어요.",
  workspace_create_failed: "공간을 만드는 중 문제가 생겼어요. 다시 시도해주세요.",
};

export default function OnboardingCard({ initialErrorCode }: { initialErrorCode?: string }) {
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState(
    initialErrorCode ? ERROR_MESSAGES[initialErrorCode] ?? "문제가 발생했어요. 다시 시도해주세요." : ""
  );
  const [isPending, startTransition] = useTransition();

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const { error } = await joinWorkspaceAction(inviteCode);
      if (error) setError(error);
    });
  }

  function handleCreate() {
    setError("");
    startTransition(async () => {
      const { error } = await createWorkspaceAction();
      if (error) setError(error);
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
      <div className="w-full max-w-sm rounded-3xl border-4 border-brown-500 bg-cream-100 p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">🏡</div>
          <h1 className="text-xl font-bold text-brown-700">공간이 아직 없어요</h1>
          <p className="mt-1 text-sm text-brown-500">초대 코드로 참여하거나 새로 만들어보세요</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-3">
          <input
            type="text"
            maxLength={6}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="초대 코드 (ABC123)"
            className="w-full rounded-xl border-2 border-brown-400/40 bg-white px-4 py-2 uppercase tracking-widest text-brown-800 outline-none focus:border-brown-500"
          />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isPending || !inviteCode}
            className="w-full rounded-xl bg-brown-500 py-2.5 font-semibold text-cream-50 transition hover:bg-brown-600 disabled:opacity-60"
          >
            {isPending ? "처리 중..." : "코드로 참여하기"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-2 text-xs text-brown-400">
          <div className="h-px flex-1 bg-brown-400/20" />
          또는
          <div className="h-px flex-1 bg-brown-400/20" />
        </div>

        <button
          onClick={handleCreate}
          disabled={isPending}
          className="w-full rounded-xl border-2 border-brown-500 py-2.5 font-semibold text-brown-600 transition hover:bg-butter-100 disabled:opacity-60"
        >
          새 공간 만들기
        </button>

        <form action={signOutAction} className="mt-4 text-center">
          <button
            type="submit"
            className="text-xs text-brown-400 underline underline-offset-2 hover:text-brown-600"
          >
            다른 계정으로 로그인
          </button>
        </form>
      </div>
    </main>
  );
}
