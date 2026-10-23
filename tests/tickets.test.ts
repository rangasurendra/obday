import { describe, expect, it } from "vitest";
import { buildTicketIndex, findTicket, normalizeCode } from "@/lib/tickets";

describe("normalizeCode", () => {
  it("trims, removes spaces and upper-cases", () => {
    expect(normalizeCode("  9betj8bb \n")).toBe("9BETJ8BB");
    expect(normalizeCode("BCOBA 0181")).toBe("BCOBA0181");
  });

  it("reduces URL payloads to the code", () => {
    expect(normalizeCode("https://example.com/t/9BETJ8BB")).toBe("9BETJ8BB");
    expect(normalizeCode("https://example.com/verify?code=9betj8bb")).toBe("9BETJ8BB");
  });

  it("rejects empty input", () => {
    expect(normalizeCode("   ")).toBeNull();
    expect(normalizeCode("")).toBeNull();
  });
});

describe("findTicket", () => {
  const index = buildTicketIndex([
    { qr_code: "9BETJ8BB", ticket_no: "BCOBA 0181" },
    { qr_code: " x1y2z3 ", ticket_no: "" },
    { qr_code: "", ticket_no: "BCOBA 0999" },
  ]);

  it("finds by QR code", () => {
    expect(findTicket("9BETJ8BB", index)).toEqual({ code: "9BETJ8BB", ticketNo: "BCOBA 0181" });
    expect(findTicket("X1Y2Z3", index)?.code).toBe("X1Y2Z3");
  });

  it("finds by typed serial number", () => {
    expect(findTicket(normalizeCode("bcoba 0181")!, index)?.code).toBe("9BETJ8BB");
  });

  it("skips rows without a code and misses unknown codes", () => {
    expect(index.count).toBe(2);
    expect(findTicket("NOPE", index)).toBeUndefined();
  });
});
