import { readFileSync } from "node:fs";
import path from "node:path";
import { parseCsv } from "./csv";

/** Read one of the read-only CSV files shipped in /data. */
export function readDataCsv(name: "users.csv" | "tickets.csv") {
  return parseCsv(readFileSync(path.join(process.cwd(), "data", name), "utf8"));
}
