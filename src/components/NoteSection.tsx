"use client";

import { useMemo, useState } from "react";
import type { Note } from "@/lib/types";

export default function NoteSection({
  notes,
  currentUserId,
  partnerId,
  onAdd,
  onDelete,
}: {
  notes: Note[];
  currentUserId: string;
  partnerId: string | null;
  onAdd: (content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [content, setContent] = useState("");

  function authorInfo(userId: string) {
    if (userId === currentUserId) return { label: "나", emoji: "🙋", className: "bg-brown-500 text-cream-50" };
    if (userId === partnerId) return { label: "상대방", emoji: "💛", className: "bg-butter-200 text-brown-700" };
    return { label: "?", emoji: "🐾", className: "bg-cream-200 text-brown-600" };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    onAdd(content.trim());
    setContent("");
  }

  const sorted = useMemo(
    () =>
      [...notes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [notes]
  );

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-brown-400/30 bg-cream-100 p-5 shadow-md">
      <h2 className="border-b border-brown-400/15 pb-3 text-lg font-bold text-brown-700">
        💌 공유 메모
      </h2>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="짧은 메모를 남겨보세요"
          className="flex-1 rounded-xl border-2 border-brown-400/30 bg-white px-3 py-2 text-sm text-brown-800 outline-none focus:border-brown-500"
        />
        <button
          type="submit"
          className="rounded-xl bg-brown-500 px-4 py-1.5 text-sm font-semibold text-cream-50 transition hover:bg-brown-600"
        >
          남기기
        </button>
      </form>

      <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {sorted.length === 0 ? (
          <li className="flex flex-col items-center gap-1 py-4 text-center text-sm text-brown-400">
            <span className="text-2xl">💌</span>
            아직 메모가 없어요
          </li>
        ) : (
          sorted.map((note) => {
            const author = authorInfo(note.user_id);
            return (
              <li
                key={note.id}
                className="group rounded-xl border border-brown-400/10 bg-white/80 px-3 py-2.5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-brown-800">{note.content}</p>
                  <button
                    onClick={() => onDelete(note.id)}
                    className="shrink-0 rounded-full px-1.5 py-1 text-brown-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${author.className}`}>
                    {author.emoji} {author.label}
                  </span>
                  <span className="text-[11px] text-brown-400">
                    {new Date(note.created_at).toLocaleString("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
