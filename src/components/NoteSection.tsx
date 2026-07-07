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

  function authorLabel(userId: string) {
    if (userId === currentUserId) return "나";
    if (userId === partnerId) return "상대방";
    return "?";
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
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-brown-400/30 bg-cream-100 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-brown-700">💌 공유 메모</h2>

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
          className="rounded-xl bg-brown-500 px-4 py-1.5 text-sm font-semibold text-cream-50 hover:bg-brown-600"
        >
          남기기
        </button>
      </form>

      <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {sorted.length === 0 ? (
          <li className="text-center text-sm text-brown-400">아직 메모가 없어요</li>
        ) : (
          sorted.map((note) => (
            <li key={note.id} className="rounded-xl bg-white/70 px-3 py-2 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-brown-800">{note.content}</p>
                <button
                  onClick={() => onDelete(note.id)}
                  className="shrink-0 rounded-full px-1.5 text-brown-400 hover:bg-red-50 hover:text-red-500"
                  aria-label="삭제"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 text-[11px] text-brown-400">
                {authorLabel(note.user_id)} ·{" "}
                {new Date(note.created_at).toLocaleString("ko-KR", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
