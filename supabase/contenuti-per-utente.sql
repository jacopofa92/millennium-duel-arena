-- Conserva gli accessi esistenti, ma i NUOVI profili partono senza pacchetti opzionali.
-- ADD COLUMN è idempotente: rieseguire non riattiva i contenuti revocati.
alter table public.profiles add column if not exists content_ww1 boolean not null default true;
alter table public.profiles add column if not exists content_ww2 boolean not null default true;
alter table public.profiles add column if not exists content_extra boolean not null default true;
alter table public.profiles alter column content_ww1 set default false;
alter table public.profiles alter column content_ww2 set default false;
alter table public.profiles alter column content_extra set default false;

create or replace function public.protect_profile_content_flags()
returns trigger language plpgsql set search_path = public as $$
begin
    if auth.uid() is not null and not public.is_admin_user(auth.uid())
       and (new.content_ww1 is distinct from old.content_ww1
         or new.content_ww2 is distinct from old.content_ww2
         or new.content_extra is distinct from old.content_extra) then
        raise exception 'Solo un amministratore può modificare i contenuti abilitati.' using errcode = '42501';
    end if;
    return new;
end;
$$;
revoke execute on function public.protect_profile_content_flags() from public;
drop trigger if exists protect_profile_content_flags on public.profiles;
create trigger protect_profile_content_flags before update on public.profiles
    for each row execute function public.protect_profile_content_flags();
