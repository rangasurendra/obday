import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-6 pt-14 pb-8">
      <div className="flex flex-col items-center gap-3.5 text-center">
        <div className="text-[11px] leading-normal tracking-[0.18em] text-muted uppercase">
          Organized by Old Boys&apos; Association
          <br />
          Bandaranayake College, Gampaha
        </div>
        <h1 className="m-0 font-display text-[clamp(40px,13vw,54px)] leading-none font-black whitespace-nowrap tracking-[0.01em] text-gold">OB DAY 2026</h1>
        <div className="font-display text-base font-semibold text-gold-light italic">Once a Nayakenz, Always a Nayakenz</div>
        <div className="text-xs tracking-[0.5em] text-gold" aria-hidden="true">
          ★ ★ ★
        </div>
      </div>

      <LoginForm />

      <div className="mt-auto flex justify-center gap-2.5 text-[13px] tracking-[0.08em] text-muted uppercase">
        <span>Sat 24 Oct</span>
        <span aria-hidden="true" className="text-rule">|</span>
        <span>6.00 PM</span>
        <span aria-hidden="true" className="text-rule">|</span>
        <span>Royal Chance Palace</span>
      </div>
    </div>
  );
}
