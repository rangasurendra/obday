import { describe, expect, it } from "vitest";
import { isAdmit } from "@/lib/admit";
import type { ScanResponse } from "@/lib/types";

const at = (seconds: number) => new Date(Date.UTC(2026, 9, 24, 13, 0, seconds)).toISOString();

const usedBy = (
  scannedBy: string,
  secondsAgo: number,
  status: "ADMITTED" | "ALREADY_USED" = "ALREADY_USED",
): ScanResponse => ({
  status,
  record: { code: "OBTEST01", ticketNo: "TEST 01", scannedBy, scannedAt: at(0), medium: "paper" },
  serverNow: at(secondsAgo),
});

describe("isAdmit", () => {
  it("admits a first scan", () => {
    expect(isAdmit(usedBy("gate1", 0, "ADMITTED"), "gate1", false)).toBe(true);
  });

  it("never admits a fresh re-scan of a used ticket, even by the same gate seconds later", () => {
    expect(isAdmit(usedBy("gate1", 5), "gate1", false)).toBe(false);
    expect(isAdmit(usedBy("gate2", 5), "gate1", false)).toBe(false);
  });

  it("admits only an explicit retry of this gate's own scan inside a minute", () => {
    expect(isAdmit(usedBy("gate1", 5), "gate1", true)).toBe(true);
    expect(isAdmit(usedBy("gate1", 90), "gate1", true)).toBe(false);
    expect(isAdmit(usedBy("gate2", 5), "gate1", true)).toBe(false);
  });

  it("never admits an invalid code", () => {
    expect(isAdmit({ status: "INVALID", raw: "x" }, "gate1", true)).toBe(false);
  });
});
