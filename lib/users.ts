import "server-only";
import { timingSafeEqual } from "node:crypto";
import { readDataCsv } from "./data-file";

export type Role = "admin" | "staff";
export type User = { username: string; displayName: string; role: Role };

type UserRow = User & { password: string };

let users: Map<string, UserRow> | undefined;

function getUsers(): Map<string, UserRow> {
  if (!users) {
    users = new Map();
    for (const row of readDataCsv("users.csv")) {
      const username = (row.username ?? "").toLowerCase();
      if (!username || !row.password) continue;
      users.set(username, {
        username,
        password: row.password,
        displayName: row.display_name || username,
        role: row.role === "admin" ? "admin" : "staff",
      });
    }
  }
  return users;
}

function samePassword(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Usernames match case-insensitively; passwords exactly. */
export function checkCredentials(username: string, password: string): User | null {
  const row = getUsers().get(username.trim().toLowerCase());
  if (!row || !samePassword(row.password, password)) return null;
  return { username: row.username, displayName: row.displayName, role: row.role };
}

export function listUsernames(): string[] {
  return [...getUsers().keys()].sort();
}
