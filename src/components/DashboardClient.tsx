"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Mood, MoodLog, Note, Todo, WorkStatus, WorkStatusLog } from "@/lib/types";
import { PARTNER_MOOD_BUBBLES, PARTNER_STATUS_BUBBLES } from "@/lib/constants";
import TodayUsStrip from "@/components/TodayUsStrip";
import TodoSection from "@/components/TodoSection";
import NoteSection from "@/components/NoteSection";
import PixelRetriever from "@/components/PixelRetriever";
import { addTodo, toggleTodo, deleteTodo } from "@/lib/actions/todos";
import { addNote, deleteNote } from "@/lib/actions/notes";
import { addMoodLog } from "@/lib/actions/mood";
import { setWorkStatus } from "@/lib/actions/status";

export default function DashboardClient({
  workspaceId,
  currentUserId,
  partnerId,
  initialTodos,
  initialNotes,
  initialMyMood,
  initialPartnerMood,
  initialMyStatus,
  initialPartnerStatus,
  partnerWroteDiaryToday,
  iWroteDiaryToday,
}: {
  workspaceId: string;
  currentUserId: string;
  partnerId: string | null;
  initialTodos: Todo[];
  initialNotes: Note[];
  initialMyMood: MoodLog | null;
  initialPartnerMood: MoodLog | null;
  initialMyStatus: WorkStatusLog | null;
  initialPartnerStatus: WorkStatusLog | null;
  partnerWroteDiaryToday: boolean;
  iWroteDiaryToday: boolean;
}) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [myMood, setMyMood] = useState<MoodLog | null>(initialMyMood);
  const [partnerMood, setPartnerMood] = useState<MoodLog | null>(initialPartnerMood);
  const [myStatus, setMyStatus] = useState<WorkStatusLog | null>(initialMyStatus);
  const [partnerStatus, setPartnerStatus] = useState<WorkStatusLog | null>(initialPartnerStatus);
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
    if (partnerWroteDiaryToday && !iWroteDiaryToday) {
      showBubble("오늘의 질문에 상대방이 먼저 답했어! 📖");
    }
    return () => {
      if (bubbleTimeout.current) clearTimeout(bubbleTimeout.current);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            setNotes((prev) => (prev.some((n) => n.id === next.id) ? prev : [...prev, next]));
            if (next.user_id !== currentUserId) {
              showBubble("새 메모가 왔어!");
            }
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Partial<Note>;
            setNotes((prev) => prev.filter((n) => n.id !== oldRow.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mood_logs",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const log = payload.new as MoodLog;
          if (log.user_id === currentUserId) {
            setMyMood((prev) =>
              !prev || prev.created_at <= log.created_at ? log : prev
            );
          } else {
            setPartnerMood((prev) =>
              !prev || prev.created_at <= log.created_at ? log : prev
            );
            showBubble(PARTNER_MOOD_BUBBLES[log.mood]);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "work_status_logs",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const log = payload.new as WorkStatusLog;
          if (log.user_id === currentUserId) {
            setMyStatus((prev) =>
              !prev || prev.created_at <= log.created_at ? log : prev
            );
          } else {
            setPartnerStatus((prev) =>
              !prev || prev.created_at <= log.created_at ? log : prev
            );
            showBubble(PARTNER_STATUS_BUBBLES[log.status]);
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

  async function handleCheckInMood(mood: Mood, note: string) {
    const { data, error } = await addMoodLog({ workspaceId, mood, note });
    if (error || !data) {
      showError(error ?? "감정 기록에 실패했어요.");
      return;
    }
    setMyMood(data);
    showBubble("오늘의 날씨, 기록했어! 멍!");
  }

  async function handleSetStatus(status: WorkStatus) {
    const { data, error } = await setWorkStatus({ workspaceId, status });
    if (error || !data) {
      showError(error ?? "상태 기록에 실패했어요.");
      return;
    }
    setMyStatus(data);
    if (status === "overtime") showBubble("야근이라니.. 힘내! 🌙");
    else if (status === "off") showBubble("퇴근 축하해! 🏠");
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <TodayUsStrip
        myMood={myMood}
        partnerMood={partnerMood}
        myStatus={myStatus}
        partnerStatus={partnerStatus}
        hasPartner={partnerId !== null}
        onCheckInMood={handleCheckInMood}
        onSetStatus={handleSetStatus}
      />

      {partnerWroteDiaryToday && !iWroteDiaryToday && (
        <Link
          href="/diary"
          className="animate-pop-in flex items-center justify-between rounded-2xl border-2 border-butter-300 bg-butter-100 px-4 py-3 text-sm font-semibold text-brown-700 transition hover:bg-butter-200"
        >
          <span>📖 상대방이 오늘의 질문에 먼저 답했어요!</span>
          <span className="text-xs text-brown-500">나도 쓰러 가기 →</span>
        </Link>
      )}

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
          className="animate-pop-in fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
