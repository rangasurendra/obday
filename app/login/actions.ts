"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";
import { checkCredentials } from "@/lib/users";

export type SignInState = { error?: string; username?: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = checkCredentials(username, password);

  if (!user) {
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 800));
    return { error: "Wrong username or password.", username };
  }

  const token = await createSessionToken({ username: user.username, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect("/scan");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
