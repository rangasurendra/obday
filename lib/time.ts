// All display times are Sri Lanka time, whatever timezone the server or phone is in.
export const EVENT_TZ = "Asia/Colombo";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: EVENT_TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TZ,
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});
const shortTimeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TZ,
  hour: "numeric",
  minute: "2-digit",
});
const isoDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TZ }); // YYYY-MM-DD
const time24Fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: EVENT_TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** "24 Oct 2026" */
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
/** "6:42:15 PM" */
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
/** "6:42 PM" */
export const formatShortTime = (iso: string) => shortTimeFmt.format(new Date(iso));
/** "2026-10-24" for CSV */
export const csvDate = (iso: string) => isoDateFmt.format(new Date(iso));
/** "18:42:15" for CSV */
export const csvTime = (iso: string) => time24Fmt.format(new Date(iso));

/** "just now", "21 min ago", "1 h 5 min ago", measured against the server clock. */
export function timeAgo(iso: string, nowIso: string): string {
  const minutes = Math.floor((Date.parse(nowIso) - Date.parse(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min ago` : `${h} h ago`;
}
