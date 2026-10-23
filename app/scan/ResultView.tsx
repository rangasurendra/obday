import { formatDate, formatTime, timeAgo } from "@/lib/time";
import { MEDIUM_LABEL, type Medium, type ScanRecord, type ScanResponse } from "@/lib/types";

const RETRY_WINDOW_MS = 60_000;

/**
 * A retry after a lost response comes back ALREADY_USED by the same user
 * seconds later. That is still this gate's admit, not a second guest.
 */
export function isOwnRecentScan(data: ScanResponse, username: string): boolean {
  return (
    data.status === "ALREADY_USED" &&
    data.record.scannedBy === username &&
    Date.parse(data.serverNow) - Date.parse(data.record.scannedAt) < RETRY_WINDOW_MS
  );
}

export function isAdmit(data: ScanResponse, username: string): boolean {
  return data.status === "ADMITTED" || isOwnRecentScan(data, username);
}

function Field({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] tracking-[0.18em] text-muted uppercase">{label}</span>
      <span className={large ? "text-[22px] font-medium" : "text-lg break-all"}>{value}</span>
    </div>
  );
}

function Serial({ record }: { record: ScanRecord }) {
  return (
    <span className="rounded-md bg-ink px-2.5 py-1 text-lg font-semibold tracking-[0.08em] text-ground">
      {record.ticketNo || record.code}
    </span>
  );
}

function Band({ tone, icon, title, subtitle }: { tone: "admit" | "deny"; icon: "check" | "cross" | "alert"; title: string; subtitle: string }) {
  const admit = tone === "admit";
  return (
    <section
      role={admit ? "status" : "alert"}
      className={`flex flex-col items-center gap-2.5 px-6 pt-12 pb-8 text-center ${admit ? "bg-admit" : "bg-deny"}`}
    >
      <div className={`flex size-24 items-center justify-center rounded-full bg-white ${admit ? "text-admit" : "text-deny"}`}>
        <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {icon === "check" && <path d="M5 12.5l4.5 4.5L19 7.5" />}
          {icon === "cross" && <path d="M6 6l12 12M18 6L6 18" />}
          {icon === "alert" && <path d="M12 7v6M12 17h.01" />}
        </svg>
      </div>
      <h1 className={`m-0 leading-none font-semibold tracking-[0.1em] text-white ${title.length > 6 ? "text-[44px]" : "text-[52px]"}`}>{title}</h1>
      <p className="m-0 text-[17px] tracking-[0.06em] text-white/90">{subtitle}</p>
    </section>
  );
}

const primaryButton =
  "h-14 w-full rounded-xl bg-gold font-sans text-lg font-semibold tracking-[0.16em] text-[#1a0e08] uppercase active:bg-gold-light";
const secondaryButton =
  "h-[52px] w-full rounded-xl border border-rule font-sans text-base font-medium tracking-[0.14em] text-ink uppercase";

export function ResultView({
  data,
  medium,
  username,
  onNext,
  onType,
}: {
  data: ScanResponse;
  /** How this attempt's ticket was shown. */
  medium: Medium;
  username: string;
  onNext: () => void;
  onType: () => void;
}) {
  if (data.status === "INVALID") {
    return (
      <>
        <Band tone="deny" icon="alert" title="NOT VALID" subtitle="Code is not on the ticket list" />
        <div className="flex grow flex-col gap-4 px-5 pt-6 pb-7">
          <div className="flex flex-col gap-1.5 rounded-[14px] border border-deny-line bg-surface p-4">
            <span className="text-[11px] tracking-[0.18em] text-muted uppercase">What was read</span>
            <span className="text-[22px] tracking-[0.08em] break-all">{data.raw || "(empty)"}</span>
          </div>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-snug text-[#e6d8c6]">
            <li>Make sure you scanned the QR on the ticket, not another code.</li>
            <li>Try typing the code printed beside the QR, or the BCOBA number.</li>
            <li>Still failing? Send the guest to the OBA desk.</li>
          </ul>
          <div className="mt-auto flex flex-col gap-3">
            <button type="button" autoFocus onClick={onNext} className={primaryButton}>
              Scan again
            </button>
            <button type="button" onClick={onType} className={secondaryButton}>
              Type the code
            </button>
          </div>
        </div>
      </>
    );
  }

  const { record, serverNow } = data;

  if (isAdmit(data, username)) {
    const retry = data.status === "ALREADY_USED";
    return (
      <>
        <Band
          tone="admit"
          icon="check"
          title="ADMIT"
          subtitle={retry ? "Recorded by you just now" : "Valid ticket · first scan"}
        />
        <div className="flex grow flex-col gap-5 px-5 pt-6 pb-7">
          <div className="overflow-hidden rounded-[14px] border border-rule bg-surface">
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <span className="font-display text-xl font-black text-gold">OB DAY 2026</span>
              <Serial record={record} />
            </div>
            <div className="grid grid-cols-2 gap-4 border-t-2 border-dotted border-rule p-4">
              <Field label="QR code" value={record.code} />
              <Field label="Scanned by" value={record.scannedBy} />
              <Field label="Date" value={formatDate(record.scannedAt)} />
              <Field label="Time" value={formatTime(record.scannedAt)} />
              <Field label="Shown as" value={MEDIUM_LABEL[record.medium]} />
            </div>
          </div>
          <p className="m-0 text-center text-sm text-muted">Now recorded. This ticket can&apos;t be used again.</p>
          <button type="button" autoFocus onClick={onNext} className={`mt-auto ${primaryButton}`}>
            Scan next ticket
          </button>
        </div>
      </>
    );
  }

  // A photo of this ticket got in first and now the paper ticket is here
  // (or the same photo is going round again).
  const photoFirst = record.medium === "photo";

  return (
    <>
      <Band
        tone="deny"
        icon="cross"
        title="ALREADY USED"
        subtitle={photoFirst ? "Do not admit · send to OBA desk" : "Do not admit · scanned before"}
      />
      <div className="flex grow flex-col gap-4 px-5 pt-6 pb-7">
        {photoFirst && (
          <div role="alert" className="flex gap-3 rounded-[14px] border-2 border-gold bg-[#2f2310] p-4">
            <svg className="mt-0.5 shrink-0 text-gold" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="6" y="2" width="12" height="20" rx="2" />
              <path d="M11 18h2" />
            </svg>
            <div className="flex flex-col gap-1">
              <span className="text-lg font-semibold tracking-[0.06em] text-gold uppercase">First entry was a photo on a phone</span>
              <span className="text-[15px] leading-snug text-ink">
                {medium === "paper"
                  ? "This guest has the paper ticket. Send them to the OBA desk to sort it out."
                  : "The same ticket photo was used before. Send this guest to the OBA desk."}
              </span>
            </div>
          </div>
        )}
        <div className="overflow-hidden rounded-[14px] border border-deny-line bg-surface">
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <span className="text-xs tracking-[0.18em] text-deny-soft uppercase">First scanned</span>
            <Serial record={record} />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t-2 border-dotted border-deny-line p-4">
            <Field label="Date" value={formatDate(record.scannedAt)} large />
            <Field label="Time" value={formatTime(record.scannedAt)} large />
            <Field label="Scanned by" value={record.scannedBy} />
            <Field label="How long ago" value={timeAgo(record.scannedAt, serverNow)} />
            <Field label="QR code" value={record.code} />
            <Field label="First shown as" value={MEDIUM_LABEL[record.medium]} />
          </div>
        </div>
        <p className="m-0 flex items-center gap-2.5 px-1 text-sm text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          This attempt: {username} at {formatTime(serverNow)}, {MEDIUM_LABEL[medium].toLowerCase()} (logged)
        </p>
        <button type="button" autoFocus onClick={onNext} className={`mt-auto ${primaryButton}`}>
          Scan next ticket
        </button>
      </div>
    </>
  );
}

export function ErrorView({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
  return (
    <>
      <section role="alert" className="flex flex-col items-center gap-2.5 border-b border-line bg-surface px-6 pt-12 pb-8 text-center">
        <h1 className="m-0 text-[40px] leading-none font-semibold tracking-[0.1em] text-gold">NOT CHECKED</h1>
        <p className="m-0 text-[17px] tracking-[0.04em] text-ink">{message}</p>
      </section>
      <div className="flex grow flex-col gap-4 px-5 pt-6 pb-7">
        <p className="m-0 text-center text-base text-muted">Don&apos;t admit yet. The ticket was not verified.</p>
        <div className="mt-auto flex flex-col gap-3">
          <button type="button" autoFocus onClick={onRetry} className={primaryButton}>
            Try again
          </button>
          <button type="button" onClick={onBack} className={secondaryButton}>
            Back to scanner
          </button>
        </div>
      </div>
    </>
  );
}
