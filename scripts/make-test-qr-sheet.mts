// Write a printable A4 sheet of the test ticket QR codes.
// Usage: npm run test-qr-sheet   ->  data/test-qr-sheet.html (open it and print, or show on a screen)
import { readFileSync, writeFileSync } from "node:fs";
import QRCode from "qrcode";
import { parseCsv } from "../lib/csv";

const tickets = parseCsv(readFileSync("data/test-tickets.csv", "utf8"));

const cards = await Promise.all(
  tickets.map(async ({ qr_code, ticket_no }) => {
    const svg = await QRCode.toString(qr_code, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return `<div class="card">${svg}<div class="code">${qr_code}</div><div class="serial">${ticket_no}</div></div>`;
  }),
);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>OB Day 2026 · Test QR codes</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; color: #140a08; background: #fff; }
  h1 { margin: 0 0 4px; font-size: 18px; }
  p { margin: 0 0 12px; font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .card { border: 1px dashed #6b5326; border-radius: 6px; padding: 6px; text-align: center; break-inside: avoid; }
  .card svg { width: 100%; max-width: 150px; height: auto; display: block; margin: 0 auto; }
  .code { font: 600 14px ui-monospace, monospace; letter-spacing: 0.08em; }
  .serial { font-size: 11px; color: #6b5326; text-transform: uppercase; letter-spacing: 0.1em; }
</style>
</head>
<body>
<h1>OB Day 2026 · TEST tickets (${tickets.length})</h1>
<p>For gate-staff practice only. These stop working once the test tickets are removed before the event.</p>
<div class="grid">
${cards.join("\n")}
</div>
</body>
</html>
`;

writeFileSync("data/test-qr-sheet.html", html);
console.log(`Wrote data/test-qr-sheet.html with ${tickets.length} QR codes.`);
