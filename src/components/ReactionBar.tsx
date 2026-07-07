"use client";

import { REACTION_EMOJIS } from "@/lib/constants";
import type { Reaction, ReactionTarget } from "@/lib/types";

// Compact emoji reaction row. Shows who reacted with what; tapping toggles
// (same emoji removes, different emoji replaces — server enforces 1 per user).
export default function ReactionBar({
  targetType,
  targetId,
  reactions,
  currentUserId,
  onToggle,
}: {
  targetType: ReactionTarget;
  targetId: string;
  reactions: Reaction[];
  currentUserId: string;
  onToggle: (targetType: ReactionTarget, targetId: string, emoji: string) => void;
}) {
  const relevant = reactions.filter(
    (r) => r.target_type === targetType && r.target_id === targetId
  );
  const mine = relevant.find((r) => r.user_id === currentUserId);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {REACTION_EMOJIS.map((emoji) => {
        const count = relevant.filter((r) => r.emoji === emoji).length;
        const isMine = mine?.emoji === emoji;
        return (
          <button
            key={emoji}
            onClick={() => onToggle(targetType, targetId, emoji)}
            className={`rounded-full px-1.5 py-0.5 text-sm transition ${
              isMine
                ? "bg-butter-200 ring-2 ring-brown-400"
                : count > 0
                  ? "bg-butter-100 hover:bg-butter-200"
                  : "opacity-40 grayscale hover:opacity-100 hover:grayscale-0"
            }`}
            aria-label={`${emoji} 리액션`}
          >
            {emoji}
            {count > 0 && <span className="ml-0.5 text-[10px] text-brown-500">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
