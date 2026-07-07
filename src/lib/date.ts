const KST_TZ = "Asia/Seoul";

export function getTodayDateString(): string {
  // en-CA gives YYYY-MM-DD directly, which matches Postgres `date` format.
  return new Intl.DateTimeFormat("en-CA", { timeZone: KST_TZ }).format(new Date());
}

export function formatHeaderDate(): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TZ,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

export function formatShortDate(dateString: string): string {
  const [, month, day] = dateString.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

// Days since epoch for a YYYY-MM-DD string. Used to pick the daily diary
// question deterministically so both partners always see the same one.
export function getDayNumber(dateString: string): number {
  return Math.floor(Date.parse(`${dateString}T00:00:00Z`) / 86_400_000);
}

export function formatDateWithWeekday(dateString: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TZ,
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${dateString}T00:00:00+09:00`));
}

// Start of the KST day as an ISO instant — for created_at range filters.
export function kstDayStartISO(dateString: string, hour = 0): string {
  return `${dateString}T${String(hour).padStart(2, "0")}:00:00+09:00`;
}

// Convert a timestamptz ISO string to its KST calendar date (YYYY-MM-DD).
export function toKstDateString(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: KST_TZ }).format(new Date(iso));
}

export function formatKstTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
