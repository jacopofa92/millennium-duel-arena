// Il Terreno si aggiorna riusando i nodi rimasti uguali, e il risultato
// resta IDENTICO a quello di una ricostruzione totale.
// =====================================================================
// renderFields() svuotava i due contenitori (`innerHTML = ''`) e
// riattaccava tutto ad ogni updateUI(), circa una volta al secondo:
// misurato su un duello vero, NESSUNO dei 2115 nodi del Terreno
// sopravviveva a un render, immagini comprese, mentre solo il 7% delle
// caselle era davvero cambiato.
//
// La parte pericolosa di riusare i nodi è mostrare uno stato VECCHIO.
// Per questo la decisione "posso riusare questa casella?" si prende
// confrontando l'HTML appena costruito con quello a schermo, non una
// lista di campi scritta a mano: qualunque cosa cambi nel disegno di una
// casella cambia anche il suo HTML. Questo test tiene ferma proprio
// quella proprietà, su tanti stati di campo diversi.
//
// NOTA su come è scritto: prima di ogni confronto si fa un render "di
// assestamento". createSlotElement aggiunge la classe di animazione
// pile-receive quando il conteggio di una pila è CRESCIUTO dall'ultimo
// render, quindi la prima e la seconda chiamata differiscono di diritto
// — senza quel giro a vuoto il test boccerebbe una differenza legittima
// invece di un errore di riconciliazione (all'inizio lo faceva).
module.exports = {
    name: 'Terreno: aggiornamento incrementale identico alla ricostruzione totale',
    async run(t) {
        const esito = await t.evaluate(() => {
            // Confronta lo stato di render, non le classi asincrone di
            // pittura (immagine caricata/nome compresso) che possono
            // legittimamente differire fra due frame consecutivi.
            const board = () => firmaRenderStabile(document.getElementById('playerFieldBoard'))
                + '||' + firmaRenderStabile(document.getElementById('botFieldBoard'));

            const mostri = cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck).slice(0, 40);
            const magie = cardDatabase.filter((c) => c.type !== 'monster').slice(0, 40);
            // Generatore con seme fisso: gli stati sono vari ma sempre gli
            // stessi ad ogni esecuzione, così un fallimento è ripetibile.
            let seme = 12345;
            const rnd = () => { seme = (seme * 1103515245 + 12345) & 0x7fffffff; return seme / 0x7fffffff; };
            const scegli = (a) => a[Math.floor(rnd() * a.length)];

            const statoACaso = (n) => {
                const campoM = (lato) => Array.from({ length: 5 }, (_, i) => {
                    if (rnd() < 0.45) return null;
                    const c = Object.assign({}, scegli(mostri), { uid: `${lato}m${n}_${i}` });
                    if (rnd() < 0.25) c.counters = 1 + Math.floor(rnd() * 3);
                    return { card: c, position: rnd() < 0.5 ? 'attack' : 'defense', isFaceDown: rnd() < 0.35, hasAttacked: rnd() < 0.3, canChangePosition: true };
                });
                const campoST = (lato) => Array.from({ length: 5 }, (_, i) => {
                    if (rnd() < 0.6) return null;
                    return { card: Object.assign({}, scegli(magie), { uid: `${lato}s${n}_${i}` }), isFaceDown: rnd() < 0.5, setOnTurn: 0 };
                });
                gameState.playerMonsterField = campoM('p');
                gameState.botMonsterField = campoM('b');
                gameState.playerSTField = campoST('p');
                gameState.botSTField = campoST('b');
                gameState.playerFieldSpell = rnd() < 0.4
                    ? { card: Object.assign({}, scegli(magie), { uid: `pf${n}` }), isFaceDown: rnd() < 0.5 } : null;
                gameState.phase = rnd() < 0.5 ? 'battle' : 'main1';
                gameState.playerGraveyard.length = Math.floor(rnd() * 4);
            };

            // L'alone delle carte giocabili (evidenzia-giocabili.js) si aggiunge ai nodi VIVI dopo il ridisegno: qui si chiama
            // renderFields() da solo (senza il passo dell'alone), quindi si spegne il modulo e si tolgono le sue classi, che
            // altrimenti resterebbero nel DOM incrementale e non in quello ricostruito da zero.
            window.EvidenziaGiocabili = null;
            document.querySelectorAll('.slot-libera').forEach((e) => e.classList.remove('slot-libera'));
            document.querySelectorAll('.glow-giocabile').forEach((e) => e.classList.remove('glow-giocabile', 'glow-bianco', 'glow-verde', 'glow-attacco'));
            let diversi = 0;
            let primaDifferenza = null;
            const STATI = 40;
            for (let n = 0; n < STATI; n++) {
                statoACaso(n);
                renderFields();                 // assestamento
                renderFields();                 // incrementale
                const incrementale = board();
                // Svuotando i contenitori, riconciliaBoard prende da sola
                // la via "rifai tutto": è la ricostruzione di riferimento.
                document.getElementById('playerFieldBoard').innerHTML = '';
                document.getElementById('botFieldBoard').innerHTML = '';
                renderFields();
                const totale = board();
                if (incrementale !== totale) {
                    diversi++;
                    if (!primaDifferenza) {
                        let at = 0;
                        while (at < incrementale.length && incrementale[at] === totale[at]) at++;
                        primaDifferenza = { stato: n, at, incrementale: incrementale.slice(at, at + 180), totale: totale.slice(at, at + 180) };
                    }
                }
            }

            // Un campo che non cambia non deve ricreare i propri nodi.
            statoACaso(999);
            renderFields(); renderFields();
            document.querySelectorAll('.field-slot').forEach((s, i) => { s.__marchio = 'm' + i; });
            const prima = [...document.querySelectorAll('.field-slot')].map((s) => s.__marchio);
            for (let i = 0; i < 6; i++) renderFields();
            const dopo = [...document.querySelectorAll('.field-slot')].map((s) => s.__marchio);
            const sopravvissuti = dopo.filter((m, i) => m && m === prima[i]).length;

            // Le carte vere conservano i gestori (l'HTML non li racconta,
            // vanno ricopiati a mano: se qualcuno aggiunge un quarto
            // gestore e dimentica di elencarlo, questo se ne accorge).
            const carteVere = [...document.querySelectorAll('.field-slot .card')]
                .filter((c) => !c.closest('.special-slot'));
            const senzaClick = carteVere.filter((c) => typeof c.onclick !== 'function').length;

            // E un click vero su un nodo riusato deve consegnare al gioco
            // la carta GIUSTA, non una vecchia rimasta in una chiusura.
            let consegnata = null;
            const indicePieno = gameState.playerMonsterField.findIndex((s) => s);
            if (indicePieno !== -1) {
                const sel = `#playerFieldBoard .field-slot[data-type="monster"][data-index="${indicePieno}"] .card`;
                const originale = window.handleCardClick;
                window.handleCardClick = function (card) { consegnata = card && card.uid; };
                document.querySelector(sel).click();
                window.handleCardClick = originale;
            }
            const attesa = indicePieno === -1 ? null : gameState.playerMonsterField[indicePieno].card.uid;

            // Una casella che CAMBIA dev'essere sostituita davvero,
            // altrimenti resterebbe a schermo uno stato vecchio.
            let sostituita = null;
            if (indicePieno !== -1) {
                const sel = `#playerFieldBoard .field-slot[data-type="monster"][data-index="${indicePieno}"]`;
                document.querySelector(sel).__marchio = 'DA_CAMBIARE';
                const slot = gameState.playerMonsterField[indicePieno];
                slot.isFaceDown = false;
                slot.position = slot.position === 'attack' ? 'defense' : 'attack';
                renderFields();
                sostituita = document.querySelector(sel).__marchio !== 'DA_CAMBIARE';
            }

            return { STATI, diversi, primaDifferenza, caselle: dopo.length, sopravvissuti, carteVere: carteVere.length, senzaClick, consegnata, attesa, sostituita };
        });

        t.assert(esito.diversi === 0,
            `Su ${esito.STATI} stati di campo, ${esito.diversi} hanno prodotto un DOM diverso da quello della ricostruzione totale: ${JSON.stringify(esito.primaDifferenza)}`);

        // Una sola casella può legittimamente cambiare per via
        // dell'animazione delle pile, il resto deve restare in piedi.
        t.assert(esito.sopravvissuti >= esito.caselle - 1,
            `A campo fermo le caselle devono conservare il proprio nodo: ne sono sopravvissute ${esito.sopravvissuti} su ${esito.caselle}`);

        t.assert(esito.carteVere > 0 && esito.senzaClick === 0,
            `Ogni carta vera sul Terreno deve conservare il gestore di click dopo la riconciliazione (${esito.senzaClick} su ${esito.carteVere} senza)`);

        t.assert(esito.consegnata === esito.attesa,
            `Un click su un nodo riusato deve consegnare la carta che è davvero in quella casella (consegnata "${esito.consegnata}", attesa "${esito.attesa}")`);

        t.assert(esito.sostituita === true,
            'Una casella il cui contenuto cambia deve essere sostituita, non riusata');

        // Le modifiche che arrivano DOPO il render (immagine decodificata,
        // compressione del titolo, classi di un FX) non sono stato di gioco.
        // Prima venivano confrontate tramite outerHTML vivo e facevano
        // ricreare sempre più carte man mano che il campo si riempiva.
        const stabilitaPittura = await t.evaluate(async () => {
            const copia = (id, uid) => Object.assign({}, cardDatabase.find((c) => c.id === id), { uid });
            gameState.playerMonsterField = [{ card: copia(1, 'stabile-campo'), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true }, null, null, null, null];
            gameState.playerSTField = [null, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.botSTField = [null, null, null, null, null];
            gameState.playerHand = [copia(2, 'stabile-mano')];
            renderFields();
            renderPlayerHand();
            await new Promise((resolve) => setTimeout(resolve, 100));
            // Un secondo giro assesta l'eventuale stato sincrono della cache immagini.
            renderFields();
            renderPlayerHand();
            const campo = document.querySelector('[data-uid="stabile-campo"]');
            const mano = document.querySelector('[data-uid="stabile-mano"]');
            campo.classList.add('fx-summon-glow');
            mano.classList.add('has-image');
            const nomeCampo = campo.querySelector('.card-name-text');
            if (nomeCampo) nomeCampo.style.transform = 'scaleX(0.73)';
            renderFields();
            renderPlayerHand();
            return {
                campoPreservato: document.querySelector('[data-uid="stabile-campo"]') === campo,
                manoPreservata: document.querySelector('[data-uid="stabile-mano"]') === mano
            };
        });
        t.assert(stabilitaPittura.campoPreservato, 'Una classe FX o la compressione del nome non deve ricreare la carta sul Terreno');
        t.assert(stabilitaPittura.manoPreservata, 'Il caricamento dell\'immagine non deve ricreare la carta in mano');
    }
};
