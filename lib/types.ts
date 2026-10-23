export type ScanResult = "ADMITTED" | "ALREADY_USED" | "INVALID";

/** How the guest showed the ticket: the printed ticket, or a photo of it on a phone. */
export type Medium = "paper" | "photo";

export const MEDIUM_LABEL: Record<Medium, string> = { paper: "Paper ticket", photo: "Photo on phone" };

export type ScanRecord = {
  code: string;
  ticketNo: string;
  scannedBy: string;
  scannedAt: string; // ISO, UTC
  medium: Medium;
};

export type AttemptRecord = {
  id: number;
  rawCode: string;
  code: string | null;
  result: ScanResult;
  scannedBy: string;
  attemptedAt: string; // ISO, UTC
  medium: Medium;
};

export type ScanResponse =
  | { status: "ADMITTED" | "ALREADY_USED"; record: ScanRecord; serverNow: string }
  | { status: "INVALID"; raw: string };
