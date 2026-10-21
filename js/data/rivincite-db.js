// @ts-check
/**
 * rivincite-db.js — Le Rivincite: i duelli famosi dell'anime, giocati nei
 * panni di uno dei due duellanti e CON IL SUO MAZZO (rivincite.html).
 * =====================================================================
 * Solo dati. js/modes/rivincita-mode.js mette il mazzo del personaggio al
 * posto del tuo prima della prima pescata; l'avversario usa il suo mazzo
 * del livello scelto (Facile/Normale/Difficile), come in Duello Libero.
 * Il tuo mazzo prestato è sempre quello COMPLETO del personaggio (il
 * Difficile, cioè la sua lista canonica a piena potenza): il livello
 * scelto cambia solo l'avversario.
 *
 * COME SE NE AGGIUNGE UNA: giocatore e avversario sono id di
 * js/data/characters-db.js che abbiano i tre mazzi in character-decks.js;
 * `campo` è un file di images/fields/ (elenco in arena-options.js). Il
 * traguardo "tutte le Rivincite" delle Sfide (challenges-db.js) vale il
 * numero di voci qui sotto: aggiungendone, va alzato anche lì.
 *
 * Forma di ogni voce: `RivincitaDef` in types/modalita.d.ts.
 */
/** @type {RivincitaDef[]} */
const rivinciteDatabase = [
    {
        id: 'yugi-kaiba-inizio',
        titolo: 'Il duello che ha cominciato tutto',
        epoca: 'Domino City',
        giocatore: 'yamiYugi',
        avversario: 'kaiba',
        campo: 'industriaKaibaCorp.jpg',
        descrizione: 'Kaiba vuole il Drago Bianco del nonno, Yugi ha in mano i pezzi di Exodia. Gioca come Yami Yugi.'
    },
    {
        id: 'joey-rex',
        titolo: 'Il Drago Nero in palio',
        epoca: 'Regno dei Duellanti',
        giocatore: 'joey',
        avversario: 'rex',
        campo: 'arenaRegnoDeiDuellanti.jpg',
        descrizione: 'Il primo grande duello di Joey sull\'isola: chi vince si prende il Drago Nero Occhi Rossi. Gioca come Joey.'
    },
    {
        id: 'joey-mai',
        titolo: 'Il profumo delle Arpie',
        epoca: 'Regno dei Duellanti',
        giocatore: 'joey',
        avversario: 'mai',
        campo: 'arenaRegnoDeiDuellanti.jpg',
        descrizione: 'Mai sa sempre quale carta sta per giocare. Joey deve contare solo sul suo cuore. Gioca come Joey.'
    },
    {
        id: 'yugi-bakura',
        titolo: 'Il Gioco delle Ombre',
        epoca: 'Regno dei Duellanti',
        giocatore: 'yamiYugi',
        avversario: 'bakura',
        campo: 'rovineAntiche.jpg',
        descrizione: 'Lo spirito dell\'Anello del Millennio ha intrappolato gli amici di Yugi nelle carte. Gioca come Yami Yugi.'
    },
    {
        id: 'kaiba-pegasus',
        titolo: 'L\'Occhio contro il Drago',
        epoca: 'Castello di Pegasus',
        giocatore: 'kaiba',
        avversario: 'pegasus',
        campo: 'torreCastelloPegasus.jpg',
        descrizione: 'Kaiba deve salvare Mokuba, ma Pegasus legge ogni sua mossa con l\'Occhio del Millennio. Gioca come Kaiba.'
    },
    {
        id: 'yugi-pegasus',
        titolo: 'La finale del castello',
        epoca: 'Castello di Pegasus',
        giocatore: 'yamiYugi',
        avversario: 'pegasus',
        campo: 'arenaCastelloPegasus.jpg',
        descrizione: 'Il Mondo Toon contro il Mago Nero, per l\'anima del nonno. Gioca come Yami Yugi.'
    },
    {
        id: 'kaiba-ishizu',
        titolo: 'Contro la profezia',
        epoca: 'Battle City',
        giocatore: 'kaiba',
        avversario: 'ishizu',
        campo: 'torreDeiDuelli.jpg',
        descrizione: 'La Collana del Millennio ha già visto la sconfitta di Kaiba. A lui non importa del futuro. Gioca come Kaiba.'
    },
    {
        id: 'joey-marik',
        titolo: 'Il coraggio di Joey',
        epoca: 'Battle City',
        giocatore: 'joey',
        avversario: 'marik',
        campo: 'torreDeiDuelliColosseo.jpg',
        descrizione: 'Davanti al Drago Alato di Ra, Joey resiste in piedi più che può. Gioca come Joey.'
    },
    {
        id: 'yugi-kaiba-torre',
        titolo: 'Obelisk contro Slifer',
        epoca: 'Battle City',
        giocatore: 'yamiYugi',
        avversario: 'kaiba',
        campo: 'torreDeiDuelli.jpg',
        descrizione: 'In cima alla Torre dei Duelli, due Dei Egizi uno contro l\'altro. Gioca come Yami Yugi.'
    },
    {
        id: 'yugi-marik',
        titolo: 'La finale di Battle City',
        epoca: 'Battle City',
        giocatore: 'yamiYugi',
        avversario: 'marik',
        campo: 'torreDeiDuelliShadow.jpg',
        descrizione: 'Il Faraone contro il lato oscuro di Marik, in un Gioco delle Ombre. Gioca come Yami Yugi.'
    }
];

window.rivinciteDatabase = rivinciteDatabase;
