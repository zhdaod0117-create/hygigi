"use client";

import { useState } from "react";
import type { Mood, MoodLog, WorkStatus, WorkStatusLog } from "@/lib/types";
import { MOODS, MOOD_MAP, WORK_STATUSES, WORK_STATUS_MAP } from "@/lib/constants";

function MoodBadge({ log }: { log: MoodLog | null }) {
  if (!log) return <span className="text-xs text-brown-300">기록 없음</span>;
  const m = MOOD_MAP[log.mood];
  return (
    <span className="text-sm" title={log.note ?? undefined}>
      {m.emoji} <span className="text-xs text-brown-600">{m.label}</span>
      {log.note && <span className="ml-1 text-xs text-brown-400">“{log.note}”</span>}
    </span>
  );
}

function StatusBadge({ log }: { log: WorkStatusLog | null }) {
  if (!log) return null;
  const s = WORK_STATUS_MAP[log.status];
  return (
    <span className="rounded-full bg-butter-100 px-2 py-0.5 text-xs font-medium text-brown-600">
      {s.emoji} {s.label}
    </span>
  );
}

export default function TodayUsStrip({
  myMood,
  partnerMood,
  myStatus,
  partnerStatus,
  hasPartner,
  onCheckInMood,
  onSetStatus,
}: {
  myMood: MoodLog | null;
  partnerMood: MoodLog | null;
  myStatus: WorkStatusLog | null;
  partnerStatus: WorkStatusLog | null;
  hasPartner: boolean;
  onCheckInMood: (mood: Mood, note: string) => void;
  onSetStatus: (status: WorkStatus) => void;
}) {
  const [openPanel, setOpenPanel] = useState<"mood" | "status" | null>(null);
  const [pendingMood, setPendingMood] = useState<Mood | null>(null);
  const [note, setNote] = useState("");

  function submitMood() {
    if (!pendingMood) return;
    onCheckInMood(pendingMood, note.trim());
    setPendingMood(null);
    setNote("");
    setOpenPanel(null);
  }

  return (
    <section className="rounded-2xl border-2 border-brown-400/30 bg-cream-100 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-brown-700">🐶 오늘의 우리</h2>
        <div className="flex gap-1.5">
          <button
            onClick={() => setOpenPanel(openPanel === "mood" ? null : "mood")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              openPanel === "mood"
                ? "bg-brown-500 text-cream-50"
                : "bg-butter-100 text-brown-600 hover:bg-butter-200"
            }`}
          >
            {myMood ? MOOD_MAP[myMood.mood].emoji : "🌈"} 내 날씨
          </button>
          <button
            onClick={() => setOpenPanel(openPanel === "status" ? null : "status")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              openPanel === "status"
                ? "bg-brown-500 text-cream-50"
                : "bg-butter-100 text-brown-600 hover:bg-butter-200"
            }`}
          >
            {myStatus ? WORK_STATUS_MAP[myStatus.status].emoji : "💼"} 내 상태
          </button>
        </div>
      </div>

      {openPanel === "mood" && (
        <div className="animate-pop-in mt-3 rounded-xl bg-white/80 p-3">
          <p className="mb-2 text-xs font-medium text-brown-500">지금 마음의 날씨는?</p>
          <div className="flex gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setPendingMood(m.value)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl border-2 py-2 text-xl transition ${
                  pendingMood === m.value
                    ? "border-brown-500 bg-butter-100"
                    : "border-transparent hover:bg-cream-50"
                }`}
              >
                {m.emoji}
                <span className="text-[10px] text-brown-500">{m.label}</span>
              </button>
            ))}
          </div>
          {pendingMood && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                maxLength={80}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="한 줄 남기기 (선택)"
                className="min-w-0 flex-1 rounded-xl border-2 border-brown-400/30 bg-white px-3 py-1.5 text-sm text-brown-800 outline-none focus:border-brown-500"
              />
              <button
                onClick={submitMood}
                className="shrink-0 rounded-xl bg-brown-500 px-4 py-1.5 text-sm font-semibold text-cream-50 hover:bg-brown-600"
              >
                기록
              </button>
            </div>
          )}
        </div>
      )}

      {openPanel === "status" && (
        <div className="animate-pop-in mt-3 rounded-xl bg-white/80 p-3">
          <p className="mb-2 text-xs font-medium text-brown-500">지금 뭐 하는 중이야?</p>
          <div className="flex gap-1.5">
            {WORK_STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  onSetStatus(s.value);
                  setOpenPanel(null);
                }}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl border-2 py-2 text-xl transition ${
                  myStatus?.status === s.value
                    ? "border-brown-500 bg-butter-100"
                    : "border-transparent hover:bg-cream-50"
                }`}
              >
                {s.emoji}
                <span className="text-[10px] text-brown-500">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/70 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brown-500">🙋 나</span>
            <StatusBadge log={myStatus} />
          </div>
          <div className="mt-1">
            <MoodBadge log={myMood} />
          </div>
        </div>
        <div className="rounded-xl bg-white/70 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brown-500">💛 상대방</span>
            <StatusBadge log={partnerStatus} />
          </div>
          <div className="mt-1">
            {hasPartner ? (
              <MoodBadge log={partnerMood} />
            ) : (
              <span className="text-xs text-brown-300">아직 함께하는 사람이 없어요</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
