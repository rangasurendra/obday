// Runs against the database in DATABASE_URL (use the Neon dev branch, never production).
// Skipped when no database is configured.
import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import { claimTicket } from "@/lib/db";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

describe.skipIf(!url)("claimTicket", () => {
  it("lets exactly one of 50 simultaneous scans win", async () => {
    const code = `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    try {
      const results = await Promise.all(
        Array.from({ length: 50 }, (_, i) => claimTicket(code, "TEST 0000", `gate${(i % 8) + 1}`, i % 2 ? "photo" : "paper")),
      );
      const winners = results.filter((r) => r.firstScan);
      expect(winners).toHaveLength(1);
      // Every loser sees the winner's record.
      for (const r of results) expect(r.record).toEqual(winners[0].record);
    } finally {
      await neon(url!)`delete from scans where qr_code = ${code}`;
    }
  });
});
