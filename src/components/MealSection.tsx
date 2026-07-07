"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MealPost, MealType } from "@/lib/types";
import { MEAL_TYPES, MEAL_TYPE_MAP } from "@/lib/constants";
import { formatKstTime } from "@/lib/date";
import { compressImage } from "@/lib/image";
import { addMealPost, deleteMealPost, getMealImageUrl } from "@/lib/actions/meals";

export type MealPostWithUrl = MealPost & { imageUrl: string | null };

export default function MealSection({
  workspaceId,
  currentUserId,
  initialPosts,
}: {
  workspaceId: string;
  currentUserId: string;
  initialPosts: MealPostWithUrl[];
}) {
  const [posts, setPosts] = useState<MealPostWithUrl[]>(initialPosts);
  const [composing, setComposing] = useState(false);
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  function showError(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`meals-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meal_posts",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as MealPost;
            if (postsRef.current.some((p) => p.id === next.id)) return;
            const { data: url } = await getMealImageUrl(next.image_path);
            setPosts((prev) =>
              prev.some((p) => p.id === next.id)
                ? prev
                : [{ ...next, imageUrl: url }, ...prev]
            );
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<MealPost>;
            setPosts((prev) => prev.filter((p) => p.id !== old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const path = `${workspaceId}/${crypto.randomUUID()}.jpg`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("meals")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (uploadError) {
        console.error("meal upload failed:", uploadError.message);
        showError("사진 업로드에 실패했어요. schema.sql이 최신인지 확인해주세요.");
        return;
      }

      const { data, error } = await addMealPost({
        workspaceId,
        mealType,
        imagePath: path,
        caption,
      });
      if (error || !data) {
        showError(error ?? "밥상 올리기에 실패했어요.");
        return;
      }
      setPosts((prev) => (prev.some((p) => p.id === data.id) ? prev : [data, ...prev]));
      setComposing(false);
      setCaption("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      showError(err instanceof Error ? err.message : "이미지 처리에 실패했어요.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(post: MealPostWithUrl) {
    const snapshot = postsRef.current;
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    const { error } = await deleteMealPost({ id: post.id, imagePath: post.image_path });
    if (error) {
      setPosts(snapshot);
      showError(error);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-brown-400/30 bg-cream-100 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-brown-700">🍽️ 오늘의 밥상</h2>
          <p className="mt-0.5 text-xs text-brown-400">오늘 뭐 먹었는지 사진 한 장으로 공유해요</p>
        </div>
        <button
          onClick={() => setComposing((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            composing
              ? "bg-brown-500 text-cream-50"
              : "bg-butter-100 text-brown-600 hover:bg-butter-200"
          }`}
        >
          {composing ? "닫기" : "+ 올리기"}
        </button>
      </div>

      {composing && (
        <form onSubmit={handleUpload} className="animate-pop-in mt-3 rounded-xl bg-white/80 p-3">
          <div className="flex gap-1.5">
            {MEAL_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setMealType(t.value)}
                className={`flex-1 rounded-xl border-2 py-1.5 text-xs font-semibold transition ${
                  mealType === t.value
                    ? "border-brown-500 bg-butter-100 text-brown-700"
                    : "border-transparent bg-cream-50 text-brown-400 hover:text-brown-600"
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-2 w-full text-xs text-brown-500 file:mr-2 file:rounded-full file:border-0 file:bg-butter-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brown-600"
          />
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              maxLength={100}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="한 줄 코멘트 (선택)"
              className="min-w-0 flex-1 rounded-xl border-2 border-brown-400/30 bg-white px-3 py-1.5 text-sm text-brown-800 outline-none focus:border-brown-500"
            />
            <button
              type="submit"
              disabled={!file || uploading}
              className="shrink-0 rounded-xl bg-brown-500 px-4 py-1.5 text-sm font-semibold text-cream-50 hover:bg-brown-600 disabled:opacity-60"
            >
              {uploading ? "올리는 중..." : "올리기"}
            </button>
          </div>
        </form>
      )}

      {posts.length === 0 ? (
        <p className="mt-4 text-center text-sm text-brown-400">오늘은 아직 밥상이 없어요 🍚</p>
      ) : (
        <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {posts.map((post) => {
            const t = MEAL_TYPE_MAP[post.meal_type];
            return (
              <li key={post.id} className="group w-36 shrink-0">
                <div className="relative">
                  {post.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.imageUrl}
                      alt={post.caption ?? `${t.label} 사진`}
                      className="h-28 w-36 rounded-xl object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-28 w-36 items-center justify-center rounded-xl bg-white/70 text-2xl">
                      {t.emoji}
                    </div>
                  )}
                  {post.user_id === currentUserId && (
                    <button
                      onClick={() => handleDelete(post)}
                      className="absolute right-1 top-1 rounded-full bg-black/40 px-1.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
                      aria-label="삭제"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-brown-500">
                  {t.emoji} {t.label} · {post.user_id === currentUserId ? "나" : "상대방"} ·{" "}
                  {formatKstTime(post.created_at)}
                </p>
                {post.caption && (
                  <p className="truncate text-xs text-brown-700" title={post.caption}>
                    {post.caption}
                  </p>
                )}
              </li>
            );
          })}
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
