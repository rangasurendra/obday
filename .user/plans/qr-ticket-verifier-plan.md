# OB Day 2026 — QR Ticket Verifier: Implementation Plan

Status: **Ready to build. All questions answered ([§11](#11-open-questions)); waiting only on the QR code list file.**
Event: **Saturday 24 October 2026, 6.00 PM**, Royal Chance Palace Banquets. That's **tomorrow**, so we build, deploy and test today (see the timeline in §9).
Date: 2026-10-23
Design canvas: https://claude.ai/artifact/HEbuzs8b4TqziN91kW8U6z (5 phone screens, private to you)

---

## 1. Goal

A small mobile web app for gate staff at OB Day 2026 (Bandaranayake College OBA, Gampaha).

1. Staff sign in with a username/password from `users.csv`.
2. Staff scan the QR on a guest's ticket with the phone camera.
3. The app checks the code against `tickets.csv` and records the **first** scan
   (who scanned, QR identifier, date, time).
4. Any later scan of the same QR — even one at the same moment on another
   phone — is refused, and the app shows the earlier scan's date, time and staff member.

It is used for one event, so we keep it as simple as we can. It still has to be
correct when two gates scan the same ticket at the same moment.

### Out of scope
- Selling tickets, making QR codes, payments.
- Checking the buffet dinner coupon stub. The entrance scan is enough.
- Guest names: tickets carry serial numbers only.
- Admin UI for editing users or tickets (edit the CSVs and redeploy).
- Offline scanning (see risk R2).
- Password hashing (you said plaintext is fine; see Q5 about repo visibility).

---

## 2. The big constraint: Vercel can't write CSV files

On Vercel, the app runs as serverless functions. Their filesystem is **read-only**,
except `/tmp`. `/tmp` is temporary and **separate for each instance**: two phones
can hit two instances, and each sees a different `/tmp`. So a `scanned.csv`
written at runtime on Vercel would lose scans **and** let duplicates through.

**Decision (2026-10-23): Neon Postgres, added from the Vercel Marketplace.**

| Data | Where it lives | Why |
|---|---|---|
| `users.csv` | Committed in the repo (`data/users.csv`), read-only | Changes only on redeploy |
| `tickets.csv` | Committed in the repo (`data/tickets.csv`), read-only | Same |
| Scan records ("scanned.csv") | **Neon Postgres** table `scans`, with `qr_code` as **PRIMARY KEY** | The database rejects a second row for the same QR. Two scans at the same moment can't both win |
| All attempts | Neon table `attempts`, append-only | Records each scan attempt: duplicates and invalid codes too |
| `scanned.csv` file | Made **on demand** at `/api/export/scanned.csv` | You still get the CSV you asked for, any time |
| Live view | `/admin` table (§5.1) + Neon's SQL editor | See who came in, when, and through which gate |

There is one storage implementation only. Local development uses a Neon **`dev`
branch**: a free, separate copy of the database, so `npm run dev` never touches
event data. The Vercel–Neon integration supplies `DATABASE_URL` for production
and can create a branch for each preview deploy.

> Alternatives that were considered and rejected: Upstash Redis (works, but has a basic data viewer and no SQL), Google Sheet (1–3 s per scan, needs locking), CSV in Vercel Blob (two scans at once overwrite each other, so a double scan can get through), laptop at the venue (single point of failure, not Vercel).

---

## 3. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js (latest stable, App Router), TypeScript | One project with UI and API routes |
| Styling | Tailwind CSS + CSS variables for the ticket palette | Tokens in §8 |
| Fonts | `next/font/google`: **Playfair Display** (display), **Oswald** (labels/body) | Close to the ticket's look; self-hosted at build time |
| QR scanning | `qr-scanner` (nimiq) | Small; uses the native `BarcodeDetector` when available, otherwise a web worker; supports torch; handles camera selection |
| Session | Signed JWT cookie (`jose`, HS256, secret in `SESSION_SECRET`) | Works in middleware; no session database |
| Database | Neon Postgres via `@neondatabase/serverless` (HTTP driver, plain SQL, no ORM) | HTTP queries suit serverless functions. There are two tables, so an ORM isn't worth it |
| CSV | `papaparse` (parse) + a small hand-written serializer | Handles quotes/commas properly |
| Tests | Vitest | Store concurrency + CSV + code normalisation |
| Hosting | Vercel, default `*.vercel.app` domain | HTTPS out of the box (camera access requires it) |

---

## 4. Data files

### `data/users.csv` (committed, read-only)
```csv
username,password,display_name,role
admin,<generated>,OBA Admin,admin
gate1,<generated>,Gate 1,staff
gate2,<generated>,Gate 2,staff
...
```
- 5–10 rows. Passwords in plaintext, as you asked. I'll generate random 8-character ones at build time. They go only in this file, not in chat.
- `role`: `admin` can download the CSV export and see the totals; `staff` can only scan.
- Usernames are matched case-insensitively. Passwords must match exactly.

### `data/tickets.csv` (committed, read-only)
```csv
qr_code,ticket_no
9BETJ8BB,BCOBA 0181
...
```
- `qr_code`: the exact text in the QR, normalized (trimmed, uppercase).
- `ticket_no`: the printed serial (`BCOBA 0181`). It's shown on screen so staff can match it to the paper ticket. There are no guest names.
- Made from the QR code list you upload (CSV or TXT) with `scripts/import-tickets.ts`. The script
  works out the columns, trims and uppercases the codes, and **fails loudly on duplicate or empty codes**.
  It prints the total count so we can check it against the number of tickets printed.
- Loaded once per server instance into a `Map<normalizedCode, Ticket>`.

### Database schema (`db/schema.sql`, run once with `npm run db:setup`)
```sql
create table if not exists scans (
  qr_code     text primary key,               -- normalized QR value; uniqueness = the double-scan guard
  ticket_no   text not null,                  -- e.g. 'BCOBA 0181'
  scanned_by  text not null,                  -- username from users.csv
  scanned_at  timestamptz not null default now()  -- database clock, the same for every phone
);

create table if not exists attempts (
  id            bigint generated always as identity primary key,
  qr_code_raw   text not null,                -- what the camera/keyboard sent
  qr_code       text,                         -- normalized, null if unparseable
  result        text not null check (result in ('ADMITTED','ALREADY_USED','INVALID')),
  scanned_by    text not null,
  attempted_at  timestamptz not null default now()
);
create index if not exists attempts_at_idx on attempts (attempted_at desc);
create index if not exists scans_at_idx    on scans (scanned_at desc);
```
- `scanned_at` comes from the database's `now()`, not from each phone or server instance. All times use one clock.
- Date and time are shown in **Asia/Colombo** time (the database stores UTC). Formatting always sets the timezone explicitly.

### `scanned.csv` export columns (`/api/export/scanned.csv`)
```csv
qr_code,ticket_no,scanned_by,scanned_date,scanned_time,scanned_at_iso
9BETJ8BB,BCOBA 0181,gate1,2026-10-24,18:42:15,2026-10-24T13:12:15.000Z
```
Only the first, successful scan is stored per QR. That record is what the
"already used" screen shows.

### `attempts.csv` export (Q7)
`qr_code_raw, qr_code, result, scanned_by, date, time`, for every attempt.
Useful if there's an argument at the gate ("I only came in once!").

---

## 5. Screens (see design canvas)

| # | Screen | Route | Contents |
|---|---|---|---|
| 1 | Sign in | `/login` | Organizer line, "OB DAY 2026" in gold, tagline, ★★★, username/password, gold **Sign in** button, inline error (no crest) |
| 2 | Scan | `/scan` | Header (event mark, signed-in user chip, sign-out), camera viewfinder with gold corner brackets + torch button, "type the code" fallback, "Last scan" strip |
| 3a | Admit | `/scan` (result state) | Full-width **green** band: check, "ADMIT", "Valid ticket · first scan"; ticket-stub card (BCOBA no., QR code, scanned by, date, time); **Scan next ticket** |
| 3b | Already used | `/scan` (result state) | Full-width **red** band: ✕, "ALREADY USED", "Do not admit"; card with the **first** scan's date/time (large), who scanned it, "21 min ago"; line logging this attempt |
| 3c | Not valid | `/scan` (result state) | Red band: "NOT VALID"; what the camera read; short checklist; **Scan again** / **Type the code** |
| 4 | Admin dashboard | `/admin` | Totals, **table of scanned QRs** with search/filter, attempts tab, CSV downloads. See §5.1 |

The result screens are **full-screen, colour-first** (green = admit, red = stop),
so staff can read them at arm's length in a dim hall. They also use haptics:
`navigator.vibrate(80)` for admit and `[200,100,200]` for deny (Android only;
iOS ignores it). There's also a short WebAudio beep: one high tone for admit,
two low tones for deny.

Scan results replace the camera view. The app does not go to a new page, so the
camera stays warm. Tapping **Scan next** resumes decoding.

### 5.1 Admin page: scanned QR table (`/admin`, role `admin` only)

Works on a phone and a laptop. On a phone the table scrolls sideways inside its own box, with the ticket number column fixed on the left.

**Top: summary tiles**
- **Admitted**: rows in `scans`, shown with total tickets in `tickets.csv` (e.g. `142 / 400`), plus a thin progress bar.
- **Not yet arrived**: tickets − admitted.
- **Repeat attempts**: `attempts` rows with result `ALREADY_USED`.
- **Invalid codes**: `attempts` rows with result `INVALID`.

**Tabs: `Scanned` (default) | `All attempts`**

*Scanned* table: one row per admitted ticket, newest first:

| # | Ticket no. | QR code | Scanned by | Date | Time | Repeat tries |
|---|---|---|---|---|---|---|
| 142 | BCOBA 0181 | 9BETJ8BB | gate1 | 24 Oct 2026 | 6:42:15 PM | 1 |

- **Repeat tries** counts that QR's `ALREADY_USED` attempts. If it's over 0, the number shows in red, so a shared or photographed ticket stands out.
- Tapping a ticket number opens the All attempts tab filtered to that QR, showing its full history: who tried, when, and the result. (This was planned as a drawer and built as a filtered link instead, which is simpler.)

*All attempts* table: every scan event, with a coloured result badge (green ADMITTED, red ALREADY USED / INVALID) and columns time, raw code, ticket no., result, scanned by.

**Controls (above the table)**
- Search box: matches ticket no., QR code or staff username (`ilike`, on the server).
- "Scanned by" dropdown, filled from `users.csv`.
- **Refresh** button. The page also refreshes by itself every 15 s while it's open, with a "Updated 6:58 PM" note.
- **Download scanned.csv** / **Download attempts.csv**. These use the current filters.

**How it's built**
- `app/admin/page.tsx` is a server component. It reads `searchParams` (`tab`, `q`, `by`) and runs the SQL directly. There's no separate JSON API.
- `AutoRefresh.tsx` (client) calls `router.refresh()` every 15 s and pauses while the tab is hidden.
- Queries:
  ```sql
  -- Scanned tab
  select s.*, coalesce(a.repeats, 0) as repeats
  from scans s
  left join (select qr_code, count(*) as repeats from attempts
             where result = 'ALREADY_USED' group by qr_code) a using (qr_code)
  where ($1 = '' or s.ticket_no ilike '%'||$1||'%' or s.qr_code ilike '%'||$1||'%' or s.scanned_by ilike '%'||$1||'%')
    and ($2 = '' or s.scanned_by = $2)
  order by s.scanned_at desc
  limit 500;
  ```
  A few hundred tickets fit on one page, so there's no pagination. The 500-row limit is only a safety cap.
- The Neon console's SQL editor is also there for anything this table doesn't cover, e.g. `select scanned_by, count(*) from scans group by 1;`.

---

## 6. Core logic

### 6.1 Database access (`lib/db.ts`)
```ts
import { neon } from '@neondatabase/serverless';
export const sql = neon(process.env.DATABASE_URL!);

export async function claim(code: string, ticketNo: string, user: string) {
  // 1) Try to insert. The primary key guarantees only one insert per QR succeeds.
  const won = await sql`
    insert into scans (qr_code, ticket_no, scanned_by)
    values (${code}, ${ticketNo}, ${user})
    on conflict (qr_code) do nothing
    returning *`;
  if (won.length) return { firstScan: true, record: won[0] };
  // 2) Lost: read the winner's row in a SEPARATE statement (see note).
  const [existing] = await sql`select * from scans where qr_code = ${code}`;
  return { firstScan: false, record: existing };
}
```
- **Why two statements:** a single `INSERT … ON CONFLICT … UNION SELECT` statement
  works from a snapshot taken when it starts. In a near-simultaneous race it may not
  see the row the other phone just committed, and would return nothing. A second
  statement takes a fresh snapshot, so it always sees the winner.
- `logAttempt()` = one `insert into attempts`. A failure here is caught and logged,
  so it never changes the gate result.
- Also: `listScans(filters)`, `listAttempts(filters)`, `stats()` (one query returning
  admitted / repeats / invalid counts), used by `/admin` and the exports.

**Neon cold starts:** on the free plan, the database goes to sleep after about 5 minutes
idle, and the first query takes roughly 0.5–1 s to wake it. Mitigation: the scan page sends
`GET /api/health` (`select 1`) when it opens and every 2 minutes while it's open.
Gate phones keep the database awake during the event, so scan replies stay fast.

### 6.2 `POST /api/scan`
```
body: { code: string }        // raw text from QR or manual entry
auth: session cookie required (401 otherwise)

1. normalize(code): trim; if it looks like a URL, take the last path segment or a
   ?code= param; uppercase; remove spaces.
2. ticket = tickets.get(normalized) → if missing: logAttempt(INVALID) → 200 { status: "INVALID", raw }
3. { firstScan, record } = claim(normalized, ticket.ticketNo, session.user)
4. logAttempt(firstScan ? ADMITTED : ALREADY_USED)   // logAttempt(INVALID) happens in step 2
5. 200 { status: firstScan ? "ADMITTED" : "ALREADY_USED", ticket, record, serverNow }
```
- `serverNow` comes from the database (`select now()` in the same request), so the
  client works out "21 min ago" from the same clock as `scanned_at`, not the phone's.
- **Lost-response retry**: say a phone's first request succeeds but the response
  never arrives, and the phone retries. The retry gets `ALREADY_USED` with
  `scannedBy === me` and an age under 60 s. The UI shows this as **Admit
  (just recorded by you)** instead of a scary red screen. Retries are safe to repeat.

### 6.3 Client scan loop (`Scanner.tsx`)
States: `starting → scanning → checking → result(ADMITTED|ALREADY_USED|INVALID|ERROR)`.
- When a code is decoded: **pause the scanner right away**. The camera decodes about 10×/s,
  so the same QR would otherwise send a flood of requests.
- The client also ignores the same raw value for 3 s after resuming. This stops the
  ticket that's still in front of the camera from being read again.
- Network error or 5xx → **ERROR** state ("No connection — try again"). We
  **never** show Admit unless the server confirmed it.
- Camera permission denied or no camera → show the manual-entry form with a short
  hint on how to allow the camera in Safari/Chrome.
- Prefer the rear camera (`preferredCamera: 'environment'`); show the torch button
  only when the device supports it.

### 6.4 Auth
- `/login` server action reads `users.csv`, compares, and sets an `obday_session` cookie
  (JWT `{ sub: username, role }`, `HttpOnly; Secure; SameSite=Lax`, 18 h expiry).
- Middleware (`middleware.ts`, called `proxy.ts` on Next 16+) redirects
  anything except `/login` and static assets to `/login` when there's no valid cookie.
  `/admin` and `/api/export/*` also require `role === "admin"`.
- Sign out clears the cookie.
- A light login throttle: about 1 s delay on failure. Nothing more is needed.

### 6.5 Making sure CSVs reach the serverless bundle
CSV files read with `fs` at runtime are included through
`outputFileTracingIncludes: { '/**': ['./data/*.csv'] }` in `next.config.ts`.
We'll check this on the first preview deploy (step 8 of §9).

---

## 7. Project structure
```
app/
  layout.tsx            fonts, <body> background, viewport meta (no zoom on inputs)
  globals.css           design tokens (§8), Tailwind
  page.tsx              redirect → /scan
  login/page.tsx        sign-in form (screen 1)
  login/actions.ts      signIn / signOut server actions
  scan/page.tsx         server: read session, render <Scanner user=…>
  scan/Scanner.tsx      client: camera, state machine, result views (2, 3a–c)
  scan/ResultCard.tsx   ticket-stub card shared by result states
  admin/page.tsx        server: stats tiles + Scanned/Attempts tables (§5.1)
  admin/AutoRefresh.tsx client: router.refresh() every 15 s
  admin/Filters.tsx     client: search box, scanned-by select, tabs (update searchParams)
  api/scan/route.ts     POST verify + claim
  api/health/route.ts   GET select 1 (keeps Neon awake)
  api/export/[file]/route.ts   GET scanned.csv | attempts.csv (admin, honours filters)
lib/
  csv.ts                parse/serialize
  users.ts              load users.csv → Map
  tickets.ts            load tickets.csv → Map, normalize()
  session.ts            sign/verify JWT, getSession()
  time.ts               Asia/Colombo formatting, "x min ago"
  db.ts                 neon client, claim(), logAttempt(), listScans(), listAttempts(), stats()
proxy.ts              (Next 16 name for middleware)
db/
  schema.sql            tables + indexes (§4)
data/
  users.csv
  tickets.csv
scripts/
  db-setup.mts          runs db/schema.sql against DATABASE_URL
  reset-scans.mts       truncate scans, attempts (pre-event cleanup; asks for confirmation)
  import-tickets.mts    optional: turn the printer's list into tickets.csv
tests/
  db.test.ts            50 parallel claims of one code → exactly 1 firstScan (Neon dev branch)
  tickets.test.ts       normalize() cases (spaces, lowercase, URL payloads)
  csv.test.ts
```

---

## 8. Visual design tokens (from the ticket)

| Token | Value | Use |
|---|---|---|
| `--ground` | `#140A08` | Page background (ticket's near-black brown) |
| `--surface` | `#241311` | Cards, inputs |
| `--rule` | `#6B5326` | Borders, dotted perforation lines |
| `--gold` | `#E2B95A` | Wordmark, primary buttons, viewfinder brackets |
| `--gold-light` | `#F3D88E` | Tagline, hover |
| `--ink` | `#F5EBDD` | Body text (ivory) |
| `--muted` | `#BFAE98` | Labels |
| `--admit` | `#1F7A4A` | Admit band (white text passes 4.5:1) |
| `--deny` | `#B3261E` | Already-used / invalid band |

Type: Playfair Display 900 for "OB DAY 2026". Oswald for everything else,
with uppercase tracked labels like the ticket's info blocks. Motifs taken
from the ticket: ★★★ divider, dotted perforation rule, BCOBA serial "pill" in
ivory with dark text. Touch targets ≥ 44 px, primary buttons 52–56 px.
---

## 9. Build steps

1. `create-next-app` (TS, App Router, Tailwind, ESLint), add deps: `qr-scanner jose papaparse @neondatabase/serverless`, dev: `vitest tsx`.
2. Create the Vercel project, then in Marketplace → **Neon** → connect it (this injects `DATABASE_URL`). In the Neon console, create a `dev` branch and put its URL in `.env.local`. Run `npm run db:setup` on both branches.
3. Tokens, fonts, layout; build the **Sign in** screen + `session.ts` + middleware.
4. `users.ts`, `tickets.ts`, `csv.ts` with tests; seed `data/users.csv` (generated passwords) and a sample `data/tickets.csv` (real list in step 10).
5. `lib/db.ts` (`claim`, `logAttempt`, list/stats queries) + the concurrency test against the dev branch.
6. `POST /api/scan` with the full logic in §6.2, plus `/api/health`.
7. `Scanner.tsx`: camera, state machine, the three result views, manual entry, haptics/beep, error state, health-ping keep-alive.
8. `/admin`: stats tiles, Scanned/Attempts tables, search + filter, auto-refresh, attempt drawer, CSV export routes, `reset-scans` script.
9. Push to a **private** GitHub repo → connect it to the Vercel project → set `SESSION_SECRET` → deploy. Check that the CSVs load on the deployed function and that a scan shows up in `/admin`.
10. Load the real `tickets.csv`, redeploy, and test on **iPhone Safari** and **Android Chrome** using real printed tickets.
11. Run `reset-scans` against **production** to clear test scans, then hand the `*.vercel.app` URL and the user list to the gate team.

**Timeline (event is tomorrow, 24 Oct, 6.00 PM):**

| When | What |
|---|---|
| **Today (23 Oct)** | Steps 1–9: build, deploy to Vercel, test with the sample ticket |
| Today, once the list arrives | Step 10: import the QR list, redeploy, test with real tickets on iPhone and Android |
| **24 Oct, by ~3 PM** | Final run-through: two phones scan the same ticket at once, then the `/admin` check |
| **24 Oct, ~5 PM** | Step 11: `reset-scans`, hand the URL and logins to the gate team, gates open at 6.00 PM |

---

## 10. Testing & event-day checklist

**Automated**
- 50 parallel `claim()` calls for the same code → exactly one `firstScan: true`, and all 50 return the same stored record (run against the Neon `dev` branch).
- Admin queries: search and the "scanned by" filter return the right rows. Repeat tries count matches the `ALREADY_USED` attempts.
- `normalize()` handles: lowercase, surrounding spaces, `BCOBA 0181`-style input, a URL payload.
- Unknown code → INVALID. Session missing → 401.

**Manual (on phones, on the deployed URL)**
- Two phones scan the same ticket at the same moment → one green, one red, and the red one shows the green one's time.
- Airplane mode during a scan → ERROR screen, never green.
- Camera permission denied → manual entry still works.
- Torch on and off. Dim-room readability. Check the time shown is Sri Lanka time.
- Export the CSV and open it in Excel; check the columns and timezone.
- `/admin` on a phone: table scrolls sideways, auto-refresh picks up a new scan within 15 s, and a `staff` user gets redirected away from it.

**Event day**
- Clear the test scans. Check `/admin` shows Admitted `0 / <total>`.
- Open `/admin` on one organiser phone or laptop. This also keeps Neon awake.
- Every gate phone: signed in, brightness up, charged, camera permission allowed.
- Paper fallback: a printed list of ticket numbers in case the venue loses signal.

---

## 11. Open questions

1. ~~**Scan storage**~~ **Decided:** Neon Postgres via the Vercel Marketplace, with an admin table view and an on-demand `scanned.csv` (§2, §5.1).
2. **QR contents:** The QR code list is coming as a CSV/TXT upload. It goes through `import-tickets.ts`. Still to confirm from the file: does each code come with its `BCOBA` serial?
3. **Event date:** **Saturday 24 October 2026**, 6.00 PM. The printed "03 Oct" date isn't used anywhere in the app.
4. **Dinner coupon:** Not checked. The entrance scan is enough.
5. **Repo visibility:** A private GitHub repo with `users.csv` in plaintext is fine.
6. **Export access:** Admin only, for `/admin` and both CSV downloads.
7. ~~**Attempt log**~~ **Included:** the admin page needs it for repeat-try counts and the All attempts tab. Tell me if you'd rather not keep it.
8. **Venue connectivity:** Mobile data is reliable, so there's no offline mode. Typed codes and a paper list stay as the fallback.
9. **Holder names:** Serial numbers only.
10. **Crest:** Not needed. Removed from the sign-in screen.

---

## 12. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Two gates scan the same ticket at once | `qr_code` primary key + `on conflict do nothing`; tested with 50 parallel claims |
| R1b | Neon wakes slowly after sitting idle | Health ping from scan and admin pages; first scan of the night can take about 1 s at worst |
| R2 | Poor signal at the venue | Small requests (<1 KB); clear ERROR state; manual entry; paper fallback list |
| R3 | iOS camera quirks | HTTPS (Vercel), `playsinline`, start camera on a user tap; tested on a real iPhone |
| R4 | Test scans left in the data on event day | `reset-scans` script in the event-day checklist |
| R5 | Plaintext passwords leak through the repo | Private repo (Q5); passwords only usable for this one-time app |
| R6 | Wrong times (server is UTC) | All display formatting pinned to `Asia/Colombo` |
| R7 | Copied or photographed QR | It works once only; the second person gets "Already used" with time and gate |
