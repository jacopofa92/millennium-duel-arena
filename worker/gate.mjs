/**
 * gate.mjs — il cancello lato SERVER del sito (Cloudflare Worker davanti ai file del gioco).
 * ==========================================================================================
 * Prima l'accesso con approvazione era controllato solo da JavaScript nella pagina (js/cloud/auth-gate.js): chi disattiva
 * lo script o apre i file in locale giocava senza account. Ora il Worker NON CONSEGNA il gioco a chi non ha un cookie di
 * accesso valido; il cookie lo emette solo questo stesso Worker, dopo aver chiesto a Supabase se l'account e' approvato.
 *
 * Cosa e' pubblico (serve per poter accedere) e cosa no:
 *  - PUBBLICO: index.html (e i file che carica: lista scritta da scripts/pubblica.js in `_pubblici.json`), sw.js,
 *    manifest.json, app-status.json e le cartelle di sola grafica/audio (images, audio, video, assets).
 *  - PROTETTO (serve il cookie): tutte le altre pagine .html, il motore del duello, l'IA, i dati delle carte, ogni altro
 *    script. Chi non e' approvato non puo' quindi caricare il duello.
 *
 * Il cookie `ygo_acc` = `<id utente>.<scadenza>.<firma>`: la firma e' un HMAC-SHA256 con il segreto COOKIE_SECRET (solo nel
 * Worker). E' HttpOnly (il JavaScript della pagina non lo legge), Secure e SameSite=Lax, e dura poche ore: un account
 * revocato smette di funzionare al piu' alla scadenza del cookie, perche' per rinnovarlo il Worker richiede di nuovo a
 * Supabase se l'account e' ancora approvato.
 *
 * Endpoint /__acc (solo qui): POST con `Authorization: Bearer <token Supabase>` = verifica e imposta il cookie;
 * DELETE = lo toglie (uscita dall'account). Segreti e variabili: vedi docs/planning/ACCESSO_SOLO_APPROVATI.md.
 */

export const NOME_COOKIE = 'ygo_acc';
/** Durata del cookie: e' anche il massimo ritardo con cui una revoca dell'account smette di far entrare. */
export const DURATA_SECONDI = 6 * 3600;
const PREFISSI_PUBBLICI = ['/images/', '/audio/', '/video/', '/assets/'];
const BASE64URL = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const DA_BASE64URL = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const encoder = new TextEncoder();
function chiave(segreto, usi) {
    return crypto.subtle.importKey('raw', encoder.encode(segreto), { name: 'HMAC', hash: 'SHA-256' }, false, usi);
}

/** Crea il valore del cookie per `idUtente`, valido fino a `scadenza` (secondi dall'epoca). */
export async function creaCookie(segreto, idUtente, scadenza) {
    const corpo = `${idUtente}.${scadenza}`;
    const firma = await crypto.subtle.sign('HMAC', await chiave(segreto, ['sign']), encoder.encode(corpo));
    return `${corpo}.${BASE64URL(firma)}`;
}

/** Vero se il cookie e' ben formato, firmato con questo segreto e non scaduto. La firma si controlla a tempo costante. */
export async function cookieValido(segreto, valore, adesso = Math.floor(Date.now() / 1000)) {
    if (!segreto || !valore) return false;
    const parti = String(valore).split('.');
    if (parti.length !== 3) return false;
    const [id, scadenza, firma] = parti;
    if (!/^[0-9a-f-]{8,64}$/i.test(id) || !/^\d{1,12}$/.test(scadenza) || Number(scadenza) <= adesso) return false;
    try {
        return await crypto.subtle.verify('HMAC', await chiave(segreto, ['verify']), DA_BASE64URL(firma), encoder.encode(`${id}.${scadenza}`));
    } catch (e) {
        return false;
    }
}

function leggiCookie(request, nome) {
    const testo = request.headers.get('Cookie') || '';
    for (const pezzo of testo.split(/;\s*/)) {
        const i = pezzo.indexOf('=');
        if (i > 0 && pezzo.slice(0, i) === nome) return pezzo.slice(i + 1);
    }
    return null;
}

/** `/pagina`, `/pagina.html`, `/pagina/` e `/` (= index) sono la stessa cosa: il sito gira `.html` a senza estensione. */
export function normalizza(percorso) {
    let p = percorso.replace(/\/+$/, '') || '/index';
    p = p.replace(/\.html$/i, '');
    return p === '/' ? '/index' : p;
}

/** Vero se questo percorso si consegna senza cookie. `elenco` = { pubblici: [...] } scritto da scripts/pubblica.js. */
export function eAperto(percorso, elenco) {
    const p = normalizza(percorso);
    if (PREFISSI_PUBBLICI.some((pre) => percorso.startsWith(pre))) return true;
    const pubblici = (elenco && elenco.pubblici) || [];
    return pubblici.some((voce) => voce === percorso || normalizza(voce) === p);
}

let elencoInMemoria = null;
async function caricaElenco(env) {
    if (elencoInMemoria) return elencoInMemoria;
    try {
        const r = await env.ASSETS.fetch(new Request('https://assets.invalid/_pubblici.json'));
        if (r.ok) elencoInMemoria = await r.json();
    } catch (e) { /* si ritenta alla prossima richiesta */ }
    // Senza elenco (file mancante) si considera pubblico solo index: meglio un gioco chiuso che uno aperto.
    return elencoInMemoria || { pubblici: ['/index.html'] };
}
export function azzeraElencoPerTest() { elencoInMemoria = null; }

function risposta(corpo, stato, extra = {}) {
    return new Response(corpo, { status: stato, headers: Object.assign({ 'Cache-Control': 'no-store' }, extra) });
}

function cookieHeader(valore, durata) {
    return `${NOME_COOKIE}=${valore}; Path=/; Max-Age=${durata}; HttpOnly; Secure; SameSite=Lax`;
}

/** POST: verifica con Supabase che l'account sia approvato e imposta il cookie. DELETE: lo toglie. */
async function gestisciAccesso(request, env) {
    if (request.method === 'DELETE') return risposta(null, 204, { 'Set-Cookie': cookieHeader('', 0) });
    if (request.method !== 'POST') return risposta('Metodo non ammesso', 405, { Allow: 'POST, DELETE' });
    if (!env.COOKIE_SECRET || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return risposta('Cancello non configurato', 503);
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return risposta('Token mancante', 401);
    const intestazioni = { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
    try {
        // 1) il token e' davvero di un utente? (Supabase lo valida e ci dice chi e')
        const u = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: intestazioni });
        if (!u.ok) return risposta('Sessione non valida', 401, { 'Set-Cookie': cookieHeader('', 0) });
        const utente = await u.json();
        if (!utente || !utente.id) return risposta('Sessione non valida', 401);
        // 2) e' approvato (o amministratore)? Lo dice la tabella profiles, che l'utente puo' leggere solo per se' stesso.
        const p = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(utente.id)}&select=status,is_admin`, { headers: intestazioni });
        if (!p.ok) return risposta('Profilo non leggibile', 502);
        const righe = await p.json();
        const profilo = Array.isArray(righe) ? righe[0] : null;
        const approvato = !!(profilo && (profilo.is_admin === true || profilo.status === 'approved'));
        if (!approvato) return risposta('Account non approvato', 403, { 'Set-Cookie': cookieHeader('', 0) });
        const scadenza = Math.floor(Date.now() / 1000) + DURATA_SECONDI;
        const valore = await creaCookie(env.COOKIE_SECRET, utente.id, scadenza);
        return risposta(JSON.stringify({ ok: true, scadenza }), 200, { 'Set-Cookie': cookieHeader(valore, DURATA_SECONDI), 'Content-Type': 'application/json' });
    } catch (e) {
        return risposta('Verifica non riuscita', 502);
    }
}

function eNavigazione(request) {
    return request.mode === 'navigate' || (request.headers.get('Accept') || '').includes('text/html');
}

export default {
    /** @param {Request} request @param {any} env */
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/__acc') return gestisciAccesso(request, env);
        // L'elenco dei file pubblici non si consegna a nessuno (lo legge solo questo Worker).
        if (url.pathname === '/_pubblici.json') return risposta('Non trovato', 404);

        const elenco = await caricaElenco(env);
        if (eAperto(url.pathname, elenco)) return env.ASSETS.fetch(request);

        if (!env.COOKIE_SECRET) return risposta('Cancello non configurato: manca COOKIE_SECRET', 503);
        if (await cookieValido(env.COOKIE_SECRET, leggiCookie(request, NOME_COOKIE))) {
            const r = await env.ASSETS.fetch(request);
            // Contenuto riservato: niente copie in cache condivise, e la copia del browser si rivalida sempre (ETag).
            const out = new Response(r.body, r);
            out.headers.set('Cache-Control', 'private, no-cache');
            out.headers.append('Vary', 'Cookie');
            return out;
        }
        // Senza cookie valido: una pagina riporta all'accesso (`accesso=1` dice al gioco di richiedere il cookie), il resto e' un 401.
        if (eNavigazione(request)) return Response.redirect(`${url.origin}/index.html?accesso=1`, 302);
        return risposta('Accesso riservato', 401);
    }
};
