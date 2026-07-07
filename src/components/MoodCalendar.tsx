"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MoodLog } from "@/lib/types";
import { MOOD_MAP } from "@/lib/constants";
import { getTodayDateString, toKstDateString } from "@/lib/date";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function monthOf(dateString: string) {
  return dateString.slice(0, 7); // YYYY-MM
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Weekday of the 1st in KST: noon KST is 03:00 UTC the same calendar day,
// so the UTC weekday of "T12:00+09:00" matches the KST weekday.
function firstWeekday(month: string) {
  return new Date(`${month}-01T12:00:00+09:00`).getUTCDay();
}

function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export default function MoodCalendar({
  workspaceId,
  currentUserId,
}: {
  workspaceId: string;
  currentUserId: string;
}) {
  const today = getTodayDateString();
  const currentMonth = monthOf(today);
  const [month, setMonth] = useState(currentMonth);
  const [logs, setLogs] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("mood_logs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .gte("created_at", `${month}-01T00:00:00+09:00`)
        .lt("created_at", `${shiftMonth(month, 1)}-01T00:00:00+09:00`)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setLogs((data as MoodLog[]) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, month]);

  // Per day, the LAST check-in of each person wins (logs arrive ascending).
  const byDay = useMemo(() => {
    const map = new Map<string, { mine?: MoodLog; partner?: MoodLog }>();
    for (const log of logs) {
      const date = toKstDateString(log.created_at);
      const slot = map.get(date) ?? {};
      if (log.user_id === currentUserId) slot.mine = log;
      else slot.partner = log;
      map.set(date, slot);
    }
    return map;
  }, [logs, currentUserId]);

  const [year, monthNum] = month.split("-").map(Number);
  const blanks = firstWeekday(month);
  const totalDays = daysInMonth(month);

  return (
    <section className="rounded-2xl border-2 border-brown-400/30 bg-cream-100 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-brown-700">🗓️ 감정 캘린더</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="rounded-full bg-butter-100 px-2.5 py-1 text-xs font-bold text-brown-600 hover:bg-butter-200"
            aria-label="이전 달"
          >
            ◀
          </button>
          <span className="text-sm font-semibold text-brown-700">
            {year}년 {monthNum}월
          </span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={month >= currentMonth}
            className="rounded-full bg-butter-100 px-2.5 py-1 text-xs font-bold text-brown-600 hover:bg-butter-200 disabled:opacity-30"
            aria-label="다음 달"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={`text-[10px] font-semibold ${
              i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-brown-400"
            }`}
          >
            {d}
          </div>
        ))}
        {Array.from({ length: blanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1;
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const slot = byDay.get(date);
          const isToday = date === today;
          return (
            <div
              key={date}
              className={`flex min-h-12 flex-col items-center rounded-lg py-0.5 ${
                isToday ? "bg-butter-100 ring-2 ring-brown-400" : "bg-white/50"
              }`}
            >
              <span className="text-[10px] text-brown-400">{day}</span>
              <span className="text-xs leading-tight" title={slot?.mine?.note ?? undefined}>
                {slot?.mine ? MOOD_MAP[slot.mine.mood].emoji : "·"}
              </span>
              <span className="text-xs leading-tight" title={slot?.partner?.note ?? undefined}>
                {slot?.partner ? MOOD_MAP[slot.partner.mood].emoji : "·"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-right text-[10px] text-brown-400">
        {loading ? "불러오는 중..." : "위: 나 · 아래: 상대방 (그날 마지막 날씨)"}
      </p>
    </section>
  );
}
