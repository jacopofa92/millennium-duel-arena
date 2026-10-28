/**
 * settimana-db.js — Il Duello della Settimana (settimana.html): le regole che
 * ruotano, gli avversari e i premi.
 * =====================================================================
 * Solo dati. La logica (quale regola vale questa settimana, come si adatta un
 * mazzo, lo stato salvato) vive in js/modes/settimana.js e la preparazione del
 * duello in js/modes/settimana-mode.js.
 *
 * LA REGOLA riguarda i MOSTRI del mazzo, di entrambi i duellanti: Magie e
 * Trappole restano libere. Nessuna regola del motore cambia (scelta esplicita
 * dell'utente per ogni modalità): prima del duello i mostri che non la
 * rispettano vengono sostituiti da mostri validi di Livello e ATK simili, e
 * il duello è un duello normale.
 *
 * `filtro.tipo`: 'attributo' (valore = attributo, come scritto in cards.json),
 * 'razza' (valore = razza), 'livelloMax' (valore = Livello massimo).
 *
 * L'ORDINE conta: la regola della settimana è quella di posto (numero della
 * settimana) % lunghezza, quindi due settimane di fila sono sempre diverse e
 * le categorie si alternano. Aggiungere una regola in fondo non sposta quelle
 * già note; inserirla nel mezzo sì.
 */
const settimanaDatabase = {
    regole: [
        { id: 'attr-luce',       icona: '☀️', titolo: 'Solo mostri LUCE',          filtro: { tipo: 'attributo', valore: 'LUCE' } },
        { id: 'razza-guerriero', icona: '⚔️', titolo: 'Solo mostri Guerriero',     filtro: { tipo: 'razza', valore: 'Guerriero' } },
        { id: 'liv-4',           icona: '🌱', titolo: 'Solo mostri fino al Livello 4', filtro: { tipo: 'livelloMax', valore: 4 } },
        { id: 'attr-oscurita',   icona: '🌑', titolo: 'Solo mostri OSCURITÀ',      filtro: { tipo: 'attributo', valore: 'OSCURITÀ' } },
        { id: 'razza-drago',     icona: '🐉', titolo: 'Solo mostri Drago',         filtro: { tipo: 'razza', valore: 'Drago' } },
        { id: 'attr-terra',      icona: '⛰️', titolo: 'Solo mostri TERRA',         filtro: { tipo: 'attributo', valore: 'TERRA' } },
        { id: 'razza-incantatore', icona: '🪄', titolo: 'Solo mostri Incantatore', filtro: { tipo: 'razza', valore: 'Incantatore' } },
        { id: 'attr-acqua',      icona: '🌊', titolo: 'Solo mostri ACQUA',         filtro: { tipo: 'attributo', valore: 'ACQUA' } },
        { id: 'razza-macchina',  icona: '⚙️', titolo: 'Solo mostri Macchina',      filtro: { tipo: 'razza', valore: 'Macchina' } },
        { id: 'attr-fuoco',      icona: '🔥', titolo: 'Solo mostri FUOCO',         filtro: { tipo: 'attributo', valore: 'FUOCO' } },
        { id: 'razza-demone',    icona: '😈', titolo: 'Solo mostri Demone',        filtro: { tipo: 'razza', valore: 'Demone' } },
        { id: 'attr-vento',      icona: '🌪️', titolo: 'Solo mostri VENTO',         filtro: { tipo: 'attributo', valore: 'VENTO' } },
        { id: 'razza-zombie',    icona: '🧟', titolo: 'Solo mostri Zombie',        filtro: { tipo: 'razza', valore: 'Zombie' } },
        { id: 'liv-3',           icona: '🌿', titolo: 'Solo mostri fino al Livello 3', filtro: { tipo: 'livelloMax', valore: 3 } }
    ],
    /** Chi sfida questa settimana: stesso ragionamento delle regole (posto % lunghezza, con un passo diverso). */
    avversari: ['rex', 'weevil', 'mako', 'mai', 'joey', 'bandit_keith', 'bakura', 'arkana', 'strings', 'odion', 'lumis', 'umbra',
        'ishizu', 'espaRoba', 'duke', 'seeker', 'marik', 'pegasus', 'kaiba', 'noah'],
    /** Premio della PRIMA vittoria della settimana a ciascun livello (poi resta la vittoria normale). */
    premi: {
        Facile: { crediti: 300, stelle: 0 },
        Medio: { crediti: 600, stelle: 0 },
        Difficile: { crediti: 1000, stelle: 1 }
    }
};
window.settimanaDatabase = settimanaDatabase;
