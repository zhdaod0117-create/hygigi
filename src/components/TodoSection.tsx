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

  function assigneeLabel(assignedTo: string | null) {
    if (assignedTo === null) return "둘 다";
    if (assignedTo === currentUserId) return "나";
    if (assignedTo === partnerId) return "상대방";
    return "둘 다";
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
    return (
      <li
        key={todo.id}
        className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 shadow-sm"
      >
        <input
          type="checkbox"
          checked={todo.is_done}
          onChange={(e) => onToggle(todo.id, e.target.checked)}
          className="h-4 w-4 accent-brown-500"
        />
        <div className="flex-1">
          <p className={`text-sm ${todo.is_done ? "text-brown-300 line-through" : "text-brown-800"}`}>
            {todo.title}
          </p>
          <p className="text-[11px] text-brown-400">
            {formatShortDate(todo.due_date)} · {assigneeLabel(todo.assigned_to)}
          </p>
        </div>
        <button
          onClick={() => onDelete(todo.id)}
          className="rounded-full px-2 text-brown-400 hover:bg-red-50 hover:text-red-500"
          aria-label="삭제"
        >
          ✕
        </button>
      </li>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-brown-400/30 bg-cream-100 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-brown-700">📝 오늘의 할 일</h2>

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
          <li className="text-center text-sm text-brown-400">오늘 할 일이 없어요 🎉</li>
        ) : (
          todayTodos.map(renderTodo)
        )}
      </ul>

      {otherTodos.length > 0 && (
        <div>
          <button
            onClick={() => setShowOthers((v) => !v)}
            className="w-full rounded-xl bg-butter-100 px-3 py-1.5 text-xs font-semibold text-brown-600"
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
