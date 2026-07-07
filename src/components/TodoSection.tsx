"use client";

import { useMemo, useState } from "react";
import type { Todo } from "@/lib/types";
import { getTodayDateString, formatShortDate } from "@/lib/date";

type AssigneeChoice = "me" | "partner" | "both";

export default function TodoSection({
  todos,
  currentUserId,
  partnerId,
  onAdd,
  onToggle,
  onDelete,
}: {
  todos: Todo[];
  currentUserId: string;
  partnerId: string | null;
  onAdd: (title: string, dueDate: string, assignedTo: string | null) => void;
  onToggle: (id: string, isDone: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const today = getTodayDateString();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(today);
  const [assignee, setAssignee] = useState<AssigneeChoice>("both");
  const [showOthers, setShowOthers] = useState(false);

  const { todayTodos, otherTodos } = useMemo(() => {
    const sorted = [...todos].sort((a, b) => a.due_date.localeCompare(b.due_date));
    return {
      todayTodos: sorted.filter((t) => t.due_date === today),
      otherTodos: sorted.filter((t) => t.due_date !== today),
    };
  }, [todos, today]);

  function assigneeInfo(assignedTo: string | null) {
    if (assignedTo === currentUserId) return { label: "나", emoji: "🙋", className: "bg-brown-500 text-cream-50" };
    if (assignedTo === partnerId) return { label: "상대방", emoji: "💛", className: "bg-butter-200 text-brown-700" };
    return { label: "둘 다", emoji: "🐾", className: "bg-cream-200 text-brown-600" };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const assignedTo = assignee === "both" ? null : assignee === "me" ? currentUserId : partnerId;
    onAdd(title.trim(), dueDate, assignedTo);
    setTitle("");
    setDueDate(today);
    setAssignee("both");
  }

  function renderTodo(todo: Todo) {
    const assignee = assigneeInfo(todo.assigned_to);
    return (
      <li
        key={todo.id}
        className={`group flex items-center gap-3 rounded-xl border border-brown-400/10 bg-white/80 px-3 py-2.5 shadow-sm transition hover:shadow-md ${
          todo.is_done ? "opacity-70" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => onToggle(todo.id, !todo.is_done)}
          aria-label={todo.is_done ? "완료 취소" : "완료로 표시"}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
            todo.is_done
              ? "border-brown-500 bg-brown-500"
              : "border-brown-400/40 bg-white hover:border-brown-500"
          }`}
        >
          {todo.is_done && (
            <span key={todo.id + "-check"} className="animate-check-pop text-xs text-cream-50">
              ✓
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm transition ${
              todo.is_done ? "text-brown-300 line-through" : "text-brown-800"
            }`}
          >
            {todo.title}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[11px] text-brown-500">
              📅 {formatShortDate(todo.due_date)}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${assignee.className}`}>
              {assignee.emoji} {assignee.label}
            </span>
          </div>
        </div>
        <button
          onClick={() => onDelete(todo.id)}
          className="shrink-0 rounded-full px-2 py-1 text-brown-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          aria-label="삭제"
        >
          ✕
        </button>
      </li>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-brown-400/30 bg-cream-100 p-5 shadow-md">
      <h2 className="border-b border-brown-400/15 pb-3 text-lg font-bold text-brown-700">
        📝 오늘의 할 일
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="할 일을 입력해주세요"
          className="rounded-xl border-2 border-brown-400/30 bg-white px-3 py-2 text-sm text-brown-800 outline-none focus:border-brown-500"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="flex-1 rounded-xl border-2 border-brown-400/30 bg-white px-2 py-1.5 text-sm text-brown-800 outline-none focus:border-brown-500"
          />
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value as AssigneeChoice)}
            className="rounded-xl border-2 border-brown-400/30 bg-white px-2 py-1.5 text-sm text-brown-800 outline-none focus:border-brown-500"
          >
            <option value="both">둘 다</option>
            <option value="me">나</option>
            <option value="partner" disabled={!partnerId}>
              상대방
            </option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-brown-500 px-4 py-1.5 text-sm font-semibold text-cream-50 hover:bg-brown-600"
          >
            추가
          </button>
        </div>
      </form>

      <ul className="flex flex-col gap-2">
        {todayTodos.length === 0 ? (
          <li className="flex flex-col items-center gap-1 py-4 text-center text-sm text-brown-400">
            <span className="text-2xl">🎉</span>
            오늘 할 일이 없어요
          </li>
        ) : (
          todayTodos.map(renderTodo)
        )}
      </ul>

      {otherTodos.length > 0 && (
        <div>
          <button
            onClick={() => setShowOthers((v) => !v)}
            className="w-full rounded-xl bg-butter-100 px-3 py-2 text-xs font-semibold text-brown-600 transition hover:bg-butter-200"
          >
            {showOthers ? "▲ 접기" : `▼ 다른 할 일 보기 (${otherTodos.length})`}
          </button>
          {showOthers && (
            <ul className="mt-2 flex flex-col gap-2">{otherTodos.map(renderTodo)}</ul>
          )}
        </div>
      )}
    </section>
  );
}
