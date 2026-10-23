import { readDataCsv } from "./data-file";

export type Ticket = { code: string; ticketNo: string };

export type TicketIndex = {
  byCode: Map<string, Ticket>;
  bySerial: Map<string, Ticket>;
  count: number;
};

/**
 * Turn whatever the camera or keyboard produced into a lookup key.
 * - surrounding whitespace and inner spaces are dropped, letters upper-cased
 * - a URL payload is reduced to its ?code= value or its last path segment
 * Returns null when nothing usable is left.
 */
export function normalizeCode(raw: string): string | null {
  let value = raw.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      value =
        url.searchParams.get("code") ??
        url.pathname.split("/").filter(Boolean).pop() ??
        "";
    } catch {
      // not a valid URL after all; keep the raw text
    }
  }
  value = value.replace(/\s+/g, "").toUpperCase();
  return value.length > 0 && value.length <= 128 ? value : null;
}

export function buildTicketIndex(rows: Record<string, string>[]): TicketIndex {
  const byCode = new Map<string, Ticket>();
  const bySerial = new Map<string, Ticket>();
  for (const row of rows) {
    const code = normalizeCode(row.qr_code ?? "");
    if (!code) continue;
    const ticket: Ticket = { code, ticketNo: (row.ticket_no ?? "").trim() };
    byCode.set(code, ticket);
    const serial = normalizeCode(ticket.ticketNo);
    if (serial) bySerial.set(serial, ticket);
  }
  return { byCode, bySerial, count: byCode.size };
}

let index: TicketIndex | undefined;

function getIndex(): TicketIndex {
  index ??= buildTicketIndex(readDataCsv("tickets.csv"));
  return index;
}

/**
 * Find a ticket by its QR value. Staff can also type the printed serial
 * (e.g. "BCOBA 0181") when a QR won't scan, so fall back to that.
 */
export function findTicket(normalized: string, idx: TicketIndex = getIndex()): Ticket | undefined {
  return idx.byCode.get(normalized) ?? idx.bySerial.get(normalized);
}

export function ticketCount(): number {
  return getIndex().count;
}
