import { getSession } from "@/lib/auth";
import { claimTicket, logAttempt } from "@/lib/db";
import { findTicket, normalizeCode } from "@/lib/tickets";
import type { Medium, ScanResponse } from "@/lib/types";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { code?: unknown; medium?: unknown } | null;
  const raw = typeof body?.code === "string" ? body.code.slice(0, 512) : "";
  const medium: Medium = body?.medium === "photo" ? "photo" : "paper";
  const code = normalizeCode(raw);
  const ticket = code ? findTicket(code) : undefined;

  if (!ticket) {
    await logAttempt(raw, code, "INVALID", session.username, medium);
    return Response.json({ status: "INVALID", raw } satisfies ScanResponse);
  }

  const { firstScan, record, serverNow } = await claimTicket(ticket.code, ticket.ticketNo, session.username, medium);
  const status = firstScan ? "ADMITTED" : "ALREADY_USED";
  await logAttempt(raw, ticket.code, status, session.username, medium);
  return Response.json({ status, record, serverNow } satisfies ScanResponse);
}
