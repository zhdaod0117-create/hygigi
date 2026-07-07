"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", emoji: "🏠", label: "홈" },
  { href: "/diary", emoji: "📖", label: "일기" },
  { href: "/history", emoji: "📚", label: "기록" },
] as const;

export default function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-brown-400/20 bg-cream-100/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              // Prefetching all 3 tabs on every mount fires concurrent
              // middleware invocations that each try to refresh the auth
              // session — when the token is actually due for a refresh
              // (e.g. reopening the app after a few hours), the concurrent
              // refresh attempts race and can knock the user back to /login.
              prefetch={false}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition ${
                active ? "text-brown-700" : "text-brown-400 hover:text-brown-600"
              }`}
            >
              <span className={`text-lg ${active ? "" : "grayscale opacity-70"}`}>{tab.emoji}</span>
              {tab.label}
              <span
                className={`h-1 w-8 rounded-full ${active ? "bg-brown-500" : "bg-transparent"}`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
