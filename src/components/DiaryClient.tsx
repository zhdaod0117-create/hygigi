"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DiaryEntry, Reaction, ReactionTarget } from "@/lib/types";
import { formatDateWithWeekday } from "@/lib/date";
import { saveDiaryEntry, markDiaryRead } from "@/lib/actions/diary";
import { toggleReaction } from "@/lib/actions/reactions";
import ReactionBar from "@/components/ReactionBar";
import PixelRetriever from "@/components/PixelRetriever";

export default function DiaryClient({
  workspaceId,
  currentUserId,
  today,
  question,
  initialMyEntry,
  initialPartnerEntry,
  initialPartnerWritten,
  initialReactions,
}: {
  workspaceId: string;
  currentUserId: string;
  today: string;
  question: { id: number; content: string } | null;
  initialMyEntry: DiaryEntry | null;
  initialPartnerEntry: DiaryEntry | null;
  initialPartnerWritten: boolean;
  initialReactions: Reaction[];
}) {
  const [myEntry, setMyEntry] = useState(initialMyEntry);
  const [partnerEntry, setPartnerEntry] = useState(initialPartnerEntry);
  const [partnerWritten, setPartnerWritten] = useState(initialPartnerWritten);
  const [reactions, setReactions] = useState(initialReactions);
  const [draft, setDraft] = useState(initialMyEntry?.content ?? "");
  const [editing, setEditing] = useState(initialMyEntry === null);
  const [saving, setSaving] = useState(false);
  const [bubble, setBubble] = useState<{ id: number; text: string } | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const bubbleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readMarked = useRef(false);

  function showBubble(text: string) {
    if (bubbleTimeout.current) clearTimeout(bubbleTimeout.current);
    setBubble({ id: Date.now(), text });
    bubbleTimeout.current = setTimeout(() => setBubble(null), 3000);
  }

  function showError(text: string) {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ id: Date.now(), text });
    toastTimeout.current = setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    return () => {
      if (bubbleTimeout.current) clearTimeout(bubbleTimeout.current);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  // Mark the partner's revealed entry as read (once).
  useEffect(() => {
    if (partnerEntry && partnerEntry.read_at === null && !readMarked.current) {
      readMarked.current = true;
      markDiaryRead(partnerEntry.id);
    }
  }, [partnerEntry]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`diary-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "diary_entries",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const entry = payload.new as DiaryEntry;
          if (entry.entry_date !== today) return;
          if (entry.user_id === currentUserId) {
            setMyEntry(entry); // e.g. read_at set by the partner
          } else {
            setPartnerEntry((prev) => {
              if (!prev) showBubble("둘 다 썼다! 서로의 답이 열렸어! 🎉");
              return entry;
            });
            setPartnerWritten(true);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reactions",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<Reaction>;
            setReactions((prev) => prev.filter((r) => r.id !== old.id));
          } else {
            const next = payload.new as Reaction;
            if (next.target_type !== "diary_entry") return;
            setReactions((prev) => [...prev.filter((r) => r.id !== next.id), next]);
            if (next.user_id !== currentUserId && payload.eventType === "INSERT") {
              showBubble(`상대방이 ${next.emoji} 를 남겼어!`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, currentUserId, today]);

  async function handleSave() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    const hadEntry = myEntry !== null;
    const { data, error } = await saveDiaryEntry({ workspaceId, content: draft });
    setSaving(false);
    if (error || !data) {
      showError(error ?? "저장에 실패했어요.");
      return;
    }
    setMyEntry(data);
    setEditing(false);

    // Writing my entry may have just revealed the partner's — fetch it now
    // (realtime can't retroactively deliver rows that were hidden by RLS).
    if (!hadEntry && partnerWritten && !partnerEntry) {
      const supabase = createClient();
      const { data: revealed } = await supabase
        .from("diary_entries")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("entry_date", today)
        .neq("user_id", currentUserId)
        .maybeSingle();
      if (revealed) {
        setPartnerEntry(revealed as DiaryEntry);
        showBubble("둘 다 썼다! 서로의 답이 열렸어! 🎉");
        return;
      }
    }
    showBubble(hadEntry ? "일기를 고쳤어! 멍!" : "오늘의 일기 완성! 멍!");
  }

  async function handleToggleReaction(
    targetType: ReactionTarget,
    targetId: string,
    emoji: string
  ) {
    const { data, removed, error } = await toggleReaction({
      workspaceId,
      targetType,
      targetId,
      emoji,
    });
    if (error) {
      showError(error);
      return;
    }
    setReactions((prev) => {
      const withoutMine = prev.filter(
        (r) =>
          !(r.user_id === currentUserId && r.target_type === targetType && r.target_id === targetId)
      );
      return removed || !data ? withoutMine : [...withoutMine, data];
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="rounded-2xl border-2 border-brown-400/30 bg-cream-100 px-5 py-4 shadow-sm">
        <h1 className="text-lg font-bold text-brown-700">📖 교환일기</h1>
        <p className="text-sm text-brown-500">{formatDateWithWeekday(today)}</p>
      </header>

      {question ? (
        <section className="rounded-2xl border-2 border-butter-300 bg-butter-100 px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold text-brown-500">오늘의 질문</p>
          <p className="mt-1 text-base font-bold text-brown-800">{question.content}</p>
        </section>
      ) : (
        <section className="rounded-2xl border-2 border-brown-400/30 bg-cream-100 px-5 py-4 text-sm text-brown-500">
          오늘의 질문을 불러오지 못했어요. Supabase에 최신 schema.sql이 적용됐는지 확인해주세요.
        </section>
      )}

      {/* 내 답 */}
      <section className="rounded-2xl border-2 border-brown-400/30 bg-cream-100 p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-brown-700">🙋 나의 답</h2>
          {myEntry && !editing && (
            <button
              onClick={() => {
                setDraft(myEntry.content);
                setEditing(true);
              }}
              className="rounded-full bg-butter-100 px-3 py-1 text-xs font-semibold text-brown-600 hover:bg-butter-200"
            >
              수정
            </button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="오늘의 질문에 편하게 답해보세요. 상대방이 쓰기 전까진 아무도 못 봐요!"
              className="w-full resize-y rounded-xl border-2 border-brown-400/30 bg-white px-3 py-2 text-sm text-brown-800 outline-none focus:border-brown-500"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-brown-400">{draft.length}/2000 · 당일만 작성·수정할 수 있어요</span>
              <div className="flex gap-2">
                {myEntry && (
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-xl border-2 border-brown-400/40 px-4 py-1.5 text-sm font-semibold text-brown-500 hover:bg-butter-100"
                  >
                    취소
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !draft.trim()}
                  className="rounded-xl bg-brown-500 px-4 py-1.5 text-sm font-semibold text-cream-50 hover:bg-brown-600 disabled:opacity-60"
                >
                  {saving ? "저장 중..." : myEntry ? "고치기" : "남기기"}
                </button>
              </div>
            </div>
          </div>
        ) : myEntry ? (
          <div>
            <p className="whitespace-pre-wrap text-sm text-brown-800">{myEntry.content}</p>
            <div className="mt-2 flex items-center justify-between">
              <ReactionBar
                targetType="diary_entry"
                targetId={myEntry.id}
                reactions={reactions}
                currentUserId={currentUserId}
                onToggle={handleToggleReaction}
              />
              {myEntry.read_at && (
                <span className="text-[11px] text-brown-400">상대방이 읽었어요 ✓</span>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {/* 상대방 답 */}
      <section className="rounded-2xl border-2 border-brown-400/30 bg-cream-100 p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-brown-700">💛 상대방의 답</h2>
        {partnerEntry ? (
          <div>
            <p className="whitespace-pre-wrap text-sm text-brown-800">{partnerEntry.content}</p>
            <div className="mt-2">
              <ReactionBar
                targetType="diary_entry"
                targetId={partnerEntry.id}
                reactions={reactions}
                currentUserId={currentUserId}
                onToggle={handleToggleReaction}
              />
            </div>
          </div>
        ) : partnerWritten ? (
          <div className="flex flex-col items-center gap-1 rounded-xl bg-white/70 py-6 text-center">
            <span className="text-2xl">🔒</span>
            <p className="text-sm font-semibold text-brown-700">상대방은 벌써 답을 남겼어요!</p>
            <p className="text-xs text-brown-400">내 답을 쓰면 서로의 답이 열려요</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 rounded-xl bg-white/70 py-6 text-center">
            <span className="text-2xl">⏳</span>
            <p className="text-sm text-brown-500">상대방은 아직 안 썼어요</p>
            <p className="text-xs text-brown-400">둘 다 쓰면 서로의 답이 공개돼요</p>
          </div>
        )}
      </section>

      <PixelRetriever bubble={bubble} />
      {toast && (
        <div
          key={toast.id}
          role="alert"
          className="animate-pop-in fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
