"use client";

import { useMemo, useState } from "react";
import type { DiaryEntry, MoodLog, Reaction, ReactionTarget } from "@/lib/types";
import { MEAL_TYPE_MAP, MOOD_MAP } from "@/lib/constants";
import { formatDateWithWeekday, formatKstTime, toKstDateString } from "@/lib/date";
import { deleteMoodLog } from "@/lib/actions/mood";
import { toggleReaction } from "@/lib/actions/reactions";
import ReactionBar from "@/components/ReactionBar";
import type { MealPostWithUrl } from "@/components/MealSection";

type DayGroup = {
  date: string;
  entries: DiaryEntry[];
  moods: MoodLog[];
  meals: MealPostWithUrl[];
};

export default function HistoryClient({
  workspaceId,
  currentUserId,
  initialMoodLogs,
  initialDiaryEntries,
  initialMealPosts,
  questions,
  initialReactions,
}: {
  workspaceId: string;
  currentUserId: string;
  initialMoodLogs: MoodLog[];
  initialDiaryEntries: DiaryEntry[];
  initialMealPosts: MealPostWithUrl[];
  questions: { id: number; content: string }[];
  initialReactions: Reaction[];
}) {
  const [moodLogs, setMoodLogs] = useState(initialMoodLogs);
  const [reactions, setReactions] = useState(initialReactions);
  const [toast, setToast] = useState<string | null>(null);

  const questionMap = useMemo(
    () => new Map(questions.map((q) => [q.id, q.content])),
    [questions]
  );

  const days = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    const dayOf = (date: string) => {
      let g = map.get(date);
      if (!g) {
        g = { date, entries: [], moods: [], meals: [] };
        map.set(date, g);
      }
      return g;
    };
    for (const e of initialDiaryEntries) dayOf(e.entry_date).entries.push(e);
    for (const m of moodLogs) dayOf(toKstDateString(m.created_at)).moods.push(m);
    for (const p of initialMealPosts) dayOf(toKstDateString(p.created_at)).meals.push(p);
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [initialDiaryEntries, moodLogs, initialMealPosts]);

  function who(userId: string) {
    return userId === currentUserId ? "🙋 나" : "💛 상대방";
  }

  async function handleDeleteMood(id: string) {
    const snapshot = moodLogs;
    setMoodLogs((prev) => prev.filter((m) => m.id !== id));
    const { error } = await deleteMoodLog(id);
    if (error) {
      setMoodLogs(snapshot);
      setToast(error);
      setTimeout(() => setToast(null), 4000);
    }
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
      setToast(error);
      setTimeout(() => setToast(null), 4000);
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
        <h1 className="text-lg font-bold text-brown-700">📚 우리의 기록</h1>
        <p className="text-sm text-brown-500">감정 날씨와 교환일기가 날짜별로 쌓여요</p>
      </header>

      {days.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-brown-400/30 bg-cream-100 py-12 text-center">
          <span className="text-3xl">🐾</span>
          <p className="text-sm font-semibold text-brown-600">아직 쌓인 기록이 없어요</p>
          <p className="text-xs text-brown-400">
            홈에서 오늘의 날씨를 남기거나, 일기 탭에서 오늘의 질문에 답해보세요!
          </p>
        </div>
      ) : (
        days.map((day) => (
          <section
            key={day.date}
            className="rounded-2xl border-2 border-brown-400/30 bg-cream-100 p-4 shadow-sm"
          >
            <h2 className="mb-3 text-sm font-bold text-brown-700">
              {formatDateWithWeekday(day.date)}
            </h2>

            {day.entries.length > 0 && (
              <div className="mb-3 flex flex-col gap-2">
                <p className="text-xs font-semibold text-brown-500">
                  📖 {questionMap.get(day.entries[0].question_id) ?? "오늘의 질문"}
                </p>
                {day.entries.map((entry) => (
                  <div key={entry.id} className="rounded-xl bg-white/80 px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-brown-500">{who(entry.user_id)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-brown-800">
                      {entry.content}
                    </p>
                    <div className="mt-1.5">
                      <ReactionBar
                        targetType="diary_entry"
                        targetId={entry.id}
                        reactions={reactions}
                        currentUserId={currentUserId}
                        onToggle={handleToggleReaction}
                      />
                    </div>
                  </div>
                ))}
                {day.entries.length === 1 && (
                  <p className="text-[11px] text-brown-400">
                    {day.entries[0].user_id === currentUserId
                      ? "이날 상대방의 답이 없어 내 답만 보여요"
                      : ""}
                  </p>
                )}
              </div>
            )}

            {day.meals.length > 0 && (
              <ul className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {day.meals.map((meal) => {
                  const t = MEAL_TYPE_MAP[meal.meal_type];
                  return (
                    <li key={meal.id} className="w-24 shrink-0">
                      {meal.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={meal.imageUrl}
                          alt={meal.caption ?? `${t.label} 사진`}
                          className="h-20 w-24 rounded-lg object-cover shadow-sm"
                        />
                      ) : (
                        <div className="flex h-20 w-24 items-center justify-center rounded-lg bg-white/70 text-xl">
                          {t.emoji}
                        </div>
                      )}
                      <p className="mt-0.5 truncate text-[10px] text-brown-500">
                        {t.emoji} {t.label} · {who(meal.user_id)}
                        {meal.caption ? ` · ${meal.caption}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}

            {day.moods.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {day.moods.map((m) => {
                  const mood = MOOD_MAP[m.mood];
                  return (
                    <li
                      key={m.id}
                      className="group rounded-xl bg-white/60 px-3 py-1.5"
                    >
                      {/* Row 1: icon + text get the full card width. Reactions
                          (6 buttons) and delete live on row 2 so they never
                          fight the text for space and squeeze it to near-zero
                          on narrow phones (each glyph wrapping its own line). */}
                      <div className="flex items-start gap-2">
                        <span className="text-lg leading-tight">{mood.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-brown-700">
                            <span className="font-semibold">{who(m.user_id)}</span> · {mood.label}
                            {m.note && <span className="text-brown-500"> · “{m.note}”</span>}
                          </p>
                          <p className="text-[10px] text-brown-400">{formatKstTime(m.created_at)}</p>
                        </div>
                        {m.user_id === currentUserId && (
                          <button
                            onClick={() => handleDeleteMood(m.id)}
                            className="shrink-0 rounded-full px-1.5 text-brown-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                            aria-label="삭제"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div className="mt-1 pl-7">
                        <ReactionBar
                          targetType="mood_log"
                          targetId={m.id}
                          reactions={reactions}
                          currentUserId={currentUserId}
                          onToggle={handleToggleReaction}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))
      )}

      {toast && (
        <div
          role="alert"
          className="animate-pop-in fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
