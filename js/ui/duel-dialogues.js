/**
 * Battute contestuali dei duellanti. Il motore segnala soltanto l'evento;
 * personalità, probabilità, cooldown e presentazione restano qui.
 */
(function () {
    'use strict';

    const CHANCE = { battleStart: 1, victory: 1, attack: .32, turnStart: .38, damaged: .48, activate: .36 };
    const COOLDOWN_MS = 3400;

    const PROFILES = {
        hero: {
            battleStart: ['Duelliamo con onore!', 'Credo nel mio deck.', 'Che vinca il migliore!'],
            victory: ['È stato un grande duello.', 'La fiducia ci ha portati alla vittoria!', 'Le carte hanno risposto.'],
            attack: ['Avanti, attacca!', 'È il momento!', 'Mostrami la tua forza!'],
            turnStart: ['Tocca a me.', 'Pesco!', 'Il duello continua.'],
            damaged: ['Non è ancora finita.', 'Posso ancora combattere!', 'Un duro colpo...'],
            activate: ['Attivo la mia carta!', 'Ecco la mia strategia.', 'Avevo previsto questa mossa.']
        },
        proud: {
            battleStart: ['Non farmi perdere tempo.', 'Ti mostrerò la vera potenza.', 'La vittoria è già decisa.'],
            victory: ['Un risultato inevitabile.', 'Sei ancora troppo debole.', 'La potenza non si improvvisa.'],
            attack: ['Annientalo!', 'Attacca senza pietà!', 'Spazzalo via!'],
            turnStart: ['Ora osserva.', 'Il mio turno.', 'La vittoria si avvicina.'],
            damaged: ['Un colpo fortunato.', 'Non cambierà nulla.', 'Hai osato colpirmi?'],
            activate: ['La tua mossa era prevista.', 'Attivo questa carta!', 'Sei caduto nella mia strategia.']
        },
        dark: {
            battleStart: ['Benvenuto nelle ombre.', 'La paura sarà la tua rovina.', 'Questo duello reclama un prezzo.'],
            victory: ['Le ombre hanno scelto.', 'La tua luce si è spenta.', 'Ora appartieni all’oscurità.'],
            attack: ['Divora la sua speranza!', 'Nessuna pietà!', 'Trascinalo nelle tenebre!'],
            turnStart: ['Le ombre si muovono.', 'È giunta la tua fine.', 'Il destino gira dalla mia parte.'],
            damaged: ['Il dolore mi rende più forte.', 'Non temi abbastanza.', 'Un sacrificio trascurabile.'],
            activate: ['La trappola si chiude.', 'Invoco il potere oscuro.', 'Il tuo destino è segnato.']
        },
        trickster: {
            battleStart: ['Preparati a una sorpresa!', 'Vediamo se sai stare al gioco.', 'Le apparenze ingannano.'],
            victory: ['E il trucco è riuscito!', 'Non hai visto arrivare la fine.', 'Una partita deliziosa!'],
            attack: ['Sorprendilo!', 'Vai, adesso!', 'Facciamolo divertire!'],
            turnStart: ['Che carta interessante...', 'Ora viene il bello.', 'Ho un’idea.'],
            damaged: ['Oh, che scortesia!', 'Questa non l’avevo prevista.', 'Bel colpo, lo ammetto.'],
            activate: ['Sorpresa!', 'Guarda attentamente.', 'Ecco il mio asso nella manica.']
        },
        warrior: {
            battleStart: ['Affrontami a viso aperto!', 'Che inizi lo scontro!', 'Metti alla prova il mio valore.'],
            victory: ['Onore alla battaglia.', 'La disciplina ha prevalso.', 'Una vittoria meritata.'],
            attack: ['Carica!', 'Colpisci con forza!', 'All’assalto!'],
            turnStart: ['Riprendiamo lo scontro.', 'La mia mossa.', 'Manteniamo la posizione.'],
            damaged: ['Resisto!', 'Non spezzerai le mie linee.', 'È solo una ferita.'],
            activate: ['Cambio tattica!', 'È il momento della contromossa.', 'La strategia entra in azione.']
        },
        mystic: {
            battleStart: ['Il destino ci ha condotti qui.', 'Le antiche forze osservano.', 'Ogni carta ha un significato.'],
            victory: ['Il futuro si è compiuto.', 'Così era scritto.', 'L’equilibrio è ristabilito.'],
            attack: ['Compi il tuo destino!', 'Che il potere si manifesti!', 'Avanza!'],
            turnStart: ['Il fato cambia corso.', 'Ascolto la voce delle carte.', 'Il mio turno è giunto.'],
            damaged: ['Anche questo era previsto.', 'Il destino chiede un tributo.', 'La visione vacilla.'],
            activate: ['Le antiche arti rispondono.', 'Rivelo il sentiero nascosto.', 'Il sigillo si apre.']
        },
        wild: {
            battleStart: ['Ti travolgerò!', 'Facciamo sul serio!', 'Il mio deck ha fame!'],
            victory: ['Che duello bestiale!', 'Troppo forte per te!', 'Questa sì che è potenza!'],
            attack: ['Fallo a pezzi!', 'Scatenati!', 'A tutta forza!'],
            turnStart: ['Eccomi di nuovo!', 'Ora ruggiamo!', 'Tocca al più forte!'],
            damaged: ['Ehi, faceva male!', 'Non mi fermerai così!', 'Adesso mi hai fatto arrabbiare!'],
            activate: ['Prova a fermare questa!', 'Ecco il colpo a sorpresa!', 'Scateno la mia carta!']
        },
        cold: {
            battleStart: ['Procediamo.', 'Analizzerò ogni tua mossa.', 'Non commettere errori.'],
            victory: ['Come calcolato.', 'La logica ha prevalso.', 'Esito confermato.'],
            attack: ['Bersaglio acquisito.', 'Eliminalo.', 'Attacco autorizzato.'],
            turnStart: ['Nuovo calcolo.', 'È il mio turno.', 'Valuto le opzioni.'],
            damaged: ['Danno registrato.', 'Variabile imprevista.', 'Correggo la strategia.'],
            activate: ['Contromisura attiva.', 'Eseguo il piano.', 'Risposta calcolata.']
        }
    };

    const CHARACTER_PROFILE = {
        yugiMuto: 'hero', yamiYugi: 'mystic', joey: 'wild', tea: 'hero', tristan: 'hero', serenity: 'hero', solomonMuto: 'mystic',
        kaiba: 'proud', gozaburo: 'proud', priestSeto: 'proud', rex: 'wild', weevil: 'trickster', mako: 'warrior', panik: 'dark', bonz: 'dark',
        paradoxBrothers: 'mystic', mai: 'proud', bandit_keith: 'proud', pegasus: 'trickster', duke: 'trickster', espaRoba: 'mystic', arkana: 'dark',
        seeker: 'trickster', strings: 'cold', lumis: 'trickster', umbra: 'dark',
        bakura: 'dark', ishizu: 'mystic', odion: 'warrior', marik: 'dark', noah: 'cold', gansley: 'trickster', johnson: 'wild', nesbitt: 'warrior',
        crump: 'cold', lector: 'mystic', simonMuran: 'mystic', jono: 'warrior', teana: 'hero', shadi: 'mystic', priestessIsis: 'mystic', mageSoldier: 'warrior',
        oceanMage: 'mystic', highMageSecmeton: 'proud', forestMage: 'mystic', highMageAnubisius: 'dark', mountainMage: 'warrior', highMageAtenza: 'proud',
        desertMage: 'mystic', highMageMartis: 'dark', meadowMage: 'warrior', highMageKepura: 'proud', labyrinthMage: 'trickster', sebek: 'warrior', neku: 'cold',
        heishin: 'dark', darkNite: 'dark', nitemare: 'dark', mirror: 'cold', robertoGiacobbo: 'mystic',
        albertoAngela: 'mystic', alessandroBarbero: 'warrior',
        ww1_boroevic: 'warrior', ww1_conrad: 'cold', ww1_eugenio: 'warrior', ww1_brumowski: 'wild', ww1_arigi: 'wild', ww1_kaiserjager: 'warrior'
    };

    const PERSONAL = {
        kaiba: {
            battleStart: ['Preparati alla sconfitta!', 'Il tuo deck non può competere col mio.', 'Ti schiaccerò con la pura potenza!'],
            victory: ['Esattamente come previsto.', 'Nessuno supera Seto Kaiba.', 'Torna quando avrai un vero deck.']
        },
        yugiMuto: { battleStart: ['Giochiamo!', 'Mi fido del cuore delle carte.', 'Darò tutto me stesso!'] },
        yamiYugi: { battleStart: ['È tempo di duellare!', 'Il destino delle carte ci attende.', 'Mostrami la forza del tuo cuore.'] },
        joey: { battleStart: ['Ti farò vedere di che pasta sono fatto!', 'Andiamo, amico!', 'Joey Wheeler è pronto!'] },
        pegasus: { battleStart: ['Che il gioco cominci, caro duellante.', 'Mostrami il tuo cuore, se ne hai il coraggio.', 'Questo sarà molto divertente.'] },
        marik: { battleStart: ['Il Gioco delle Ombre ha inizio.', 'La tua sofferenza mi divertirà.', 'Non uscirai indenne da questo duello.'] },
        bakura: { battleStart: ['La tua anima sarà mia.', 'Giochiamo nelle tenebre.', 'Il tuo destino è già sigillato.'] },
        mai: { battleStart: ['Non sottovalutarmi.', 'Le mie Arpie sono pronte.', 'Vediamo quanto vali davvero.'] },
        seeker: {
            battleStart: ['La caccia alla tua carta rara comincia.', 'Il mio Exodia è già vicino.', 'Difenditi pure: io continuerò a pescare.'],
            victory: ['Exodia non lascia superstiti.', 'La tua carta rara ora è mia.', 'La caccia è conclusa.'],
            attack: ['Elimina quell’ostacolo!', 'La preda non può fuggire!', 'Attacca!'],
            turnStart: ['Un’altra carta per Exodia.', 'La prossima pescata deciderà tutto.', 'La caccia continua.'],
            damaged: ['Perderò punti, non la mia strategia.', 'Finché pesco, posso vincere.', 'Un colpo inutile.'],
            activate: ['Scarto il superfluo e pesco ancora.', 'Il mio deck mi consegnerà Exodia.', 'Accelero la caccia!']
        },
        strings: {
            battleStart: ['...', 'Il padrone muove i fili.', 'Slifer attende nel mio deck.'],
            victory: ['...', 'I fili non si sono spezzati.', 'Il Dio del Cielo ha deciso.'],
            attack: ['...', 'Avanza.', 'Colpisci.'],
            turnStart: ['Pesco.', 'La mano cresce.', 'Il ciclo continua.'],
            damaged: ['...', 'Il burattino non sente dolore.', 'Danno irrilevante.'],
            activate: ['Il ciclo della Melma è completo.', 'La combinazione continua.', 'Un altro filo si tende.']
        },
        lumis: {
            battleStart: ['La Maschera della Luce sigillerà i tuoi tributi.', 'Umbra non è qui, ma il nostro piano resta perfetto.', 'Dietro un sorriso si nasconde la tua sconfitta.'],
            victory: ['La luce della maschera ti ha accecato.', 'Il sigillo ha retto.', 'Una vittoria perfettamente orchestrata.'],
            attack: ['La maschera ordina: attacca!', 'Ora, senza esitazione!', 'Colpisci il punto scoperto!'],
            turnStart: ['La scena è di nuovo mia.', 'Preparo un altro sigillo.', 'La luce cambia il duello.'],
            damaged: ['Hai incrinato la maschera!', 'Non rovinare il piano!', 'Questo non era previsto.'],
            activate: ['Una nuova maschera entra in scena!', 'Sigillo la tua strategia.', 'La mia Magia ti indebolisce!']
        },
        umbra: {
            battleStart: ['L’oscurità dietro la maschera ti divorerà.', 'Senza Lumis farò tutto da solo.', 'La Bestia Mascherata reclama un sacrificio.'],
            victory: ['La maschera ha scelto la sua vittima.', 'Sei scomparso nell’ombra.', 'Il sacrificio è completo.'],
            attack: ['Bestia, annientalo!', 'Dall’ombra: attacca!', 'Schiaccialo!'],
            turnStart: ['L’ombra torna a muoversi.', 'È tempo di un altro sacrificio.', 'La maschera osserva.'],
            damaged: ['Pagherai questo affronto!', 'La mia ombra resiste.', 'Non hai ancora visto la Bestia.'],
            activate: ['La maledizione della maschera!', 'Il sigillo oscuro si chiude.', 'Offro i miei mostri alla Bestia!']
        },
        albertoAngela: {
            battleStart: ['Entriamo insieme nella storia.', 'Ogni carta custodisce un frammento del passato.', 'Oggi rivivremo la grandezza di Roma.'],
            victory: ['La storia premia chi sa comprenderla.', 'L\'Impero ha retto alla prova.', 'Un viaggio nel passato davvero memorabile.'],
            attack: ['Legione, avanzate!', 'La formazione si mette in marcia!', 'Roma non arretra!'],
            turnStart: ['Apriamo un nuovo capitolo.', 'Osserviamo con attenzione.', 'Il passato ha ancora molto da raccontare.'],
            damaged: ['Anche gli imperi conoscono battute d\'arresto.', 'Un colpo duro, ma istruttivo.', 'La legione mantiene la posizione.'],
            activate: ['Ricostruiamo la strategia.', 'Le fonti rivelano una nuova possibilità.', 'È il momento della manovra decisiva.']
        },
        alessandroBarbero: {
            battleStart: ['Vediamo come si combatte davvero una battaglia.', 'Schieriamo gli uomini e leggiamo il terreno.', 'La storia militare non ammette improvvisazioni.'],
            victory: ['La battaglia si è decisa nella preparazione.', 'Ecco perché la strategia conta.', 'Le cronache ricorderanno questo scontro.'],
            attack: ['Cavalieri, alla carica!', 'La linea avanza!', 'Colpite il fianco scoperto!'],
            turnStart: ['Riorganizziamo lo schieramento.', 'Adesso cambia il ritmo della battaglia.', 'È il momento di prendere l\'iniziativa.'],
            damaged: ['Una breccia, non una disfatta.', 'Le perdite fanno parte della battaglia.', 'Ricompattiamo le linee.'],
            activate: ['Ecco la manovra che cambia lo scontro.', 'La riserva entra in campo.', 'La tattica viene prima della forza.']
        }
    };

    const SPECIALS = {
        kaiba: { 'Drago Bianco Occhi Blu': 'Appari, Drago Bianco Occhi Blu! Distruggilo con il Flusso di Distruzione!', 'Drago Bianco Occhi Blu Finale': 'La creatura suprema è giunta! Drago Bianco Occhi Blu Finale!' },
        yugiMuto: { 'Mago Nero': 'Mago Nero, vieni in mio aiuto!', 'Kuriboh': 'Kuriboh, conto su di te!' },
        yamiYugi: { 'Mago Nero': 'Mago Nero, il mio più fedele servitore!', 'Il Drago Alato di Ra': 'Risvegliati, Drago Alato di Ra!' },
        joey: { 'Drago Nero Occhi Rossi': 'Vai, Drago Nero Occhi Rossi! Mostra il tuo potenziale!' },
        mai: { 'Signora Arpia': 'Signora Arpia, vola sul campo!' },
        pegasus: { 'Relinquished': 'Relinquished, assorbi il suo potere!' },
        marik: { 'Il Drago Alato di Ra': 'Ra! Incenerisci ogni speranza!' },
        seeker: { 'Testa Proibita': 'Un pezzo ancora... Exodia sarà completo!' },
        strings: { 'Slifer il Drago del Cielo': 'Slifer... il padrone ha tirato i fili.', 'Melma Rediviva': 'La Melma Rediviva tornerà ancora.' },
        lumis: { 'La Bestia Mascherata': 'La Maschera della Luce libera la Bestia!' },
        umbra: { 'La Bestia Mascherata': 'Sorgi dall’oscurità, Bestia Mascherata!' },
        albertoAngela: {
            'Gilford la Leggenda': 'Gilford la Leggenda: il comandante guida la legione!',
            'Gilford il Fulmine': 'Gilford il Fulmine: Roma scatena tutta la sua potenza!'
        },
        alessandroBarbero: {
            'Cavaliere del Re': 'Il Cavaliere del Re chiama a raccolta la corte!',
            'Cavaliere Joker Arcano': 'La corte è riunita: avanza, Cavaliere Joker Arcano!'
        }
    };

    const timers = { player: null, bot: null };
    const lastShown = { player: 0, bot: 0 };
    const lastIndex = {};

    function identity(owner) {
        if (!window.DuelSession) return { id: owner === 'bot' ? null : 'player', name: owner === 'bot' ? 'Bot' : 'Giocatore' };
        return owner === 'bot' ? DuelSession.opponent : DuelSession.player;
    }

    function characterId(owner) {
        const duelist = identity(owner) || {};
        if (duelist.id) return duelist.id;
        const byName = typeof characterDatabase !== 'undefined'
            ? characterDatabase.find((c) => c.name === duelist.name) : null;
        return byName ? byName.id : (owner === 'player' ? 'player' : null);
    }

    function linesFor(owner, context) {
        const id = characterId(owner);
        const profile = PROFILES[CHARACTER_PROFILE[id] || (owner === 'player' ? 'hero' : 'cold')] || PROFILES.hero;
        return (PERSONAL[id] && PERSONAL[id][context]) || profile[context] || [];
    }

    function pick(owner, context, lines) {
        if (!lines.length) return '';
        const key = owner + ':' + context;
        let index = Math.floor(Math.random() * lines.length);
        if (lines.length > 1 && index === lastIndex[key]) index = (index + 1) % lines.length;
        lastIndex[key] = index;
        return lines[index];
    }

    // La battuta è un sottotitolo: chi parla e cosa dice, su una fascia
    // scura che sfuma (vedi duel-dialogues.css). Costruito una volta per
    // lato e riusato: il testo cambia a ogni battuta.
    function bubble(owner) {
        const box = document.getElementById(owner === 'bot' ? 'botInfo' : 'playerInfo');
        if (!box) return null;
        let el = box.querySelector('.duel-speech');
        if (!el) {
            el = document.createElement('div');
            el.className = 'duel-speech duel-speech--' + owner;
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            el.innerHTML = '<span class="duel-speech__nome"></span>'
                + '<span class="duel-speech__testo"></span>';
            box.appendChild(el);
        }
        return el;
    }

    function show(owner, text, special) {
        const el = bubble(owner);
        if (!el || !text) return false;
        clearTimeout(timers[owner]);
        const durata = special ? 4100 : 3000;
        const duellante = identity(owner) || {};
        el.querySelector('.duel-speech__nome').textContent = duellante.name || (owner === 'bot' ? 'Avversario' : 'Tu');
        // Una parola per <span>, ciascuna col suo ritardo (--i): compaiono
        // una dopo l'altra, come se il personaggio stesse parlando. Testo
        // inserito con textContent parola per parola: niente HTML dalle
        // battute, che possono contenere nomi di carte qualsiasi.
        const testo = el.querySelector('.duel-speech__testo');
        testo.textContent = '';
        testo.setAttribute('aria-label', text);
        String(text).split(/\s+/).filter(Boolean).forEach((parola, i, tutte) => {
            const s = document.createElement('span');
            s.className = 'duel-speech__parola';
            s.style.setProperty('--i', i);
            s.setAttribute('aria-hidden', 'true');
            s.textContent = parola + (i < tutte.length - 1 ? ' ' : '');
            testo.appendChild(s);
        });
        el.classList.toggle('is-special', !!special);
        // Se il fumetto era già aperto (una battuta che ne sostituisce
        // un'altra) resta aperto: le parole nuove sono elementi nuovi, quindi
        // ricompaiono da sole una alla volta. Chiudere e riaprire il fumetto
        // lo farebbe sparire per un istante.
        if (!el.classList.contains('is-visible')) requestAnimationFrame(() => el.classList.add('is-visible'));
        lastShown[owner] = Date.now();
        timers[owner] = setTimeout(() => el.classList.remove('is-visible'), durata);
        return true;
    }

    function say(owner, context, options) {
        options = options || {};
        const forced = !!options.force;
        if (!forced && Math.random() > (CHANCE[context] == null ? .35 : CHANCE[context])) return false;
        if (!forced && Date.now() - lastShown[owner] < COOLDOWN_MS) return false;
        return show(owner, options.text || pick(owner, context, linesFor(owner, context)), !!options.special);
    }

    function summon(owner, card) {
        if (!card) return false;
        const id = characterId(owner);
        const text = SPECIALS[id] && SPECIALS[id][card.name];
        return text ? say(owner, 'summon', { force: true, special: true, text: text }) : false;
    }

    window.DuelDialogues = {
        say: say,
        summon: summon,
        battleStart: () => {
            say('bot', 'battleStart', { force: true });
            setTimeout(() => say('player', 'battleStart', { force: true }), 1250);
        },
        duelEnd: (playerWon) => {
            if (playerWon === 'draw') return;
            say(playerWon ? 'player' : 'bot', 'victory', { force: true });
        },
        _profiles: PROFILES,
        _assignments: CHARACTER_PROFILE,
        // Esposti per i guardrail del roster; il runtime usa le chiusure.
        _personal: PERSONAL,
        _specials: SPECIALS
    };
})();
