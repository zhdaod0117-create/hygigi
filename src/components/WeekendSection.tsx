"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WeekendWish } from "@/lib/types";
import { addWeekendWish, toggleWeekendWish, deleteWeekendWish } from "@/lib/actions/weekend";

export default function WeekendSection({
  workspaceId,
  initialWishes,
}: {
  workspaceId: string;
  initialWishes: WeekendWish[];
}) {
  const [wishes, setWishes] = useState<WeekendWish[]>(initialWishes);
  const [title, setTitle] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const wishesRef = useRef(wishes);
  wishesRef.current = wishes;

  function showError(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`weekend-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "weekend_wishes",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as WeekendWish;
            setWishes((prev) => (prev.some((w) => w.id === next.id) ? prev : [...prev, next]));
          } else if (payload.eventType === "UPDATE") {
            const next = payload.new as WeekendWish;
            setWishes((prev) => prev.map((w) => (w.id === next.id ? next : w)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<WeekendWish>;
            setWishes((prev) => prev.filter((w) => w.id !== old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const value = title.trim();
    setTitle("");
    const { data, error } = await addWeekendWish({ workspaceId, title: value });
    if (error || !data) {
      showError(error ?? "추가에 실패했어요.");
      return;
    }
    setWishes((prev) => (prev.some((w) => w.id === data.id) ? prev : [...prev, data]));
  }

  async function handleToggle(id: string, isDone: boolean) {
    const snapshot = wishesRef.current;
    setWishes((prev) => prev.map((w) => (w.id === id ? { ...w, is_done: isDone } : w)));
    const { error } = await toggleWeekendWish(id, isDone);
    if (error) {
      setWishes(snapshot);
      showError(error);
    }
  }

  async function handleDelete(id: string) {
    const snapshot = wishesRef.current;
    setWishes((prev) => prev.filter((w) => w.id !== id));
    const { error } = await deleteWeekendWish(id);
    if (error) {
      setWishes(snapshot);
      showError(error);
    }
  }

  const pending = wishes.filter((w) => !w.is_done);
  const done = wishes.filter((w) => w.is_done);

  return (
    <section className="rounded-2xl border-2 border-brown-400/30 bg-cream-100 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-brown-700">🧺 주말에 하고 싶은 것</h2>
      <p className="mt-0.5 text-xs text-brown-400">
        평일에 생각날 때마다 담아두고, 주말에 만나서 하나씩 해봐요
      </p>

      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <input
          type="text"
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 그 파스타집 웨이팅 도전"
          className="min-w-0 flex-1 rounded-xl border-2 border-brown-400/30 bg-white px-3 py-2 text-sm text-brown-800 outline-none focus:border-brown-500"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-brown-500 px-4 py-1.5 text-sm font-semibold text-cream-50 hover:bg-brown-600"
        >
          담기
        </button>
      </form>

      {wishes.length === 0 ? (
        <p className="mt-4 text-center text-sm text-brown-400">
          아직 비어 있어요 — 이번 주말에 뭐 할까요? 🐶
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {[...pending, ...done].map((wish) => (
            <li
              key={wish.id}
              className="group flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 shadow-sm"
            >
              <input
                type="checkbox"
                checked={wish.is_done}
                onChange={(e) => handleToggle(wish.id, e.target.checked)}
                className="h-4 w-4 accent-brown-500"
              />
              <p
                className={`flex-1 text-sm ${
                  wish.is_done ? "text-brown-300 line-through" : "text-brown-800"
                }`}
              >
                {wish.title}
              </p>
              <button
                onClick={() => handleDelete(wish.id)}
                className="rounded-full px-2 text-brown-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                aria-label="삭제"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {toast && (
        <div
          role="alert"
          className="animate-pop-in fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </section>
  );
}
