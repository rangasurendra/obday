import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { getSession } from "@/lib/auth";
import { getStats, listAttempts, listScans } from "@/lib/db";
import { ticketCount } from "@/lib/tickets";
import { formatDate, formatTime } from "@/lib/time";
import { listUsernames } from "@/lib/users";
import { MEDIUM_LABEL, type Medium, type ScanResult } from "@/lib/types";
import AutoRefresh from "./AutoRefresh";
import Filters from "./Filters";

type Search = { tab?: string; q?: string; by?: string; shown?: string };

const th = "px-4 py-3 text-left text-xs font-medium tracking-[0.16em] whitespace-nowrap text-muted uppercase";
const td = "px-4 py-3 whitespace-nowrap";

const RESULT_LABEL: Record<ScanResult, string> = {
  ADMITTED: "Admitted",
  ALREADY_USED: "Already used",
  INVALID: "Invalid",
};

function query(params: Search) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

function MediumBadge({ medium }: { medium: Medium }) {
  return medium === "photo" ? (
    <span className="rounded-md bg-gold px-2 py-0.5 text-sm font-medium text-[#1a0e08]">{MEDIUM_LABEL.photo}</span>
  ) : (
    <span className="text-muted">{MEDIUM_LABEL.paper}</span>
  );
}

function Tile({ label, value, total, alert }: { label: string; value: number; total?: number; alert?: boolean }) {
  return (
    <div className={`flex flex-col gap-2 rounded-[14px] border bg-surface px-[18px] py-4 ${total ? "border-rule" : "border-line"}`}>
      <span className="text-xs tracking-[0.18em] text-muted uppercase">{label}</span>
      <span className={`text-[34px] leading-none font-semibold ${alert && value > 0 ? "text-deny-soft" : ""}`}>
        {value}
        {total !== undefined && <span className="text-lg font-normal text-muted"> / {total}</span>}
      </span>
      {total !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-1.5 bg-ok" style={{ width: `${total ? Math.min(100, (value / total) * 100) : 0}%` }} />
        </div>
      )}
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/scan");

  const { tab = "scanned", q = "", by = "", shown = "" } = await searchParams;
  const showAttempts = tab === "attempts";
  const filters = { q: q.trim(), by, shown };

  const [stats, scans, attempts] = await Promise.all([
    getStats(),
    showAttempts ? Promise.resolve([]) : listScans(filters),
    showAttempts ? listAttempts(filters) : Promise.resolve([]),
  ]);
  const total = ticketCount();
  const tabClass = (active: boolean) =>
    `flex h-11 items-center border-b-[3px] px-[18px] text-[15px] font-medium tracking-[0.14em] uppercase ${
      active ? "border-gold text-gold" : "border-transparent text-muted hover:text-ink"
    }`;
  const exportHref = `/api/export/${showAttempts ? "attempts" : "scanned"}.csv${query(filters)}`;

  return (
    <div className="min-h-dvh">
      <AppHeader session={session} current="admin" />
      <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 pt-6 pb-12">
        <section aria-label="Totals" className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5">
          <Tile label="Admitted" value={stats.admitted} total={total} />
          <Tile label="Not yet arrived" value={Math.max(0, total - stats.admitted)} />
          <Tile label="Repeat attempts" value={stats.repeats} alert />
          <Tile label="Invalid codes" value={stats.invalid} alert />
          <Tile label="Entered by photo" value={stats.photos} />
          <Tile label="Photo, then paper" value={stats.conflicts} alert />
        </section>

        <section className="flex flex-col gap-3.5">
          <nav aria-label="Records" className="flex gap-1 border-b border-line">
            <Link href={`/admin${query({ q, by, shown })}`} className={tabClass(!showAttempts)} aria-current={!showAttempts ? "page" : undefined}>
              Scanned ({stats.admitted})
            </Link>
            <Link href={`/admin${query({ tab: "attempts", q, by, shown })}`} className={tabClass(showAttempts)} aria-current={showAttempts ? "page" : undefined}>
              All attempts ({stats.attempts})
            </Link>
          </nav>

          <div className="flex flex-wrap items-center gap-2.5">
            <Filters tab={showAttempts ? "attempts" : ""} q={q} by={by} shown={shown} users={listUsernames()} />
            <a
              href={exportHref}
              className="flex h-11 items-center gap-2 rounded-[10px] bg-gold px-4 text-[15px] font-semibold tracking-[0.1em] text-[#1a0e08] uppercase"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
              </svg>
              {showAttempts ? "attempts.csv" : "scanned.csv"}
            </a>
            <AutoRefresh />
          </div>

          <div className="overflow-x-auto rounded-[14px] border border-line">
            {showAttempts ? (
              <table className="w-full min-w-[760px] border-collapse text-base">
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className={`${th} sticky left-0 bg-surface`}>Time</th>
                    <th scope="col" className={th}>Date</th>
                    <th scope="col" className={th}>Result</th>
                    <th scope="col" className={th}>Code read</th>
                    <th scope="col" className={th}>Shown as</th>
                    <th scope="col" className={th}>Scanned by</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-t border-line">
                      <th scope="row" className={`${td} sticky left-0 bg-ground text-left font-medium`}>{formatTime(a.attemptedAt)}</th>
                      <td className={td}>{formatDate(a.attemptedAt)}</td>
                      <td className={td}>
                        <span
                          className={`rounded-md px-2 py-0.5 text-sm font-medium ${
                            a.result === "ADMITTED" ? "bg-admit text-white" : "border border-deny-line bg-deny-ground text-deny-soft"
                          }`}
                        >
                          {RESULT_LABEL[a.result]}
                        </span>
                      </td>
                      <td className={`${td} max-w-[280px] truncate tracking-[0.06em]`} title={a.rawCode}>{a.rawCode}</td>
                      <td className={td}>
                        <MediumBadge medium={a.medium} />
                      </td>
                      <td className={td}>{a.scannedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[760px] border-collapse text-base">
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className={`${th} sticky left-0 bg-surface`}>Ticket no.</th>
                    <th scope="col" className={th}>QR code</th>
                    <th scope="col" className={th}>Scanned by</th>
                    <th scope="col" className={th}>Date</th>
                    <th scope="col" className={th}>Time</th>
                    <th scope="col" className={th}>Shown as</th>
                    <th scope="col" className={`${th} text-right`}>Repeat tries</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((s) => (
                    <tr key={s.code} className="border-t border-line">
                      <th scope="row" className={`${td} sticky left-0 bg-ground text-left font-medium tracking-[0.06em]`}>
                        <Link href={`/admin${query({ tab: "attempts", q: s.code })}`} className="text-ink underline decoration-rule underline-offset-4 hover:text-gold">
                          {s.ticketNo || "—"}
                        </Link>
                      </th>
                      <td className={`${td} tracking-[0.1em]`}>{s.code}</td>
                      <td className={td}>{s.scannedBy}</td>
                      <td className={td}>{formatDate(s.scannedAt)}</td>
                      <td className={td}>{formatTime(s.scannedAt)}</td>
                      <td className={td}>
                        <MediumBadge medium={s.medium} />
                        {s.conflict && (
                          <span className="ml-2 rounded-md border border-deny-line bg-deny-ground px-2 py-0.5 text-sm font-semibold text-deny-soft">
                            Paper shown later
                          </span>
                        )}
                      </td>
                      <td className={`${td} text-right`}>
                        <span
                          className={`inline-block min-w-7 rounded-md px-2 py-0.5 text-center ${
                            s.repeats > 0 ? "border border-deny-line bg-deny-ground font-semibold text-deny-soft" : "text-muted"
                          }`}
                        >
                          {s.repeats}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(showAttempts ? attempts : scans).length === 0 && (
              <p className="m-0 px-4 py-8 text-center text-muted">{q || by || shown ? "Nothing matches these filters." : "No scans yet."}</p>
            )}
          </div>
          <p className="m-0 text-[13px] text-muted">
            Tap a ticket number to see every attempt for that QR. Times are Sri Lanka time. Shows the latest{" "}
            {showAttempts ? "1,000" : "500"} rows; the CSV has the same cap.
          </p>
        </section>
      </main>
    </div>
  );
}
