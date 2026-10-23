export type ScanResult = "ADMITTED" | "ALREADY_USED" | "INVALID";

export type ScanRecord = {
  code: string;
  ticketNo: string;
  scannedBy: string;
  scannedAt: string; // ISO, UTC
};

export type AttemptRecord = {
  id: number;
  rawCode: string;
  code: string | null;
  result: ScanResult;
  scannedBy: string;
  attemptedAt: string; // ISO, UTC
};

export type ScanResponse =
  | { status: "ADMITTED" | "ALREADY_USED"; record: ScanRecord; serverNow: string }
  | { status: "INVALID"; raw: string };
