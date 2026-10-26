// Raid cooperativo (Multiplayer): i Boss tra cui l'host sceglie.
//
// `id` e' l'id di un Duellante di characters-db.js: il Boss gioca il suo mazzo a Difficile, come in Duello Libero.
// `lp` e' la barra COMUNE dei due giocatori (ognuno duella da solo contro il suo Boss, ma i danni si sommano).
// Per aggiungere un Boss basta una voce; i Life Point sono la leva di bilanciamento (due mazzi da 8000 a testa
// sono 16000: sotto quella cifra il Boss cade se i due giocatori colpiscono quasi quanto in un duello normale).
window.RAID_BOSSES = [
    { id: 'kaiba', lp: 16000 },
    { id: 'marik', lp: 16000 },
    { id: 'yamiYugi', lp: 18000 },
    { id: 'pegasus', lp: 18000 },
    { id: 'nitemare', lp: 20000 }
];
