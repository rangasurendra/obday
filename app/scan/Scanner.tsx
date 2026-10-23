"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import type QrScanner from "qr-scanner";
import { formatShortTime } from "@/lib/time";
import type { Medium, ScanResponse } from "@/lib/types";
import { signal, unlockAudio } from "./feedback";
import { isAdmit } from "@/lib/admit";
import { ErrorView, ResultView } from "./ResultView";

type View =
  | { kind: "scanning" }
  | { kind: "checking"; raw: string }
  | { kind: "result"; data: ScanResponse; medium: Medium; retry: boolean }
  | { kind: "error"; raw: string; medium: Medium; message: string };

type LastScan = { label: string; admitted: boolean; at: string };

// The ticket is usually still in front of the camera after "Scan next";
// ignore the same value for this long so it isn't checked again by accident.
const SAME_CODE_COOLDOWN_MS = 3000;
const HEALTH_PING_MS = 120_000;

function cameraMessage(err: unknown): string {
  const text = String(err);
  if (/NotAllowed|Permission|denied/i.test(text)) {
    return "Camera access is blocked. Allow the camera for this site in your browser settings, then reload. You can still type codes below.";
  }
  if (/not ?found|NotFound|no camera/i.test(text)) {
    return "No camera found on this device. Type codes below instead.";
  }
  return "The camera couldn't start. Reload the page, or type codes below.";
}

export default function Scanner({ username }: { username: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const manualRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const lastRawRef = useRef<{ raw: string; at: number } | null>(null);

  const [view, setView] = useState<View>({ kind: "scanning" });
  const [camera, setCamera] = useState<"starting" | "on" | "error">("starting");
  const [cameraError, setCameraError] = useState("");
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [manual, setManual] = useState("");
  const [last, setLast] = useState<LastScan | null>(null);
  // Set by staff before scanning; goes back to paper after every ticket.
  const [medium, setMedium] = useState<Medium>("paper");

  const check = useCallback(
    async (raw: string, medium: Medium, retry = false) => {
      busyRef.current = true;
      setView({ kind: "checking", raw });
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: raw, medium }),
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          signal(false);
          setView({ kind: "error", raw, medium, message: `Server error (${res.status}). Try again in a moment.` });
          return;
        }
        const data = (await res.json()) as ScanResponse;
        const admitted = isAdmit(data, username, retry);
        signal(admitted);
        setView({ kind: "result", data, medium, retry });
        setLast({
          label:
            data.status === "INVALID"
              ? `${raw.slice(0, 18) || "(empty)"} · Not valid`
              : `${data.record.ticketNo || data.record.code} · ${admitted ? "Admitted" : "Already used"}${medium === "photo" ? " · photo" : ""}`,
          admitted,
          at: data.status === "INVALID" ? new Date().toISOString() : data.serverNow,
        });
      } catch {
        signal(false);
        setView({
          kind: "error",
          raw,
          medium,
          message: navigator.onLine ? "Couldn't reach the server." : "No internet connection.",
        });
      }
    },
    [router, username],
  );

  const onDecode = useEffectEvent((raw: string) => {
    if (busyRef.current) return;
    const prev = lastRawRef.current;
    if (prev && prev.raw === raw && Date.now() - prev.at < SAME_CODE_COOLDOWN_MS) return;
    lastRawRef.current = { raw, at: Date.now() };
    void check(raw, medium);
  });

  // Camera
  useEffect(() => {
    let cancelled = false;
    let scanner: QrScanner | undefined;
    (async () => {
      try {
        const { default: QrScannerLib } = await import("qr-scanner");
        if (cancelled || !videoRef.current) return;
        scanner = new QrScannerLib(videoRef.current, (result) => onDecode(result.data), {
          preferredCamera: "environment",
          maxScansPerSecond: 8,
          returnDetailedScanResult: true,
          highlightScanRegion: false,
          highlightCodeOutline: false,
          onDecodeError: () => {},
        });
        scannerRef.current = scanner;
        await scanner.start();
        if (cancelled) return;
        setCamera("on");
        setHasFlash(await scanner.hasFlash());
      } catch (err) {
        if (cancelled) return;
        setCamera("error");
        setCameraError(cameraMessage(err));
      }
    })();
    return () => {
      cancelled = true;
      scanner?.destroy();
      scannerRef.current = null;
    };
  }, []);

  // Keep the database awake, keep the screen on, unlock audio on first touch.
  useEffect(() => {
    const ping = () => void fetch("/api/health", { cache: "no-store" }).catch(() => {});
    ping();
    const timer = setInterval(ping, HEALTH_PING_MS);

    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if (document.visibilityState === "visible") wakeLock = await navigator.wakeLock?.request("screen");
      } catch {
        wakeLock = null;
      }
    };
    void requestWakeLock();
    document.addEventListener("visibilitychange", requestWakeLock);
    window.addEventListener("pointerdown", unlockAudio);

    return () => {
      clearInterval(timer);
      void wakeLock?.release().catch(() => {});
      document.removeEventListener("visibilitychange", requestWakeLock);
      window.removeEventListener("pointerdown", unlockAudio);
    };
  }, []);

  const backToScanning = () => {
    busyRef.current = false;
    if (lastRawRef.current) lastRawRef.current.at = Date.now();
    setManual("");
    setMedium("paper");
    setView({ kind: "scanning" });
  };

  const typeCode = () => {
    backToScanning();
    requestAnimationFrame(() => manualRef.current?.focus());
  };

  const toggleFlash = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    await scanner.toggleFlash();
    setFlashOn(scanner.isFlashOn());
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = manual.trim();
    if (raw) {
      lastRawRef.current = { raw, at: Date.now() };
      void check(raw, medium);
    }
  };

  const overlay = view.kind === "result" || view.kind === "error";

  return (
    <>
      <main className="flex grow flex-col gap-4 p-5" aria-hidden={overlay}>
        <div role="group" aria-label="How is the ticket shown?" className="mx-auto flex w-full max-w-[420px] items-center gap-2">
          <span className="text-[11px] tracking-[0.16em] text-muted uppercase">Shown as</span>
          <div className="grid grow grid-cols-2 gap-1 rounded-xl border border-rule bg-surface p-1">
            {(["paper", "photo"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={medium === m}
                onClick={() => setMedium(m)}
                className={`flex h-11 items-center justify-center gap-2 rounded-lg text-[15px] font-medium tracking-[0.08em] uppercase ${
                  medium === m ? (m === "photo" ? "bg-gold text-[#1a0e08]" : "bg-ink text-ground") : "text-muted"
                }`}
              >
                {m === "paper" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6z" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="6" y="2" width="12" height="20" rx="2" />
                    <path d="M11 18h2" />
                  </svg>
                )}
                {m === "paper" ? "Paper" : "Phone photo"}
              </button>
            ))}
          </div>
        </div>
        <div
          className={`relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-2xl bg-black ${
            medium === "photo" ? "ring-4 ring-gold" : ""
          }`}
        >
          {medium === "photo" && (
            <div className="absolute top-3 left-3 z-10 rounded-md bg-gold px-2.5 py-1 text-xs font-semibold tracking-[0.14em] text-[#1a0e08] uppercase">
              Photo on phone
            </div>
          )}
          <video ref={videoRef} className="absolute inset-0 size-full object-cover" muted playsInline />
          {camera !== "on" && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1e1512] p-6 text-center text-sm tracking-wide text-muted">
              {camera === "starting" ? "Starting camera…" : cameraError}
            </div>
          )}
          {camera === "on" && (
            <div className="pointer-events-none absolute inset-[16%]" aria-hidden="true">
              <div className="absolute top-0 left-0 size-10 rounded-tl-xl border-t-4 border-l-4 border-gold" />
              <div className="absolute top-0 right-0 size-10 rounded-tr-xl border-t-4 border-r-4 border-gold" />
              <div className="absolute bottom-0 left-0 size-10 rounded-bl-xl border-b-4 border-l-4 border-gold" />
              <div className="absolute right-0 bottom-0 size-10 rounded-br-xl border-r-4 border-b-4 border-gold" />
              <div className="scanline absolute top-1/2 right-3 left-3 h-0.5 bg-gold shadow-[0_0_12px_var(--color-gold)]" />
            </div>
          )}
          {view.kind === "checking" && (
            <div className="absolute inset-0 flex items-center justify-center bg-ground/70 text-lg tracking-[0.14em] uppercase" role="status">
              Checking…
            </div>
          )}
          {hasFlash && (
            <button
              type="button"
              onClick={toggleFlash}
              aria-label={flashOn ? "Turn torch off" : "Turn torch on"}
              aria-pressed={flashOn}
              className={`absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full ${flashOn ? "bg-gold text-ground" : "bg-ground/80 text-ink"}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 2h8l-2 6h-4z" />
                <path d="M10 8v12a2 2 0 0 0 4 0V8" />
              </svg>
            </button>
          )}
        </div>
        <p className="m-0 text-center text-base tracking-wide">Point the camera at the QR code on the ticket</p>

        <div className="flex items-center gap-2.5 text-xs tracking-[0.2em] text-muted uppercase">
          <div className="h-px grow bg-line" />
          <span>or type the code</span>
          <div className="h-px grow bg-line" />
        </div>
        <form onSubmit={submitManual} className="flex gap-2.5">
          <label htmlFor="code" className="sr-only">
            Ticket code or BCOBA number
          </label>
          <input
            ref={manualRef}
            id="code"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. 9BETJ8BB"
            className="h-12 min-w-0 grow rounded-[10px] border border-rule bg-surface px-3.5 text-lg tracking-[0.12em] outline-none placeholder:text-hint focus:border-gold"
          />
          <button
            type="submit"
            disabled={!manual.trim() || view.kind === "checking"}
            className="h-12 rounded-[10px] bg-gold px-5 text-base font-semibold tracking-[0.14em] text-[#1a0e08] uppercase disabled:opacity-50"
          >
            Check
          </button>
        </form>
      </main>

      <footer className="flex items-center gap-2.5 border-t border-dashed border-rule px-5 pt-3.5 pb-5 text-sm" aria-live="polite">
        <span className="text-[11px] tracking-[0.16em] text-muted uppercase">Last</span>
        {last ? (
          <>
            <span className={`size-2 rounded-full ${last.admitted ? "bg-ok" : "bg-deny-soft"}`} aria-hidden="true" />
            <span className="grow truncate tracking-wide">{last.label}</span>
            <span className="text-muted">{formatShortTime(last.at)}</span>
          </>
        ) : (
          <span className="grow text-muted">No scans yet</span>
        )}
      </footer>

      {overlay && (
        <div className="fixed inset-0 z-20 overflow-y-auto bg-ground">
          <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
            {view.kind === "result" ? (
              <ResultView data={view.data} medium={view.medium} retry={view.retry} username={username} onNext={backToScanning} onType={typeCode} />
            ) : (
              <ErrorView message={view.message} onRetry={() => void check(view.raw, view.medium, true)} onBack={backToScanning} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
