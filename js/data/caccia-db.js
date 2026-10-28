/**
 * caccia-db.js — La Caccia al Boss (caccia-boss.html): i Boss che ruotano e le
 * regole della caccia.
 * =====================================================================
 * Solo dati. Lo stato e la rotazione vivono in js/modes/caccia.js, la
 * preparazione del duello in js/modes/caccia-mode.js.
 *
 * Un Boss a settimana, lo stesso per tutti (posto = numero della settimana %
 * lunghezza). Il Boss gioca col suo mazzo Difficile ma parte con molti più Life
 * Point, e il giocatore ha un numero di TURNI suoi: finiti quelli senza aver
 * battuto il Boss la caccia è persa. Nessuna regola del motore cambia.
 *
 * PREMIO: la prima caccia vinta della settimana paga crediti e Stelle; se è
 * vinta con pochi turni c'è una Stella in più. Cacce successive: solo i premi
 * normali di un duello.
 */
const cacciaDatabase = {
    /** Life Point del Boss (il giocatore parte con quelli di sempre: 8000). */
    lpBoss: 12000,
    /** Quanti turni DEL GIOCATORE ha per vincere (il primo conta, anche se non si può attaccare). */
    turni: 8,
    livello: 'Difficile',
    premio: { crediti: 1500, stelle: 3, bonusVeloce: { entroTurni: 5, stelle: 1 } },
    /** I Boss, uno a settimana. `titolo` è la frase che li presenta. */
    boss: [
        { id: 'kaiba',     titolo: 'Il Presidente della KaibaCorp non ha mai perso senza una buona scusa.' },
        { id: 'pegasus',   titolo: 'L\'inventore del gioco vede ogni tua carta prima che tu la giochi.' },
        { id: 'marik',     titolo: 'Il Faraone Oscuro del Cairo ha un Dio dalla sua parte.' },
        { id: 'yamiYugi',  titolo: 'Il Re dei Giochi non è mai stato battuto in un duello vero.' },
        { id: 'heishin',   titolo: 'Il sacerdote che ha giocato con il tempo stesso.' },
        { id: 'nitemare',  titolo: 'Dalle ombre del Labirinto: attacca senza pietà.' },
        { id: 'bakura',    titolo: 'Il ladro di anime gioca con le tue carte come con la tua vita.' },
        { id: 'noah',      titolo: 'Un duellante senza corpo e con tutto il tempo del mondo.' },
        { id: 'gozaburo',  titolo: 'Ha costruito un impero sulla paura di perdere.' },
        { id: 'darkNite',  titolo: 'L\'ultima ombra di Forbidden Memories.' },
        { id: 'seeker',    titolo: 'Il Cercatore non lascia carte indietro.' },
        { id: 'lumis',     titolo: 'La luce che brucia chi la guarda troppo.' }
    ]
};
window.cacciaDatabase = cacciaDatabase;
