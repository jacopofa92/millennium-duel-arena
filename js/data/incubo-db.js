// Livello INCUBO dei Boss (Assalto al Boss in Multiplayer, "Contro un Boss" del Tag Team locale).
//
// Il Boss gioca il suo mazzo Difficile, ma "a copione": una mano sempre giocabile e, ogni tanto, la sua carta simbolo che
// entra in campo come EVENTO. Tutto sta in js/modes/incubo.js (niente cambia nel motore); qui solo i numeri e le scelte,
// per ritoccare il livello senza leggere il codice.
//
// `carte`: le carte dell'evento di ogni Boss (id di cards.json). Se sono piu' d'una, ne esce una (vedi `scelta`):
//   - 'caso'      : a sorte fra le carte elencate (Kaiba, Nitemare);
//   - 'conviene'  : Pegasus, Abbandono se l'avversario ha un mostro forte da assorbire, altrimenti il Drago Toon.
// `atk4000`: id con ATK fisso a 4000 per l'evento (Ra, senza pagare Life Point; Slifer li ha da se' con 4 carte in mano).
// `mano`: Slifer vale quanto le carte in mano: l'evento aspetta di averne almeno 4 e le tiene finche' resta in campo.
window.incuboDatabase = {
    nome: 'Incubo',
    // Probabilita' per turno DEL BOSS: la prima comparsa parte dal 3° turno con il 40% e sale del 10% a ogni turno;
    // dopo che la carta e' stata distrutta la seconda parte dal 10% (e sale del 10% a turno). Poi basta.
    primoTurno: 3,
    probPrima: 0.4,
    probRipresa: 0.1,
    passo: 0.1,
    // Quante comparse al massimo per OGNI giocatore che il Boss ha davanti (2 in solitaria, 4 contro due).
    comparsePerGiocatore: 2,
    // Mano bilanciata: quante volte su cento si lascia la mano com'e' (una mano un po' storta ogni tanto ci sta).
    sbagliaPercento: 8,
    // Premi: +25% su crediti e Stelle, e 1 Carta Locazione + 1 Carta del Millennio, una volta al giorno.
    bonusPremi: 0.25,
    boss: {
        yamiYugi: { carte: [31], scelta: 'caso', mano: 4 },
        kaiba: { carte: [29, 30], scelta: 'caso' },          // Drago Occhi Blu Finale / Obelisk il Tormentatore
        marik: { carte: [472], scelta: 'caso', atk4000: [472] },
        pegasus: { carte: [123, 416], scelta: 'conviene' },  // Drago Toon Occhi Blu / Abbandono
        nitemare: { carte: [1126, 102], scelta: 'caso' }     // Drago Nero Meteora / Drago Teschio Nero
    }
};
