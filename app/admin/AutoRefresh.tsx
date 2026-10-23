"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatTime } from "@/lib/time";

const REFRESH_MS = 15_000;

export default function AutoRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
      setUpdatedAt(new Date().toISOString());
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return (
    <div className="ml-auto flex items-center gap-3">
      <span className="text-[13px] text-muted" aria-live="polite">
        {updatedAt ? `Updated ${formatTime(updatedAt)} · ` : ""}refreshes every 15 s
      </span>
      <button
        type="button"
        onClick={() => {
          startTransition(() => router.refresh());
          setUpdatedAt(new Date().toISOString());
        }}
        disabled={pending}
        className="flex h-11 items-center gap-2 rounded-[10px] border border-rule px-4 text-[15px] tracking-[0.1em] uppercase disabled:opacity-60"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        {pending ? "Refreshing" : "Refresh"}
      </button>
    </div>
  );
}
