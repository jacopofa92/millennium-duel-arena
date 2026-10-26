// Le modalita' del Multiplayer: UNA tabella sola, letta dal menu (index.html) e dalla sala (multiplayer.html).
//
// Dal menu si sceglie la modalita' e si arriva in sala con `multiplayer.html?modo=<id>`: la sala parte gia' con le regole di
// quella modalita' (e senza i selettori delle altre). Senza `modo` (vecchi collegamenti, test) la sala resta completa,
// con tutte le regole selezionabili.
// Il valore dentro `room-config` resta `specchio` / `raid` (campi gia' esistenti): questa tabella non cambia il protocollo.
window.MP_MODI = [
    {
        id: 'duello', nome: 'Duello', icona: 'duel',
        titolo: 'Duello Multiplayer',
        descrizione: 'Sfida un amico online, in tempo reale, ognuno con il proprio mazzo.'
    },
    {
        id: 'specchio', nome: 'Duello a Specchio', icona: 'rematch',
        titolo: 'Duello a Specchio',
        descrizione: 'Stesso mazzo per tutti e due: niente collezione, vince chi gioca meglio.'
    },
    {
        id: 'raid', nome: 'Assalto al Boss', icona: 'tower',
        titolo: 'Assalto al Boss',
        descrizione: 'Cooperativa: ognuno duella contro lo stesso Boss e i suoi Life Point sono in comune.'
    }
];
window.mpModo = function (id) {
    return window.MP_MODI.find((m) => m.id === id) || null;
};
