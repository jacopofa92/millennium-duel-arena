-- Mantiene una sola sessione di gioco attiva per account.
-- Il client puo' chiedere il passaggio di sessione solo durante il login;
-- il database confronta la data reale della sessione Supabase e rifiuta
-- scritture provenienti da sessioni precedenti.
create table if not exists public.active_device_sessions (
    user_id uuid primary key references auth.users(id) on delete cascade,
    auth_session_id uuid not null,
    session_created_at timestamptz not null,
    updated_at timestamptz not null default now()
);

alter table public.active_device_sessions enable row level security;
revoke all on table public.active_device_sessions from public, anon, authenticated;

create or replace function public.claim_active_device_session()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
    v_created_at timestamptz;
begin
    if v_user_id is null or v_session_id is null then
        raise exception 'Sessione di accesso non valida.' using errcode = '42501';
    end if;

    select s.created_at
      into v_created_at
      from auth.sessions as s
     where s.id = v_session_id
       and s.user_id = v_user_id;

    if v_created_at is null then
        raise exception 'Sessione Supabase non trovata.' using errcode = '42501';
    end if;

    insert into public.active_device_sessions as attiva
        (user_id, auth_session_id, session_created_at, updated_at)
    values
        (v_user_id, v_session_id, v_created_at, now())
    on conflict (user_id) do update
        set auth_session_id = excluded.auth_session_id,
            session_created_at = excluded.session_created_at,
            updated_at = now()
        where attiva.auth_session_id = excluded.auth_session_id
           or excluded.session_created_at > attiva.session_created_at;

    if not found then
        raise exception 'Un accesso più recente è attivo su un altro dispositivo.'
            using errcode = '42501', detail = 'DEVICE_SESSION_SUPERSEDED';
    end if;
    return true;
end;
$$;

revoke all on function public.claim_active_device_session() from public, anon;
grant execute on function public.claim_active_device_session() to authenticated;

create or replace function public.is_active_device_session()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
    v_active_session_id uuid;
begin
    if v_user_id is null or v_session_id is null then
        raise exception 'Sessione di accesso non valida.' using errcode = '42501';
    end if;
    select s.auth_session_id into v_active_session_id
      from public.active_device_sessions as s
     where s.user_id = v_user_id;
    -- Nessun claim significa che l'account non ha ancora effettuato un
    -- nuovo login col client aggiornato; la compatibilità iniziale resta.
    return not found or v_active_session_id = v_session_id;
end;
$$;
revoke all on function public.is_active_device_session() from public, anon;
grant execute on function public.is_active_device_session() to authenticated;

create or replace function public.require_active_device_session_for_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_active_session_id uuid;
    v_request_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
    if tg_op = 'DELETE' then
        v_user_id := old.user_id;
    else
        v_user_id := new.user_id;
    end if;

    -- Operazioni amministrative e manutenzione server-side non sono una
    -- seconda sessione di gioco dell'utente: non devono restare bloccate
    -- dalla sessione attiva del proprietario dei dati.
    if auth.uid() is null or public.is_admin_user(auth.uid()) then
        if tg_op = 'DELETE' then return old; end if;
        return new;
    end if;

    -- Compatibilità con account/sessioni preesistenti: finché un account
    -- non effettua un nuovo login col client aggiornato, nessuno viene espulso.
    -- Il primo login aggiornato registra la sessione da proteggere.
    select s.auth_session_id
      into v_active_session_id
      from public.active_device_sessions as s
     where s.user_id = v_user_id
     for share;

    if not found then
        if tg_op = 'DELETE' then return old; end if;
        return new;
    end if;

    if v_request_session_id is distinct from v_active_session_id then
        raise exception 'Questo account è stato aperto da un altro dispositivo.'
            using errcode = 'P0001', detail = 'DEVICE_SESSION_SUPERSEDED';
    end if;

    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

revoke all on function public.require_active_device_session_for_write() from public, anon, authenticated;

drop trigger if exists require_active_device_session_on_saves on public.saves;
create trigger require_active_device_session_on_saves
    before insert or update or delete on public.saves
    for each row execute function public.require_active_device_session_for_write();

drop trigger if exists require_active_device_session_on_custom_cards on public.custom_cards;
create trigger require_active_device_session_on_custom_cards
    before insert or update or delete on public.custom_cards
    for each row execute function public.require_active_device_session_for_write();
