-- Adminbereich absichern mit Supabase Auth.
-- Aktuell erlaubte Admin-E-Mail:
-- fliegenmelder.ahlen@gmail.com
--
-- Wenn ihr weitere Admins ergänzen wollt, tragt die E-Mail-Adressen unten
-- zusätzlich in die Listen ein.

drop policy if exists "temporary admin can read reports" on public.reports;
drop policy if exists "temporary admin can update reports" on public.reports;

drop policy if exists "admin can read all reports" on public.reports;
create policy "admin can read all reports"
on public.reports
for select
to authenticated
using (
  lower(auth.jwt() ->> 'email') in (
    'fliegenmelder.ahlen@gmail.com'
  )
);

drop policy if exists "admin can update reports" on public.reports;
create policy "admin can update reports"
on public.reports
for update
to authenticated
using (
  lower(auth.jwt() ->> 'email') in (
    'fliegenmelder.ahlen@gmail.com'
  )
)
with check (
  lower(auth.jwt() ->> 'email') in (
    'fliegenmelder.ahlen@gmail.com'
  )
);
