-- Admin-Freigabe für den aktuellen einfachen Adminbereich.
-- Wichtig: Das ist eine Übergangslösung ohne Login.
-- Später ersetzen wir das durch Supabase Auth.

drop policy if exists "temporary admin can read reports" on public.reports;
create policy "temporary admin can read reports"
on public.reports
for select
to anon
using (true);

drop policy if exists "temporary admin can update reports" on public.reports;
create policy "temporary admin can update reports"
on public.reports
for update
to anon
using (true)
with check (true);
