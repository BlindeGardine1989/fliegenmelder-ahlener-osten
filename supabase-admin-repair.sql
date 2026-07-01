alter table public.reports add column if not exists status text default 'pending';
alter table public.reports add column if not exists visible boolean default false;
update public.reports set status = coalesce(status,'pending'), visible = coalesce(visible,false);
drop policy if exists "admin can read all reports" on public.reports;
create policy "admin can read all reports" on public.reports for select to authenticated using (lower(auth.jwt() ->> 'email') in ('fliegenmelder.ahlen@gmail.com'));
drop policy if exists "admin can update reports" on public.reports;
create policy "admin can update reports" on public.reports for update to authenticated using (lower(auth.jwt() ->> 'email') in ('fliegenmelder.ahlen@gmail.com')) with check (lower(auth.jwt() ->> 'email') in ('fliegenmelder.ahlen@gmail.com'));
drop policy if exists "admin can delete reports" on public.reports;
create policy "admin can delete reports" on public.reports for delete to authenticated using (lower(auth.jwt() ->> 'email') in ('fliegenmelder.ahlen@gmail.com'));
