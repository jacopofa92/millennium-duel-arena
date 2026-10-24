-- ============================================================
-- Yu-Gi-Oh! Duel Arena — schema Supabase per la sincronizzazione
-- CLOUD OPZIONALE di salvataggio giocatore e carte custom.
-- ============================================================
-- Da eseguire nell'SQL Editor del tuo progetto Supabase (dashboard →
-- SQL Editor → New query → incolla tutto → Run). RIESEGUIBILE senza
-- errori anche se l'hai già lanciato una volta (usa "if not exists"/
-- "drop ... if exists" ovunque) — utile perché una sessione successiva
-- di sviluppo aggiunge nuove sezioni in fondo a questo stesso file
-- (es. la sezione "APPROVAZIONE ADMIN" più sotto): rilanciare l'intero
-- file aggiorna solo ciò che è cambiato, senza fallire su ciò che
-- esisteva già.
--
-- L'autenticazione (auth.users) è già gestita da Supabase stesso: qui si
-- creano solo le DUE tabelle che il gioco usa (js/cloud/cloud-sync.js), più
-- le policy di Row Level Security che garantiscono che ogni utente veda e
-- modifichi SOLO i propri dati — obbligatorio: senza RLS chiunque con la
-- chiave "anon" pubblica (che è per forza incorporata nel codice client,
-- vedi js/cloud/supabase-config.js) potrebbe leggere/scrivere i dati di TUTTI.
-- ============================================================

-- ------------------------------------------------------------
-- 1) saves — UN salvataggio completo per utente (rispecchia esattamente
--    l'oggetto che oggi vive in localStorage via js/save-manager.js:
--    nome giocatore, deck, deck attivo, record duelli, valute, pacchetti
--    posseduti — tutto in una sola colonna jsonb, stesso principio "un
--    solo blob" già usato in locale, per una sincronizzazione semplice
--    invece di normalizzare in tabelle separate).
-- ------------------------------------------------------------
create table if not exists public.saves (
    user_id uuid primary key references auth.users(id) on delete cascade,
    data jsonb not null,
    updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "Users can view their own save" on public.saves;
create policy "Users can view their own save"
    on public.saves for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own save" on public.saves;
create policy "Users can insert their own save"
    on public.saves for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own save" on public.saves;
create policy "Users can update their own save"
    on public.saves for update
    using (auth.uid() = user_id);

drop policy if exists "Users can delete their own save" on public.saves;
create policy "Users can delete their own save"
    on public.saves for delete
    using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2) custom_cards — le carte create in crea-carta.html (js/data/custom-cards.js),
--    UNA RIGA per carta (a differenza di "saves" sopra): permette di
--    cancellarne/aggiornarne una singola senza toccare le altre.
-- ------------------------------------------------------------
create table if not exists public.custom_cards (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    card jsonb not null,
    created_at timestamptz not null default now()
);

alter table public.custom_cards enable row level security;

drop policy if exists "Users can view their own custom cards" on public.custom_cards;
create policy "Users can view their own custom cards"
    on public.custom_cards for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own custom cards" on public.custom_cards;
create policy "Users can insert their own custom cards"
    on public.custom_cards for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own custom cards" on public.custom_cards;
create policy "Users can update their own custom cards"
    on public.custom_cards for update
    using (auth.uid() = user_id);

drop policy if exists "Users can delete their own custom cards" on public.custom_cards;
create policy "Users can delete their own custom cards"
    on public.custom_cards for delete
    using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Indice utile per "tutte le carte di questo utente", la query più
-- comune (vedi js/cloud/cloud-sync.js#pullCustomCards).
-- ------------------------------------------------------------
create index if not exists custom_cards_user_id_idx on public.custom_cards (user_id);

-- ------------------------------------------------------------
-- 3) delete_own_account() — permette a un utente loggato di cancellare
--    SE STESSO (mai un altro: legge auth.uid(), non un parametro).
--    Necessaria perché auth.users vive in uno schema protetto che il
--    client con la chiave "anon"/utente autenticato non può toccare
--    direttamente — SECURITY DEFINER fa eseguire la funzione con i
--    permessi di chi l'ha creata (di solito il proprietario del
--    progetto), non con quelli di chi la chiama. La riga in saves e
--    tutte quelle in custom_cards spariscono da sole grazie a
--    "on delete cascade" definito sopra sulle foreign key.
-- ------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- ============================================================
-- 4) APPROVAZIONE ADMIN — replica dello stesso meccanismo del
--    progetto "Fioxify" (stesso autore): la registrazione resta
--    self-service, ma un nuovo account resta "pending" (nessun
--    accesso al gioco, vedi js/cloud/cloud-sync.js#signIn) finché un
--    amministratore non lo approva dal pannello Admin (admin.html).
--    Rieseguibile senza errori (usa "if not exists"/"drop ... if
--    exists" come il resto di questo file).
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES: anagrafica minima (auth.users non è interrogabile
-- direttamente dal client) + stato di approvazione + ruolo admin.
-- ------------------------------------------------------------
create table if not exists public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    email       text not null,
    status      text not null default 'pending',
    is_admin    boolean not null default false,
    created_at  timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
    check (status in ('pending', 'approved', 'rejected'));

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
    for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
    for update using (auth.uid() = id);

-- crea automaticamente il profilo ad ogni nuova registrazione (status
-- 'pending'/is_admin false di default, vedi la tabella sopra)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- backfill: crea il profilo anche per gli utenti già registrati prima
-- che esistesse questa tabella (es. account creati durante lo sviluppo
-- della sola sincronizzazione cloud, prima dell'approvazione admin)
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

revoke execute on function public.handle_new_user() from public;

-- ------------------------------------------------------------
-- Helper functions (security definer: bypassano la RLS di profiles
-- per evitare ricorsioni nelle policy che le usano)
-- ------------------------------------------------------------
create or replace function public.is_admin_user(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

create or replace function public.is_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select coalesce(
        (select status = 'approved' or is_admin from public.profiles where id = auth.uid()),
        false
    );
$$;

revoke execute on function public.is_admin_user(uuid) from anon;
revoke execute on function public.is_approved() from anon;

-- ------------------------------------------------------------
-- Trigger: impedisce a un utente normale (autenticato via client,
-- quindi via PostgREST con un vero JWT) di auto-approvarsi o
-- auto-promuoversi admin modificando il proprio profilo.
-- BUG REALE trovato dall'utente eseguendo questo stesso file: il
-- controllo originale bloccava anche una query lanciata a mano
-- nell'SQL Editor (es. la UPDATE per promuovere il primo admin,
-- documentata più in basso) — lì `auth.uid()` è SEMPRE null (nessuna
-- sessione PostgREST/JWT dietro una connessione SQL diretta), quindi
-- `is_admin_user(null)` tornava false e il trigger scattava anche per
-- te, l'amministratore del database. Il controllo va applicato SOLO
-- quando la modifica arriva DAVVERO da un utente autenticato via
-- client (auth.uid() non null) — una query diretta (SQL Editor,
-- service_role) bypassa questo controllo per costruzione, esattamente
-- come deve poter fare per il bootstrap del primo admin.
-- ------------------------------------------------------------
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    if auth.uid() is not null and not public.is_admin_user(auth.uid()) then
        if new.status is distinct from old.status or new.is_admin is distinct from old.is_admin then
            raise exception 'Non puoi modificare lo stato di approvazione o i permessi admin del tuo profilo.';
        end if;
    end if;
    return new;
end;
$$;

revoke execute on function public.protect_profile_privileged_columns() from public;

drop trigger if exists protect_profile_privileged_columns on public.profiles;
create trigger protect_profile_privileged_columns
    before update on public.profiles
    for each row execute function public.protect_profile_privileged_columns();

-- policy che permette agli admin di aggiornare qualsiasi profilo (per approvare/rifiutare)
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
    for update to authenticated
    using (public.is_admin_user(auth.uid()))
    with check (true);

-- policy che permette agli admin di leggere tutte le righe di profiles
-- (serve al pannello Admin per elencare le richieste di registrazione)
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
    for select to authenticated
    using (public.is_admin_user(auth.uid()));

-- ------------------------------------------------------------
-- Permette al form di registrazione (utente non ancora autenticato) di
-- sapere se un'email è già registrata, senza esporre l'intera tabella
-- profiles ad anon: restituisce solo lo status ('pending'/'approved'/
-- 'rejected') o null se l'email è libera.
-- ------------------------------------------------------------
create or replace function public.check_registration_email(check_email text)
returns text
language sql
security definer
set search_path = public
stable
as $$
    select status from public.profiles where lower(email) = lower(check_email) limit 1;
$$;

grant execute on function public.check_registration_email(text) to anon, authenticated;

-- ------------------------------------------------------------
-- server_now(): l'ora del SERVER, per la rotazione del Negozio e delle
-- missioni (js/cloud/server-date.js).
--
-- PERCHÉ UNA FUNZIONE E NON L'HEADER `Date` DELLA RISPOSTA HTTP, che era
-- il primo approccio e non richiedeva nulla qui: quell'header il
-- JavaScript non lo vede MAI da un'altra origine. `Date` non è fra gli
-- header che il CORS espone di default, e Supabase non manda un
-- `Access-Control-Expose-Headers` che lo aggiunga — misurato con una
-- richiesta vera dal browser: degli header della risposta arrivano solo
-- `content-length` e `content-type`, anche su un 200. Il risultato era
-- che il Negozio mostrava sempre l'avviso "non riesco a leggere la data
-- dal server". Nel CORPO della risposta, invece, il CORS non c'entra.
--
-- `stable` e non `volatile`: non scrive niente, e permette al pianificatore
-- di trattarla come una lettura qualunque. Aperta anche ad `anon` perché
-- la rotazione dev'essere la stessa per tutti, anche prima dell'accesso —
-- e l'ora corrente non è un'informazione riservata.
-- ------------------------------------------------------------
create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$
    select now();
$$;

grant execute on function public.server_now() to anon, authenticated;

-- ------------------------------------------------------------
-- Ultimo accesso online (pannello Admin). `last_seen_at` lo scrive SOLO
-- segna_visto(), con l'ora del SERVER (`now()`): un orologio di telefono
-- sbagliato non deve falsare la colonna. Chiamata dal gioco (cloud-sync.js,
-- `segnaVisto`) all'avvio di ogni pagina e ogni 5 minuti mentre è in primo
-- piano, al massimo una volta ogni 5 minuti per dispositivo. Il primo valore
-- viene da auth.users.last_sign_in_at (solo l'accesso, non la sessione
-- rinnovata): per questo prima dell'aggiornamento un account può risultare
-- "visto" molto prima dell'ultima volta in cui ha davvero giocato.
-- ------------------------------------------------------------
alter table public.profiles add column if not exists last_seen_at timestamptz;

update public.profiles p
set last_seen_at = u.last_sign_in_at
from auth.users u
where u.id = p.id and p.last_seen_at is null;

create or replace function public.segna_visto()
returns void
language sql
security definer
set search_path = public
as $$
    update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

revoke execute on function public.segna_visto() from public, anon;
grant execute on function public.segna_visto() to authenticated;

-- ------------------------------------------------------------
-- Gate di scrittura: un utente non ancora approvato non può salvare/
-- caricare nulla sul cloud, anche bypassando la UI (accesso al gioco è
-- già bloccato lato client da cloud-sync.js#signIn, questo è un secondo
-- strato lato database).
-- ------------------------------------------------------------
drop policy if exists "Users can insert their own save" on public.saves;
create policy "Users can insert their own save"
    on public.saves for insert
    with check (auth.uid() = user_id and public.is_approved());

drop policy if exists "Users can update their own save" on public.saves;
create policy "Users can update their own save"
    on public.saves for update
    using (auth.uid() = user_id and public.is_approved());

drop policy if exists "Users can insert their own custom cards" on public.custom_cards;
create policy "Users can insert their own custom cards"
    on public.custom_cards for insert
    with check (auth.uid() = user_id and public.is_approved());

-- ------------------------------------------------------------
-- Per promuovere un account ad admin (accesso al pannello Admin,
-- admin.html, e approvazione automatica), esegui manualmente
-- nell'SQL Editor:
--   update public.profiles set is_admin = true, status = 'approved'
--   where email = 'la-tua-email@esempio.it';
-- ------------------------------------------------------------
