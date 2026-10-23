import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("parses with trimmed, lower-cased headers and a BOM", () => {
    expect(parseCsv("﻿ QR_Code ,Ticket_No\n9BETJ8BB, BCOBA 0181\n\n")).toEqual([
      { qr_code: "9BETJ8BB", ticket_no: "BCOBA 0181" },
    ]);
  });

  it("quotes commas and quotes, and defuses spreadsheet formulas", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"'], ["=HYPERLINK(1)", null]])).toBe(
      'a,b\r\n"x,y","say ""hi"""\r\n\'=HYPERLINK(1),\r\n',
    );
  });
});
