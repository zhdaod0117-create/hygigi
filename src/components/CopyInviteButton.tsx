"use client";

import { useState } from "react";

export default function CopyInviteButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // clipboard API unavailable (e.g. insecure context) — ignore silently
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-full bg-brown-500 px-3 py-1 text-xs font-semibold text-cream-50 transition hover:bg-brown-600"
    >
      {copied ? "복사됨! ✓" : "복사"}
    </button>
  );
}
