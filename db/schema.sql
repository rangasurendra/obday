-- First successful scan per QR. The primary key is the double-scan guard.
create table if not exists scans (
  qr_code     text primary key,
  ticket_no   text not null,
  scanned_by  text not null,
  scanned_at  timestamptz not null default now()
);

-- Every scan attempt, including repeats and unknown codes.
create table if not exists attempts (
  id            bigint generated always as identity primary key,
  qr_code_raw   text not null,
  qr_code       text,
  result        text not null check (result in ('ADMITTED', 'ALREADY_USED', 'INVALID')),
  scanned_by    text not null,
  attempted_at  timestamptz not null default now()
);

create index if not exists scans_at_idx on scans (scanned_at desc);
create index if not exists attempts_at_idx on attempts (attempted_at desc);
create index if not exists attempts_code_idx on attempts (qr_code);
