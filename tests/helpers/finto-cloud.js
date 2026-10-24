// tests/helpers/finto-cloud.js
// =====================================================================
// Un Supabase FINTO, tenuto in memoria qui in Node e condiviso fra più
// contesti del browser: ogni contesto è un "dispositivo" diverso (il suo
// localStorage è suo), ma il cloud è uno solo — esattamente la situazione
// di chi gioca su desktop e poi riprende il telefono.
//
// Come si innesta: la pagina carica js/vendor/supabase.min.js, che scrive
// window.supabase. Prima che giri qualunque script della pagina si mette su
// window.supabase una proprietà con un setter che IGNORA le assegnazioni,
// così la libreria vera non sostituisce quella finta. Ogni query del
// client finto viene passata a Node con exposeFunction e risolta qui.
//
// Copre SOLO quello che usa js/cloud/cloud-sync.js per sessione, profilo,
// salvataggio e carte personalizzate. L'utente è sempre lo stesso,
// approvato e amministratore.
// =====================================================================

function creaFintoCloud() {
    const cloud = { saves: {}, custom_cards: {}, richieste: [], profili: [] };

    function rispondi(q) {
        cloud.richieste.push(`${q.table}:${q.op}`);
        const uid = q.filters.user_id || q.filters.id;
        // Una chiamata a funzione (client.rpc('segna_visto')): si registra in richieste come rpc:<nome>.
        if (q.table === 'rpc') return { data: null, error: null };
        // L'elenco dei profili (pannello Admin: nessun filtro) arriva da cloud.profili; il profilo di UN utente resta quello di sempre.
        if (q.table === 'profiles' && q.op === 'select' && !q.filters.id && !q.filters.status) return { data: cloud.profili || [], error: null };
        if (q.table === 'profiles') return { data: { status: 'approved', is_admin: true }, error: null };
        if (q.table === 'saves') {
            if (q.op === 'select') return { data: cloud.saves[uid] ? JSON.parse(JSON.stringify(cloud.saves[uid])) : null, error: null };
            if (q.op === 'upsert') { cloud.saves[q.payload.user_id] = { data: q.payload.data, updated_at: q.payload.updated_at }; return { error: null }; }
            // Come il database vero: l'inserimento di una riga che esiste già
            // viola la chiave unica, e l'aggiornamento condizionato
            // (`.eq('updated_at', ...)`) tocca la riga SOLO se ha ancora quella
            // updated_at — altrimenti torna zero righe, senza errore.
            if (q.op === 'insert') {
                if (cloud.saves[q.payload.user_id]) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
                cloud.saves[q.payload.user_id] = { data: q.payload.data, updated_at: q.payload.updated_at };
                return { data: [{ updated_at: q.payload.updated_at }], error: null };
            }
            if (q.op === 'update') {
                // Un gancio per i test: qualcosa che succede sul cloud
                // PROPRIO fra la lettura e la scrittura di un dispositivo.
                if (typeof cloud.primaDelloUpdate === 'function') { const f = cloud.primaDelloUpdate; cloud.primaDelloUpdate = null; f(); }
                const riga = cloud.saves[uid];
                if (!riga) return { data: [], error: null };
                if (q.filters.updated_at && Date.parse(riga.updated_at) !== Date.parse(q.filters.updated_at)) return { data: [], error: null };
                cloud.saves[uid] = { data: q.payload.data, updated_at: q.payload.updated_at };
                return { data: [{ updated_at: q.payload.updated_at }], error: null };
            }
            if (q.op === 'delete') { delete cloud.saves[uid]; return { error: null }; }
        }
        if (q.table === 'custom_cards') {
            if (q.op === 'select') return { data: (cloud.custom_cards[uid] || []).map((card) => ({ card })), error: null };
            if (q.op === 'delete') { cloud.custom_cards[uid] = []; return { error: null }; }
            if (q.op === 'insert') {
                q.payload.forEach((r) => { (cloud.custom_cards[r.user_id] = cloud.custom_cards[r.user_id] || []).push(r.card); });
                return { error: null };
            }
        }
        return { data: null, error: null };
    }

    /** Da chiamare su ogni contesto PRIMA di aprire pagine. */
    async function collega(context, opzioni) {
        await context.exposeFunction('__fintoCloud', (q) => JSON.stringify(rispondi(JSON.parse(q))));
        // `ricordaUscita`: signOut ricorda di essere uscito (nel localStorage del
        // dispositivo) e getSession risponde senza sessione finché non si
        // rifà signInWithPassword. Spento di default: gli spec nati prima
        // contano su una sessione che torna sempre.
        await context.addInitScript((ricordaUscita) => {
            window.AUTH_GATE_SKIP = false;
            window.__fintoRicordaUscita = !!ricordaUscita;
            const utente = { id: 'utente-prova', email: 'admin@prova.it' };
            function query(table) {
                const q = { table, op: 'select', filters: {}, payload: null };
                const b = {
                    select() { return b; },
                    eq(k, v) { q.filters[k] = v; return b; },
                    order() { return b; },
                    single() { return b; },
                    maybeSingle() { return b; },
                    upsert(p) { q.op = 'upsert'; q.payload = p; return b; },
                    insert(p) { q.op = 'insert'; q.payload = p; return b; },
                    update(p) { q.op = 'update'; q.payload = p; return b; },
                    delete() { q.op = 'delete'; return b; },
                    then(ok, ko) { return window.__fintoCloud(JSON.stringify(q)).then((r) => JSON.parse(r)).then(ok, ko); }
                };
                return b;
            }
            const finto = {
                createClient() {
                    return {
                        auth: {
                            getSession: () => {
                                const uscito = window.__fintoRicordaUscita && localStorage.getItem('__fintoUscito') === '1';
                                return Promise.resolve({ data: { session: uscito ? null : { user: utente, access_token: 'finto' } } });
                            },
                            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
                            signInWithPassword: () => { localStorage.removeItem('__fintoUscito'); return Promise.resolve({ data: { user: utente }, error: null }); },
                            signOut: () => { if (window.__fintoRicordaUscita) localStorage.setItem('__fintoUscito', '1'); return Promise.resolve({ error: null }); }
                        },
                        from: query,
                        rpc: (nome) => window.__fintoCloud(JSON.stringify({ table: 'rpc', op: nome, filters: {}, payload: null })).then((r) => JSON.parse(r))
                    };
                }
            };
            Object.defineProperty(window, 'supabase', { configurable: false, get: () => finto, set: () => { /* la libreria vera non passa */ } });
        }, !!(opzioni && opzioni.ricordaUscita));
    }

    return { cloud, collega };
}

module.exports = { creaFintoCloud };
