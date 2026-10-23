import type { ScanResponse } from "./types";

const RETRY_WINDOW_MS = 60_000;

/**
 * Only for "Try again" after a connection error: the first request may have
 * been recorded even though its response was lost, so it comes back
 * ALREADY_USED by this user seconds ago. That is still this guest's admit.
 * A fresh scan of the same ticket is never treated this way.
 */
export function isOwnRetry(data: ScanResponse, username: string, retry: boolean): boolean {
  return (
    retry &&
    data.status === "ALREADY_USED" &&
    data.record.scannedBy === username &&
    Date.parse(data.serverNow) - Date.parse(data.record.scannedAt) < RETRY_WINDOW_MS
  );
}

export function isAdmit(data: ScanResponse, username: string, retry: boolean): boolean {
  return data.status === "ADMITTED" || isOwnRetry(data, username, retry);
}
