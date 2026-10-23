# OB Day 2026 — Ticket Check

Mobile web app for gate staff at OB Day 2026 (Bandaranayake College OBA, Gampaha).
Staff sign in, scan the QR on each ticket, and the app admits it once. Any later scan,
on any phone, shows **Already used** with the first scan's date, time and gate.

- **Screens:** sign in → scan (camera or typed code) → Admit / Already used / Not valid.
  Admins also get `/admin`: totals, a table of scanned QRs, all attempts, and CSV downloads.
- **Data:** `data/users.csv` and `data/tickets.csv` ship with the app (read-only).
  Scans live in **Neon Postgres**. `scanned.csv` is downloaded from `/admin`.
- Full plan: [.user/plans/qr-ticket-verifier-plan.md](.user/plans/qr-ticket-verifier-plan.md)

## Data files

| File | Columns | Notes |
|---|---|---|
| `data/users.csv` | `username,password,display_name,role` | Plain-text passwords. `role` is `admin` or `staff`. Keep this repo **private**. |
| `data/tickets.csv` | `qr_code,ticket_no` | Built from the QR list with `npm run import-tickets -- <file>` |

Changing either file needs a redeploy (push to GitHub).

## Set up (once)

1. **Vercel project:** import this (private) GitHub repo in Vercel.
2. **Database:** in the Vercel project, go to **Storage → Create → Neon** (Marketplace) and connect it.
   This adds `DATABASE_URL` to the project.
3. **Session secret:** add an environment variable `SESSION_SECRET` with a long random value:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. **Local env:** create `.env.local` with the database URL (use a Neon `dev` branch for local work):
   ```
   DATABASE_URL=postgres://...
   SESSION_SECRET=anything-long-for-local
   ```
5. **Create the tables** (run once per database/branch, safe to repeat):
   ```bash
   npm run db:setup
   ```
6. Deploy (push to `main`). Share the `*.vercel.app` URL and each person's username/password.

## Everyday commands

```bash
npm run dev                                  # http://localhost:3000
npm run import-tickets -- path/to/list.csv   # rebuild data/tickets.csv from the QR list
npm test                                     # unit tests (+ race test when DATABASE_URL is set)
npm run reset-scans -- --yes                 # DELETE all scans + attempts (pre-event cleanup)
```

`reset-scans` and `db:setup` use the `DATABASE_URL` in `.env.local`. To clear **production**,
point it at the production database URL temporarily, or run `truncate scans, attempts restart identity;`
in the Neon SQL editor.

## Test tickets

`data/test-tickets.csv` holds 20 practice tickets, `OBTEST01` to `OBTEST20` (serials `TEST 01` to `TEST 20`).
They're real, scannable tickets while they're in `tickets.csv`.

```bash
npm run import-tickets -- data/tickets-source.csv --with-test   # 600 real + 20 test tickets
npm run test-qr-sheet                                            # data/test-qr-sheet.html, print or show on a screen
npm run import-tickets -- data/tickets-source.csv               # real tickets only (do this before gates open)
```

## Event-day checklist

- [ ] Test tickets removed: re-import **without** `--with-test`, push, and check that `/admin` shows `/ 600`.
- [ ] Real `tickets.csv` imported and deployed. The ticket count on `/admin` matches the number printed.
- [ ] Two phones scan the same ticket at the same moment: one shows green, the other red.
- [ ] Test scans cleared. `/admin` shows `Admitted 0 / <total>`.
- [ ] Every gate phone is signed in, charged, has brightness up, and has camera permission allowed.
- [ ] `/admin` is open on one organiser device.
- [ ] Printed fallback list of ticket numbers is at the desk.

## Paper ticket or photo on a phone

Above the camera there's a **Shown as: Paper | Phone photo** switch. When a guest shows the ticket
as a photo on a phone, staff tap **Phone photo** before scanning. The switch goes back to **Paper**
after every ticket. The choice is saved with the scan.

If the paper ticket turns up after a photo of it was let in, the **Already used** screen warns
*"First entry was a photo on a phone"* and tells staff to send the guest to the OBA desk.
`/admin` counts **Entered by photo** and **Photo, then paper**, and the **Shown as** filter lists those tickets.
Both CSV exports include a `shown_as` column.

## How double scans are prevented

`scans.qr_code` is the table's primary key. `/api/scan` runs
`insert ... on conflict do nothing returning *`, so only one request per QR can insert.
Every other request reads the existing row and gets `ALREADY_USED` with the first scan's details.
A retry from the same staff member within 60 s still shows **Admit**, because the first response
was probably lost on the network.
