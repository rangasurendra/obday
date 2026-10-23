// Build data/tickets.csv from the QR code list.
// Usage: npm run import-tickets -- <file.csv|file.txt> [--with-test]
//
// --with-test also adds the 20 test tickets from data/test-tickets.csv (OBTEST01..20).
// They are real, scannable tickets: re-import WITHOUT the flag before gates open.
//
// Accepts either
//   - a CSV with a header row: the QR column is the first header containing "qr" or "code",
//     the serial column the first containing "ticket", "serial" or "no"; or
//   - plain lines: "CODE" or "CODE,SERIAL" / "CODE<TAB>SERIAL".
// Fails on empty or duplicate codes so a bad list never reaches the gate.
import { readFileSync, writeFileSync } from "node:fs";
import { parseCsv, toCsv } from "../lib/csv";
import { normalizeCode } from "../lib/tickets";

const args = process.argv.slice(2);
const withTest = args.includes("--with-test");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Usage: npm run import-tickets -- <file.csv|file.txt> [--with-test]");
  process.exit(1);
}

const text = readFileSync(file, "utf8").replace(/^﻿/, "");
const firstLine = text.split(/\r?\n/, 1)[0].toLowerCase();
const hasHeader = /qr|code|ticket|serial/.test(firstLine);

// Write serials the way they are printed on the ticket: "BCOBA-181" -> "BCOBA 0181".
const printedSerial = (s: string) => {
  const m = /^([A-Za-z]+)[\s-]*(\d+)$/.exec(s.trim());
  return m ? `${m[1].toUpperCase()} ${m[2].padStart(4, "0")}` : s.trim();
};

let pairs: { raw: string; serial: string; active: boolean; where: string }[];
if (hasHeader) {
  const rows = parseCsv(text);
  const headers = Object.keys(rows[0] ?? {});
  const codeCol = headers.find((h) => /qr|code/.test(h));
  const serialCol = headers.find((h) => h !== codeCol && /ticket|serial|no/.test(h));
  const statusCol = headers.find((h) => h === "status");
  if (!codeCol) throw new Error(`No QR/code column in headers: ${headers.join(", ")}`);
  console.log(`Columns: code="${codeCol}" serial="${serialCol ?? "(none)"}" status="${statusCol ?? "(none)"}"`);
  pairs = rows.map((r, i) => ({
    where: `line ${i + 2}`,
    raw: r[codeCol] ?? "",
    serial: serialCol ? printedSerial(r[serialCol] ?? "") : "",
    // A status column, when present, must say "active" (or be blank) for the ticket to count.
    active: !statusCol || ["", "active"].includes((r[statusCol] ?? "").toLowerCase()),
  }));
} else {
  pairs = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l, i) => {
      const [raw, serial = ""] = l.split(/[,\t]/);
      return { raw, serial: printedSerial(serial), active: true, where: `line ${i + 1}` };
    });
}

let testCount = 0;
if (withTest) {
  const tests = parseCsv(readFileSync("data/test-tickets.csv", "utf8"));
  testCount = tests.length;
  pairs.push(
    ...tests.map((r, i) => ({
      raw: r.qr_code ?? "",
      serial: (r.ticket_no ?? "").trim(),
      active: true,
      where: `test-tickets.csv line ${i + 2}`,
    })),
  );
}

const seen = new Map<string, string>();
const errors: string[] = [];
const out: string[][] = [];
let skipped = 0;
pairs.forEach(({ raw, serial, active, where }) => {
  if (!active) return skipped++;
  const code = normalizeCode(raw);
  if (!code) return errors.push(`${where}: empty code`);
  if (seen.has(code)) return errors.push(`${where}: duplicate ${code} (first on ${seen.get(code)})`);
  seen.set(code, where);
  out.push([code, serial]);
});

if (errors.length) {
  console.error(`${errors.length} problem(s):\n  ${errors.slice(0, 50).join("\n  ")}`);
  process.exit(1);
}

writeFileSync("data/tickets.csv", toCsv(["qr_code", "ticket_no"], out).replace(/\r\n/g, "\n"));
const withSerial = out.filter((r) => r[1]).length;
console.log(`Wrote data/tickets.csv: ${out.length} tickets (${withSerial} with a serial number, ${skipped} not active and skipped).`);
console.log(`First: ${out[0]?.join(" / ")}   Last: ${out.at(-1)?.join(" / ")}`);
console.log(
  withTest
    ? `Includes ${testCount} TEST tickets. Re-run without --with-test before the event.`
    : "No test tickets included.",
);
