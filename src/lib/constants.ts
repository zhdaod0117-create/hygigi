import type { MealType, Mood, WorkStatus } from "@/lib/types";

export const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: "sunny", emoji: "☀️", label: "맑음" },
  { value: "partly", emoji: "🌤️", label: "구름 조금" },
  { value: "cloudy", emoji: "☁️", label: "흐림" },
  { value: "rainy", emoji: "🌧️", label: "비" },
  { value: "stormy", emoji: "⛈️", label: "폭풍" },
];

export const MOOD_MAP = Object.fromEntries(MOODS.map((m) => [m.value, m])) as Record<
  Mood,
  (typeof MOODS)[number]
>;

export const WORK_STATUSES: { value: WorkStatus; emoji: string; label: string }[] = [
  { value: "working", emoji: "🏢", label: "출근" },
  { value: "off", emoji: "🏠", label: "퇴근" },
  { value: "overtime", emoji: "🌙", label: "야근" },
  { value: "meeting", emoji: "🔇", label: "회의 중" },
];

export const WORK_STATUS_MAP = Object.fromEntries(
  WORK_STATUSES.map((s) => [s.value, s])
) as Record<WorkStatus, (typeof WORK_STATUSES)[number]>;

export const REACTION_EMOJIS = ["❤️", "😂", "😭", "👍", "🥺", "🎉"] as const;

export const MEAL_TYPES: { value: MealType; emoji: string; label: string }[] = [
  { value: "breakfast", emoji: "🌅", label: "아침" },
  { value: "lunch", emoji: "🍚", label: "점심" },
  { value: "dinner", emoji: "🌙", label: "저녁" },
  { value: "snack", emoji: "🍪", label: "간식" },
];

export const MEAL_TYPE_MAP = Object.fromEntries(
  MEAL_TYPES.map((m) => [m.value, m])
) as Record<MealType, (typeof MEAL_TYPES)[number]>;

// Signed URL lifetime for meal photos (keep in sync with actions/meals.ts).
export const MEAL_URL_TTL_SECONDS = 60 * 60;

// Dog speech bubbles for partner mood check-ins arriving in realtime.
export const PARTNER_MOOD_BUBBLES: Record<Mood, string> = {
  sunny: "상대방 마음이 맑음이래! ☀️",
  partly: "상대방 마음에 구름 조금 🌤️",
  cloudy: "상대방 마음이 흐리대.. ☁️",
  rainy: "상대방 마음에 비가 와.. 토닥토닥 🌧️",
  stormy: "상대방 마음에 폭풍이!! 꼭 안아줘 ⛈️",
};

export const PARTNER_STATUS_BUBBLES: Record<WorkStatus, string> = {
  working: "상대방 출근했대! 화이팅 🏢",
  off: "상대방 퇴근했대! 🏠",
  overtime: "상대방 야근이래.. 힘내라 멍! 🌙",
  meeting: "상대방 회의 들어갔대 🔇",
};