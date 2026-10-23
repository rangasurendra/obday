import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { listAttempts, listScans } from "@/lib/db";
import { csvDate, csvTime } from "@/lib/time";

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const session = await getSession();
  if (session?.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });

  const { file } = await params;
  const search = new URL(request.url).searchParams;
  const filters = { q: (search.get("q") ?? "").trim(), by: search.get("by") ?? "" };

  let csv: string;
  if (file === "scanned.csv") {
    const rows = await listScans({ ...filters, limit: 100_000 });
    csv = toCsv(
      ["qr_code", "ticket_no", "scanned_by", "scanned_date", "scanned_time", "scanned_at_iso", "repeat_tries"],
      rows.map((r) => [r.code, r.ticketNo, r.scannedBy, csvDate(r.scannedAt), csvTime(r.scannedAt), r.scannedAt, r.repeats]),
    );
  } else if (file === "attempts.csv") {
    const rows = await listAttempts({ ...filters, limit: 100_000 });
    csv = toCsv(
      ["qr_code_raw", "qr_code", "result", "scanned_by", "date", "time", "attempted_at_iso"],
      rows.map((r) => [r.rawCode, r.code, r.result, r.scannedBy, csvDate(r.attemptedAt), csvTime(r.attemptedAt), r.attemptedAt]),
    );
  } else {
    return Response.json({ error: "Unknown file" }, { status: 404 });
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="obday-${file.replace(".csv", "")}-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
