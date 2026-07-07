"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Note, Todo } from "@/lib/types";
import TodoSection from "@/components/TodoSection";
import NoteSection from "@/components/NoteSection";
import PixelRetriever from "@/components/PixelRetriever";
import { addTodo, toggleTodo, deleteTodo } from "@/lib/actions/todos";
import { addNote, deleteNote } from "@/lib/actions/notes";

export default function DashboardClient({
  workspaceId,
  currentUserId,
  partnerId,
  initialTodos,
  initialNotes,
}: {
  workspaceId: string;
  currentUserId: string;
  partnerId: string | null;
  initialTodos: Todo[];
  initialNotes: Note[];
}) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [bubble, setBubble] = useState<{ id: number; text: string } | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const bubbleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Realtime handlers need the latest todos to tell "newly completed" from
  // "already completed" — payload.old only carries the primary key.
  const todosRef = useRef(todos);
  todosRef.current = todos;

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

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`workspace-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todos", filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as Todo;
            setTodos((prev) => (prev.some((t) => t.id === next.id) ? prev : [...prev, next]));
          } else if (payload.eventType === "UPDATE") {
            const next = payload.new as Todo;
            const before = todosRef.current.find((t) => t.id === next.id);
            if (next.is_done && before && !before.is_done) {
              showBubble("잘했어! 멍!");
            }
            setTodos((prev) => prev.map((t) => (t.id === next.id ? next : t)));
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Partial<Todo>;
            setTodos((prev) => prev.filter((t) => t.id !== oldRow.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes", filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as Note;
            setNotes((prev) => {
              if (prev.some((n) => n.id === next.id)) return prev;
              return [...prev, next];
            });
            if (next.user_id !== currentUserId) {
              showBubble("새 메모가 왔어!");
            }
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Partial<Note>;
            setNotes((prev) => prev.filter((n) => n.id !== oldRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, currentUserId]);

  async function handleAddTodo(title: string, dueDate: string, assignedTo: string | null) {
    const { data, error } = await addTodo({ workspaceId, title, dueDate, assignedTo });
    if (error || !data) {
      showError(error ?? "할 일 추가에 실패했어요.");
      return;
    }
    // Realtime may deliver the same row; dedupe by id.
    setTodos((prev) => (prev.some((t) => t.id === data.id) ? prev : [...prev, data]));
  }

  async function handleToggleTodo(id: string, isDone: boolean) {
    const snapshot = todosRef.current;
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, is_done: isDone } : t)));
    if (isDone) showBubble("잘했어! 멍!");

    const { error } = await toggleTodo(id, isDone);
    if (error) {
      setTodos(snapshot);
      showError(error);
    }
  }

  async function handleDeleteTodo(id: string) {
    const snapshot = todosRef.current;
    setTodos((prev) => prev.filter((t) => t.id !== id));

    const { error } = await deleteTodo(id);
    if (error) {
      setTodos(snapshot);
      showError(error);
    }
  }

  async function handleAddNote(content: string) {
    const { data, error } = await addNote({ workspaceId, content });
    if (error || !data) {
      showError(error ?? "메모 추가에 실패했어요.");
      return;
    }
    setNotes((prev) => (prev.some((n) => n.id === data.id) ? prev : [...prev, data]));
    showBubble("메모 남겼어! 멍!");
  }

  async function handleDeleteNote(id: string) {
    const snapshot = notes;
    setNotes((prev) => prev.filter((n) => n.id !== id));

    const { error } = await deleteNote(id);
    if (error) {
      setNotes(snapshot);
      showError(error);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <TodoSection
          todos={todos}
          currentUserId={currentUserId}
          partnerId={partnerId}
          onAdd={handleAddTodo}
          onToggle={handleToggleTodo}
          onDelete={handleDeleteTodo}
        />
        <NoteSection
          notes={notes}
          currentUserId={currentUserId}
          partnerId={partnerId}
          onAdd={handleAddNote}
          onDelete={handleDeleteNote}
        />
      </div>
      <PixelRetriever bubble={bubble} />
      {toast && (
        <div
          key={toast.id}
          role="alert"
          className="animate-pop-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
