-- Sospensione reversibile e appunti privati dell'amministratore.
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
    check (status in ('pending', 'approved', 'rejected', 'suspended'));
-- Un amministratore non può togliere per errore l'accesso a sé o agli altri admin.
alter table public.profiles drop constraint if exists profiles_admin_not_suspended;
alter table public.profiles add constraint profiles_admin_not_suspended
    check (not (is_admin and status = 'suspended'));

-- Separata dai profili: anche la SELECT del proprio profilo non deve rivelare le note.
create table if not exists public.admin_profile_notes (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    note text not null default '' check (char_length(note) <= 4000)
);
alter table public.admin_profile_notes enable row level security;
revoke all on public.admin_profile_notes from anon;
grant select, insert, update, delete on public.admin_profile_notes to authenticated;
drop policy if exists admin_profile_notes_admin on public.admin_profile_notes;
create policy admin_profile_notes_admin on public.admin_profile_notes
    for all to authenticated
    using (public.is_admin_user(auth.uid()))
    with check (public.is_admin_user(auth.uid()));

-- La sospensione blocca anche le chiamate dirette con un JWT ancora valido.
drop policy if exists saves_approved_only on public.saves;
create policy saves_approved_only on public.saves as restrictive
    for all to authenticated using (public.is_approved()) with check (public.is_approved());
drop policy if exists custom_cards_approved_only on public.custom_cards;
create policy custom_cards_approved_only on public.custom_cards as restrictive
    for all to authenticated using (public.is_approved()) with check (public.is_approved());
