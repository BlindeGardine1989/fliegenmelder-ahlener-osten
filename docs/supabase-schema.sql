-- Supabase SQL Editor öffnen und diesen Code ausführen.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  address text not null check (char_length(address) between 3 and 140),
  severity int not null check (severity between 1 and 5),
  since text,
  time_of_day text,
  note text default '' check (char_length(note) <= 800),
  contact_private text default '' check (char_length(contact_private) <= 160),
  lat double precision not null,
  lng double precision not null,
  photo_path text,
  status text not null default 'pending' check (status in ('pending','approved','hidden')),
  visible boolean not null default false,
  client_timestamp timestamptz,
  created_at timestamptz not null default now()
);

create or replace view public.reports_public as
select
  id,
  public_id,
  address,
  severity,
  since,
  time_of_day,
  note,
  lat,
  lng,
  photo_path,
  case
    when photo_path is not null then
      concat('https://', current_setting('request.headers', true)::json->>'host', '/storage/v1/object/public/report-photos/', photo_path)
    else null
  end as photo_url,
  created_at,
  client_timestamp
from public.reports
where visible = true and status = 'approved';

alter table public.reports enable row level security;

drop policy if exists "public can insert pending reports" on public.reports;
create policy "public can insert pending reports"
on public.reports
for insert
to anon
with check (
  status = 'pending'
  and visible = false
  and severity between 1 and 5
  and char_length(address) between 3 and 140
  and char_length(coalesce(note,'')) <= 800
  and char_length(coalesce(contact_private,'')) <= 160
);

drop policy if exists "public can read approved reports" on public.reports;
create policy "public can read approved reports"
on public.reports
for select
to anon
using (status = 'approved' and visible = true);

-- Storage:
-- Bucket erstellen: report-photos
-- Public Bucket: für den Start aktivieren.
-- Max. Dateigröße am besten auf 1–2 MB begrenzen.
