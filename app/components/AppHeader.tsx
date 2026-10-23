import Link from "next/link";
import { signOut } from "@/app/login/actions";
import type { Session } from "@/lib/session";

export default function AppHeader({ session, current }: { session: Session; current: "scan" | "admin" }) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-3 pr-3 pl-5">
      <div className="flex grow flex-col">
        <span className="font-display text-[22px] leading-tight font-black text-gold">OB DAY 2026</span>
        <span className="text-xs tracking-[0.16em] text-muted uppercase">
          {current === "scan" ? "Ticket check" : "Admin"}
        </span>
      </div>
      <nav className="flex items-center gap-2">
        {session.role === "admin" &&
          (current === "scan" ? (
            <Link href="/admin" className="px-2 text-sm tracking-wide text-gold hover:text-gold-light">
              Admin
            </Link>
          ) : (
            <Link href="/scan" className="px-2 text-sm tracking-wide text-gold hover:text-gold-light">
              Open scanner
            </Link>
          ))}
        <span className="flex h-9 items-center gap-2 rounded-full border border-rule px-3 text-sm tracking-wide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
          {session.username}
        </span>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sign out"
            className="flex size-11 items-center justify-center rounded-[10px] border border-line text-muted hover:text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </form>
      </nav>
    </header>
  );
}
