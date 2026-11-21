# Cernita degli effetti: generici o Yu-Gi-Oh only

Generato da `node tools/cernita-effetti.js` (non modificare a mano: si rigenera). Dati carta per carta: `docs/planning/cernita-effetti.json`.
Verifica per esecuzione: `node tools/cernita-effetti.js --verifica` (scrive `CERNITA_EFFETTI_VERIFICA.md`).

## A cosa serve
Per il clone del gioco con un altro tema: le carte **Yu-Gi-Oh only** non si portano, e dal **bacino** degli effetti generici si generano
carte di qualunque tema. Una carta e' "Yu-Gi-Oh only" se il suo effetto punta a un **id** di un'altra carta, a un **nome** di carta,
a un archetipo o ai materiali di una Fusione. Un riferimento a se stessa non la rende Yu-Gi-Oh only, ma va corretto (gruppo D).

## Risultato (832 carte con un effetto reale)
| Gruppo | Carte | Per tipo |
|---|---|---|
| **A** generico puro | 408 | mostri: 220, Magie: 104, Trappole: 84 |
| **B** generico, con Tipo/Attributo come parametro | 131 | mostri: 73, Magie: 44, Trappole: 14 |
| **M** meccanica propria senza nomi (Spirit, Contatori Magia, Toon, Union) | 18 | mostri: 17, Trappole: 1 |
| **D** generico ma con il PROPRIO id scritto nel codice (si ripara sostituendo il numero con ctx.card.id) | 0 |  |
| **C3** Yu-Gi-Oh only dal motore/IA (la carta e' pulita, ma il motore o l'IA la nomina per id o nome) | 32 | mostri: 16, Magie: 9, Trappole: 7 |
| **C2** Yu-Gi-Oh only probabile (il testo cita carte per nome) | 69 | mostri: 57, Magie: 7, Trappole: 5 |
| **C1** Yu-Gi-Oh only certo (id o nomi nel codice, materiali di Fusione) | 174 | mostri: 103, Magie: 59, Trappole: 12 |

**Bacino riusabile subito (A + B): 539 carte, il 65%.**

Forme del bacino: reattivo - mostro: 187, solo attivazione - spell: 88, solo attivazione - mostro: 69, solo attivazione - trap: 49, passivo - spell: 40, reattivo - trap: 38, passivo - mostro: 37, reattivo - spell: 20, passivo - trap: 11.

Ganci piu' usati nel bacino: onFlip 47, onDestroy 38, onSummon 25, onStandbyPhase 22, onAttackDeclare 21, onDealsBattleDamage 14, onEndPhase 10, onCardEffectTargetDeclare 8, onSTDestroyed 8, onSpecialSummon 8, onOpponentSummon 7, onBattled 7, onSentToGraveyardFromHand 6, onOwnAttackDeclare 5.

## Come e' stata fatta (e i suoi limiti)
La classificazione **legge il codice** di ogni definizione (`function.toString()`): id numerici confrontati con `.id`, confronti e ricerche
sul nome, chiavi come `mentionsNames`/`archetypes`/`fusionMaterials`. Non puo' vedere una dipendenza **nascosta** (una funzione
condivisa, un flag impostato da un'altra carta). Per questo esiste `--verifica`, che il bacino lo **esegue** in un mondo senza
le carte Yu-Gi-Oh only e con id e nomi travestiti.

Il gruppo **B** e' generico solo se il Tipo/Attributo diventa un parametro: oggi il codice confronta con stringhe fisse come `'Drago'`.
Il gruppo **D** si ripara con una sostituzione banale e poi entra nel bacino.
Il gruppo **C3** nasce dal controllo al contrario (motore, IA e js/data/cards-db.js): un numero in un array puo' essere un valore e non un id, quindi va riletto a mano.
Il gruppo **C2** e' una stima dal testo (alcune carte potrebbero essere generiche con un nome decorativo, per esempio un gettone): va rivisto a mano.

## Carte "pulite" ma con il proprio id nel codice (gruppo D)
Vanno bene per qualunque tema **dopo** aver sostituito il numero con ctx.card.id; senza, un controllo come slot.card.id !== 426 smette di funzionare appena la carta ha un id diverso.
(nessuna)

## Carte "pulite" che il motore o l'IA nominano (gruppo C3)
- 8 Spada Rivelatrice: js/engine/duel-engine.js: const spade = stFieldOf(controller).filter((slot) => slot && !slot.isFaceDown && slot.card.id === 8); | js/engine/fasi.js: if (slot.card.id === 8 && gameState.revealedSwordsLanded) {
- 30 Obelisk il Tormentatore: js/engine/duel-engine.js: && (card.race === 'Essere Divino' || card.id === 30 || card.id === 31 || card.id === 472 || card.id === 1275 | | js/engine/duel-engine.js: && (card.race === 'Essere Divino' || card.id === 30 || card.id === 31 || card.id === 472 || card.id === 1275 |
- 31 Slifer il Drago del Cielo: js/engine/duel-engine.js: && (card.race === 'Essere Divino' || card.id === 30 || card.id === 31 || card.id === 472 || card.id === 1275 | | js/engine/duel-engine.js: && (card.race === 'Essere Divino' || card.id === 30 || card.id === 31 || card.id === 472 || card.id === 1275 |
- 36 Anfora dell'Avidità: js/ai/ai-hard.js: && (scelta.action === 'set' || scelta.card.id !== 36)) return null;
- 134 Soffio Incendiario: js/ai/ai-shared.js: if (!link || !link.card || link.card.id !== 134) return null;
- 136 Richiamo del Posseduto: js/engine/game-flow.js: && stSlot.card.id === 136
- 204 Sdoppiatore: js/engine/duel-engine.js: const hasSosia = stFieldOf(owner).some((s) => s && !s.isFaceDown && s.card.id === 204);
- 267 Gilford il Fulmine: js/data/cards-db.js: if (card.id === 30 || card.id === 31 || card.id === 472 || card.id === 1275 || card.id === 267) return 3;
- 307 Carte Infinite: js/engine/fasi.js: const hasInfiniteCards = (gameState[stKey] || []).some((s) => s && !s.isFaceDown && s.card.id === 307);
- 353 Signore di D.: js/ai/ai-hard.js: if (card.id === 353 && hasFlutePlan) return 7000;
- 439 Magia Ombra: js/engine/game-flow.js: && stSlot.card.id === 439
- 456 Tela del Ragno: js/engine/battaglia.js: return fs && !fs.isFaceDown && fs.card.id === 456;
- 472 Il Drago Alato di Ra: js/engine/actions.js: if (card.id !== 472 || gameState.playerLP <= 100) { proceed(); return; } | js/engine/duel-engine.js: && (card.race === 'Essere Divino' || card.id === 30 || card.id === 31 || card.id === 472 || card.id === 1275 |
- 485 Ritorno Toon: js/engine/card-effects.js: return !!(card.name && card.name.startsWith('Lady Arpia') && !card.name.includes('Toon'));
- 487 Mondo Toon: js/engine/card-effects.js: return !!(card.name && card.name.startsWith('Lady Arpia') && !card.name.includes('Toon')); | js/engine/duel-engine.js: return stFieldOf(owner).find((slot) => slot && !slot.isFaceDown && slot.card.id === 487) || null;
- 497 Umi: js/engine/battaglia.js: return fs && !fs.isFaceDown && fs.card.id === 497;
- 559 Ultima Offerta: js/ai/ai-hard.js: const offerIndex = st.findIndex((slot, index) => slot && slot.card.id === 559
- 620 Cerchio Incantatore: js/engine/game-flow.js: && !stSlot.isFaceDown && stSlot.card.id === 620 && stSlot.card.targetUid === slot.card.uid));
- 767 Canyon: js/engine/battaglia.js: .some((fs) => fs && !fs.isFaceDown && fs.card.id === 767);
- 772 Simorgh, Volatile della Divinità: js/engine/actions.js: if (card.id === 772 && slot.card.attribute !== 'VENTO') return sum; | js/engine/actions.js: if (pending.card.id === 772 && slot.card.attribute !== 'VENTO' && !pending.selected.includes(index)) {
- 773 Proiettile Sonico: js/engine/battaglia.js: const originalCard = attacker.id === 773 && cardDatabase.find((card) => card.id === attacker.id);
- 810 Pillola dell'Evoluzione Gigante: js/engine/actions.js: const hasEvolutionPill = gameState.playerSTField.some((s) => s && !s.isFaceDown && s.card.id === 810);
- 824 Drago Gadjiltron-Ingranaggio Antico: js/engine/actions.js: if (gearCastleIndex !== -1 && card.name.includes('Ingranaggio Antico')) {
- 825 Chimera Gadjiltron-Ingranaggio Antico: js/engine/actions.js: if (gearCastleIndex !== -1 && card.name.includes('Ingranaggio Antico')) {
- 826 Ingegnere-Ingranaggio Antico: js/engine/actions.js: if (gearCastleIndex !== -1 && card.name.includes('Ingranaggio Antico')) {
- 832 Golem-Ingranaggio Antico: js/engine/actions.js: if (gearCastleIndex !== -1 && card.name.includes('Ingranaggio Antico')) {
- 833 Bestia-Ingranaggio Antico: js/engine/actions.js: if (gearCastleIndex !== -1 && card.name.includes('Ingranaggio Antico')) {
- 834 Soldato-Ingranaggio Antico: js/engine/actions.js: if (gearCastleIndex !== -1 && card.name.includes('Ingranaggio Antico')) {
- 836 Cannone-Ingranaggio Antico: js/engine/actions.js: if (gearCastleIndex !== -1 && card.name.includes('Ingranaggio Antico')) {
- 882 Oppressione Reale: js/engine/duel-engine.js: stFieldOf(lato).some((s) => s && s.card.id === 882 && (!s.isFaceDown || lato === opponentOf(owner))));
- 888 Freed il Generale Senza Avversari: js/engine/fasi.js: const freedSlot = (freedField || []).find((s) => s && !s.isFaceDown && s.card.id === 888);
- 1078 Kotodama: js/engine/duel-engine.js: if (simultaneousSummonBatch && simultaneousSummonBatch.cards.length > 1 && slot.card.id === 1078) return; | js/engine/duel-engine.js: if (!slot || slot.isFaceDown || slot.card.id !== 1078) return;

## Meccaniche proprie di Yu-Gi-Oh (se si vuole tenerle in un tema)
Quali carte le usano, per gruppo: Spirit: 11, Contatori Magia: 5, Toon: 1, Union: 1 nel solo gruppo M; l'elenco completo e' sotto.

**Rituale** (12): 56 Rito della Gloria Nera [C1]; 116 Rito Illusione Nera [C1]; 168 Maledizione della Bestia Mascherata [C1]; 183 Rituale del Drago Nero [C1]; 187 Rito Magia Oscura [C1]; 253 Giuramento della Balena Fortezza [C1]; 414 Trasmigrazione Occhi Rossi [C1]; 506 Rituale del Drago Bianco [C1]; 517 Rito di Zera [C1]; 1015 Ricetta dell'Hamburger [C1]; 1017 Giuramento della Tartaruga [C1]; 1019 Inizio delle Danze [C1]

**Toon** (8): 123 Drago Toon Occhi Blu [C2]; 481 Alligatore Toon [M]; 483 Stregone Mascherato Toon [C2]; 484 Sirena Toon [C2]; 486 Teschio Evocato Toon [C2]; 606 Manga Ryu-Ran [C2]; 1268 Lady Arpia Toon [C1]; 1270 Glorioso Soldato Nero Toon [C1]

**Contatori Magia** (6): 131 Breaker il Guerriero Magico [M]; 615 Biblioteca Reale Magica [M]; 734 Cerbero Mitica Bestia [M]; 736 Abile Mago Nero [C1]; 742 Mago del Sangue [M]; 751 Pietra del Potere Nero-Pece [M]

**Union** (4): 404 Drago Nero-Pece [C1]; 513 Y-Testa Drago [C1]; 515 Z-Carro Armato Metallico [C1]; 831 Piattaforma di Supporto per Mezzi Pesanti [M]

**Fusione** (4): 511 XY-Cannone Drago [C2]; 512 XYZ-Cannone Drago [C2]; 1260 I Maghi Neri [C1]; 1265 Drago Finale Alternativo Occhi Blu [C1]

**Spirit** (11): 659 Spirito Polvere Oscura [M]; 739 Tsukuyomi [M]; 755 Maharaghi [M]; 1001 Prete Asura [M]; 1002 Fushi No Tori [M]; 1003 Grande Naso Lungo [M]; 1004 Hino-Kagu-Tsuchi [M]; 1005 Coniglio Bianco Inaba [M]; 1006 Otohime [M]; 1007 Soldato Susa [M]; 1008 Drago Yamata [M]

## Riferimenti a id e nomi nel motore e nell'IA (non nelle carte)
Anche questi restano indietro in un clone: file con piu' riferimenti (id = confronti con un id numerico, nomi = confronti/ricerche su un nome).

| File | id | nomi |
|---|---|---|
| js/engine/duel-engine.js | 34 | 1 |
| js/ai/ai-hard.js | 25 | 0 |
| js/engine/actions.js | 7 | 1 |
| js/engine/battaglia.js | 8 | 0 |
| js/ai/ai-medium.js | 7 | 0 |
| js/engine/card-effects.js | 2 | 4 |
| js/ai/ai-shared.js | 5 | 0 |
| js/engine/fasi.js | 3 | 0 |
| js/engine/game-flow.js | 3 | 0 |
| js/ai/ai-controller.js | 0 | 1 |
| js/ai/bot.js | 1 | 0 |
