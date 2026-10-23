"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

const inputClass =
  "h-12 rounded-[10px] border border-rule bg-ground px-3.5 text-[17px] outline-none placeholder:text-hint focus:border-gold";
const labelClass = "text-xs tracking-[0.14em] text-muted uppercase";

export default function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={action} className="flex flex-col gap-[18px] rounded-[14px] border border-rule bg-surface px-5 py-6">
      <div className="flex items-center gap-2.5">
        <div className="h-px grow bg-rule" />
        <h2 className="m-0 text-sm font-medium tracking-[0.22em] text-gold uppercase">Gate staff sign in</h2>
        <div className="h-px grow bg-rule" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className={labelClass}>
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={state.username}
          placeholder="e.g. gate1"
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </div>
      {state.error && (
        <div role="alert" className="rounded-lg border border-deny-line bg-deny-ground px-3 py-2.5 text-sm text-deny-soft">
          {state.error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-[52px] rounded-[10px] bg-gold text-lg font-semibold tracking-[0.16em] text-[#1a0e08] uppercase disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
