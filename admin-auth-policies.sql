-- Adminbereich absichern mit Supabase Auth.
-- Nur diese E-Mail darf alle Meldungen lesen und bearbeiten.
-- Falls eine andere Admin-Mail genutzt werden soll, E-Mail-Adresse ersetzen.

drop policy if exists "temporary admin can read reports" on public.reports;
drop policy if exists "temporary admin can update reports" on public.reports;

drop policy if exists "admin can read all reports" on public.reports;
create policy "admin can read all reports"
on public.reports
for select
to authenticated
using (
  auth.jwt() ->> 'email' = 'sarahstefanowitz@yahoo.de'
);

drop policy if exists "admin can update reports" on public.reports;
create policy "admin can update reports"
on public.reports
for update
to authenticated
using (
  auth.jwt() ->> 'email' = 'sarahstefanowitz@yahoo.de'
)
with check (
  auth.jwt() ->> 'email' = 'sarahstefanowitz@yahoo.de'
);
