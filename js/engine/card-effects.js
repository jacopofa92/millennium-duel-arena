/**
 * card-effects.js — Gli effetti delle carte: helper condivisi e mappa.
 * =====================================================================
 * QUESTO è il file da aprire per capire COME si scrive una carta (le
 * convenzioni qui sotto valgono per tutte), ma le carte vere e proprie
 * non stanno più qui: stanno in js/engine/card-effects-1.js …
 * card-effects-8.js, che vanno caricati DOPO questo.
 *
 * PERCHÉ È DIVISO. Era un solo file da 23.800 righe e 1,3 MB, di gran
 * lunga il più grande del progetto: lento da aprire, scomodo da
 * scorrere, e ogni modifica produceva un diff enorme in cui il
 * cambiamento vero spariva. La divisione è puramente MECCANICA (per
 * righe, non per tema): le carte sono rimaste nello stesso ordine di
 * sempre, e nessun effetto è stato toccato.
 *
 * PER TROVARE UNA CARTA non aprire i file a caso: cerca
 * `register(<id>` in tutta la cartella js/engine/. Ogni carta ha ancora
 * il suo blocchetto `CardEffects.register(idCarta, { ... })` con sopra
 * il commento che spiega l'effetto in italiano — copiane uno simile a
 * quello che vuoi creare come punto di partenza.
 *
 * PER AGGIUNGERNE UNA NUOVA: mettila in fondo all'ultima parte, o
 * accanto alle carte del suo stesso gruppo se ne ha uno. Se ti serve un
 * helper che usano già altre carte, è qui sotto, e ogni parte se lo
 * importa in cima (`const { ... } = window.CardEffectsShared`): se
 * quello che ti serve non è nella riga di import della TUA parte,
 * aggiungilo lì. Un helper che serve a una carta sola, o a un gruppetto
 * di carte vicine, resta invece nella sua parte accanto a loro — qui
 * salgono solo quelli usati da gruppi lontani fra loro.
 *
 * Il "come funziona" (trigger, finestre di risposta, helper come
 * ctx.destroyMonster/ctx.dealDamage/ctx.banishTemporarily/ecc.) è spiegato
 * in js/engine/duel-engine.js, che va caricato PRIMA di questo file — ed
 * è anche lui a definire `CardEffects.register` stesso. Qui non c'è
 * altro che le regole delle singole carte.
 *
 * Convenzione per un effetto visivo "grosso" dopo l'attivazione (es. id 7
 * Buco Nero, id 8 Spada Rivelatrice): resolveChain() in duel-engine.js
 * ORA aspetta GIÀ da sola che il pulse della carta a centro schermo
 * (~2s, FX.playCardActivateCenterScreen) sia DAVVERO finito prima di
 * chiamare activate(ctx) qui sotto — non serve più che ogni singola
 * carta aggiunga il proprio setTimeout(FX.ACTIVATE_CENTER_DURATION_MS)
 * per questo (era la vecchia convenzione, ora ridondante: activate(ctx)
 * PARTE già al momento giusto). Un secondo effetto/animazione DENTRO
 * activate(ctx) può quindi scattare SUBITO, senza altri ritardi. Questo
 * vale per OGNI carta di questo file, non solo per chi ha un effetto
 * visivo "grosso": in una Chain con più link, ogni singola attivazione
 * aspetta il proprio pulse prima di risolversi, così anche più
 * attivazioni in sequenza restano leggibili invece di accavallarsi.
 *
 * Convenzione per i SEGNALINI su una carta (es. id 131 Distruttore il
 * Guerriero Magico/Segnalino Magia, id 139 Guardia di Carte/Segnalino
 * Guardia): usa sempre il campo generico `card.counters` (un numero),
 * mai un nome specifico come `magicCounters`/`guardCounters` — anche se
 * sulla carta vera il segnalino ha un nome proprio ("Segnalino Magia"
 * ecc., da usare comunque nei messaggi di log), il campo che lo conta va
 * tenuto unico e generico. Il motivo è che renderFields() in
 * js/engine/game-flow.js mostra IN AUTOMATICO un badge tondo con il numero sopra
 * ogni carta con `counters > 0`, per QUALSIASI carta — un solo posto da
 * aggiornare invece di insegnare alla UI ogni nome di segnalino esistente.
 *
 * Convenzione per l'EVOCAZIONE FUSIONE: un mostro nell'Extra Deck (vedi
 * card.extraDeck/category==='fusion' in cards-db.js) NON ha un `activate`/
 * `canActivate` propri — dichiara solo `fusionMaterials: [idA, idB, ...]`,
 * gli ID esatti delle carte richieste come Materiale. "Polimerizzazione" (id 38,
 * Polymerization) e qualunque altra carta che Evochi per Fusione in futuro
 * usano DuelEngine.getFusableExtraDeckMonsters(owner) per trovare quali
 * mostri sono fondibili ORA (materiali già in mano/Terreno) e
 * ctx.fusionSummon(owner, extraDeckIndex, materialLocations) per farlo
 * davvero — vedi js/engine/duel-engine.js per i dettagli. Non serve altro codice
 * per-carta finché il Mostro Fusione non ha ANCHE un effetto proprio oltre
 * alla condizione di Evocazione (in quel caso aggiungi pure `static`/
 * `onSummon`/ecc. nello stesso blocco, come qualunque altro mostro).
 * Variante SENZA la Magia "Polimerizzazione" (es. id 511/512 Cannone Drago XY/XYZ):
 * `banishFusionMaterials: [idA, idB, ...]` invece di `fusionMaterials` —
 * il giocatore stesso attiva lo Special Summon cliccando la zona Fusion
 * (non serve nessuna carta Magia), e i materiali vanno bandendoli dal
 * proprio Terreno scoperto, mai dalla mano — vedi
 * DuelEngine.getBanishFusableExtraDeckMonsters/banishFusionSummon.
 *
 * ctx.banishTemporarily(owner, card, returnTrigger) — bando TEMPORANEO con
 * ritorno programmato (es. Buco Dimensionale, Ninja d'Assalto): il
 * chiamante toglie `card` dal Terreno PRIMA di chiamarla; `returnTrigger`
 * è 'standby' (torna alla prossima Standby Phase di `owner`) o 'endphase'
 * (torna alla prossima End Phase, di chiunque). Diverso da un bando
 * "vero" (es. Rilascio dell'Anima, che manda dritto al Cimitero
 * bypassando il Terreno): qui la carta torna da sola in campo, scoperta
 * in Posizione di Attacco — vedi processTemporaryBanishmentReturns in
 * duel-engine.js, chiamata da enterStandbyPhase()/enterEndPhase() in
 * game-flow.js.
 *
 * Le proprietà che una carta può definire:
 *   static(ctx)          — effetto continuo, richiamato ad ogni render
 *                           finché la carta resta scoperta sul campo.
 *   canActivate(ctx)      — deve tornare true/false: si può attivare ORA?
 *                           (se assente, si assume sempre true)
 *   activate(ctx)          — cosa succede quando la carta viene attivata
 *                           manualmente: Magie (dalla mano o Set),
 *                           Trappole Set, o l'effetto Ignition di UN
 *                           MOSTRO GIÀ scoperto sul Terreno (es. Soldato
 *                           Cannone) — in quel caso ctx.zone === 'monster'
 *                           e il mostro NON va al Cimitero né si muove,
 *                           solo il suo effetto si risolve, una volta per
 *                           turno per carta (vedi il ramo zone ===
 *                           'monster' di canActivate/activateCard in
 *                           duel-engine.js).
 *   continuous: true      — SOLO per Magie/Trappole: invece di andare
 *                           subito al Cimitero dopo l'attivazione, la
 *                           carta resta scoperta sul Terreno e il suo
 *                           effetto si applica tramite static() (es.
 *                           Spada Rivelatrice).
 *   onAttackDeclare(ctx)  — la carta può rispondere quando l'AVVERSARIO
 *                           di chi la controlla dichiara un attacco
 *                           (Trappole o effetti da mano come Kuriboh).
 *   activatableFromGraveyard: true — la carta può rispondere anche stando
 *                           nel proprio Cimitero (es. Tartaruga
 *                           Elettromagnetica, id 223: si bandisce dal
 *                           Cimitero per terminare la Battle Phase
 *                           avversaria) — opt-in esplicito, altrimenti
 *                           nessuna carta nel Cimitero viene mai offerta
 *                           come risposta a un trigger reattivo (vedi
 *                           findTriggerCandidates in duel-engine.js).
 *                           canActivate(ctx) resta il posto giusto per
 *                           condizioni come "una volta per Duello"
 *                           (ctx.hasUsedOncePerDuel/markUsedOncePerDuel).
 *   onOpponentSummon(ctx) — la carta può rispondere quando l'AVVERSARIO
 *                           di chi la controlla Evoca un mostro (es.
 *                           Buco Trappola).
 *   onOwnMonsterSummoned(ctx) — SOLO per Magie/Trappole Continue (zona
 *                           'st') o la Magia Terreno: reagisce quando un
 *                           mostro del PROPRIO controllore viene Evocato
 *                           Normalmente o Special Summonato, da qualsiasi
 *                           zona (es. Terreno di Caccia delle Arpie id
 *                           788). ctx.summonedCard/summonedVia
 *                           ('normal'\'special') come per
 *                           ON_NORMAL_SUMMON/ON_SPECIAL_SUMMON.
 *                           SEMPLIFICAZIONE: un solo rispondente automatico
 *                           (il primo eleggibile, 'st' prima della Magia
 *                           Terreno), niente vera finestra di priorità —
 *                           stesso schema di onOwnMonsterDestroyed/
 *                           onEnemyMonsterDestroyed.
 *   onBattled(ctx)         — si attiva alla fine del Damage Step se QUESTO
 *                           mostro ha combattuto (attaccando o difendendo)
 *                           ED È SOPRAVVISSUTO a quella battaglia —
 *                           indipendentemente da chi vince/perde/pareggia
 *                           (a differenza di onDealsBattleDamage, solo
 *                           quando l'attaccante infligge danno; MAI per un
 *                           attacco diretto). ctx.card è questa carta
 *                           stessa (per trovare il proprio slot attuale,
 *                           es. per bandirsi — vedi Guerriero D.D. id
 *                           179), ctx.opponentCard è l'altro mostro
 *                           coinvolto, ctx.opponentSurvived se anche lui è
 *                           sopravvissuto alla stessa battaglia (es. Testa
 *                           di Martello Iper id 800).
 *                           SEMPLIFICAZIONE: mai per una carta appena
 *                           distrutta in QUESTA battaglia (niente "ultima
 *                           informazione nota"). Vedi fireOwnBattled in
 *                           actions.js.
 *   onEquippedMonsterBattled(ctx) — SOLO per Carte Equipaggiamento
 *                           (isEquip): come onBattled qui sopra, ma per il
 *                           mostro a cui questa carta è agganciata invece
 *                           che per se stessa (es. Pugno Ingranaggio
 *                           Antico id 840). ctx.equippedCard/opponentCard/
 *                           opponentSurvived come sopra.
 *   onDestroyedInBattle(ctx) — si attiva quando QUESTO mostro viene
 *                           distrutto in QUESTA battaglia (chiamato dal
 *                           lato del suo proprietario, subito dopo la
 *                           distruzione) — a differenza di onDestroy
 *                           (qualunque causa di distruzione), qui
 *                           ctx.destroyerCard è SEMPRE noto: il mostro
 *                           avversario che l'ha appena distrutta in
 *                           battaglia (es. Guerriero di Ardesia id 776:
 *                           "il mostro che l'ha distrutta perde 500
 *                           ATK/DEF"). Vedi fireOwnBattled in actions.js.
 *   onEnemyMonsterSummoned(ctx) — reazione MANDATORIA (non una Chain/
 *                           scelta come onOpponentSummon) di QUESTO
 *                           mostro quando l'AVVERSARIO evoca un mostro,
 *                           Normalmente o Special — es. Slifer il Drago
 *                           del Cielo (id 31). ctx.summonedCard/
 *                           summonedOwner/summonedSlotIndex/
 *                           summonedPosition/summonedVia. SEMPLIFICAZIONE:
 *                           un solo rispondente automatico (il primo
 *                           eleggibile in campo), stesso schema di
 *                           onEnemyMonsterDestroyed.
 *   onFlip(ctx)            — si attiva quando QUESTO mostro viene girato
 *                           scoperto in battaglia (era coperto, l'ha
 *                           attaccato o è sopravvissuto rivelandosi) —
 *                           NON scatta se la carta viene distrutta nello
 *                           stesso momento in cui si rivela.
 *   onDestroy(ctx)         — si attiva quando QUESTO mostro viene
 *                           distrutto e mandato al Cimitero (in battaglia,
 *                           tramite resolveBattleDamage in actions.js, o
 *                           da un effetto, tramite ctx.destroyMonster/
 *                           destroyAllMonsters). ctx.card è la carta stessa
 *                           (già rimossa dal campo, già nel Cimitero).
 *                           SEMPLIFICAZIONE per tutte le carte che lo
 *                           usano: solo distruzione, non ogni possibile
 *                           modo di finire al Cimitero (es. scarto, o un
 *                           effetto che manda al Cimitero senza distruggere).
 *                           ctx.destroyedByOpponentCard: SOLO se distrutto
 *                           in battaglia, l'ALTRO mostro coinvolto in
 *                           quello scontro (chi ha attaccato, se questo
 *                           era il difensore; chi difendeva, se questo
 *                           era l'attaccante) — es. Ossigeddon (id 804):
 *                           "se distrutta in battaglia da un mostro Tipo
 *                           Piroico". null per una distruzione da effetto
 *                           Carta (ACTIONS.destroyMonster/destroyAllMonsters),
 *                           dove non esiste un "altro mostro della
 *                           battaglia" concettualmente.
 *                           ctx.destroyedByOwner: chi ha CAUSATO la
 *                           distruzione (es. Signore dei Vampiri, id 658:
 *                           "distrutta da un effetto DELL'AVVERSARIO") —
 *                           'player'/'bot'/null, letto da `this.owner`
 *                           dentro ACTIONS.destroyMonster (duel-engine.js):
 *                           valido per OGNI distruzione da effetto Carta
 *                           (anche di massa, es. Buco Nero), null per una
 *                           distruzione in battaglia o per una chiamata
 *                           interna senza un vero ctx dietro (es.
 *                           clearTemporaryAtkDefBonus).
 *                           ctx.wasFaceDown/wasPosition: coperta/Posizione
 *                           al momento della distruzione da effetto Carta
 *                           (es. Falena della Sabbia, id 766) — undefined
 *                           per una distruzione in battaglia.
 *   onSentToGraveyardFromHand(ctx) — si attiva quando QUESTA carta, ferma
 *                           in mano, viene scartata a caso e mandata al
 *                           Cimitero tramite ctx.discardRandomFromHand(owner)
 *                           (duel-engine.js) — l'helper condiviso usato da
 *                           ogni "il tuo avversario scarta 1 carta a caso"
 *                           di questo file (es. Cappello Magico Bianco id
 *                           591). NON scatta per ogni altro modo di finire
 *                           al Cimitero dalla mano (scarto come costo di
 *                           attivazione, scarto di una carta SCELTA invece
 *                           che casuale, mandata al Cimitero da un
 *                           effetto che non passa da quell'helper) — vale
 *                           la stessa SEMPLIFICAZIONE già accettata per
 *                           onDestroy qui sopra, ma ancora più stretta.
 *                           ctx.discardedByOwner: chi ha causato lo scarto
 *                           (letto da `this.owner` dentro l'helper, stesso
 *                           schema di ctx.destroyedByOwner sopra) — es.
 *                           Mummia Rigenerante (id 667): "se questa carta
 *                           viene mandata dalla tua mano al Cimitero da un
 *                           effetto dell'AVVERSARIO" si legge come
 *                           `ctx.discardedByOwner === ctx.opponent`.
 *   onSTDestroyed(ctx)     — si attiva quando QUESTA Magia/Trappola (in
 *                           zona 'st', Set o scoperta) viene distrutta
 *                           tramite ctx.destroySpellTrap(owner, index)
 *                           (duel-engine.js) — es. Bara Oscura (id 792):
 *                           "quando questa carta Set viene distrutta e
 *                           mandata al Cimitero...". NON scatta per ogni
 *                           altro modo di finire al Cimitero da quella
 *                           zona (attivazione normale/Trappola risolta,
 *                           un effetto che la RIMANDA in mano invece di
 *                           distruggerla) — solo per le chiamate che
 *                           passano da quell'helper condiviso, oggi solo
 *                           le carte che distruggono ESPLICITAMENTE una
 *                           Magia/Trappola avversaria (Piumino delle
 *                           Arpie id 291, Freccia Spezza-Magie id 352,
 *                           Attacco Magico Oscuro id 748, Drago da
 *                           Compagnia delle Arpie id 786, Ingegnere
 *                           Ingranaggio Antico id 826). ctx.wasFaceDown
 *                           distingue Set da scoperta al momento della
 *                           distruzione; ctx.destroyedByOwner chi ha
 *                           causato la distruzione (stesso schema di
 *                           destroyedByOwner/discardedByOwner sopra).
 *   onOpponentStandbyPhase(ctx) — SOLO per Magie/Trappole Continue (zona
 *                           'st'): a differenza di onStandbyPhase qui
 *                           sotto (sempre il proprio controllore), questo
 *                           si attiva durante la Standby Phase
 *                           dell'AVVERSARIO di chi controlla la carta —
 *                           es. L'Occhio della Verità (id 466).
 *                           ctx.standbyOwner è chi sta vivendo quella
 *                           Standby Phase (l'avversario), ctx.owner resta
 *                           il controllore di QUESTA carta come sempre.
 *   onBattlePhaseEnd(ctx)  — si attiva alla fine della Battle Phase del
 *                           turno corrente, su ENTRAMBI i lati (a
 *                           differenza di onStandbyPhase/onEndPhase qui
 *                           sotto, solo il proprietario di turno — un
 *                           mostro può aver combattuto anche da
 *                           difensore, quindi appartenere all'altro
 *                           giocatore), MA SOLO se quella Battle Phase è
 *                           davvero avvenuta (mai se il turno l'ha
 *                           saltata) — es. Bestia Mitica Cerbero (id
 *                           734): "se questa carta ha combattuto,
 *                           rimuovi tutti i Segnalini Magia"; Cavaliere
 *                           del Miraggio (id 381): "se ha attaccato o è
 *                           stata attaccata, bandiscila". Per "ha
 *                           combattuto", controlla
 *                           ctx.card.battledThisBattlePhase (scritto da
 *                           fireOwnBattled in actions.js per OGNI carta
 *                           che sopravvive a una battaglia — azzeralo tu
 *                           stesso dopo averlo letto, si auto-consuma).
 *   onStandbyPhase(ctx)    — si attiva durante la TUA Standby Phase,
 *                           mentre questa carta (mostro o Magia/Trappola
 *                           Continua) resta scoperta sul Terreno — vedi
 *                           firePhaseTrigger in duel-engine.js, chiamata
 *                           da enterStandbyPhase() in game-flow.js.
 *   onEndPhase(ctx)        — come onStandbyPhase(ctx), ma durante la TUA
 *                           End Phase. ctx.slotIndex (mostri) permette di
 *                           modificare/svuotare il proprio slot (es. per
 *                           sacrificarsi).
 *   onPositionChange(ctx)  — si attiva quando QUESTO mostro, già scoperto
 *                           sul Terreno, cambia Posizione di Battaglia
 *                           (Attacco<->Difesa) — che sia per scelta del suo
 *                           controllore (changeMonsterPosition in
 *                           actions.js) o per effetto di un'ALTRA carta
 *                           (es. Stop Difesa id 69, Vaso Cattura-Drago id
 *                           206): stessa identica reazione, la fonte non
 *                           conta. ctx.fromPosition/ctx.toPosition sono
 *                           'attack'/'defense'. Vedi ctx.changePosition
 *                           per forzare tu stesso un cambio di Posizione
 *                           da un altro effetto (es. id 530/531).
 *   onCardActivated(ctx)   — si attiva quando UNA QUALSIASI carta (di
 *                           entrambi i giocatori) viene attivata tramite
 *                           activateCard() — Magie, Trappole già Set,
 *                           effetti Ignition — ECCETTO questa carta stessa
 *                           (già esclusa in automatico). ctx.activatedCard/
 *                           activatedOwner descrivono cosa/chi ha scatenato
 *                           il trigger; ctx.card resta QUESTA carta (quella
 *                           con l'effetto), come per onDestroy/onFlip. Se
 *                           l'effetto è vincolato a "una volta per turno",
 *                           filtralo con canActivateOnCardActivated(ctx) e
 *                           usa ctx.hasUsedOncePerTurn/markUsedOncePerTurn
 *                           (es. Signore del Rosso, id 354). SEMPLIFICAZIONE:
 *                           scatta solo dalle attivazioni manuali, non dalle
 *                           Trappole automatiche di risposta (onAttackDeclare/
 *                           onOpponentSummon qui sopra).
 *   damageStepBonus(ctx)   — mostro attaccante O difensore in battaglia:
 *                           ritorna { atk, def } di bonus valido SOLO per
 *                           QUESTO calcolo danni (Damage Step), non
 *                           persistente come gameState.atkDefBonus. ctx =
 *                           { card, opponentCard, role, owner } dove role
 *                           è 'attacker'/'defender', opponentCard è l'altro
 *                           mostro coinvolto (null per un attacco diretto)
 *                           e owner è chi controlla `card` ADESSO (null se
 *                           per qualche motivo non più in campo) — utile
 *                           SOLO a un effetto che deve fare più di un
 *                           calcolo puro, es. pagare i propri LP (Iniezione
 *                           della Fata Giglio id 889, l'unica ad usarlo:
 *                           chiama DuelEngine.actions.dealDamage(ctx.owner, ...)
 *                           direttamente, questo ctx NON ha un proprio
 *                           ctx.dealDamage/ctx.log come i normali handler).
 *   canSpecialSummonFromHand(ctx) — SOLO per mostri: deve tornare true/false,
 *                           "posso Special Summonare questa carta dalla
 *                           mano ADESSO?" (es. Gilasaurus, sempre vero;
 *                           Il Demone Megacyber, solo se l'avversario ha
 *                           2+ mostri in più di te). Cliccando il mostro
 *                           in mano, se questo è vero, l'UI offre la
 *                           scelta tra Evocazione Normale e Special
 *                           Summon — vedi DuelEngine.canSpecialSummonFromHand/
 *                           trySpecialSummonFromHand.
 *   paySpecialSummonCost(ctx) — opzionale, solo insieme al campo qui sopra:
 *                           paga un eventuale costo (es. sacrificare 1
 *                           mostro) PRIMA che la carta lasci la mano;
 *                           torna false per annullare l'intera Special
 *                           Summon se il costo non è pagabile.
 *   onEquipped(ctx)        — si attiva su QUESTO mostro quando gli viene
 *                           agganciata una Carta Equipaggiamento
 *                           (qualsiasi, non solo una specifica) — es.
 *                           Gearfried il Maestro di Spada (id 258):
 *                           "ogni volta che questa carta viene
 *                           equipaggiata: distruggi 1 mostro
 *                           dell'avversario". ctx.equipCard è la Carta
 *                           Equipaggiamento appena agganciata. Scatta da
 *                           attachEquip(ctx, index) qui sopra, quindi
 *                           per QUALUNQUE Carta Equipaggiamento di questo
 *                           file, non solo carte specifiche.
 *   isUnion: true          — SOLO per Mostri Union (es. Testa di Drago Y
 *                           id 513): un mostro che, tramite un proprio
 *                           effetto Ignition dalla zona Mostro (usa
 *                           attachUnionMonster(ctx, filterFn) qui sopra),
 *                           si aggancia a un altro mostro come una Carta
 *                           Equipaggiamento — insieme a isEquip:true (per
 *                           il bonus statico via static(), come ogni
 *                           altro Equip) e unionTargetFilter (per
 *                           permettere ad altre carte come Avanti Tutta!
 *                           id 853 di trovarne uno idoneo nel Cimitero).
 *                           Se il bersaglio a cui è agganciato lascia il
 *                           campo, torna da solo sul Terreno scoperto in
 *                           Attacco (o al Cimitero se non c'è spazio) —
 *                           vedi recomputeStaticEffects in duel-engine.js.
 *                           Nel proprio static(), controlla sempre prima
 *                           `if (!ctx.card.equippedToOwner) return;`:
 *                           finché è ancora un mostro (non agganciato),
 *                           static() viene comunque chiamato come per
 *                           ogni mostro scoperto sul Terreno.
 *   isEquip: true          — SOLO per Magie Equipaggiamento: da usare
 *                           insieme a continuous:true. Segnala a
 *                           recomputeStaticEffects() (duel-engine.js) di
 *                           controllare, ad ogni render, che il mostro
 *                           in card.equippedToOwner/Index/Uid sia ancora
 *                           lì — altrimenti manda la carta al Cimitero da
 *                           sola, PRIMA di chiamare il suo static() (che
 *                           applica il bonus vero e proprio via
 *                           gameState.atkDefBonus, come ogni altro buff
 *                           continuo). In activate() chiama
 *                           equipToChosenTarget(ctx, filterFn?) qui
 *                           sotto: fa scegliere il bersaglio al giocatore
 *                           e lo aggancia. findEquipTarget/attachEquip
 *                           restano per i pochi casi che non hanno questa
 *                           forma, ma per una carta nuova non servono.
 *   declaredTargeting: { count, cardType, race? } — SOLO per Magie/
 *                           Trappole che scelgono come bersaglio un
 *                           numero FISSO di carte quando si risolvono
 *                           (es. "distruggi 1 mostro bersaglio"). Non
 *                           influenza come la carta stessa si risolve —
 *                           serve SOLO a farla RICONOSCERE da carte
 *                           reattive di terzi che devono sapere "cosa sta
 *                           per bersagliare" un'attivazione ANCORA sulla
 *                           Chain, PRIMA che il suo stesso activate(ctx)
 *                           giri (in questo motore la scelta vera del
 *                           bersaglio avviene dentro activate(), che
 *                           risolve DOPO che la finestra di risposta si è
 *                           già aperta — l'opposto dell'ordine reale del
 *                           gioco, dove i bersagli si dichiarano
 *                           all'attivazione). Esempi: Campo di Riryoku
 *                           (id 636), Scudo Magico Tipo-8 (id 689) e La
 *                           Perla del Drago (id 652) leggono il
 *                           declaredTargeting della carta in cima alla
 *                           Chain (chain.links[...].def.declaredTargeting)
 *                           per decidere se possono rispondere. `count`
 *                           è il numero di carte bersagliate (es. 1);
 *                           `cardType` è 'monster'/'spell'/'trap';
 *                           `race` (opzionale) restringe ulteriormente
 *                           (es. 'Drago' per La Perla del Drago). SOLO le
 *                           carte davvero necessarie a queste risposte
 *                           lo dichiarano oggi — non un audit dell'intero
 *                           dataset: una futura carta reattiva con un
 *                           requisito nuovo (es. "bersaglia una Magia",
 *                           "bersaglia 2 carte") può riusare lo stesso
 *                           campo su qualunque altra Magia/Trappola a
 *                           bersaglio fisso non ancora coperta.
 *
 * NIENTE Pendulum/XYZ/Link/Synchro: questo gioco segue le regole della
 * prima serie di Yu-Gi-Oh (Evocazione Normale/Tributo, Flip, Fusione,
 * Magie/Trappole Normali/Continue/Campo).
 */
(function () {
    'use strict';


    /**
     * Vero (e logga il motivo) se `card` NON può essere bandita perché è
     * scoperta sul Terreno — def.cannotBeBanishedWhileOnField, opt-in
     * per-carta (es. Uovo Giurassico Miracoloso, id 808: "finché scoperta
     * sul Terreno, questa carta non può essere bandita"). Il testo reale
     * protegge SOLO dal bando "dal Terreno" (mostro, o zona Mostro
     * Fusione come materiale) — un bando dal Cimitero/dalla mano/dal
     * Deck resta permesso, quindi questo controllo va PRIMA di ogni
     * bando che toglie una carta proprio da lì, non di tutti i ~28
     * bandi di questo file (la maggior parte parte dal Cimitero, fuori
     * scopo per questa protezione). Il chiamante deve verificarlo PRIMA
     * di rimuovere la carta dal proprio slot (se true, non toccare né
     * lo slot né chiamare ctx.banish/ctx.banishTemporarily).
     */
    function blockBanishFromField(ctx, card) {
        const def = DuelEngine.getDefinition(card.id);
        if (!def || !def.cannotBeBanishedWhileOnField) return false;
        ctx.log(`🚫 ${card.name} non può essere bandita finché scoperta sul Terreno!`);
        return true;
    }

    // ================================================================
    // Helper condivisi per le Carte Equipaggiamento (vedi isEquip qui
    // sopra). Non sono carte: sono funzioni di supporto usate da più
    // register() qui sotto, per non ripetere la stessa logica ~25 volte.
    // ================================================================

    /**
     * Vero se `card` conta come "Lady Arpia" ai fini di QUALUNQUE effetto
     * di supporto Arpia — non solo la vera "Lady Arpia" (id 288, incluse
     * le varianti "Lady Arpia 1/2/3", id 782/783/784) ma anche Arpia Cyber
     * (id 172), il cui testo reale è "il nome di questa carta è sempre
     * considerato 'Lady Arpia'" (vedi cards.json): per regola vera, quella
     * dicitura la rende un bersaglio legittimo per OGNI riferimento al
     * nome "Lady Arpia" in un testo altrui, sempre — non un'abilità
     * propria da attivare, ecco perché id 172 non ha una sua registrazione
     * qui: questo helper è l'unico "effetto" che le serve, usato da ogni
     * altra carta di supporto Arpia in questo file al posto di un
     * controllo diretto sul nome/id. Stesso discorso per la clausola
     * "trattata come Lady Arpia" di Lady Arpia 2 (id 783): già coperta qui
     * da startsWith('Lady Arpia'), nessuna registrazione dedicata serve
     * per quella parte del suo testo (la seconda clausola, sull'annullare
     * gli effetti Flip dei mostri che distrugge in battaglia, è invece
     * già garantita per costruzione altrove — vedi il commento su
     * TRIGGER.ON_FLIP in resolveBattleDamage, actions.js).
     */
    function isHarpieLadySupport(card) {
        if (!card) return false;
        if (card.id === 172) return true;
        // Solo MOSTRI: "Lady Arpia Formazione Fenice" (id 289) è una
        // Magia, ma il suo nome comincia anch'esso con "Lady Arpia". Senza
        // questo controllo Egoista Elegante (id 787) la Special Summonava
        // dalla mano come un mostro — senza ATK, quindi i Life Points di chi
        // la attaccava diventavano NaN (trovato dal duello senza testa,
        // confermato nel browser) — e ogni conteggio di "Lady Arpia sul
        // Terreno" o ricerca nel Deck/Cimitero poteva contarla.
        if (card.type !== 'monster') return false;
        // "Lady Arpia Toon" (id 1268) e' un'altra carta: col vecchio nome ("Signora Arpia Toon") non iniziava per "Lady Arpia".
        return !!(card.name && card.name.startsWith('Lady Arpia') && !card.name.includes('Toon'));
    }

    /**
     * Identita' di archetipo condivisa per i supporti moderni.
     *
     * Le carte storiche del progetto non hanno tutte un campo `archetypes`:
     * per loro manteniamo pochi fallback di compatibilita' sui nomi italiani
     * gia' presenti. Le carte nuove e quelle custom possono invece dichiarare
     * `archetypes: ['toon', 'blue-eyes']` nei dati oppure nella definizione
     * dell'effetto, senza dover aggiungere il loro id a questo helper.
     *
     * Non va usato per Tipo/Razza/Attributo e non prova a dedurre famiglie
     * generiche: un tag esplicito resta sempre la fonte piu' affidabile.
     */
    function cardHasArchetype(card, archetype) {
        if (!card || !archetype) return false;
        const normalize = (value) => String(value || '').trim().toLowerCase();
        const wanted = normalize(archetype);
        const def = window.DuelEngine && DuelEngine.getDefinition
            ? DuelEngine.getDefinition(card.id)
            : null;
        const declared = []
            .concat(Array.isArray(card.archetypes) ? card.archetypes : [])
            .concat(def && Array.isArray(def.archetypes) ? def.archetypes : []);
        if (declared.some((value) => normalize(value) === wanted)) return true;

        // Carte il cui nome UFFICIALE (Konami) contiene ora la parola dell'archetipo ("Drago Occhi Blu Finale", "Abile Mago
        // Nero", "Attacco Mago Nero") ma che, col nome di prima della rinomina, NON entravano in questo controllo per nome:
        // restano fuori per non cambiare il comportamento del gioco. Per farle contare come membri, basta toglierle da qui.
        // La lista e' sorvegliata da tests/specs/guardrail-nomi-carte.spec.js.
        const ESCLUSE_PER_NOME = { 'blue-eyes': [29], 'dark-magician': [736, 748] };
        if ((ESCLUSE_PER_NOME[wanted] || []).includes(card.id)) return false;
        const name = normalize(card.name);
        if (wanted === 'toon') return !!(def && def.isToon) || name.includes('toon');
        if (wanted === 'red-eyes') return name.includes('occhi rossi') || name.includes('red-eyes');
        if (wanted === 'blue-eyes') return name.includes('occhi blu') || name.includes('blue-eyes');
        if (wanted === 'dark-magician') {
            return name.includes('mago nero') || name.includes('dark magician')
                || name === 'ragazza maga nera' || name === 'dark magician girl';
        }
        return false;
    }

    /**
     * Confronta il nome stampato o uno dei nomi assunti dichiarati dalla
     * carta/definizione. Serve per testi come "il nome di questa carta viene
     * considerato ..." senza cambiare l'id, il nome mostrato o i salvataggi.
     */
    // Nomi che alcune carte avevano PRIMA dell'allineamento ai nomi ufficiali Konami (2026-10-21). Le carte personalizzate create
    // allora possono ancora citarli in `mentionsNames`/`treatedAsNames` o nel testo: si riconoscono come alias del nome nuovo.
    // Chiavi e valori sono normalizzati (minuscolo).
    const NOMI_PRECEDENTI = {
        'ragazza maga nera': ['maga oscura'],
        'mondo toon': ['mondo dei toon'],
        'drago occhi blu finale': ['drago bianco definitivo'],
        'drago finale alternativo occhi blu': ['drago bianco alternativo definitivo']
    };

    function cardHasEffectiveName(card, requestedName, zone) {
        if (!card || !requestedName) return false;
        const normalize = (value) => String(value || '').trim().toLowerCase();
        const wanted = normalize(requestedName);
        const accettati = [wanted].concat(NOMI_PRECEDENTI[wanted] || []);
        const def = window.DuelEngine && DuelEngine.getDefinition
            ? DuelEngine.getDefinition(card.id)
            : null;
        const names = [card.name]
            .concat(Array.isArray(card.treatedAsNames) ? card.treatedAsNames : [])
            .concat(def && Array.isArray(def.treatedAsNames) ? def.treatedAsNames : []);
        // Alcuni nomi assunti dipendono dalla zona. Tenerli separati dai
        // treatedAsNames assoluti evita, per esempio, che Drago Bianco
        // Alternativo venga considerato Drago Bianco Occhi Blu anche in
        // mano: il suo testo limita esplicitamente Terreno e Cimitero.
        if (zone && def && def.treatedAsNamesByZone && Array.isArray(def.treatedAsNamesByZone[zone])) {
            names.push(...def.treatedAsNamesByZone[zone]);
        }
        return names.some((value) => accettati.includes(normalize(value)));
    }

    /**
     * Vero se il testo della carta cita esplicitamente un nome. Le carte
     * custom possono dichiarare `mentionsNames`, così una traduzione o un
     * testo abbreviato non rende invisibile la carta ai cercatori come
     * Magician's Rod. Per le carte storiche resta il fallback sul testo.
     */
    function cardMentionsName(card, requestedName) {
        if (!card || !requestedName) return false;
        const normalize = (value) => String(value || '').trim().toLowerCase();
        const wanted = normalize(requestedName);
        const accettati = [wanted].concat(NOMI_PRECEDENTI[wanted] || []);
        const def = window.DuelEngine && DuelEngine.getDefinition
            ? DuelEngine.getDefinition(card.id)
            : null;
        const declared = []
            .concat(Array.isArray(card.mentionsNames) ? card.mentionsNames : [])
            .concat(def && Array.isArray(def.mentionsNames) ? def.mentionsNames : []);
        if (declared.some((value) => accettati.includes(normalize(value)))) return true;
        const text = normalize(card.effect);
        if (accettati.some((nome) => text.includes(nome))) return true;
        // Il dataset è italiano, ma le custom possono conservare il nome
        // TCG inglese nel testo pur cercando l'identità italiana.
        if (wanted === 'mago nero') return text.includes('dark magician');
        return false;
    }

    /**
     * Trova il primo mostro scoperto idoneo sul proprio Terreno a cui
     * equipaggiare una carta — `filterFn(card)` opzionale per restrizioni
     * (es. solo Incantatore, solo LUCE). Esclude sempre i mostri che
     * rifiutano le Carte Equipaggiamento (def.rejectsEquip — es. Gearfried
     * il Cavaliere di Ferro, id 16). Torna -1 se nessuno è idoneo.
     */
    function findEquipTarget(ctx, filterFn) {
        const candidati = collectEquipTargets(ctx, filterFn);
        return candidati.length > 0 ? candidati[0].index : -1;
    }

    /**
     * Tutti i mostri scoperti del proprio Terreno a cui questa Carta
     * Equipaggiamento potrebbe agganciarsi, nella forma che
     * chooseFieldCardTarget si aspetta. È la sorella "elenco completo" di
     * findEquipTarget qui sopra, che ne prende solo il primo: le regole di
     * idoneità (scoperto, filtro della carta, def.rejectsEquip) stanno qui
     * una volta sola, così canActivate e la scelta vera non possono
     * divergere.
     */
    function collectEquipTargets(ctx, filterFn) {
        const out = [];
        ctx.field(ctx.owner).forEach((slot, index) => {
            if (!slot || slot.isFaceDown) return;
            if (filterFn && !filterFn(slot.card)) return;
            const targetDef = DuelEngine.getDefinition(slot.card.id);
            if (targetDef && targetDef.rejectsEquip) return;
            out.push({ owner: ctx.owner, index: index, zone: 'monster', card: slot.card, slot: slot });
        });
        return out;
    }

    /**
     * Scelta VERA di QUALE proprio mostro equipaggiare, poi aggancio.
     *
     * È il caso più ripetuto dell'intero dataset: quasi ogni Carta
     * Equipaggiamento dice "equipaggia questa carta a 1 mostro <tale> che
     * controlli", e per anni ognuna ha preso il primo mostro idoneo da
     * sinistra (`findEquipTarget` + `attachEquip`, una riga sola copiata
     * una cinquantina di volte) — con due mostri idonei in campo il
     * giocatore non poteva decidere su quale mettere il bonus, che è
     * l'unica decisione che la carta chiede.
     *
     * `onAttached(card, index)` (opzionale) gira DOPO l'aggancio, per le
     * poche carte che devono anche segnare qualcosa sul bersaglio (es.
     * Bozzolo dell'Evoluzione, id 157). Asincrono come ogni altro helper
     * di scelta di questo file: qualunque cosa debba avvenire dopo
     * l'aggancio va lì dentro, mai dopo la chiamata.
     *
     * **Usarlo per ogni futura Carta Equipaggiamento**, invece di
     * riscrivere la coppia findEquipTarget/attachEquip a mano.
     */
    function equipToChosenTarget(ctx, filterFn, options) {
        const candidati = collectEquipTargets(ctx, filterFn);
        if (candidati.length === 0) return false;
        // BUG CORRETTO (segnalato giocando): con DUE o più mostri idonei la
        // scelta apre la lista ed è asincrona, ma la Carta Equipaggiamento è
        // già nella sua casella senza aggancio — e la pulizia degli Equip
        // orfani in recomputeStaticEffects (duel-engine.js), che gira a
        // ogni ridisegno, la mandava al Cimitero prima del tocco: il log
        // diceva "equipaggiata" su una carta già nel Cimitero. Con un solo
        // candidato la scelta è immediata, ed è per questo che sembrava
        // funzionare. Due rimedi: la carta porta `equipInScelta` finché la
        // lista è aperta (la pulizia la salta), e la risoluzione ASPETTA la
        // scelta (chooseFieldCardTargetWaiting) invece di proseguire.
        const card = ctx.card;
        card.equipInScelta = true;
        const sceltaChiusa = () => { delete card.equipInScelta; };
        return chooseFieldCardTargetWaiting(ctx, candidati, {
            title: (options && options.title) || `⚔️ ${ctx.card.name}`,
            text: (options && options.text) || 'Scegli a quale tuo mostro equipaggiare questa carta.',
            // Equipaggiare è scegliere quel mostro come bersaglio (regola
            // vera): passa dal checkpoint di targeting, così Signore dei
            // D., Gran Scudo Gardna, Bastone del Silenzio, Guardiano
            // Kay'est e i Dei Egizi valgono anche contro le Magie
            // Equipaggiamento — prima non le vedevano. Se il bersaglio si
            // sottrae, la carta resta senza aggancio e la pulizia di
            // recomputeStaticEffects la manda al Cimitero, come per un
            // Equip che perde il suo mostro.
            dichiara: true,
            onNegato: sceltaChiusa
        }, (scelto) => {
            sceltaChiusa();
            // Lo slot si ricontrolla ORA: fra l'apertura del picker e il
            // click il mostro scelto può essere sparito dal Terreno, e
            // attachEquip legge l'indice senza verificare nulla.
            const slot = ctx.field(scelto.owner)[scelto.index];
            if (!slot || slot.card.uid !== scelto.card.uid) return;
            // scelto.owner, non ctx.owner: un reindirizzamento (Specchietto
            // della Fata) può spostare il bersaglio sull'altro Terreno.
            attachEquip(ctx, scelto.index, scelto.owner);
            if (options && typeof options.onAttached === 'function') options.onAttached(slot.card, scelto.index);
        });
    }

    /**
     * Toglie dal Cimitero la carta che sta reagendo al proprio arrivo lì
     * (hook `onSentToGraveyardFromField`) e la rimette altrove: in mano,
     * oppure in cima al Deck.
     *
     * Serve a quattro Carte Equipaggiamento che hanno tutte la stessa
     * forma di clausola — Pugnale Farfalla - Elma (135) torna in mano,
     * Corno dell'Unicorno (301) e Coccola Malevola (594) in cima al Deck
     * — quindi la manovra sta qui una volta sola invece che copiata
     * quattro volte.
     *
     * Due accorgimenti che non sono ovvi:
     *  - la carta si cerca per `uid`, non per id: di quella carta possono
     *    essercene più copie nello stesso Cimitero, e va spostata
     *    ESATTAMENTE quella che ha reagito;
     *  - il Deck dell'avversario in Multiplayer non esiste come array (è
     *    solo un contatore, vedi drawCardsToHand in game-flow.js): in
     *    quel caso si aggiorna il conteggio senza inventarsi un mazzo,
     *    altrimenti si creerebbero due verità diverse sui due client.
     */
    function riprendiDalCimitero(ctx, destinazione) {
        const grave = ctx.graveyard(ctx.owner);
        const i = grave.findIndex((c) => c.uid === ctx.card.uid);
        if (i === -1) return false;
        // Necrovalley (id 890): la carta resta nel Cimitero.
        if (ctx.graveyardMoveNegated(ctx.owner)) return false;
        const [carta] = grave.splice(i, 1);
        // Un equip appena tornato indietro non deve ricordarsi a chi era
        // agganciato: se rientrasse in campo con questi campi ancora
        // impostati, la pulizia di recomputeStaticEffects lo rispedirebbe
        // al Cimitero al primo render.
        delete carta.equippedToOwner;
        delete carta.equippedToIndex;
        delete carta.equippedToUid;

        if (destinazione === 'mano') {
            ctx.hand(ctx.owner).push(carta);
            return true;
        }
        const chiaveDeck = Tavolo.chiave(ctx.owner, 'Deck');
        const chiaveConteggio = Tavolo.chiave(ctx.owner, 'DeckCount');
        if (Array.isArray(gameState[chiaveDeck])) {
            // `pop()` pesca dalla FINE dell'array, quindi "in cima al
            // Deck" è la fine, non l'inizio (vedi drawCardsToHand).
            gameState[chiaveDeck].push(carta);
            gameState[chiaveConteggio] = gameState[chiaveDeck].length;
        } else {
            gameState[chiaveConteggio] = (gameState[chiaveConteggio] || 0) + 1;
        }
        return true;
    }

    /**
     * Aggancia ctx.card (la Carta Equipaggiamento appena attivata) al mostro
     * nello slot `index` — del proprio Terreno, o di `targetOwner` se
     * passato (un bersaglio ridiretto sull'altro lato).
     */
    function attachEquip(ctx, index, targetOwner) {
        const ownerDelMostro = targetOwner || ctx.owner;
        const target = ctx.field(ownerDelMostro)[index].card;
        ctx.card.equippedToOwner = ownerDelMostro;
        ctx.card.equippedToIndex = index;
        ctx.card.equippedToUid = target.uid;
        ctx.log(`⚔️ ${ctx.card.name} equipaggiata a ${target.name}!`);
        // "Ogni volta che questa carta viene equipaggiata con una Carta
        // Equipaggiamento" (es. Gearfried il Maestro di Spada, id 258):
        // reazione del BERSAGLIO stesso (target), non della Carta
        // Equipaggiamento appena agganciata (ctx.card) — nuovo hook
        // generico, riusabile da ogni futuro mostro con lo stesso testo.
        const targetDef = DuelEngine.getDefinition(target.id);
        if (targetDef && typeof targetDef.onEquipped === 'function') {
            targetDef.onEquipped(DuelEngine.makeContext(ownerDelMostro, { card: target, slotIndex: index, equipCard: ctx.card }));
        }
    }

    /** Il mostro a cui ctx.card (una Carta Equipaggiamento) è attualmente equipaggiata — sempre valido quando static() viene chiamato (vedi recomputeStaticEffects). */
    function equippedTarget(ctx) {
        return ctx.field(ctx.card.equippedToOwner)[ctx.card.equippedToIndex].card;
    }

    /**
     * Cerca nel Deck di `ctx.owner` tutte le carte che soddisfano
     * `filterFn`, e offre una VERA scelta al giocatore umano tra tutte
     * (non solo la prima trovata nell'ordine — casuale di fatto, essendo
     * il Deck mescolato a inizio duello) tramite
     * `window.DuelEngineUI.openCardListPicker` — stesso schema già
     * consolidato per un bersaglio scelto tra più candidati (Rinascita
     * del Mostro id 35, Predone Cyber id 174): il BOT (o una pagina senza
     * quel modale in DOM, o quando c'è un solo candidato) sceglie da solo
     * il primo trovato, comportamento identico a prima.
     *
     * Nata per correggere un problema reale segnalato dall'utente:
     * diverse carte con un vero "cerca 1 carta con una CATEGORIA di
     * requisiti dal Deck" (es. Sangan id 433: "1 mostro con 1500 o meno
     * ATK", Uccello Sonico id 601: "1 Magia Rituale") usavano
     * `deck.findIndex(...)` — la PRIMA carta idonea nell'ordine del
     * Deck mescolato, non una scelta libera — senza nemmeno documentarlo
     * con un `missingEffectNote`, a differenza della convenzione onesta
     * seguita nel resto del dataset.
     *
     * `onChosen(card)` riceve la carta GIÀ rimossa dal Deck (playerDeckCount/
     * botDeckCount già aggiornato) — puoi chiamare in modo sicuro sia in
     * modo sincrono (bot/singolo candidato) sia asincrono (picker aperto,
     * il giocatore sceglie più tardi): ri-valida SEMPRE eventuali
     * precondizioni dipendenti dal tempo (es. uno slot Mostro libero)
     * DENTRO `onChosen`, mai prima di chiamare questa funzione, esattamente
     * come già fa id 35 per il proprio slot/Cimitero.
     * `options.pickForBot(candidates)` è facoltativo: permette a un piano
     * tematico di scegliere con criterio senza cambiare il comportamento
     * storico delle altre carte, che resta il primo candidato mescolato.
     */
    function searchZoneWithChoice(ctx, zoneArray, filterFn, options, onChosen) {
        if (!Array.isArray(zoneArray)) return false;
        const candidates = zoneArray.filter(filterFn);
        if (candidates.length === 0) {
            if (options && options.noneFoundLog) ctx.log(options.noneFoundLog);
            return false;
        }
        const takeCard = (card) => {
            const idx = zoneArray.indexOf(card);
            if (idx === -1) return;
            zoneArray.splice(idx, 1);
            onChosen(card);
        };
        Decisioni.chiedi({
            chi: ctx.owner,
            candidati: candidates,
            titolo: (options && options.title) || '🔍 Scegli una carta',
            testo: (options && options.text) || 'Scegli quale carta.',
            automatica: (elenco) => ((options && typeof options.pickForBot === 'function')
                ? options.pickForBot(elenco) : elenco[0]) || elenco[0],
            automaticaSeUnica: true
        }, (card) => { if (card) takeCard(card); });
        return true;
    }

    function searchDeckWithChoice(ctx, filterFn, options, onChosen) {
        // options.deckOwner: quasi sempre assente (default ctx.owner — la
        // stragrande maggioranza delle carte cerca nel PROPRIO Deck), ma
        // alcune (es. Signore dei Vampiri id 658/Dama dei Vampiri id 665:
        // "manda 1 mostro dal Deck dell'AVVERSARIO al Cimitero") cercano nel
        // Deck dell'avversario mentre resta ctx.owner a scegliere — chi fa
        // la scelta (mostrare o no il picker al giocatore umano, dentro
        // searchZoneWithChoice) resta sempre determinato da ctx.owner,
        // indipendentemente da QUALE Deck si sta cercando.
        const deckOwner = (options && options.deckOwner) || ctx.owner;
        const deckKey = Tavolo.chiave(deckOwner, 'Deck');
        const deck = ctx.gameState[deckKey];
        return searchZoneWithChoice(ctx, deck, filterFn, options, (card) => {
            gameState[Tavolo.chiave(deckOwner, 'DeckCount')] = deck.length;
            onChosen(card);
        });
    }

    /**
     * Come searchDeckWithChoice qui sopra, ma per il Cimitero di `graveyardOwner`
     * (quasi sempre `ctx.owner`, a volte quello dell'avversario — es.
     * Libro della Vita) invece del Deck — nessun contatore separato da
     * aggiornare (ctx.graveyard(owner) riflette già la lunghezza reale).
     */
    function searchGraveyardWithChoice(ctx, graveyardOwner, filterFn, options, onChosen) {
        // Necrovalley (id 890): "nega ogni effetto Carta che sposterebbe una
        // carta nel Cimitero in un posto diverso". Questo helper sposta
        // sempre la carta fuori dal Cimitero (in mano, in campo, nel Deck),
        // quindi con Necrovalley attiva l'effetto non fa nulla. È il punto
        // condiviso da cui passa la gran parte di questi effetti; chi sposta
        // dal Cimitero con uno splice scritto a mano non è coperto.
        if (window.DuelEngine && DuelEngine.isNecrovalleyProtectingGraveyard && DuelEngine.isNecrovalleyProtectingGraveyard(graveyardOwner)) {
            ctx.log('🏺 Necrovalley nega l\'effetto: le carte nel Cimitero non possono essere spostate.');
            return false;
        }
        return searchZoneWithChoice(ctx, ctx.graveyard(graveyardOwner), filterFn, options, onChosen);
    }

    /**
     * Scelta VERA tra più mostri candidati GIÀ scoperti sul Terreno
     * (propri e/o dell'avversario) — es. Dispositivo di Evacuazione
     * Forzata (id 671, "scegli come bersaglio 1 mostro sul Terreno"),
     * che prima sceglieva sempre e solo il primo trovato (bug reale
     * segnalato dall'utente: "deve far scegliere 1 mostro sul terreno...
     * ma non lo fa"). `candidates`: array di { owner, index, card } già
     * filtrati da chi chiama (nessun controllo qui su chi può essere
     * bersagliato — resta responsabilità della carta, esattamente come
     * ctx.declareTarget, da chiamare dentro `onChosen` prima di agire
     * sul bersaglio scelto, mai qui). Riusa la STESSA interfaccia già
     * consolidata per una scelta tra carte vere
     * (window.DuelEngineUI.openCardListPicker) invece di un modale
     * dedicato "clicca sul Terreno": i candidati sono già vere `card`,
     * stesso identico schema già usato in js/engine/actions.js per
     * scegliere quale mostro sacrificare per un attacco con Tributo
     * extra — funzionalmente identico, niente UI nuova da mantenere.
     * Auto-sceglie il primo (comportamento di sempre) se non
     * c'è un vero giocatore umano con un modale disponibile, o se c'è un
     * solo candidato — stesso principio di searchZoneWithChoice qui
     * sopra.
     */
    function chooseFieldCardTarget(ctx, candidates, options, onChosenOriginale) {
        if (!candidates || candidates.length === 0) return false;
        // `options.dichiara`: il bersaglio scelto passa dal checkpoint di
        // targeting condiviso (ctx.declareTarget) PRIMA di arrivare alla
        // carta — vedi dichiaraBersaglioScelto qui sotto. Si avvolge
        // onChosen una volta sola, così ogni strada (picker, bot, scelta
        // remota) ci passa allo stesso modo.
        const onChosen = options && options.dichiara
            ? (scelto) => {
                dichiaraBersaglioSceltoWaiting(ctx, scelto, options, (finale) => {
                    if (finale) onChosenOriginale(finale);
                    else if (typeof options.onNegato === 'function') options.onNegato();
                });
            }
            : onChosenOriginale;
        // In Multiplayer la scelta VIAGGIA (`viaggia`, vedi
        // js/engine/decisioni.js): se a scegliere è l'avversario REMOTO si
        // aspetta la sua invece di indovinarla. Prima di questo, la copia
        // dell'effetto che gira di qua auto-sceglieva il primo candidato,
        // e se il giocatore vero ne aveva scelto un altro i due schermi
        // finivano per mostrare due partite diverse — con il Terreno di
        // chi SUBISCE l'effetto sbagliato proprio dalla sua parte, dove
        // nessuna fotografia di stato dell'avversario può correggerlo.
        //
        // Le carte COPERTE dell'AVVERSARIO entrano nell'elenco disegnate
        // col retro, non scoperte. Senza questo, un picker che dice
        // "scegli 1 carta sul suo Terreno" gli rivelava nome, ATK/DEF ed
        // effetto di ogni sua carta Set — informazione che al tavolo vero
        // non ha, e per giunta gratis, senza nemmeno dover scegliere
        // quella carta. Verificato che succedesse davvero: il picker di
        // Drago Barile elencava "Gearfried il Cavaliere di Ferro
        // ⚔️1800🛡️1600" per un mostro coperto.
        // Si maschera una COPIA (stesso uid, che è come il chiamante
        // ritrova il candidato dopo il click): la carta vera sul Terreno
        // non viene toccata. Le PROPRIE carte coperte restano scoperte
        // nell'elenco — sono già tue, non c'è niente da nascondere.
        const onCancel = options && typeof options.onCancel === 'function' ? options.onCancel : null;
        Decisioni.chiedi({
            chi: ctx.owner,
            candidati: candidates,
            mostra: (c) => {
                const copertaAvversaria = !!(c.slot && c.slot.isFaceDown) && c.owner !== ctx.owner;
                return copertaAvversaria ? Object.assign({}, c.card, { __mostraCoperta: true }) : c.card;
            },
            titolo: (options && options.title) || '🎯 Scegli un bersaglio',
            testo: (options && options.text) || 'Scegli quale carta bersagliare (tua o dell\'avversario).',
            automaticaSeUnica: true,
            // Facoltativo: serve a chi ha chiesto di essere aspettato
            // (attendiScelta), che deve sapere anche quando il giocatore
            // chiude la lista senza scegliere. Senza, chiudere lascia le
            // cose come stanno, come sempre.
            annullabile: !!onCancel
        }, (scelto) => {
            if (scelto) onChosen(scelto);
            else if (onCancel) onCancel();
        });
        return true;
    }

    /**
     * "Aspettami": da chiamare all'inizio di un handler che fa scegliere il
     * giocatore, quando chi lo esegue deve aspettare la scelta prima di
     * andare avanti — una risposta a un attacco, l'auto-effetto di chi
     * attacca, una decisione "durante il calcolo dei danni", un link di
     * una Chain. Torna la funzione da chiamare a scelta conclusa, su OGNI
     * strada (Annulla compreso), o la battaglia resta ferma.
     *
     * Fuori da quei punti torna una funzione che non fa niente, quindi una
     * carta può chiamarla sempre senza chiedersi da dove è stata
     * raggiunta. Vedi callCardHandlerWaiting in duel-engine.js.
     */
    function attendiScelta(ctx) {
        return ctx && typeof ctx.waitForChoice === 'function' ? ctx.waitForChoice() : function () {};
    }

    /**
     * chooseFieldCardTarget per un effetto OBBLIGATORIO che qualcuno sta
     * aspettando (una risposta a un attacco, l'auto-effetto di chi
     * attacca): chiede di essere aspettato (attendiScelta), riapre la lista
     * se il giocatore la chiude senza scegliere — l'effetto si sta già
     * risolvendo, non si può più tirarsi indietro — e chiude l'attesa su
     * ogni strada, anche se `onChosen` lancia un errore.
     *
     * È lo schema che serviva a cinque carte (214, 622, 819, 852, 895) che
     * prima sceglievano da sole proprio perché la battaglia non le
     * aspettava. Torna false se non c'è nessun candidato (e allora non
     * chiede nessuna attesa).
     */
    function chooseFieldCardTargetWaiting(ctx, candidati, options, onChosen) {
        if (!candidati || candidati.length === 0) return false;
        const fine = attendiScelta(ctx);
        // onNegato: con `dichiara` il bersaglio può sottrarsi, e allora
        // onChosen non viene chiamato — l'attesa va chiusa lo stesso.
        const negatoOriginale = options && options.onNegato;
        const apri = () => chooseFieldCardTarget(ctx, candidati, Object.assign({}, options, {
            onCancel: apri,
            onNegato: () => { try { if (typeof negatoOriginale === 'function') negatoOriginale(); } finally { fine(); } }
        }), (scelto) => {
            try { onChosen(scelto); } finally { fine(); }
        });
        apri();
        return true;
    }

    /**
     * Più bersagli sul Terreno scelti UNO ALLA VOLTA, per le carte che
     * dicono "scegli 2 dei tuoi mostri e 1 del tuo avversario" (Attacco a
     * Doppia Punta id 548) o "un numero di mostri pari a..." (Lady Arpia
     * Formazione della Fenice id 289). Prima quelle carte sceglievano da
     * sole i più deboli/più forti.
     *
     * `passi`: array di { candidati(giaScelti) -> candidati, title, text },
     * un elemento per bersaglio. La funzione riceve le carte già scelte
     * nei passi precedenti (array di candidati finali), così lo stesso
     * mostro non si sceglie due volte. Un passo senza candidati si salta.
     *
     * Ogni passo passa da chooseFieldCardTarget con `dichiara: true` e il
     * numero TOTALE di bersagli (Specchietto della Fata reagisce solo a un
     * bersaglio singolo): un bersaglio che si sottrae al checkpoint
     * semplicemente non entra fra i finali. Chiudere la lista la riapre:
     * l'effetto si sta già risolvendo. In Multiplayer ogni scelta viaggia
     * come sempre; il bot prende il primo candidato di ogni passo, quindi
     * chi chiama li ordina dal preferito.
     *
     * NON tocca le carte: `onDone(finali)` decide cosa farne, ed è anche il
     * punto in cui va chiusa un'eventuale attendiScelta. Torna false se il
     * primo passo non ha candidati (e allora chiama comunque onDone([])).
     */
    function chooseFieldTargetsInSequence(ctx, passi, onDone) {
        const finali = [];
        const totale = passi.length;
        let i = 0;
        const prossimo = () => {
            while (i < passi.length) {
                const passo = passi[i];
                const usati = new Set(finali.map((f) => f.card.uid));
                const candidati = (passo.candidati(finali.slice()) || []).filter((c) => c && c.card && !usati.has(c.card.uid));
                i++;
                if (candidati.length === 0) continue;
                const apri = () => chooseFieldCardTarget(ctx, candidati, {
                    title: passo.title,
                    text: passo.text,
                    // Costi/Tributi scelgono carte ma non le "bersagliano"
                    // secondo le regole: il chiamante può disattivare il
                    // checkpoint di targeting con dichiara:false.
                    dichiara: passo.dichiara !== false,
                    totalTargetCount: totale,
                    onNegato: prossimo,
                    onCancel: apri
                }, (scelto) => { finali.push(scelto); prossimo(); });
                apri();
                return;
            }
            onDone(finali);
        };
        const primi = passi.length ? (passi[0].candidati([]) || []) : [];
        prossimo();
        return primi.length > 0;
    }

    /**
     * Scelta fra OPZIONI con un'etichetta, non fra carte: dichiarare una
     * categoria (Mostro/Magia/Trappola, un Tipo di mostro) o scegliere fra
     * due effetti. Gemella di chooseFieldCardTarget per le scelte che non
     * hanno una carta da cliccare.
     *
     * - `options.options`: array di { value, label, icon? };
     * - `options.chooser` (default ctx.owner): chi sceglie;
     * - `options.pickForBot()`: torna il `value` che sceglie il bot (default:
     *   la prima opzione);
     * - `options.optional`: aggiunge "Annulla" (o `options.optionalLabel`);
     *   chiudendo, `onChosen(null)`.
     *
     * Nel Multiplayer a passo comune ogni scelta, opzioni comprese, viaggia
     * come posizione nello stesso elenco calcolato dai due motori.
     */
    function chooseOption(ctx, options, onChosen) {
        const o = options || {};
        const voci = (o.options || []).filter(Boolean);
        if (voci.length === 0) { onChosen(null); return; }
        Decisioni.chiedi({
            chi: o.chooser || ctx.owner,
            tipo: 'opzioni',
            candidati: voci,
            titolo: o.title,
            testo: o.text,
            automatica: (elenco) => {
                const scelto = typeof o.pickForBot === 'function' ? o.pickForBot() : elenco[0].value;
                return elenco.find((v) => v.value === scelto) || elenco[0];
            },
            annullabile: !!o.optional,
            etichettaAnnulla: o.optionalLabel
        }, (voce) => onChosen(voce ? voce.value : null));
    }

    /**
     * Fa passare un bersaglio appena scelto dal checkpoint di targeting
     * condiviso (ctx.declareTarget, duel-engine.js) e torna quello FINALE:
     * `null` se il bersaglio si è sottratto o l'effetto è stato annullato
     * (Gran Scudo Gardna, Signore dei D., Mago Comando del Caos, un Dio
     * Egizio...), oppure il candidato ricostruito su owner/index
     * restituiti, che possono essere stati RIDIRETTI (Specchietto della
     * Fata) — il chiamante deve usare sempre quelli, mai i propri.
     *
     * Prima ogni carta doveva ricordarsi di chiamare declareTarget dentro
     * la propria callback, e un audit (1.0.37) ne ha trovate una trentina
     * che non lo facevano: le carte che reagiscono al targeting non le
     * vedevano affatto. Ora basta chiedere `{ dichiara: true }` a
     * chooseFieldCardTarget.
     *
     * Il checkpoint copre solo i MOSTRI sul Terreno: un candidato della
     * zona Magia/Trappola passa così com'è. `options.totalTargetCount`
     * (default 1) serve a Specchietto della Fata/Campo di Riryoku, che
     * reagiscono solo a un effetto con UN bersaglio.
     */
    function dichiaraBersaglioScelto(ctx, scelto, options) {
        if (!scelto || scelto.zone === 'st') return scelto;
        const decl = ctx.declareTarget(scelto.owner, scelto.index, { totalTargetCount: (options && options.totalTargetCount) || 1 });
        if (!decl.allowed) return null;
        const slot = ctx.field(decl.targetOwner)[decl.targetIndex];
        if (!slot) return null;
        return { owner: decl.targetOwner, index: decl.targetIndex, zone: 'monster', card: slot.card, slot: slot };
    }

    /**
     * Gemella con continuazione di dichiaraBersaglioScelto. È il percorso
     * usato dai picker: se Specchietto della Fata o Spostamento chiedono al
     * loro controllore un nuovo bersaglio, la callback della carta parte
     * soltanto dopo quella decisione (anche nel Multiplayer a passo comune).
     */
    function dichiaraBersaglioSceltoWaiting(ctx, scelto, options, onDone) {
        if (!scelto || scelto.zone === 'st') { onDone(scelto); return; }
        ctx.declareTargetWaiting(scelto.owner, scelto.index,
            { totalTargetCount: (options && options.totalTargetCount) || 1 }, (decl) => {
                if (!decl.allowed) { onDone(null); return; }
                const slot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!slot) { onDone(null); return; }
                onDone({ owner: decl.targetOwner, index: decl.targetIndex, zone: 'monster', card: slot.card, slot: slot });
            });
    }

    /**
     * Nome storico di chooseFieldCardTarget, quando sapeva scegliere solo
     * fra mostri. Resta perché lo usano già diverse carte e rinominarle
     * tutte sarebbe churn senza guadagno: la funzione non è mai stata
     * legata ai mostri: i candidati li raccoglie e li filtra chi chiama.
     * Dichiarata come `function` e non `const` apposta, così vale anche
     * per le registrazioni carta che girano prima di questa riga.
     */
    function chooseFieldMonsterTarget(ctx, candidates, options, onChosen) {
        return chooseFieldCardTarget(ctx, candidates, options, onChosen);
    }

    /**
     * Raccoglie i bersagli possibili SUL TERRENO, da una zona sola o da
     * entrambe, pronti per chooseFieldCardTarget.
     *
     * È il pezzo che mancava per le carte il cui testo dice "1 Magia/
     * Trappola sul Terreno" (Tornado di Polvere id 219, Rimuovi Trappola
     * id 417, Distruzione con Zampata id 647) o addirittura "N carte sul
     * Terreno" senza distinguere (Attacco d'Icaro id 795): prima esisteva
     * solo la raccolta dei MOSTRI, scritta a mano dentro ogni carta, e
     * per le Magie/Trappole ognuna si arrangiava prendendo la prima che
     * trovava.
     *
     * Ogni candidato porta con sé la propria `zone` ('monster' o 'st'),
     * perché chi agisce dopo deve sapere in quale fila togliere la carta:
     * distruggere un mostro e distruggere una Trappola passano da due
     * funzioni diverse del motore.
     *
     * Le carte COPERTE sono incluse solo se richiesto esplicitamente
     * (`includiCoperte`): per la maggior parte degli effetti il testo
     * reale dice "scoperta", e mostrare al giocatore il contenuto di una
     * carta coperta avversaria in un picker rivelerebbe informazione
     * nascosta.
     */
    function collectFieldTargets(ctx, opzioni) {
        const o = opzioni || {};
        const zone = o.zone || 'both';           // 'monster' | 'st' | 'both'
        const diChi = o.owner || 'both';         // 'player' | 'bot' | 'both' | 'self' | 'opponent'
        const filtro = o.filter || (() => true);
        const includiCoperte = !!o.includiCoperte;

        const proprietari = diChi === 'both' ? Tavolo.ordine()
            : diChi === 'self' ? [ctx.owner]
                : diChi === 'opponent' ? [ctx.opponent]
                    : [diChi];

        const out = [];
        proprietari.forEach((owner) => {
            if (zone === 'monster' || zone === 'both') {
                ctx.field(owner).forEach((slot, index) => {
                    if (!slot || !slot.card) return;
                    if (slot.isFaceDown && !includiCoperte) return;
                    if (!filtro(slot.card, owner, slot)) return;
                    out.push({ owner: owner, index: index, zone: 'monster', card: slot.card, slot: slot });
                });
            }
            if (zone === 'st' || zone === 'both') {
                ctx.stField(owner).forEach((slot, index) => {
                    if (!slot || !slot.card) return;
                    if (slot.isFaceDown && !includiCoperte) return;
                    if (!filtro(slot.card, owner, slot)) return;
                    out.push({ owner: owner, index: index, zone: 'st', card: slot.card, slot: slot });
                });
            }
        });
        return out;
    }

    /**
     * Scelta VERA di QUALE carta scartare dalla PROPRIA mano — per il caso
     * comunissimo "scarta 1 carta [dalla mano]" come costo/effetto di
     * un'altra carta (es. Tributo ai Dannati id 492, Vortice Fulmineo id
     * 729, Interferenza Magica id 361): decine di carte in questo dataset
     * scartavano sempre e solo `ctx.hand(ctx.owner)[0]` (la prima carta in
     * mano) invece di una vera scelta del giocatore — bug reale segnalato
     * dall'utente ("effetto scarta una carta non fa scegliere la carta da
     * scartare dalla mano"), stessa identica famiglia di
     * "primo candidato invece di vera scelta" già corretta altrove in
     * questo file (searchZoneWithChoice/chooseFieldMonsterTarget qui
     * sopra) — qui per la mano invece che Deck/Cimitero/Terreno.
     * `options.filter` (default: ogni carta) restringe i candidati per le
     * carte che vincolano il TIPO di scarto (es. "scarta 1 Magia dalla
     * mano" di Chiron il Mago id 150, "scarta 1 mostro Tipo Drago" di
     * Spirit Ryu id 630) — se il filtro esclude tutto, nessun picker si
     * apre (comportamento "costo non pagabile", stesso di searchZoneWithChoice
     * con 0 candidati). `options.handOwner` (default ctx.owner): DI CHI è
     * la mano da cui scartare — quasi sempre la propria, ma alcune carte
     * (es. Confisca id 874: "guarda la mano del tuo avversario, scegli 1
     * carta al suo interno e falla scartare") fanno scegliere a ctx.owner
     * una carta dalla mano DELL'AVVERSARIO, esattamente come Amazzone
     * Maestra delle Catene (id 86) già fa per "prendi 1 mostro" — chi
     * decide (e quindi chi vede il picker) resta sempre ctx.owner,
     * indipendentemente da quale mano si sta scartando, stesso principio
     * di `options.deckOwner` in searchDeckWithChoice. `onDiscarded(card)`
     * riceve la carta GIÀ scartata (già rimossa dalla mano e nel Cimitero,
     * con onSentToGraveyardFromHand già scattato) — ASINCRONO se si apre
     * un vero picker: qualunque logica che deve girare DOPO lo scarto (es.
     * scegliere poi un bersaglio da distruggere) va messa dentro
     * `onDiscarded`, mai dopo la chiamata a questa funzione, esattamente
     * come per searchZoneWithChoice/chooseFieldMonsterTarget. Il bot (o un
     * fallback senza UI) sceglie da solo `candidates[0]` di default —
     * `options.pickForBot(candidates)` (opzionale) sostituisce questa
     * scelta con un'euristica dedicata quando ne serve una migliore del
     * primo trovato (es. Confisca id 874: il bot guarda la mano
     * dell'avversario e sceglie la carta con l'impatto stimato più alto
     * via AI_SHARED.scoreCardImpact, non semplicemente la prima).
     */
    function offerHandDiscardChoice(ctx, options, onDiscarded) {
        const handOwner = (options && options.handOwner) || ctx.owner;
        const hand = ctx.hand(handOwner);
        const filterFn = (options && options.filter) || (() => true);
        const candidates = hand.filter(filterFn);
        if (candidates.length === 0) {
            if (options && options.noneFoundLog) ctx.log(options.noneFoundLog);
            return false;
        }
        const doDiscard = (card) => {
            const idx = ctx.hand(handOwner).indexOf(card);
            if (idx === -1) return;
            const discarded = ctx.discardChosenFromHand(handOwner, idx);
            onDiscarded(discarded);
        };
        const onCancel = options && typeof options.onCancel === 'function' ? options.onCancel : null;
        Decisioni.chiedi({
            chi: ctx.owner,
            candidati: candidates,
            titolo: (options && options.title) || '🗑️ Scarta una carta',
            testo: (options && options.text) || 'Scegli quale carta scartare dalla mano.',
            automatica: (elenco) => ((options && typeof options.pickForBot === 'function') ? options.pickForBot(elenco) : elenco[0]) || elenco[0],
            automaticaSeUnica: true,
            // Facoltativo: serve a chi ha chiesto di essere aspettato
            // (attendiScelta), che deve sapere anche quando il giocatore
            // chiude senza scartare.
            annullabile: !!onCancel
        }, (card) => {
            if (card) doDiscard(card);
            else if (onCancel) onCancel();
        });
        return true;
    }

    /**
     * Scelta VERA di QUALE carta della PROPRIA mano usare, senza
     * scartarla — la sorella mancante di offerHandDiscardChoice qui sopra.
     *
     * Serve a ogni carta che dice "Special Summona 1 mostro <tale> dalla
     * tua mano" (Richiamo della Mummia id 670 e simili): lì la carta non
     * va scartata, va GIOCATA, quindi l'helper dello scarto non andava
     * bene e il codice finiva per prendersi il primo candidato con un
     * `hand.findIndex(...)` — bug reale segnalato dall'utente ("non fa
     * selezionare la carta che voglio evocare, va lei da sola in
     * autonomia").
     *
     * `onChosen(card, index)` riceve la carta ANCORA IN MANO e il suo
     * indice attuale: è chi chiama a decidere cosa farne (toglierla dalla
     * mano ed Evocarla, rivelarla, ecc.). ASINCRONO quando si apre un
     * vero picker, quindi tutto ciò che deve avvenire DOPO la scelta va
     * dentro `onChosen` — stessa regola di tutti gli altri helper di
     * scelta di questo file. L'indice si ricalcola al momento della
     * scelta e non prima: fra l'apertura del picker e il click la mano
     * può essere cambiata.
     */
    function chooseCardFromHand(ctx, options, onChosen) {
        const handOwner = (options && options.handOwner) || ctx.owner;
        const filterFn = (options && options.filter) || (() => true);
        const candidates = ctx.hand(handOwner).filter(filterFn);
        if (candidates.length === 0) {
            if (options && options.noneFoundLog) ctx.log(options.noneFoundLog);
            return false;
        }
        const usa = (card) => {
            const idx = ctx.hand(handOwner).indexOf(card);
            if (idx === -1) return; // sparita dalla mano nel frattempo
            onChosen(card, idx);
        };
        Decisioni.chiedi({
            chi: ctx.owner,
            candidati: candidates,
            titolo: (options && options.title) || '🖐️ Scegli una carta',
            testo: (options && options.text) || 'Scegli quale carta usare dalla tua mano.',
            automatica: (elenco) => ((options && typeof options.pickForBot === 'function') ? options.pickForBot(elenco) : elenco[0]) || elenco[0],
            automaticaSeUnica: true
        }, (card) => { if (card) usa(card); });
        return true;
    }

    /**
     * Scelta VERA fra carte GIÀ filtrate da chi chiama, senza toccarle:
     * non le rimuove da nessuna zona, non le sposta, non le segna. È
     * l'anello che mancava fra gli helper di scelta di questo file —
     * tutti gli altri presuppongono una destinazione:
     *   searchZoneWithChoice/searchGraveyardWithChoice   tolgono la carta
     *   banishFromGraveyardWithChoice                    la bandiscono
     *   offerHandDiscardChoice                           la scartano
     *   chooseCardFromHand                               dà anche l'indice in mano
     *   chooseFieldCardTarget                            vuole {owner,index} sul Terreno
     *
     * Serve quando la carta scelta deve restare esattamente dov'è: il
     * primo caso è Tombarolo (id 276), che USA una Magia dal Cimitero
     * dell'AVVERSARIO lasciandola lì dov'era. **Usarlo per ogni futura
     * carta con quella forma**, invece di aprire a mano
     * DuelEngineUI.openCardListPicker: qui c'è già l'auto-scelta del bot
     * e il ritrovamento per uid dopo il click.
     *
     * `options.pickForBot` permette un'euristica dedicata quando "il
     * primo della lista" non è una scelta sensata per il bot.
     */
    function chooseCardFromList(ctx, cards, options, onChosen) {
        if (!Array.isArray(cards) || cards.length === 0) return false;
        Decisioni.chiedi({
            chi: ctx.owner,
            candidati: cards,
            titolo: (options && options.title) || '🔍 Scegli una carta',
            testo: (options && options.text) || 'Scegli quale carta usare.',
            automatica: (elenco) => ((options && typeof options.pickForBot === 'function') ? options.pickForBot(elenco) : elenco[0]) || elenco[0],
            automaticaSeUnica: true
        }, (card) => { if (card) onChosen(card); });
        return true;
    }

    /**
     * Scarto scelto da CHI LO SUBISCE, non da chi controlla l'effetto
     * ("quel proprietario sceglie e manda 1 carta dalla sua mano al Cimitero",
     * Criosfinge id 761; "...poi ne scarta 1 a sua scelta", Duo Delinquente
     * id 873). Ogni altra scelta di questo motore è di chi controlla
     * l'effetto: qui decide `victimOwner`.
     *  - Vittima umana (`'player'`, con l'interfaccia): picker sulla propria
     *    mano, OBBLIGATORIO — chiudere la finestra la riapre, lo scarto non
     *    si può rifiutare.
     *  - Vittima bot: scarta la carta che vale meno per lui (punteggio di
     *    impatto più basso, AI_SHARED.scoreCardImpact), non la prima a caso.
     *  - Multiplayer: entrambi i motori conoscono la stessa mano e
     *    `Decisioni` aspetta sul client specchio la posizione scelta dalla
     *    vittima reale; non servono segnaposto né fotografie correttive.
     * Torna false se la mano della vittima è vuota.
     */
    function victimChoosesDiscard(ctx, victimOwner, options, onDiscarded) {
        const o = options || {};
        const mano = ctx.hand(victimOwner);
        if (mano.length === 0) return false;
        const scarta = (card) => {
            const i = ctx.hand(victimOwner).indexOf(card);
            if (i === -1) return;
            const scartata = ctx.discardChosenFromHand(victimOwner, i);
            if (typeof onDiscarded === 'function') onDiscarded(scartata);
        };
        const apri = () => {
            const attuale = ctx.hand(victimOwner).slice();
            if (attuale.length === 0) return;
            Decisioni.chiedi({
                chi: victimOwner,
                candidati: attuale,
                titolo: o.title || '🗑️ Devi scartare una carta',
                testo: o.text || 'Scegli tu quale carta della tua mano mandare al Cimitero.',
                // Il bot scarta ciò che vale meno per lui, non la prima a caso.
                automatica: (elenco) => (Tavolo.eIA(victimOwner) && window.AI_SHARED && typeof AI_SHARED.scoreCardImpact === 'function')
                    ? elenco.slice().sort((a, b) => AI_SHARED.scoreCardImpact(a) - AI_SHARED.scoreCardImpact(b))[0]
                    : elenco[0],
                automaticaSeUnica: true,
                // Lo scarto è obbligatorio: chiudere non lo annulla, riapre.
                annullabile: true
            }, (card) => {
                if (card) scarta(card);
                else setTimeout(apri, 0);
            });
        };
        apri();
        return true;
    }

    /**
     * Dentro un onCardEffectTargetDeclare: "...e se lo fai, distruggi quella
     * Magia" (Freed il Generale id 888, Bastone del Silenzio id 423). Si
     * distrugge solo una Magia che RESTA sul Terreno (Continua o
     * Equipaggiamento): una Normale/Rapida va al Cimitero da sola a fine
     * risoluzione, e distruggerla mentre si sta ancora risolvendo la
     * manderebbe al Cimitero due volte. Torna true se l'ha distrutta.
     */
    function destroyTargetingSpellIfItStays(ctx) {
        if (!ctx.sourceCard || !ctx.sourceOwner) return false;
        const def = DuelEngine.getDefinition(ctx.sourceCard.id);
        const resta = ctx.sourceCard.subtype === 'continuous' || ctx.sourceCard.subtype === 'equip'
            || !!(def && (def.continuous || def.isEquip));
        if (!resta) return false;
        const i = ctx.stField(ctx.sourceOwner).findIndex((s) => s && s.card.uid === ctx.sourceCard.uid);
        if (i === -1) return false;
        ctx.destroySpellTrap(ctx.sourceOwner, i);
        return true;
    }

    /**
     * Scelta VERA di "fino a N" carte fra quelle già filtrate da chi chiama
     * ("bandisci fino a 3 mostri", "rimanda un numero qualsiasi di carte"):
     * il giocatore ne sceglie una alla volta e si ferma quando vuole col
     * pulsante Chiudi del picker (o raggiunto `max`). L'ORDINE in cui le
     * sceglie è l'ordine dell'array passato a `onDone`, per le carte che
     * dicono "nell'ordine che preferisci" (Yado Karu id 1113).
     *
     * Non tocca le carte: chi chiama decide cosa farne in `onDone(scelte)`,
     * che riceve anche un array vuoto (il giocatore ha chiuso subito — una
     * scelta legittima per un "fino a"). ASINCRONO quando si apre un
     * picker, come ogni helper di scelta di questo file.
     *
     * Il bot (o un fallback senza UI) sceglie con `options.pickForBot(cards,
     * max)` se c'è, altrimenti prende le prime `max`.
     * `options.min` (default 0): sotto quel numero il pulsante Chiudi non
     * conclude, il picker si riapre.
     */
    function chooseUpToNFromList(ctx, cards, max, options, onDone) {
        const o = options || {};
        const minimo = o.min || 0;
        const tetto = Math.min(max, (cards || []).length);
        if (!Array.isArray(cards) || cards.length === 0 || tetto <= 0) { onDone([]); return false; }
        // Il bot (o un duello senza interfaccia) sceglie l'insieme intero in
        // un colpo solo, con la sua euristica: chiedergli una carta alla
        // volta lo costringerebbe a decidere senza sapere quante ne vuole.
        if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
            const auto = typeof o.pickForBot === 'function' ? o.pickForBot(cards.slice(), tetto) : cards.slice(0, tetto);
            onDone((auto || []).slice(0, tetto));
            return true;
        }
        const scelte = [];
        const prossima = () => {
            const restanti = cards.filter((c) => !scelte.some((s) => s.uid === c.uid));
            if (scelte.length >= tetto || restanti.length === 0) { onDone(scelte); return; }
            const giaPrese = scelte.length ? ` Scelte finora: ${scelte.map((c) => c.name).join(', ')}.` : '';
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: restanti,
                titolo: o.title || '🔍 Scegli le carte',
                testo: `${o.text || 'Scegli una carta alla volta.'} (${scelte.length}/${tetto}) ${scelte.length >= minimo ? 'Chiudi per finire.' : ''}${giaPrese}`,
                annullabile: true
            }, (card) => {
                if (card) { scelte.push(card); prossima(); return; }
                if (scelte.length >= minimo) onDone(scelte);
                else prossima();
            });
        };
        prossima();
        return true;
    }

    /**
     * Come searchGraveyardWithChoice qui sopra, ma per un costo/effetto che
     * deve BANDIRE la carta scelta (Zona Bandite), non spostarla in mano/
     * Terreno — usata per la prima volta da Spada Divina - Lama della
     * Fenice (id 722)/Fabbrica dell'Ingranaggio Antico (id 841)/Libro
     * della Vita (id 669, lato Cimitero avversario). BUG REALE trovato ed
     * evitato qui: searchZoneWithChoice/takeCard rimuove GIÀ la carta
     * dalla zona PRIMA di chiamare onChosen (pensato per "sposta la carta
     * altrove", dove la rimozione generica basta) — ma ctx.banishFromGraveyard
     * richiede che la carta sia ANCORA nel Cimitero per trovarla
     * (grave.indexOf(card)) e per il controllo Necrovalley (id 890),
     * quindi chiamarlo DOPO che takeCard l'ha già rimossa fallisce
     * sempre silenziosamente. Questa funzione non rimuove nulla da sola:
     * lascia scegliere tra i candidati (senza toccare l'array) e delega
     * la rimozione+il controllo Necrovalley a banishFromGraveyard stesso.
     */
    function banishFromGraveyardWithChoice(ctx, graveyardOwner, filterFn, options, onBanished) {
        const grave = ctx.graveyard(graveyardOwner);
        const candidates = grave.filter(filterFn);
        if (candidates.length === 0) {
            if (options && options.noneFoundLog) ctx.log(options.noneFoundLog);
            return false;
        }
        const proceed = (card) => {
            if (ctx.banishFromGraveyard(graveyardOwner, card)) onBanished(card);
        };
        Decisioni.chiedi({
            chi: ctx.owner,
            candidati: candidates,
            titolo: (options && options.title) || '🔍 Scegli una carta',
            testo: (options && options.text) || 'Scegli quale carta bandire.',
            automaticaSeUnica: true
        }, (card) => { if (card) proceed(card); });
        return true;
    }

    /**
     * Costo "banisci N mostri dal Cimitero che soddisfano certi requisiti"
     * per una Special Summon dalla mano (es. Inferno id 677, Fenrir id
     * 698, Stregone del Caos id 740) — a differenza di searchGraveyardWithChoice
     * qui sopra (usata per effetti REATTIVI, dove aprire un picker
     * asincrono dopo il fatto è sicuro), qui il valore di ritorno di
     * paySpecialSummonCost GATE sincronamente se la Special Summon
     * procede (DuelEngine.trySpecialSummonFromHand, duel-engine.js) — un
     * picker asincrono qui dentro tornerebbe true PRIMA che la scelta sia
     * fatta. La scelta vera si fa quindi PRIMA, nel click handler
     * (offerSpecialSummonBanishChoice, actions.js), che deposita gli uid
     * scelti in gameState.pendingSpecialSummonBanishUids — questa
     * funzione li legge e li consuma, provando ad assegnarli ai
     * `filters` richiesti (un predicato per carta necessaria, ripetuto
     * per un conteggio omogeneo); se assente/non valida (bot, chiamata
     * diretta da test/console, o nessuna vera scelta esisteva) ricade sul
     * primo assortimento valido trovato nel Cimitero, invariato rispetto
     * al comportamento precedente.
     */
    function resolveSpecialSummonBanishCost(ctx, filters, logText) {
        const grave = ctx.graveyard(ctx.owner);
        const pendingUids = gameState.pendingSpecialSummonBanishUids;
        gameState.pendingSpecialSummonBanishUids = null;
        function tryAssign(pool) {
            const used = new Set();
            const chosen = [];
            for (const filterFn of filters) {
                const match = pool.find((c) => !used.has(c.uid) && filterFn(c));
                if (!match) return null;
                used.add(match.uid);
                chosen.push(match);
            }
            return chosen;
        }
        let chosen = null;
        if (pendingUids && pendingUids.length === filters.length) {
            const pendingCards = pendingUids.map((uid) => grave.find((c) => c.uid === uid)).filter(Boolean);
            if (pendingCards.length === filters.length) chosen = tryAssign(pendingCards);
        }
        if (!chosen) chosen = tryAssign(grave);
        if (!chosen) return false;
        const ok = chosen.every((card) => ctx.banishFromGraveyard(ctx.owner, card));
        if (ok && logText) ctx.log(logText);
        return ok;
    }

    /**
     * Gemella di resolveSpecialSummonBanishCost qui sopra, ma per un
     * costo "tributa N mostri sul proprio Terreno" (es. Drago Toon Occhi
     * Blu id 123, Manga Ryu-Ran id 606: 2 mostri QUALSIASI) — legge/
     * consuma gameState.pendingSpecialSummonTributeUids, depositata da
     * offerSpecialSummonTributeChoice (actions.js). Per un tributo
     * SINGOLO con un requisito specifico (es. Exxod id 753, "Sfinge") si
     * riusa invece il meccanismo preesistente
     * getSpecialSummonSacrificeCandidates/pendingSpecialSummonSacrificeUid,
     * che già copriva quel caso da prima di questa sessione.
     */
    function resolveSpecialSummonTributeCost(ctx, filters, logText) {
        const field = ctx.field(ctx.owner);
        const pendingUids = gameState.pendingSpecialSummonTributeUids;
        gameState.pendingSpecialSummonTributeUids = null;
        function tryAssign(indexPool) {
            const used = new Set();
            const indices = [];
            for (const filterFn of filters) {
                const found = indexPool.find((i) => !used.has(i) && field[i] && filterFn(field[i].card));
                if (found === undefined) return null;
                used.add(found);
                indices.push(found);
            }
            return indices;
        }
        let indices = null;
        if (pendingUids && pendingUids.length === filters.length) {
            const pendingIndices = pendingUids.map((uid) => field.findIndex((s) => s && s.card.uid === uid)).filter((i) => i !== -1);
            if (pendingIndices.length === filters.length) indices = tryAssign(pendingIndices);
        }
        if (!indices) {
            const allIndices = field.map((s, i) => (s ? i : -1)).filter((i) => i !== -1);
            indices = tryAssign(allIndices);
        }
        if (!indices) return false;
        indices.forEach((i) => {
            ctx.graveyard(ctx.owner).push(field[i].card);
            field[i] = null;
        });
        if (logText) ctx.log(logText);
        return true;
    }

    /**
     * Attiva l'aggancio di un mostro Union (def.isUnion — es. Testa di
     * Drago Y id 513, Piattaforma di Supporto Mech Pesante id 831) dalla
     * zona Mostro (dov'è ctx.index) alla zona Magia/Trappola come una
     * Carta Equipaggiamento — usa lo stesso attachEquip qui sopra, poi
     * sposta la carta stessa da fieldOf a stFieldOf. Torna false (nessun
     * effetto) se non c'è un bersaglio idoneo o nessuna casella Magia/
     * Trappola libera. Il ritorno automatico sul Terreno quando il
     * bersaglio non è più valido vive in recomputeStaticEffects
     * (duel-engine.js, def.isUnion). Questo helper copre soltanto
     * l'AGGANCIO: lo stacco volontario è dichiarato dalla singola Union
     * con `continuous` + `repeatableWhileContinuous` (Y, Z e Drago Nero
     * Pece), perché deve condividere con l'aggancio il limite una volta
     * per turno e rispettare la propria condizione di bersaglio.
     */
    function attachUnionMonster(ctx, filterFn) {
        // Esclude sempre se stessa dai bersagli idonei: un mostro Union
        // il cui unionTargetFilter è ampio (es. Piattaforma di Supporto
        // Mech Pesante id 831: "qualsiasi mostro Tipo Macchina", e lei
        // stessa lo è) non deve mai potersi agganciare a se stessa.
        // A quale mostro agganciarsi lo sceglie il giocatore (prima era il
        // primo idoneo da sinistra), e il bersaglio passa dal checkpoint di
        // targeting come per ogni Equip: il testo reale di un Union dice
        // "scegli come bersaglio 1 mostro che controlli".
        const candidati = collectEquipTargets(ctx, (c) => c.uid !== ctx.card.uid && (!filterFn || filterFn(c)));
        if (candidati.length === 0) return false;
        const ownField = ctx.field(ctx.owner);
        if (ctx.index == null || !ownField[ctx.index] || ownField[ctx.index].card.uid !== ctx.card.uid) return false;
        if (ctx.stField(ctx.owner).findIndex((s) => s === null) === -1) {
            ctx.log(`⚠️ Nessuna casella Magia/Trappola libera: ${ctx.card.name} non può agganciarsi.`);
            return false;
        }
        return chooseFieldCardTarget(ctx, candidati, {
            title: `🔗 ${ctx.card.name}`,
            text: 'Scegli a quale tuo mostro agganciare questo mostro Union.',
            dichiara: true
        }, (scelto) => {
            // Tutto si ricontrolla ORA: fra l'apertura del picker e il
            // click il Terreno può essere cambiato.
            const selfSlot = ownField[ctx.index];
            if (!selfSlot || selfSlot.card.uid !== ctx.card.uid) return;
            const targetSlot = ctx.field(scelto.owner)[scelto.index];
            if (!targetSlot || targetSlot.card.uid !== scelto.card.uid) return;
            const freeStSlot = ctx.stField(ctx.owner).findIndex((s) => s === null);
            if (freeStSlot === -1) return;
            ownField[ctx.index] = null;
            attachEquip(ctx, scelto.index, scelto.owner);
            ctx.stField(ctx.owner)[freeStSlot] = { card: ctx.card, isFaceDown: false, setOnTurn: gameState.turn };
        });
    }

    /**
     * Livello totale MASSIMO sacrificabile per un'Evocazione Rituale, dal
     * Terreno E dalla mano (esclusa la carta rituale stessa in mano, indice
     * `ritualHandIndex`) — regola generica di ogni Evocazione Rituale
     * reale (i Sacrifici possono venire da entrambe le zone), usata da
     * canActivate per il pre-check "ne ho abbastanza".
     */
    function maxRitualTributeLevel(ctx, ritualHandIndex) {
        const fieldTotal = ctx.field(ctx.owner).reduce((sum, slot) => sum + (slot ? (slot.card.level || 0) : 0), 0);
        const handTotal = ctx.hand(ctx.owner).reduce((sum, c, i) => sum + (i === ritualHandIndex ? 0 : (c.level || 0)), 0);
        return fieldTotal + handTotal;
    }

    /**
     * Sceglie ed esegue i Sacrifici per un'Evocazione Rituale, dal Terreno
     * E dalla mano (esclusa `ritualHandIndex`, la carta rituale stessa) —
     * greedy dai Livelli più alti al più basso finché il totale richiesto
     * è raggiunto (stessa SEMPLIFICAZIONE già dichiarata per Rito del
     * Guerriero Nero/id 56: nessuna selezione manuale come nell'Evocazione
     * Tributo). Manda tutti i sacrificati al Cimitero. Rimuove dal campo
     * PRIMA (indici stabili), poi dalla mano in ordine di indice
     * decrescente (per non spostare gli indici già raccolti).
     */
    function performRitualTribute(ctx, requiredLevel, ritualHandIndex) {
        const field = ctx.field(ctx.owner);
        const hand = ctx.hand(ctx.owner);
        const pool = field.map((slot, index) => (slot ? { source: 'field', index: index, level: slot.card.level || 0 } : null)).filter(Boolean)
            .concat(hand.map((c, index) => (index !== ritualHandIndex ? { source: 'hand', index: index, level: c.level || 0 } : null)).filter(Boolean))
            .sort((a, b) => b.level - a.level);
        let remaining = requiredLevel;
        const toSacrifice = [];
        pool.forEach((entry) => {
            if (remaining <= 0) return;
            toSacrifice.push(entry);
            remaining -= entry.level;
        });
        // Conserva le carte PRIMA di rimuoverle: specialSummon() consuma
        // questo payload per la cinematica Rituale e soltanto dopo mette
        // il nuovo mostro sul Terreno. Il contesto e' specifico di questa
        // risoluzione, quindi non puo' contaminare una Summon successiva.
        ctx._pendingRitualVisual = {
            materials: toSacrifice.map((entry) => entry.source === 'field'
                ? field[entry.index].card
                : hand[entry.index]).filter(Boolean)
        };
        toSacrifice.filter((e) => e.source === 'field').forEach((entry) => {
            ctx.graveyard(ctx.owner).push(field[entry.index].card);
            field[entry.index] = null;
        });
        toSacrifice.filter((e) => e.source === 'hand').sort((a, b) => b.index - a.index).forEach((entry) => {
            const [card] = hand.splice(entry.index, 1);
            ctx.graveyard(ctx.owner).push(card);
        });
    }


    /**
     * Vero se `owner` controlla una "Piccola Falena" (id 522) scoperta sul
     * proprio Terreno che è stata equipaggiata con "Bozzolo dell'Evoluzione"
     * (id 157, vedi qui sopra) esattamente `ownTurns` PROPRI turni fa — e se
     * è ADESSO il proprio turno (il testo reale dice "durante il tuo Nº
     * turno", non "da quel turno in poi"). Dato che gameState.turn avanza
     * di 1 ad ogni cambio turno (un giocatore alla volta, vedi changeTurn
     * in game-flow.js), N propri turni dopo corrisponde a +2N sul contatore
     * grezzo. Usata da 50 (Larva Mostruosa, N=2) e 52 (Grande Falena, N=4)
     * qui sotto. SEMPLIFICAZIONE: non tiene conto di eventuali turni
     * extra/salti di turno che alterassero questo conteggio — nessuna
     * carta di quel tipo risulta presente in alcun mazzo costruito finora.
     */
    function findPetitMothReadyForCocoonSummon(ctx, ownTurns) {
        if (gameState.currentPlayer !== ctx.owner) return -1;
        return ctx.field(ctx.owner).findIndex((slot) =>
            slot && !slot.isFaceDown && slot.card.id === 522 &&
            slot.card._cocoonEquippedOnTurn != null &&
            (gameState.turn - slot.card._cocoonEquippedOnTurn) === ownTurns * 2
        );
    }

    function releaseRelinquishedTarget(ctx) {
        const absorbed = ctx.card._relinquishedTarget;
        if (!absorbed) return;
        const owner = ctx.card._relinquishedFromOwner;
        const emptySlot = ctx.field(owner).findIndex((slot) => slot === null);
        if (emptySlot !== -1) {
            ctx.field(owner)[emptySlot] = { card: absorbed, position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: false, summonedOnTurn: gameState.turn };
            ctx.log(`🌀 ${absorbed.name} torna sul campo del suo proprietario!`);
        } else {
            ctx.graveyard(owner).push(absorbed);
            ctx.log(`🌀 ${absorbed.name} torna al Cimitero del suo proprietario (Terreno pieno).`);
        }
    }

    function selfFlipToFaceDownDefense(ctx) {
        const slot = ctx.field(ctx.owner)[ctx.index];
        if (!slot) return;
        slot.isFaceDown = true;
        slot.position = 'defense';
        ctx.log(`🔄 ${ctx.card.name} si gira coperta in Posizione di Difesa!`);
    }

    /**
     * Trova il primo mostro Incantatore di Livello 7+ scoperto sul proprio
     * Terreno — bersaglio richiesto da 199 (Esplosione a Onde Soniche).
     */
    function findLevel7SpellcasterTarget(ctx) {
        return ctx.field(ctx.owner).findIndex((slot) => slot && !slot.isFaceDown && slot.card.race === 'Incantatore' && slot.card.level >= 7);
    }

    /**
     * Applica la parte "deve attaccare tutti" di 199: concede al mostro bersaglio
     * abbastanza attacchi extra per colpire OGNI mostro avversario
     * attualmente in campo una volta ciascuno (slot.extraAttacksGrantedCount,
     * vedi il commento accanto a extraAttackGranted in actions.js) e
     * impedisce a ogni ALTRO proprio mostro di attaccare in questo turno
     * (gameState.cannotAttackUidsThisTurn, già usato per altre carte come
     * Obelisk il Tormentatore id 30). "Deve" attaccare (non solo "può"):
     * gameState.mustAttackTargetUidsFor[targetSlot.card.uid] = Set degli
     * uid nemici ancora da colpire — resolveAttack (actions.js) toglie il
     * bersaglio colpito da quel Set ad ogni attacco riuscito;
     * handlePhaseStepperClick (game-flow.js) blocca l'uscita dalla Battle
     * Phase finché quel Set non è vuoto E l'attaccante può ancora
     * attaccare (stesso principio del blocco "non puoi entrare in Battle
     * Phase al turno 1" già esistente lì).
     */
    function grantAttackAllEnemiesOncEach(ctx, targetIndex) {
        const targetSlot = ctx.field(ctx.owner)[targetIndex];
        const enemyUids = ctx.field(ctx.opponent).filter((s) => s).map((s) => s.card.uid);
        targetSlot.extraAttacksGrantedCount = Math.max(0, enemyUids.length - 1);
        gameState.cannotAttackUidsThisTurn = gameState.cannotAttackUidsThisTurn || new Set();
        ctx.field(ctx.owner).forEach((slot, i) => {
            if (slot && i !== targetIndex) gameState.cannotAttackUidsThisTurn.add(slot.card.uid);
        });
        gameState.mustAttackTargetUidsFor = gameState.mustAttackTargetUidsFor || {};
        gameState.mustAttackTargetUidsFor[targetSlot.card.uid] = new Set(enemyUids);
    }

    /**
     * Fa tornare in mano al proprietario la Magia/Trappola in `index`
     * della zona Magia/Trappola di `owner`, chiamando anche
     * def.onReturnedToHandSelf(ctx) se la carta lo dichiara — stesso
     * hook/schema già usato da Turbine Gigante (id 262, l'unica altra
     * carta di questo dataset che rimanda Magie/Trappole in mano),
     * estratto qui in un helper condiviso per riusarlo anche per
     * Uccello Tornado (id 1032) qui sotto.
     */
    function returnSpellTrapToHand(ctx, owner, index) {
        const slot = ctx.stField(owner)[index];
        if (!slot) return null;
        const card = slot.card;
        EventiDuello.emetti('transizione-carta', {
            carta: card,
            da: { kind: 'field', owner: owner, index: index, type: 'st' },
            a: { kind: 'hand', owner: owner },
            variante: 'hand'
        });
        ctx.hand(owner).push(card);
        ctx.stField(owner)[index] = null;
        const selfDef = DuelEngine.getDefinition(card.id);
        if (selfDef && typeof selfDef.onReturnedToHandSelf === 'function') {
            selfDef.onReturnedToHandSelf(DuelEngine.makeContext(owner, { card: card, index: index }));
        }
        return card;
    }

    // Tutto quello che sta qui sopra serve a più file-parte, quindi non
    // può restare chiuso in questa funzione: le parti lo prendono da qui.
    /**
     * Le carte della mano di `ctx.owner` ESCLUSA quella che si sta
     * attivando (per uid).
     *
     * Serve a ogni `canActivate` di una Magia con un costo "scarta 1
     * carta": quando la si attiva DALLA MANO, `ctx.hand(owner)` contiene
     * anche lei. Un controllo scritto come `hand.length === 0` la contava
     * come carta da scartare: con in mano la sola Magia la carta risultava
     * attivabile, entrava in campo, non trovava niente da scartare e si
     * perdeva al Cimitero senza effetto. Trovato da un audit sulle Carte
     * Equipaggiamento (Flamberge del Male Infranto, id 727), e presente
     * con la stessa forma in Tributo ai Dannati (492) e Vortice Fulmineo
     * (729). Per una Trappola già Settata o un mostro in campo non cambia
     * nulla: non sono in mano, e il filtro non toglie niente.
     */
    function otherHandCards(ctx) {
        const selfUid = ctx.card && ctx.card.uid;
        return ctx.hand(ctx.owner).filter((c) => !selfUid || c.uid !== selfUid);
    }

    window.CardEffectsShared = { NOMI_PRECEDENTI, chooseFieldTargetsInSequence, attendiScelta, chooseOption, chooseFieldCardTargetWaiting, dichiaraBersaglioScelto, dichiaraBersaglioSceltoWaiting, otherHandCards, blockBanishFromField, isHarpieLadySupport, cardHasArchetype, cardHasEffectiveName, cardMentionsName, findEquipTarget, collectEquipTargets, equipToChosenTarget, riprendiDalCimitero, attachEquip, equippedTarget, searchZoneWithChoice, searchDeckWithChoice, searchGraveyardWithChoice, chooseFieldCardTarget, chooseFieldMonsterTarget, collectFieldTargets, offerHandDiscardChoice, chooseCardFromHand, chooseCardFromList, chooseUpToNFromList, destroyTargetingSpellIfItStays, victimChoosesDiscard, banishFromGraveyardWithChoice, resolveSpecialSummonBanishCost, resolveSpecialSummonTributeCost, attachUnionMonster, maxRitualTributeLevel, performRitualTribute, findPetitMothReadyForCocoonSummon, releaseRelinquishedTarget, selfFlipToFaceDownDefense, findLevel7SpellcasterTarget, grantAttackAllEnemiesOncEach, returnSpellTrapToHand };
})();
