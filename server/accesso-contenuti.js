// Il relay verifica l'account con Supabase, mai con flag dichiarati dal client.
// Solo la chiave pubblica anon: nessun service_role nel repository o nel relay.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { crea } = require('../js/cloud/content-access');
const config = require('../js/cloud/supabase-config');

function catalogo(file, expression) {
    const context = { window: {}, console };
    return vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8') + '\n;' + expression, context);
}
const personaggi = catalogo('js/data/characters-db.js', 'characterDatabase');
const carte = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/cards.json'), 'utf8'));
const packs = catalogo('js/data/starter-structure-decks.js', 'starterStructureDeckDatabase');
const cataloghi = { personaggi: () => personaggi, carte: () => carte };

function creaVerifica(opzioni = {}) {
    const fetchImpl = opzioni.fetch || fetch;
    const cfg = opzioni.config || { url: process.env.SUPABASE_URL || config.url, anonKey: process.env.SUPABASE_ANON_KEY || config.anonKey };
    const cache = new Map();
    async function verifica(token) {
        if (typeof token !== 'string' || token.length < 10 || token.length > 8192) throw new Error('Accedi al gioco prima di entrare in Multiplayer.');
        const nota = cache.get(token);
        if (nota && nota.fino > Date.now()) return nota.profilo;
        const headers = { apikey: cfg.anonKey, Authorization: 'Bearer ' + token };
        const userResponse = await fetchImpl(cfg.url + '/auth/v1/user', { headers, signal: AbortSignal.timeout(6000) });
        if (!userResponse.ok) throw new Error('Sessione Multiplayer scaduta: accedi di nuovo.');
        const user = await userResponse.json();
        if (!user || !/^[a-f0-9-]{36}$/i.test(user.id)) throw new Error('Account non verificato.');
        const response = await fetchImpl(cfg.url + '/rest/v1/profiles?id=eq.' + user.id + '&select=status,is_admin,content_ww1,content_ww2,content_extra', { headers, signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new Error('Impossibile verificare i contenuti del tuo account.');
        const rows = await response.json();
        const p = rows && rows[0];
        if (!p || (!p.is_admin && p.status !== 'approved')) throw new Error('Questo account non può accedere al Multiplayer.');
        const profilo = { uid: user.id, ww1: !!(p.is_admin || p.content_ww1), ww2: !!(p.is_admin || p.content_ww2), extra: !!(p.is_admin || p.content_extra) };
        // Tetto esplicito: il relay non conserva indefinitamente JWT di vecchie connessioni.
        if (cache.size >= 1000) cache.delete(cache.keys().next().value);
        cache.set(token, { fino: Date.now() + 60000, profilo });
        return profilo;
    }
    return { verifica };
}

/** Pacchetti richiesti da una configurazione, avatar o mazzo canonico. */
function richiesti(action) {
    const need = new Set();
    const accesso = crea((pack) => { need.add(pack); return true; }, cataloghi);
    const stack = [action];
    let budget = 5000;
    while (stack.length && --budget > 0) {
        const obj = stack.pop();
        if (!obj || typeof obj !== 'object') continue;
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                if (key === 'origin') accesso.origine(value);
                if (key === 'field' || key === 'campo') accesso.campo(value);
                if (['personaggio', 'characterId', 'pedina', 'image'].includes(key)) accesso.personaggio(value);
                if (key === 'raid') accesso.personaggio(value);
                if (key === 'specchio') {
                    const pack = packs.find((p) => p.packId === value);
                    if (!pack) throw new Error('Mazzo a specchio sconosciuto.');
                    accesso.carteVietate(pack);
                }
            }
            if (key === 'spec' && value && Array.isArray(value.main)) accesso.carteVietate(value);
            else if (value && typeof value === 'object') stack.push(value);
        }
    }
    if (budget <= 0) throw new Error('Configurazione Multiplayer troppo complessa.');
    return need;
}

function chiave(action, senderId) {
    if (action.kind === 'room-config') return 'campo';
    if (action.kind === 'mazzo') return senderId + ':mazzo:' + (action.posto || 'io');
    if (action.kind === 'ready' && action.pedina) return senderId + ':pedina';
    if (action.kind === 'tag-sala') {
        if (action.tipo === 'io' && action.pedina) return senderId + ':pedina';
        if (action.tipo === 'stato' || action.tipo === 'via') return 'tag';
    }
    return null;
}
function nonCompatibile(requirements, profili) {
    for (const pack of requirements) if (profili.some((p) => !p || p[pack] !== true)) return 'Il contenuto ' + pack.toUpperCase() + ' non è abilitato a tutti i partecipanti.';
    return null;
}
module.exports = { creaVerifica, richiesti, chiave, nonCompatibile };
