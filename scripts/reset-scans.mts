// Delete ALL scans and attempts (pre-event cleanup of test data).
// Usage: npm run reset-scans -- --yes
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const host = new URL(url).host;

if (!process.argv.includes("--yes")) {
  console.log(`This deletes every scan and attempt on ${host}.`);
  console.log("Run again with --yes to confirm:  npm run reset-scans -- --yes");
  process.exit(1);
}

const sql = neon(url);
await sql`truncate scans, attempts restart identity`;
console.log(`Cleared scans and attempts on ${host}.`);
