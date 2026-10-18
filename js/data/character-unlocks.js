// @ts-check
/**
 * character-unlocks.js — quali Duellanti si possono sfidare in Duello
 * Libero, e come si guadagnano gli altri.
 * =====================================================================
 * All'inizio se ne hanno due: Yugi Muto e suo nonno Solomon. Tutti gli
 * altri si sbloccano SCONFIGGENDOLI per la prima volta in un Torneo o
 * nella Modalità Storia.
 *
 * Il senso della regola: il Duello Libero è la palestra, e ci si porta
 * dentro gli avversari che si sono già affrontati per davvero. Senza,
 * l'intero roster è disponibile dal primo minuto e la Storia non dà
 * nulla che non si potesse già avere.
 *
 * COSA NON FA, di proposito: non tocca in alcun modo chi si incontra nei
 * Tornei e nella Storia. Lì gli avversari li decide il percorso, e
 * bloccarli renderebbe impossibile sbloccarli — sarebbe una porta chiusa
 * a chiave dall'interno. Il blocco vale SOLO per la scelta libera
 * dell'avversario.
 *
 * L'AMMINISTRATORE NE È FUORI: `attivo()` torna false per lui, quindi
 * vede e sfida chiunque senza dover prima vincere ventisei duelli — è la
 * stessa logica dell'autowin di collaudo (js/dev/test-shortcuts.js), ma
 * qui non serve nemmeno un interruttore: non c'è niente da collaudare,
 * solo un elenco da non doversi guadagnare ogni volta che si riparte da
 * un salvataggio pulito.
 *
 * DOVE SI SBLOCCA: in un punto solo, DuelSession.finish()
 * (js/duel-session.js), che è l'unico posto da cui passa la fine di ogni
 * duello di ogni modalità. Una modalità futura che voglia sbloccare
 * personaggi non deve aggiungere codice: le basta dichiararsi come
 * Torneo o Storia.
 */
(function () {
    'use strict';

    /**
     * I due di partenza. Sono nel codice e non nel salvataggio perché
     * sono una REGOLA del gioco, non un progresso: scriverli nel
     * salvataggio vorrebbe dire che un salvataggio vecchio (creato prima
     * che questa regola esistesse) resta senza, e si ritroverebbe il
     * Duello Libero completamente vuoto.
     */
    const INIZIALI = ['yugiMuto', 'solomonMuto'];

    // Ospiti della sezione Extra che non appartengono a un percorso Storia
    // o Torneo: devono poter essere sfidati subito, altrimenti non esisterebbe
    // alcun modo legittimo per guadagnarne lo sblocco.
    const EXTRA_DISPONIBILI = ['albertoAngela', 'alessandroBarbero'];

    /**
     * Le modalità in cui una vittoria vale uno sblocco. Elenco e non
     * "tutto tranne il Duello Libero": una modalità nuova non deve
     * diventare una via di sblocco per distrazione, deve chiederlo.
     */
    const MODALITA_CHE_SBLOCCANO = ['tournament', 'story'];

    function sonoAdmin() {
        return !!(window.CloudSync && typeof CloudSync.isAdmin === 'function' && CloudSync.isAdmin());
    }

    /** Falso se il blocco non si applica affatto (amministratore). */
    function attivo() {
        return !sonoAdmin();
    }

    function sbloccatiSalvati() {
        if (!window.SaveManager || typeof SaveManager.getUnlockedCharacters !== 'function') return [];
        return SaveManager.getUnlockedCharacters();
    }

    function sbloccato(characterId) {
        if (!characterId) return true;
        if (!attivo()) return true;
        if (INIZIALI.indexOf(characterId) !== -1) return true;
        if (EXTRA_DISPONIBILI.indexOf(characterId) !== -1) return true;
        return sbloccatiSalvati().indexOf(characterId) !== -1;
    }

    /**
     * Segna un personaggio come sbloccato. Torna true SOLO se è la prima
     * volta, così chi chiama può annunciarlo ("Nuovo Duellante!") senza
     * doversi ricordare com'era prima.
     *
     * Si scrive nel salvataggio anche per un amministratore: `attivo()`
     * riguarda cosa si PUÒ sfidare, non cosa si è fatto — se un giorno
     * quell'account smette di essere amministratore deve ritrovarsi i
     * personaggi che ha davvero battuto, non ripartire da due.
     */
    function sblocca(characterId) {
        if (!characterId || INIZIALI.indexOf(characterId) !== -1) return false;
        if (!window.SaveManager || typeof SaveManager.unlockCharacter !== 'function') return false;
        if (sbloccatiSalvati().indexOf(characterId) !== -1) return false;
        SaveManager.unlockCharacter(characterId);
        return true;
    }

    /** Vero se una vittoria in questa modalità vale uno sblocco. */
    function modalitaSblocca(mode) {
        return MODALITA_CHE_SBLOCCANO.indexOf(mode) !== -1;
    }

    /**
     * DOVE si incontra ogni Duellante, per dire sulla sua carta bloccata
     * dove andarlo a battere invece di un generico "in un Torneo o nella
     * Storia" (richiesta dell'utente).
     *
     * I tornei: gli elenchi vivono dentro le pagine dei tornei
     * (torneo-regno-duellanti.html, torneo-battle-city.html), qui ne sta
     * una COPIA. tests/specs/sblocco-duellanti-luoghi.spec.js la confronta
     * con quelle pagine, così una modifica a uno dei due lati non resta
     * scollegata. Il Torneo Kaiba non ha un elenco: sorteggia fra tutti i
     * Duellanti della serie principale e di Forbidden Memories (vedi
     * challengerPool in torneo-kaiba.html), quindi qui c'è la stessa regola.
     */
    const TORNEI = [
        {
            nome: 'Regno dei Duellanti',
            // Gli incontri sull'isola, più Kaiba al Cancello e Pegasus al
            // Castello.
            avversari: ['rex', 'weevil', 'mako', 'panik', 'bonz', 'paradoxBrothers', 'mai', 'bandit_keith', 'kaiba', 'pegasus']
        },
        {
            nome: 'Battle City',
            // Preliminari, Ghoul di Marik e i due finalisti.
            avversari: ['rex', 'weevil', 'mako', 'espaRoba', 'duke', 'mai', 'joey', 'bakura',
                'arkana', 'bandit_keith', 'odion', 'seeker', 'strings', 'lumis', 'umbra',
                'kaiba', 'marik']
        },
        {
            nome: 'Torneo Kaiba',
            regola: (c) => !!c && ['main', 'forbiddenMemories'].indexOf(c.series) !== -1 && c.id !== 'mirror'
        }
    ];

    /**
     * Le campagne della Storia in cui c'è un duello contro `id`, lette dal
     * catalogo vero (js/data/story-campaigns.js, con i ritocchi
     * dell'Editor Mappa già applicati) se la pagina l'ha caricato. Una
     * visita generica: i duelli stanno annidati dentro capitoli, aree e
     * tornei, e qualunque nodo `kind: 'duel'` con un `characterId` conta.
     */
    let storieCache = null;
    function storiePer(id) {
        const catalogo = typeof storyCampaignsDatabase !== 'undefined' ? storyCampaignsDatabase : null;
        if (!catalogo) return [];
        if (!storieCache) {
            storieCache = {};
            const visita = (nodo, campagna) => {
                if (!nodo || typeof nodo !== 'object') return;
                if (Array.isArray(nodo)) { nodo.forEach((n) => visita(n, campagna)); return; }
                if (nodo.kind === 'duel' && nodo.characterId) {
                    const elenco = storieCache[nodo.characterId] || (storieCache[nodo.characterId] = []);
                    if (elenco.indexOf(campagna) === -1) elenco.push(campagna);
                }
                Object.keys(nodo).forEach((k) => { if (nodo[k] && typeof nodo[k] === 'object') visita(nodo[k], campagna); });
            };
            catalogo.forEach((c) => visita(c, c.nome || c.id));
        }
        return storieCache[id] || [];
    }

    /**
     * I luoghi (nomi leggibili) in cui una vittoria contro `character` lo
     * sblocca. Prima le strade SICURE — la Storia, poi i tornei con un
     * elenco fisso — e per ultimo il Torneo Kaiba, che gli avversari li
     * sorteggia: la carta mostra solo il primo luogo, e deve essere uno in
     * cui lo si incontra di sicuro.
     */
    function doveSiSblocca(character) {
        if (!character) return [];
        const luoghi = storiePer(character.id).map((nome) => 'Storia: ' + nome);
        TORNEI.filter((t) => t.avversari && t.avversari.indexOf(character.id) !== -1).forEach((t) => luoghi.push(t.nome));
        TORNEI.filter((t) => t.regola && t.regola(character)).forEach((t) => luoghi.push(t.nome + ' (a sorteggio)'));
        return luoghi;
    }

    /**
     * La frase da mostrare a chi tocca un Duellante ancora bloccato.
     * Sta qui e non nelle due copie del Duello Libero (la pagina a sé e
     * la vista dentro index.html) perché quelle due sono già andate alla
     * deriva in passato, ed è esattamente il genere di testo che finisce
     * per essere diverso nei due posti.
     */
    function comeSbloccare(character) {
        const nome = (character && character.name) || 'Questo Duellante';
        // "si sblocca con una vittoria" e non "sconfiggendolo": nel roster
        // ci sono Duellanti donna (Téa, Mai, Ishizu...) e perfino una voce
        // al plurale (i Fratelli Paradosso), quindi qualunque pronome o
        // participio concordato sarebbe sbagliato per qualcuno. Una frase
        // senza concordanza è giusta per tutti e non chiede al dato dei
        // personaggi un campo "genere" che non ha motivo di esistere.
        const luoghi = doveSiSblocca(character);
        if (luoghi.length === 0) return nome + ' si sblocca con una vittoria in un Torneo o nella Modalità Storia.';
        return nome + ' si sblocca con una vittoria in: ' + luoghi.join(', ') + '.';
    }

    window.CharacterUnlocks = {
        INIZIALI: INIZIALI.slice(),
        EXTRA_DISPONIBILI: EXTRA_DISPONIBILI.slice(),
        attivo: attivo,
        sbloccato: sbloccato,
        sblocca: sblocca,
        modalitaSblocca: modalitaSblocca,
        comeSbloccare: comeSbloccare,
        doveSiSblocca: doveSiSblocca,
        TORNEI: TORNEI
    };
})();
