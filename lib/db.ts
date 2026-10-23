import "server-only";
import { neon } from "@neondatabase/serverless";
import type { AttemptRecord, Medium, ScanRecord, ScanResult } from "./types";

type Sql = ReturnType<typeof neon>;
let client: Sql | undefined;

function sql(): Sql {
  if (!client) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

type Row = Record<string, unknown>;
const iso = (v: unknown) => new Date(v as string | Date).toISOString();

const toScan = (r: Row): ScanRecord => ({
  code: r.qr_code as string,
  ticketNo: r.ticket_no as string,
  scannedBy: r.scanned_by as string,
  scannedAt: iso(r.scanned_at),
  medium: r.medium === "photo" ? "photo" : "paper",
});

const toAttempt = (r: Row): AttemptRecord => ({
  id: Number(r.id),
  rawCode: r.qr_code_raw as string,
  code: (r.qr_code as string | null) ?? null,
  result: r.result as ScanResult,
  scannedBy: r.scanned_by as string,
  attemptedAt: iso(r.attempted_at),
  medium: r.medium === "photo" ? "photo" : "paper",
});

/**
 * Record the first scan of a ticket. Exactly one caller per QR gets
 * firstScan: true, however many phones scan it at the same moment.
 */
export async function claimTicket(code: string, ticketNo: string, scannedBy: string, medium: Medium) {
  const won = (await sql()`
    insert into scans (qr_code, ticket_no, scanned_by, medium)
    values (${code}, ${ticketNo}, ${scannedBy}, ${medium})
    on conflict (qr_code) do nothing
    returning *, now() as server_now`) as Row[];
  if (won.length) {
    return { firstScan: true, record: toScan(won[0]), serverNow: iso(won[0].server_now) };
  }
  // Separate statement on purpose: a fresh snapshot always sees the winner's
  // committed row, which a single INSERT ... UNION SELECT might not.
  const existing = (await sql()`
    select *, now() as server_now from scans where qr_code = ${code}`) as Row[];
  return { firstScan: false, record: toScan(existing[0]), serverNow: iso(existing[0].server_now) };
}

export async function logAttempt(
  rawCode: string,
  code: string | null,
  result: ScanResult,
  scannedBy: string,
  medium: Medium,
) {
  try {
    await sql()`
      insert into attempts (qr_code_raw, qr_code, result, scanned_by, medium)
      values (${rawCode.slice(0, 512)}, ${code}, ${result}, ${scannedBy}, ${medium})`;
  } catch (err) {
    // The audit log must never change what the gate sees.
    console.error("logAttempt failed", err);
  }
}

/** shown: "photo" = first entry was a photo; "conflict" = photo first, then the paper ticket turned up. */
export type Filters = { q?: string; by?: string; shown?: string; limit?: number };

export async function listScans({ q = "", by = "", shown = "", limit = 500 }: Filters = {}) {
  const rows = (await sql()`
    select s.*, coalesce(a.repeats, 0)::int as repeats, coalesce(a.paper_after, false) as paper_after
    from scans s
    left join (
      select qr_code, count(*) as repeats, bool_or(medium = 'paper') as paper_after from attempts
      where result = 'ALREADY_USED' group by qr_code
    ) a using (qr_code)
    where (${q}::text = '' or s.ticket_no ilike '%' || ${q}::text || '%' or s.qr_code ilike '%' || ${q}::text || '%'
           or s.scanned_by ilike '%' || ${q}::text || '%')
      and (${by}::text = '' or s.scanned_by = ${by}::text)
      and (${shown}::text = ''
           or (${shown}::text = 'photo' and s.medium = 'photo')
           or (${shown}::text = 'conflict' and s.medium = 'photo' and coalesce(a.paper_after, false)))
    order by s.scanned_at desc
    limit ${limit}::int`) as Row[];
  return rows.map((r) => ({
    ...toScan(r),
    repeats: Number(r.repeats),
    // A photo got in first and the paper ticket was shown later.
    conflict: r.medium === "photo" && r.paper_after === true,
  }));
}

export async function listAttempts({ q = "", by = "", shown = "", limit = 1000 }: Filters = {}) {
  const rows = (await sql()`
    select * from attempts
    where (${q}::text = '' or qr_code_raw ilike '%' || ${q}::text || '%' or qr_code ilike '%' || ${q}::text || '%'
           or scanned_by ilike '%' || ${q}::text || '%')
      and (${by}::text = '' or scanned_by = ${by}::text)
      and (${shown}::text = ''
           or (${shown}::text = 'photo' and medium = 'photo')
           -- every attempt on a ticket whose photo got in first and whose paper turned up later
           or (${shown}::text = 'conflict' and qr_code in (
                select a.qr_code from attempts a join scans s using (qr_code)
                where a.result = 'ALREADY_USED' and a.medium = 'paper' and s.medium = 'photo')))
    order by attempted_at desc, id desc
    limit ${limit}::int`) as Row[];
  return rows.map(toAttempt);
}

export async function getStats() {
  const [r] = (await sql()`
    select
      (select count(*) from scans)::int as admitted,
      (select count(*) from attempts where result = 'ALREADY_USED')::int as repeats,
      (select count(*) from attempts where result = 'INVALID')::int as invalid,
      (select count(*) from attempts)::int as attempts,
      (select count(*) from scans where medium = 'photo')::int as photos,
      (select count(distinct a.qr_code) from attempts a join scans s using (qr_code)
        where a.result = 'ALREADY_USED' and a.medium = 'paper' and s.medium = 'photo')::int as conflicts`) as Row[];
  return {
    admitted: Number(r.admitted),
    repeats: Number(r.repeats),
    invalid: Number(r.invalid),
    attempts: Number(r.attempts),
    photos: Number(r.photos),
    conflicts: Number(r.conflicts),
  };
}

export async function ping() {
  await sql()`select 1`;
}
