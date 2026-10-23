"use client";

import { useRef } from "react";

// A plain GET form, so filters live in the URL and survive the auto-refresh.
export default function Filters({ tab, q, by, users }: { tab: string; q: string; by: string; users: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="get" action="/admin" className="flex min-w-0 grow flex-wrap items-center gap-2.5">
      {tab && <input type="hidden" name="tab" value={tab} />}
      <label htmlFor="q" className="sr-only">
        Search
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Search ticket no., QR code or staff"
        className="h-11 min-w-0 flex-[1_1_240px] rounded-[10px] border border-rule bg-surface px-3.5 text-base outline-none placeholder:text-hint focus:border-gold"
      />
      <label htmlFor="by" className="sr-only">
        Scanned by
      </label>
      <select
        id="by"
        name="by"
        defaultValue={by}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-11 rounded-[10px] border border-rule bg-surface px-3 text-base"
      >
        <option value="">All staff</option>
        {users.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-11 rounded-[10px] border border-rule px-4 text-[15px] tracking-[0.1em] text-ink uppercase hover:border-gold"
      >
        Search
      </button>
    </form>
  );
}
