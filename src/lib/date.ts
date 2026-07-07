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
