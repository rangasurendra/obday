import { ping } from "@/lib/db";

// Pinged by open scan/admin pages so Neon doesn't fall asleep mid-event.
export async function GET() {
  try {
    await ping();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
