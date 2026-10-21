# Allineamento dei nomi ai nomi ufficiali Konami in italiano (2026-10-21)

Fonte: YGOPRODeck API v7 (nomi italiani Konami, `language=it`). Il gioco ha 1133 carte Yu-Gi-Oh: **625 rinominate**, 449 avevano gia' il nome ufficiale, **50 invariate** (motivo nella tabella piu' in basso). Le carte di altri set (WW1) non sono toccate.

## Come sono state identificate

Il gioco non ha il codice Konami delle carte e molti nomi erano traduzioni proprie ("Guerriero Celtico" invece di "Guardiano Celtico"). Ogni carta e' stata collegata alla sua carta ufficiale con piu' prove, nell'ordine:
1. nome italiano gia uguale all'ufficiale;
2. confronto delle illustrazioni (impronta visiva, anche a ritagli diversi);
3. mostri: livello + attributo + razza + ATK + DEF unici;
4. Magie/Trappole: sottotipo + somiglianza di nome e testo.
Ogni abbinamento e' stato poi riletto con le statistiche/tipo della carta ufficiale; i casi ambigui sono stati decisi a mano (identificando la carta dal nome inglese) o lasciati invariati.

## Cosa e' stato controllato (effetti che cercano le carte per nome)

Il codice identifica altre carte dal nome in due modi, entrambi verificati prima/dopo:
- **ricerche per parola chiave** (`name.includes('Amazzone')`, `startsWith('Lady Arpia')`, `name === 'Sorelle Arpie'`, regex del Negozio...): ogni ricerca trova le STESSE carte di prima (alcune sono state riscritte, es. `/Amazzone|(?<!Imboscata )Amazoness/`, perche' i nomi ufficiali usano "Amazoness"/"Arpie");
- **funzioni del motore** (archetipi Toon/Occhi Rossi/Occhi Blu/Mago Nero, Lady Arpia, nomi effettivi e citati nel testo, pacchetti a tema del Negozio): risultati identici;
- **408 duelli completi IA contro IA** (tutti i Duellanti, tre livelli) rigiocati prima e dopo con gli stessi semi: 120.719 righe di registro, uguali (3 differenze solo di formattazione di un nome in un messaggio).

Per non cambiare il comportamento sono rimaste fuori dalle ricerche per nome alcune carte che il nuovo nome farebbe entrare (es. "Drago Occhi Blu Finale" non conta come Occhi Blu per il controllo sul nome, come prima): sono elencate nel codice (`ESCLUSE_PER_NOME` in `js/engine/card-effects.js`, `ECCEZIONI_NOME` in `js/economy/shop-catalog.js`).

**Protezione permanente**: `tests/specs/guardrail-nomi-carte.spec.js` congela, per ogni ricerca per nome del codice e per ogni funzione che identifica carte per nome, le carte che devono trovare (`tests/data/ricerche-per-nome.json`). Cambiare un nome o scrivere una nuova ricerca per nome fa fallire il test finche' non si verifica cosa succede e si aggiorna con `node tests/helpers/ricerche-per-nome.js --aggiorna`.

## Carte doppie ELIMINATE (8)

Otto carte erano la stessa carta reale di un'altra (due voci nel gioco): sono state eliminate e al loro posto resta la carta indicata. Chi le possedeva o le aveva in un mazzo le ritrova sulla carta che resta (migrazione in `js/save-manager.js`, `CARTE_ELIMINATE`); mazzi dei Duellanti, Structure/Starter Deck, puzzle e Tutorial sono stati spostati. Le parti piu' fedeli al testo ufficiale degli alias sono state portate sulla carta che resta (clausola di annullamento di Esplosione a Onde Soniche, scelta delle carte di Rilascio delle Anime, scelta del bersaglio di Clown Stupido). Raigeki (409) e Folgore Fulminante (37) restano entrambe.

| Eliminata | Resta |
|---|---|
| 163 Pagliaccio Insolente | 530 Clown Stupido |
| 609 Liberazione dell'Anima | 452 Rilascio delle Anime |
| 616 Soldato del Fulgore Nero | 55 Glorioso Soldato Nero |
| 617 Rito del Fulgore Nero | 56 Rito della Gloria Nera |
| 668 Grande Tornado | 262 Ritorno Totale |
| 723 Lama Fulminea | 349 Lama Accecante |
| 747 Onda di Diffusione | 199 Esplosione a Onde Soniche |
| 1024 Bomba a Orologeria | 315 Bomba a Tempo |

Nota: l'alias 1024 "Bomba a Orologeria" era la versione attivabile a mano; la 315 "Bomba a Tempo" esplode da sola alla Standby Phase.

## Carte NON rinominate (50)

| id | Nome nel gioco | Proposta ufficiale | Motivo |
|---|---|---|---|
| 25 | Ryu Kishin | Ryu-Kishin | il nome italiano ufficiale coincide con l'inglese (carta non tradotta): resta il nome del gioco |
| 34 | Ragno Lanciatore | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 37 | Folgore Fulminante | — | stessa carta reale della 409 (Raigeki): due voci nel gioco, resta l'alias |
| 47 | Cavaliere Missile | Guerriero Razzo | le statistiche del gioco non coincidono con la carta ufficiale: attributo diverso |
| 100 | Armatura Guida d'Attacco | — | Attack Guidance Armor non ha un nome italiano ufficiale |
| 132 | Soffio di Luce | — | Breath of Light non ha un nome italiano ufficiale (solo inglese) |
| 153 | Notte Meccanica | — | carta non identificata con certezza (nessuna corrispondenza affidabile) |
| 162 | Copione | — | carta non identificata con certezza (stat/testo non coincidono con Copycat) |
| 185 | Folletto Oscuro | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 197 | Prigione dei Dadi | — | carta non identificata con certezza |
| 200 | Dado Dimensionale | — | carta non identificata con certezza |
| 208 | Artigli di Drago | — | carta non identificata con certezza |
| 221 | Ectoplasmatore | Ectoplasmer | il nome italiano ufficiale coincide con l'inglese (carta non tradotta): resta il nome del gioco |
| 304 | Hurricail | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 315 | Bomba a Tempo | — | Jigen Bakudan non ha un nome italiano diverso dall'inglese; la 1024 e' la stessa carta reale |
| 322 | Kaitoptera | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 355 | Signore di Zemia | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 376 | Metalmorfosi | Metalmorph | il nome italiano ufficiale coincide con l'inglese (carta non tradotta): resta il nome del gioco |
| 396 | Spada Sigillante di Orichalcos | — | Orichalcos Sword of Sealing non ha un nome italiano ufficiale |
| 450 | Demolizione dell'Anima | — | carta non identificata con certezza |
| 460 | Dado di Evocazione | — | carta non identificata con certezza |
| 472 | Il Drago Alato di Ra | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 498 | Cerchio degli Inferi | — | carta non identificata con certezza |
| 586 | Uomo Karate | Karate Man | il nome italiano ufficiale coincide con l'inglese (carta non tradotta): resta il nome del gioco |
| 631 | Megamorfosi | Megamorph | il nome italiano ufficiale coincide con l'inglese (carta non tradotta): resta il nome del gioco |
| 691 | Signore Drago Oceanico - Neo-Daedalus | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 692 | Guerriero del Serpente Marino dell'Oscurità | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 700 | Levia-Dragon - Daedalus | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 780 | Ninja Signora Yae | Lady Ninja Yae | il nome italiano ufficiale coincide con l'inglese (carta non tradotta): resta il nome del gioco |
| 803 | Idrogeddon | Hydrogeddon | il nome italiano ufficiale coincide con l'inglese (carta non tradotta): resta il nome del gioco |
| 804 | Ossigeddon | Oxygeddon | il nome italiano ufficiale coincide con l'inglese (carta non tradotta): resta il nome del gioco |
| 809 | Bebè Cerasauro | Babycerasaurus | il nome italiano ufficiale coincide con l'inglese (carta non tradotta): resta il nome del gioco |
| 889 | Iniezione della Fata Giglio | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 892 | Maledizione dei Guardiani della Tomba | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 893 | Vassallo dei Guardiani della Tomba | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 894 | Lanciere dei Guardiani della Tomba | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 895 | Assalitore dei Guardiani della Tomba | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 896 | Artigliere dei Guardiani della Tomba | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 897 | Spia dei Guardiani della Tomba | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 898 | Guardia dei Guardiani della Tomba | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 899 | Capo dei Guardiani della Tomba | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 900 | Sentinella dei Guardiani della Tomba | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 903 | Santa Giovanna | St. Joan | il nome italiano ufficiale coincide con l'inglese (carta non tradotta): resta il nome del gioco |
| 928 | Seadra Spinoso | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 998 | Behemoth Fuso | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 1058 | Tuorlo Mucoso | Mucus Yolk | il nome italiano ufficiale coincide con l'inglese (carta non tradotta): resta il nome del gioco |
| 1060 | Insetto dalle 8 Chele | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 1061 | Shock di Byser | Byser Shock | il nome italiano ufficiale coincide con l'inglese (carta non tradotta): resta il nome del gioco |
| 1064 | Sirena Curatrice | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |
| 1141 | Cavaliere di Fuoco Charubin | — | nessuna carta ufficiale corrispondente trovata (carta del gioco o non tradotta) |

## Carte rinominate (625)

| id | Prima | Ora |
|---|---|---|
| 4 | Guerriero Celtico | Guardiano Celtico |
| 6 | Cavaliere Oscuro | Spada in Agguato |
| 11 | Braccio Dx Del Proibito | Braccio Dx del Proibito |
| 14 | Gaia il Cavaliere Feroce | Gaia il Cavaliere |
| 15 | Maledizione del Drago | Anatema del Drago |
| 20 | Buster Blader | Combattente delle Lame |
| 23 | Insetto Divoratore | Insetto Mangia-Uomini |
| 28 | Mago del Tempo | Stregone del Tempo |
| 29 | Drago Bianco Definitivo | Drago Occhi Blu Finale |
| 33 | Il Guardiano del Cancello | Guardiano del Cancello |
| 35 | Rinascita del Mostro | Mostro Resuscitato |
| 36 | Vaso dell'Avidità | Anfora dell'Avidità |
| 38 | Fusione | Polimerizzazione |
| 41 | Testa Proibita | Exodia il Proibito |
| 50 | Larva Mostruosa | Larva di Falena |
| 54 | Muro d'Illusione | Muro Illusorio |
| 55 | Guerriero Nero Supremo | Glorioso Soldato Nero |
| 56 | Rito del Guerriero Nero | Rito della Gloria Nera |
| 59 | Carica dell'Anima | Carica Anime |
| 69 | Stop Difesa | Blocca Difesa |
| 74 | Guardiano della Palude | Guardiano delle Paludi |
| 77 | Coccinella della Rovina a 4 Stelle | Coccinella del Destino |
| 78 | Patto col Sovrano Oscuro | Un Accordo con l'Arcidemone |
| 80 | Un Battito d'Ali del Drago Gigante | Il Battito d'Ali del Drago Gigante |
| 82 | Parshath il Cavaliere Alato | Parshath Cavaliere Volante |
| 83 | Spada di Alligatore | Spada dell'Alligatore |
| 84 | Drago Spada di Alligatore | Drago Spada dell'Alligatore |
| 85 | Alpha il Guerriero Magnetico | Guerriero Magnetico Alfa |
| 86 | Amazzone Maestra delle Catene | Maestra delle Catene Amazoness |
| 87 | Amazzone Combattente | Guerriera Amazoness |
| 88 | Arciere delle Amazzoni | Imboscata Amazoness |
| 89 | Amazzone Incantatrice | Incantatrice Amazoness |
| 90 | Amazzone Spadaccina | Spadaccina Amazoness |
| 93 | Antico Elfo | Elfo Antico |
| 96 | Aqua Madoor | Mago delle Acque |
| 97 | Armaill | Armaill delle Lame |
| 101 | Assalitore con l'Ascia | Predone d'Ascia |
| 102 | Drago Nero del Teschio | Drago Teschio Nero |
| 104 | Drago Barile | Drago Revolver |
| 105 | Insetto di Base | Insetto della Foresta |
| 106 | Bue da Battaglia | Ascia da Guerra |
| 111 | Anima del Berserker | Anima Furente |
| 112 | Beta il Guerriero Magnetico | Guerriero Magnetico Beta |
| 114 | Insetto Gigante | Grande Insetto |
| 115 | Gran Scudo Gardna | Grande Scudo Custode |
| 116 | Rito dell'Illusione Nera | Rito Illusione Nera |
| 117 | Ciondolo Nero | Pendente Nero |
| 118 | Drago di Fuoco delle Terre Nere | Drago Infuocato della Terra Nera |
| 119 | Cavaliere della Lama | Cavaliere Lama |
| 120 | Sfera Esplosiva | Sfera di Distruzione |
| 121 | Blocca Attacco | Blocca-Attacco |
| 122 | Spadaccino di Fiamma Blu | Spadaccino di Fuoco Blu |
| 125 | Cinghiale Soldato | Cinghiale Guerriero |
| 126 | Pinguino Fulmine | Pinguino Fulminante |
| 127 | Libro delle Arti Segrete | Libro di Arti Ascose |
| 128 | Buco Trappola senza Fondo | Buco Trappola Senza Fine |
| 130 | Controllo Mentale | Controllo della Mente |
| 131 | Distruttore, il Guerriero Magico | Breaker il Guerriero Magico |
| 133 | Terra in Fiamme | Terra Infuocata |
| 134 | Soffio Esplosivo | Soffio Incendiario |
| 135 | Pugnale Farfalla - Elma | Pugnale a Farfalla - Elma |
| 136 | Richiamo degli Infestati | Richiamo del Posseduto |
| 137 | Soldato Cannone | Soldato-Cannone |
| 138 | Distruzione di Carte | Distruggi-Carte |
| 139 | Guardia di Carte | Guardia della Carta |
| 140 | Carta della Rovina | Carta dell'Oblio |
| 145 | Spada Celeste - Eatos | Spada Celestiale - Eatos |
| 146 | Catena di Distruzione | Distruzione a Catena |
| 147 | Cambio di Cuore | Cambiare Idea |
| 148 | Scudo Lustro Giallo | Scudo Giallo del Desiderio |
| 149 | Chimera la Bestia Mitica Volante | Chimera, la Mitica Bestia Volante |
| 150 | Chiron il Mago | Chiron il Saggio |
| 152 | Prescelto | Il Prescelto |
| 155 | Zombie Pagliaccio | Zombie Clown |
| 156 | Cavaliere Scarafaggio | Cavaliere-Scarafaggio |
| 160 | Potere Raccolto | Potere Riunito |
| 161 | Patto con Exodia | Contratto con Exodia |
| 169 | Tenda degli Oscuri | Sipario degli Oscuri |
| 170 | Comandante Cyber | Cyber Comandante |
| 171 | Falco Cyber | Cyber-Falcone |
| 172 | Arpia Cyber | Cyber Lady Arpia |
| 173 | Barattolo Cyber | Cyber Giara |
| 174 | Predone Cyber | Predone Cibernetico |
| 175 | Scudo Cyber | Cyber Scudo |
| 176 | Soldato Cyber del Mondo Oscuro | Cyber-Soldato del Mondoscuro |
| 177 | Alligatore Cyber-Tecnologico | Cyber-Alligatech |
| 178 | Laser Ciclone | Laser Ciclonico |
| 183 | Rito del Drago Oscuro | Rituale del Drago Nero |
| 184 | Cavaliere della Fiamma Oscura | Cavaliere Fiamma Oscura |
| 187 | Rito della Magia Oscura | Rito Magia Oscura |
| 188 | Maga Oscura | Ragazza Maga Nera |
| 195 | Rimuovi Magia | Annulla Carta Magia |
| 196 | Des Volstgalph | Volstgalph Des |
| 198 | Drago della Dimensione Diversa | Drago da un'Altra Dimensione |
| 199 | Movimento d'Onda Diffuso | Esplosione a Onde Soniche |
| 202 | Bambola della Rovina | Malice Bambola del Testamento |
| 203 | Doma l'Angelo del Silenzio | Doma Angelo Silente |
| 204 | Sosia | Sdoppiatore |
| 205 | Doppia Presa Magica | Doppio Controllo Magico |
| 206 | Vaso Cattura-Drago | Cattura-Draghi |
| 207 | Cavaliere Maestro dei Draghi | Cavaliere Signore dei Draghi |
| 209 | Suonatore di Draghi | Pifferaio di Draghi |
| 210 | Cacciatore di Draghi | Cercatore di Draghi |
| 212 | Furia del Drago | Rabbia del Drago |
| 213 | Dragoness la Cavaliera Malvagia | Dragonessa a Cavallo |
| 214 | Spiritello dei Sogni | Folletto dei Sogni |
| 215 | Neve Battente | Neve Sferzante |
| 216 | Fuori Gioco | Caduta |
| 217 | Strega Oscura Dunames | Strega Oscura Dunares |
| 220 | Scuotiterra | Scuoti-Terra |
| 226 | Controllore del Nemico | Controlla-Avversario |
| 227 | Drenaggio di Energia | Risucchio di Energia |
| 228 | Aerosol Sterminatore | Spray |
| 229 | Bandisci il Malvagio | Esilio degli Spiriti |
| 232 | Scatola delle Fate | Scatola Fatata |
| 233 | Impatto Meteora Fatato | Pioggia di Meteore Fatate |
| 235 | Specchietto della Fata | Specchio Mano di Fata |
| 237 | Folletto Selvaggio Feroce | Demone Selvaggio |
| 238 | Barattolo di Fibra | Giara di Fibra |
| 239 | Piovra Demoniaca | Kraken il Demone |
| 240 | Ordini d'Attacco Finali | Ordini di Attacco Finale |
| 241 | Principessa di Fuoco | Principessa del Fuoco |
| 242 | Stregone di Fuoco | Stregone del Fuoco |
| 243 | Faglia | Schiacciare |
| 254 | Gaia il Campione dei Draghi | Gaia il Dragone |
| 257 | Golem Meccanico la Fortezza Mobile | Golem-Ingranaggio, la Fortezza Movente |
| 258 | Gearfried il Maestro di Spada | Spadaccino Sacro - Gearfried il Cavaliere di Ferro |
| 260 | Gigantesco Serpente di Mare Rosso | Serpente Marino Gigante Rosso |
| 261 | Soldato di Pietra Gigante | Soldato di Pietra |
| 262 | Turbine Gigante | Ritorno Totale |
| 263 | Dono dell'Elfa Mistica | Dono dell'Elfo Mistico |
| 264 | Lupo Giga-Tech | Lupo Tecnologico |
| 265 | Gil Garth | Gilgarth |
| 268 | Giltia il Cavaliere D. | Giltia il Cavaliere dei D. |
| 271 | Occhio di Gorgone | L'Occhio della Gorgone |
| 272 | Carità Aggraziata | Carità Graziosa |
| 273 | Dado Aggraziato | Dadi Graziosi |
| 275 | Grande Anziano Tiki | Grande Antico Tiki |
| 276 | Tombarolo | Predatore delle Tombe |
| 277 | Ascia di Gravità - Grarl | Ascia Gravitazionale - Grarl |
| 278 | Grande Mammut di Goldfine | Grande Mammuth di Goldfine |
| 279 | Grande Squalo Bianco | Mega Squalo Bianco |
| 281 | Bugroth l'Assalitore Terrestre | Bugroth di Terra |
| 282 | Guardiano Falce del Terrore | Falce del Terrore Guardiana |
| 283 | Guardiana Elma | Guardiano Elma |
| 286 | Ventaglio di Raffica | Ventaglio Raffica |
| 287 | Amante Felice | Amore Felice |
| 289 | Lady Arpia Formazione della Fenice | Lady Arpia Formazione Fenice |
| 290 | Sorelle Lady Arpia | Sorelle Arpie |
| 291 | Piumino delle Arpie | Spolverino dell'Arpia |
| 292 | Tempesta di Piume delle Arpie | Tempesta di Piume dell'Arpia |
| 293 | Drago da Compagnia delle Arpie | Draghetto delle Arpie |
| 295 | Scarabeo Ercole | Scarabeo Erculeo |
| 298 | Gigante Un Occhio | Gigante Hitotsu-Me |
| 299 | Diavoletto Cornuto | Demone Cornuto |
| 303 | Drago Verme Umanoide | Drago-Verme Umanoide |
| 308 | Congedo Infinito | Radiazione Infinita |
| 310 | Barriera d'Insetti | Barriera per Insetti |
| 311 | Soldati Insetto del Cielo | Soldati-Insetto del Cielo |
| 312 | Trasportatore di Materia Interdimensionale | Teletrasportatore |
| 317 | Uomo Giudice | Il Giudicatore |
| 321 | Kaiser Sea Horse | Kaiser Cavalluccio Marino |
| 325 | Ago Killer | Pungiglione Assassino |
| 326 | Soldato Cinetico | Soldato Cipher |
| 332 | Krokodilus | Kokkodrillus |
| 334 | Kuribandit | Kuribandito |
| 335 | La Jinn il Genio Mistico della Lampada | Genio della Lampada |
| 336 | Carro Armato del Labirinto | Carrarmato-Labirinto |
| 337 | Muro del Labirinto | Mura Labirintiche |
| 338 | Dama della Fede | Signora della Fede |
| 340 | Armatura Cannone Laser | Armatura Laser |
| 342 | Ragno Lanciarazzi | Ragno Lancia-Missili |
| 346 | Legion il Giullare Demoniaco | Legione Demone Giullare |
| 347 | Leogun | Leo-Cannone |
| 348 | Spada della Forza di Luce | Spada Forza di Luce |
| 349 | Lama Fulminante | Lama Accecante |
| 350 | Rimozione del Limitatore | Rimozione di Limite |
| 351 | Piccola Guardia Alata | Piccola-Guardialata |
| 352 | Freccia Spezza-Magie | Freccia Spezza-Magia |
| 353 | Signore dei D. | Signore di D. |
| 358 | Fabbrica di Conversione Meccanica | Fabbrica di Macchine |
| 359 | Re Macchina | Re delle Macchine |
| 360 | Bestia Spada Impazzita | Bestia della Spada Folle |
| 361 | Interferenza Magica | Disturbo Magico |
| 367 | Cimitero dei Mammut | Mammuth delle Tombe |
| 368 | Pianta Mangiauomini | Pianta Mangia-Uomini |
| 370 | Maschera di Dissoluzione | Maschera dell'Antimagia |
| 373 | MechanicalChaser | Meccacciatore |
| 375 | Guardiano di Metallo | Guardiano Metallico |
| 378 | Meteora della Distruzione | Meteora Della Morte |
| 379 | Meteorain | Pioggia di Meteore |
| 381 | Cavaliere del Miraggio | Cavaliere Miraggio |
| 382 | Forza dello Specchio | Forza Riflessa |
| 383 | Muro dello Specchio | Muro a Specchio |
| 384 | Recupero dei Mostri | Recupera-Mostri |
| 386 | Moltiplicazione | Moltiplicare |
| 387 | Re dei Musicisti | Re Musicista |
| 388 | Scatola Mistica | Scatola Magica |
| 389 | Cavaliere Mistico | Centauro Mistico |
| 391 | Elfa Mistica | Elfo Mistico |
| 399 | Guerriero Pantera | Pantera Guerriera |
| 400 | Drago Pappagallo | Pappadragallo |
| 401 | Macchina a Pendolo | Macchina Pendolo |
| 402 | Piccola Angela | Piccolo Angelo |
| 403 | Cavalletta d'Emergenza | Cavalletta Pungente |
| 404 | Drago Nero Pece | Drago Nero-Pece |
| 406 | Pumpking il Re dei Fantasmi | Re dei Fantasmi |
| 408 | Cavallerizzo Rabbioso | Cavaliere Rabbioso |
| 410 | Mietitore delle Carte | Mieti-Carte |
| 411 | Falce del Mietitore - Falce del Terrore | Falce del Mietitore |
| 412 | Ragazza Arciera Rossa | Ragazza Arciere |
| 413 | Drago Nero Metallico Occhi Rossi | Drago Metallico Occhi Rossi |
| 415 | Vincoli Recisi | Rimozione della Restrizione |
| 416 | Abbandonato | Abbandono |
| 418 | Ritorno dei Dannati | Ritorno del Condannato |
| 420 | Anello Magnetico | Anello del Magnetismo |
| 422 | Grotta dell'Orco di Roccia #1 | Orco di Pietra #1 |
| 423 | Bastone del Silenzio - Kay'est | Bacchetta del Silenzio - Kay'est |
| 424 | Bambola Canaglia | Bambola Mortale |
| 425 | Ragno della Roulette | Ragno Roulette |
| 427 | Rude Kaiser | Kaiser la Bestia |
| 431 | Saggi il Pagliaccio Oscuro | Saggi, Clown Oscuro |
| 436 | Drago Serpente della Notte | Drago Serpente Notturno |
| 439 | Incantesimo Ombra | Magia Ombra |
| 441 | Palazzo Splendente | Palazzo Scintillante |
| 445 | Dado Teschio | Dadi del Teschio |
| 446 | Coccinella Marchio Teschio | Coccinella dal Dorso a Teschio |
| 449 | Ancella Sonica | Fanciulla Musicale |
| 452 | Rilascio dell'Anima | Rilascio delle Anime |
| 453 | Cacciatore di Anime | Ruba-Anime |
| 454 | Drago Lancia | Drago Lanciere |
| 455 | Cancellatore di Magie | Annullatore di Magia |
| 456 | Ragnatela | Tela del Ragno |
| 457 | Spikebot | Robot Aculeo |
| 459 | Ninja d'Assalto | Ninja Fulmineo |
| 461 | Braccio di Spada del Drago | Braccio Spada di Drago |
| 462 | Cacciatore di Spade | Cacciatore di Spada |
| 464 | La 13ª Tomba | La Tredicesima Tomba |
| 465 | Le Forze A. | Le Truppe A. |
| 467 | Il Demone Megacyber | Demone Megacyber |
| 471 | L'Amazzone Ostile | L'Amazzone Scorbutica |
| 473 | Drago dei Mille | Drago Millenario |
| 475 | Idolo dai Mille Occhi | Idolo dai 1000 Occhi |
| 476 | Restrizione dai Mille Occhi | Limite dei 1000 Occhi |
| 480 | Divoratempo | Mangiatempo |
| 485 | Riavvolgimento Toon | Ritorno Toon |
| 487 | Mondo dei Toon | Mondo Toon |
| 489 | Muro del Tornado | Muro Tornado |
| 491 | Trakodon | Drago Trakodon |
| 492 | Tributo ai Dannati | Tributo al Dannato |
| 493 | Behemoth a Due Teste | Behemoth Bifronte |
| 494 | Drago del Tuono a Due Teste | Drago di Tuono Bifronte |
| 495 | Re Rex a Due Teste | Tirannosauro Rex a Due Teste |
| 496 | Ala del Tiranno | Ala Tiranna |
| 502 | Predone Vorse | Predatore Vorse |
| 505 | Water Omotics | Trasforma-Acque |
| 507 | Drago Alato, Guardiano della Fortezza #1 | Drago Alato #1 |
| 509 | Drago Verme | Drago-Verme |
| 510 | Cannone Testa X | X-Testa Cannone |
| 511 | Cannone Drago XY | XY-Cannone Drago |
| 512 | Cannone Drago XYZ | XYZ-Cannone Drago |
| 513 | Testa di Drago Y | Y-Testa Drago |
| 515 | Carro Armato Metallico Z | Z-Carro Armato Metallico |
| 517 | Rituale di Zera | Rito di Zera |
| 518 | Zera il Mant | Zera la Manta |
| 519 | Gravità Zero | Assenza di Gravità |
| 521 | Guerriero Zombie | Zombie Guerriero |
| 522 | Falena Piccola | Piccola Falena |
| 523 | Guardian Eatos | Guardiano Eatos |
| 526 | Skull Servant | Servitore del Teschio |
| 537 | Thunder Dragon | Drago del Tuono |
| 541 | Ansatsu | Ansatsu l'Assassino |
| 542 | Fantasma Arguto | Spettro Oscuro |
| 543 | Artiglio Raggiungente | Sferra-Artigli |
| 544 | Pagliaccio Mistico | Clown Mistico |
| 545 | Spada della Distruzione Oscura | Spada Distruttrice |
| 546 | Dian Keto la Maestra delle Cure | Dian Keto il Curatore |
| 547 | Fantasma Magico | Fatasma Magico |
| 548 | Attacco a Doppia Punta | Duplice Attacco |
| 550 | Il Mistico Severo | Il Mistico |
| 552 | Barone della Spada Demoniaca | Barone Malaspada |
| 553 | Forziere Divoratore | Forziere Mangia-Uomini |
| 555 | Ultima Volontà | Ultimo Desiderio |
| 556 | Maestro delle Trappole | Maestro di Trappola |
| 558 | Trappola Inversa | Inverti Trappola |
| 559 | Offerta Suprema | Ultima Offerta |
| 560 | La Malvagia Bestia Verme | Verme Bestiale |
| 561 | Uraby | Urabysauro |
| 564 | Titano Oscuro del Terrore | Titano del Terrore |
| 565 | Maestro e Allievo | Maestro ed Esperto |
| 566 | Guerriero Sconosciuto del Demone | Guerriero Sconosciuto |
| 567 | Orco dell'Ombra Nera | Orco delle Ombre Nere |
| 572 | Uccello Rosso Teschio | Uccello Teschio Rosso |
| 573 | D. Human | Guerriero D. Umano |
| 575 | La Spia Inesperta | Spia Inesperta |
| 576 | Telescopio Antico | Antico Telescopio |
| 577 | Giusto Dessert | L'hai Voluto tu! |
| 578 | Il Flauto per Evocare Draghi | Flauto Evoca-Draghi |
| 579 | Misterioso Burattinaio | Burattinaio Misterioso |
| 582 | Tartaruga Isola | Tarta-Isola |
| 583 | Pesce dai 7 Colori | Pesce dei 7 Colori |
| 584 | Soldato di Fuoco Oscuro #1 | Soldato di Fuoco #1 |
| 585 | Esploratore del Cielo | Scout del Cielo |
| 587 | Milus Radiant | Milus il Raggiante |
| 588 | Maga della Fede | Mago della Fede |
| 591 | Cappello Magico Bianco | Bianco Cappello Magico |
| 594 | Coccola Malevola | Nuzzler Malevolo |
| 595 | Il Guardiano Affidabile | Guardiano Affidabile |
| 599 | Sette Attrezzi del Bandito | I Sette Attrezzi del Bandito |
| 600 | Trappola Fasulla | Trappola Finta |
| 605 | Esploratore Ombra di Hiro | Esploratore-Ombra di Hiro |
| 607 | Tifone dello Spazio Mistico | Tifone Spaziale Mistico |
| 608 | Assalto Sconsiderato | Corsa Avventata |
| 611 | Giavellotto Incantato | Lancia Incantata |
| 612 | Ala di Grifone | Ali di Grifone |
| 615 | Biblioteca Magica Reale | Biblioteca Reale Magica |
| 618 | Ascia della Disperazione | Ascia di Distruzione |
| 619 | Zona Plasma Mistica | Zona Mistica del Plasma |
| 620 | Cerchio Ammaliante | Cerchio Incantatore |
| 622 | Spostamento | Cambio |
| 624 | Rottura di Raigeki | Frattura Raigeki |
| 628 | Il Drago che Vive nella Caverna | Il Drago Abitante nella Caverna |
| 629 | Drago Splendente #2 | Drago Avido #2 |
| 630 | Spirit Ryu | Spirito Ryu |
| 632 | Nobile del Depistaggio | Nobiluomo dello Scambio |
| 635 | Vaso dell'Ingordigia | Giara della Cupidigia |
| 636 | Campo di Riryoku | Terreno Riryoku |
| 637 | Tribù dei D. | Tribù D. |
| 638 | Drago Oscurità Occhi Rossi | Drago Oscuro Occhi Rossi |
| 639 | Drago Splendente | Drago Avido |
| 642 | Cucciolo del Drago Nero | Cucciolo di Occhi-Rossi |
| 645 | Furto Improvviso | Strappa Possesso |
| 646 | Tempesta Pesante | Tempesta Potente |
| 647 | Distruzione con Zampata | Distruzione Schiacciante |
| 648 | Scambio di Creature | Scambio-Creature |
| 652 | La Perla del Drago | La Perla di Drago |
| 653 | Avidità Sconsiderata | Cupidigia Insaziabile |
| 654 | Disturbatore di Trappole | Disturba Trappola |
| 656 | Genesi del Vampiro | Genesi Vampira |
| 659 | Spirito della Polvere Oscura | Spirito Polvere Oscura |
| 660 | Tartaruga della Piramide | Tartaruga Piramide |
| 661 | Mietitore Spirituale | Spirito Mietitore |
| 664 | Torre d'Ossa Divora-Anime | Torre d'Ossa Assorbi-Anima |
| 665 | Dama dei Vampiri | Lady Vampira |
| 671 | Dispositivo di Evacuazione Forzata | Dispositivo di Salvataggio Obbligatorio |
| 679 | Drago Vampata Solare | Drago Ondata Solare |
| 680 | Ragazzo del Baseball Estremo | Giovane Promessa del Baseball |
| 681 | Folletto della Fiamma Furente | Folletto della Fiamma Infuriato |
| 683 | Anima di Gaia il Collettivo Combustibile | L'Anima di Gaia il Combustibile Collettivo |
| 684 | Fuoco Fatuo | Volpe di Fuoco |
| 685 | Distruzione Fusa | Distruzione Infuocata |
| 686 | Camera Oscura degli Incubi | Camera Oscura dell'Incubo |
| 687 | Limite di Livello - Area B | Livello Limite - Area B |
| 688 | Collana del Comando | Amuleto del Comando |
| 693 | Manta Perforante Strisciante | Manta del Fato Incedente |
| 694 | Mambo Spaziale | Pesce Luna Spaziale |
| 696 | Ragazzo Stella | Stellone |
| 701 | Cavaliere Sirena | Sirena Cavaliere |
| 702 | Mobius il Monarca del Gelo | Mobius il Monarca Glaciale |
| 703 | Pescatore Ispido | Rana-Pescatrice Barbuta |
| 704 | Salvataggio | Recupero |
| 705 | Colpo di Martello | Lancio del Martello |
| 706 | Grande Onda Piccola Onda | Piccola Onda Grande Onda |
| 707 | Legame di Gravità | Legame Gravitazionale |
| 710 | Guerriera delle Terre Desolate | Signora Guerriera delle Terre Desolate |
| 711 | Gaia il Cavaliere Feroce Rapido | Gaia il Cavaliere del Vento Oscuro |
| 712 | Guardiano Celtico Sgradito | Guardia Celtica Riaddestrata |
| 714 | Capitano Predone | Capitano Saccheggiatore |
| 716 | D.D. Guerriera | Signora Guerriera D.D. |
| 717 | Mataza il Fulminatore | Mataza l'Assassino Fulmineo |
| 720 | Gran Maestro Ninja Sasuke | Sasuke Maestro Ninja |
| 721 | Samurai Armato - Ben Kei | Ben Kei - Samurai Armato |
| 724 | Rinforzo dell'Esercito | Rinforzi dell'Esercito |
| 725 | Il Guerriero Ritorna in Vita | Il Guerriero Sopravvissuto |
| 726 | Spada Fusione Lama Murasame | Spada-Fusione Lama Murasame |
| 727 | Flamberge del Male Infranto - Baou | Flamberga Spezza-Malvagi - Baou |
| 728 | Fata della Primavera | Fata della Sorgente |
| 729 | Vortice Fulmineo | Fulmine Boltex |
| 730 | Spade della Luce Occultante | Spade Mistificatrici |
| 733 | Stregone Eradicatore Oscuro | Stregone Oscuro Eradicatore |
| 734 | Bestia Mitica Cerbero | Cerbero Mitica Bestia |
| 736 | Abile Mago Oscuro | Abile Mago Nero |
| 738 | Mago Comando del Caos | Mago Ordine del Chaos |
| 740 | Stregone del Caos | Stregone del Chaos |
| 742 | Mago dell'Esplosione | Mago del Sangue |
| 743 | Maga Oscura Curran | Curran Maga d'Ebano |
| 744 | Mago a Fuoco Rapido | Mago Fuoco-Rapido |
| 748 | Attacco Magico Oscuro | Attacco Mago Nero |
| 751 | Pietra del Potere Nero Pece | Pietra del Potere Nero-Pece |
| 759 | Sentinella Golem | Golem Guardiano |
| 762 | Cannoni Intercettori Moai | Cannoni d'Intercettazione Moai |
| 766 | Falena della Sabbia | Falena di Sabbia |
| 769 | Ombre Mutevoli | Ombre Danzanti |
| 770 | Drenaggio Magico | Risucchio Magico |
| 771 | Prova del Viandante | Prova del Viaggiatore |
| 772 | Simorgh, Uccello della Divinità | Simorgh, Volatile della Divinità |
| 773 | Sparatore Sonico | Proiettile Sonico |
| 774 | Anatra Sonica | Papera Sonica |
| 777 | Mosca Lama | Volama |
| 778 | Faccia di Uccello | Faccia da Uccello |
| 781 | Roc dalla Valle della Foschia | Roc dalla Valle della Nebbia |
| 785 | Joe l'Uomo Uccello Veloce | Joe Veloce Uomo Alato |
| 786 | Cucciolo di Drago dell'Arpia | Cucciolo di Drago delle Arpie |
| 787 | Egoista Elegante | Egotista Elegante |
| 789 | Scintilla dell'Estasi Triangolare | Scintilla d'Estasi Triangolare |
| 794 | Arte Ninjitsu della Trasformazione | Arte della Trasformazione Ninjitsu |
| 795 | Attacco d'Icaro | Attacco Icaro |
| 796 | Tiranno Superconduttore | Tiranno Super Conduttore |
| 798 | Sabersaurus | Sciabolasaurus |
| 799 | Driceratopo Oscuro | Triceratopo Oscuro |
| 800 | Testa di Martello Iper | Iper Testa-Martello |
| 801 | Tiranno Nero | Tiranno Oscuro |
| 802 | Tiranno Infinito | Infinità Tiranno |
| 805 | Ptera Nero | Pterodattilo Nero |
| 806 | Stego Nero | Stegosauro Oscuro |
| 807 | Tiranno Definitivo | Tirannosauro Finale |
| 810 | Grande Pillola Evolutiva | Pillola dell'Evoluzione Gigante |
| 811 | Colpo di Coda | Spazzata di Coda |
| 818 | Onda Sismica | Onda d'Urto Sismica |
| 819 | Scudo con Braccio Magico | Scudo da Braccio Magico |
| 820 | Nega Attacco | Annulla Attacco |
| 821 | Goblin fuori dalla Padella | Goblin Fuori dalla Padella |
| 824 | Drago Gadjiltron Ingranaggio Antico | Drago Gadjiltron-Ingranaggio Antico |
| 825 | Chimera Gadjiltron Ingranaggio Antico | Chimera Gadjiltron-Ingranaggio Antico |
| 826 | Ingegnere Ingranaggio Antico | Ingegnere-Ingranaggio Antico |
| 827 | Soldato di Avvio - Dinamo del Terrore | Soldato Accensione - Dinamo del Terrore |
| 828 | Gadget Verde | Congegno Verde |
| 829 | Gadget Rosso | Congegno Rosso |
| 830 | Gadget Giallo | Congegno Giallo |
| 831 | Piattaforma di Supporto Mech Pesante | Piattaforma di Supporto per Mezzi Pesanti |
| 832 | Golem Ingranaggio Antico | Golem-Ingranaggio Antico |
| 833 | Bestia Ingranaggio Antico | Bestia-Ingranaggio Antico |
| 834 | Soldato Ingranaggio Antico | Soldato-Ingranaggio Antico |
| 836 | Cannone Ingranaggio Antico | Cannone-Ingranaggio Antico |
| 837 | Officina dell'Ingranaggio Antico | Laboratorio-Ingranaggio Antico |
| 838 | Carro Armato Ingranaggio Antico | Carro Armato-Ingranaggio Antico |
| 839 | Esplosivo Ingranaggio Antico | Esplosivo-Ingranaggio Antico |
| 840 | Pugno Ingranaggio Antico | Pugno-Ingranaggio Antico |
| 841 | Fabbrica dell'Ingranaggio Antico | Fabbrica-Ingranaggio Antico |
| 842 | Trapano Ingranaggio Antico | Trivella-Ingranaggio Antico |
| 843 | Castello dell'Ingranaggio Antico | Castello-Ingranaggio Antico |
| 846 | Cambio d'Arma | Cambio-Arma |
| 847 | Duplicazione Meccanica | Duplicazione di Macchine |
| 848 | Vaso dell'Avarizia | Giara dell'Avarizia |
| 849 | Roccaforte la Fortezza Mobile | Roccaforte della Fortezza Movente |
| 850 | Raggio Micro | Micro Raggio |
| 851 | Metalmorfosi Rara | Metamorfosi Rara |
| 853 | Avanti Tutta! | Attaccati! |
| 854 | Mago del Caos Nero | Mago del Chaos Oscuro |
| 855 | Paladino del Drago Oscuro | Paladino del Drago Nero |
| 857 | Wall Shadow | Muro-Ombra |
| 863 | Dicelops | Dadociclope |
| 866 | Destiny Board | Tavola del Destino |
| 867 | Spirit Message "I" | Messaggio dello Spirito "I" |
| 868 | Spirit Message "N" | Messaggio dello Spirito "N" |
| 869 | Spirit Message "A" | Messaggio dello Spirito "A" |
| 870 | Spirit Message "L" | Messaggio dello Spirito "L" |
| 871 | Terraformazione | Terraformare |
| 872 | Wingweaver | Indossatrice d'Ali |
| 873 | Duo Delinquente | Due di Meno |
| 877 | Uniti Vinceremo | Uniti Resistiamo |
| 879 | Il Pescatore Leggendario | Pescatore Leggendario |
| 880 | Messaggero della Pace | Messaggero di Pace |
| 881 | Nobile dello Sterminio | Nobiluomo dello Sterminio |
| 885 | Quiz Inverso | Quiz Invertito |
| 887 | Cancello di Fusione | Cancello della Fusione |
| 888 | Freed il Generale Senza Rivali | Freed il Generale Senza Avversari |
| 890 | Necrovalley | Necrovalle |
| 891 | Necropaura Oscura | Paura Oscura |
| 901 | La Fanciulla Indulgente | La Vergine Clemente |
| 902 | Darklord Marie | Signora Oscura Maria |
| 904 | Stella Marina Corazzata | Stella Corazzata |
| 905 | Roccia Dissolvente | Dissolviroccia |
| 906 | Lucertola Sbavante | Lucertola Affamata |
| 908 | Riflesso Demoniaco #2 | Riflesso Evocatore #2 |
| 909 | Erbafuoco | Erba di Fuoco |
| 911 | Re Fantasma Verde | Re Verde degli Spettri |
| 912 | Armatura Dura | Armatura Vivente |
| 913 | Anima Hinotama | Spirito Hinotama |
| 916 | Kurama | Uccello Kurama |
| 917 | Larvas | Uccello-Larva |
| 918 | M-Guerriero #1 | Guerriero-M #1 |
| 919 | M-Guerriero #2 | Guerriero-M #2 |
| 920 | Meda Bat | Pipistrello Meda |
| 921 | Misairuzame | Pesce Misairuzame |
| 926 | Acqua Radicale | Acqua di Radice |
| 929 | Grotta dell'Orco d'Acciaio #1 | Orco d'Acciaio #1 |
| 930 | Cavaliere Succubo | Cavaliere Terrificante |
| 931 | Il Furioso Re del Mare | Furioso Re dei Mari |
| 933 | Processo dell'Incubo | La Prova dell'Incubo |
| 934 | Bestia a Filo Teso | Elettro-Bestia |
| 935 | Tigre Tartaruga | Tartaruga-Tigre |
| 936 | Sovrano Oscuro Bibocca | Elettrosauro Doppiafauce |
| 937 | Tyhone | Tyhone Alato |
| 940 | Abitante degli Abissi | Abitatore degli Abissi |
| 942 | Cerbero di Fiamme | Cerbero Infuocato |
| 943 | Garnecia Elefantis | Elefante Garnecia |
| 946 | Megasfera di Tuono | Mega-Sfera del Tuono |
| 950 | Ratto Prevenitore | Corazzatopo |
| 953 | L'Antico della Foresta Profonda | Antico della Foresta |
| 956 | Tartaruga Gigante che si Nutre di Fiamme | Tartaruga Mangia-Fiamme |
| 957 | Guardiano della Sala del Trono | Guardiano del Trono |
| 958 | Gyojin dell'Alta Marea | Gyojin della Marea |
| 960 | Lumaca Meccanica | Mecha-Chiocciola |
| 961 | Pesce di Metallo | Pesce Metallico |
| 963 | Kappa Psichico | Psi-Kappa |
| 965 | Grotta dell'Orco di Pietra | Orco di Pietra |
| 966 | Doppia Lunga Verga #2 | Frustacode Gemelle #2 |
| 968 | Corvo Codaflagello | Corvo Coda-di-Frusta |
| 969 | Bestia del Talwar | Bestia di Talwar |
| 970 | Soldato del Fuoco Oscuro #2 | Soldato di Fuoco #2 |
| 974 | Mr. Volcano | Mr Vulcano |
| 975 | Overdrive | Marcia Inarrestabile |
| 976 | Marinaio Teschio | Teschio Marino |
| 978 | Grotta dell'Orco d'Acciaio #2 | Orco d'Acciaio #2 |
| 979 | La Tigre Bianca Onniveggente | Tigre Bianca Veggente |
| 980 | Geedo Tricefalo | Geedo dalle Tre Teste |
| 981 | Drago di Fuoco Bicefalo | Drago di Fuoco Bifronte |
| 983 | Boneheimer | Succhiaossa |
| 984 | Spirito Legato alla Terra | Spirito Terralegato |
| 985 | Imperatrice Mantide | Mantide Imperatrice |
| 986 | Danzatrice di Fiamme | Danzatore della Fiamma |
| 988 | Cavaliere Senza Testa | Il Cavaliere Senza Testa |
| 989 | Grongo Fulminante | Anguilla Fulmine |
| 990 | Dama Sferica | Lady Sphyra |
| 991 | Il Conte della Fine | Il Conte del Testamento |
| 992 | L'Orrido Fantasma dei Sogni Fuggiti | Il Fantasma dei Sogni Scomparsi |
| 996 | Lupo Portascure | Lupo con Ascia |
| 999 | Shapesnatch | Farfallino |
| 1000 | Divoratore d'Anime | Mangianima |
| 1001 | Sacerdote di Asura | Prete Asura |
| 1005 | Coniglio Bianco di Inaba | Coniglio Bianco Inaba |
| 1007 | Soldato di Susa | Soldato Susa |
| 1012 | Sosia della Regina | Doppio della Regina |
| 1013 | Fiore Arcobaleno | Fiore dell'Arcobaleno |
| 1014 | Hamburger Famelico | Hamburger Affamato |
| 1016 | Tartaruga Granchio | Tartaruga-Granchio |
| 1018 | Spettacolo della Spada | Prestazione della Spada |
| 1019 | Danza d'Apertura | Inizio delle Danze |
| 1020 | Mummia Velenosa | Mummia Infetta |
| 1022 | Scarpe Mordaci | Scarpe Voraci |
| 1023 | Parassita Bubbonico | Criceto Bubbonico |
| 1025 | L'Immortale del Tuono | Immortale del Tuono |
| 1026 | Un Gufo Fortunato | Un Gufo della Fortuna |
| 1027 | Un Gatto di Malaugurio | Un Gatto della Sfortuna |
| 1028 | Manipolatore di Draghi | Manipola-Draghi |
| 1029 | Fauci dell'Oscura Dipartita | Mascelle della Trattativa Oscura |
| 1030 | Barattolo Cobra | Giara Cobra |
| 1031 | Domatore d'Ombre | Domaombra |
| 1035 | Bollettino Meteo | Previsioni Meteo |
| 1036 | Lanciere Sciocco | Lancia Demente |
| 1037 | Assalitrice delle Fiamme | Signora Assaltatrice delle Fiamme |
| 1040 | Drago della Caverna | Drago delle Caverne |
| 1044 | Drago Teschio Demoniaco | Drago Teschio-Demone |
| 1045 | L'Ultimo Guerriero di un Altro Pianeta | L'Ultimo Guerriero da un Altro Pianeta |
| 1050 | Drago della Truppa | Truppa-Drago |
| 1051 | Momonga Agile | L'Agile Momonga |
| 1053 | Cavallo dell'Incubo | Cavallo Incubo |
| 1054 | Tirapiedi Alato | Servo Alato |
| 1056 | Servitore del Catabolismo | Servo del Catabolismo |
| 1057 | Nave di Yomi | Nave Yomi |
| 1059 | Amuleto di Shabti | Malia di Shabti |
| 1062 | Sparajongler Esplosivo | Giocoliere Devastante |
| 1063 | Sentinella Cremisi | Sentinella Porpora |
| 1066 | Elfa Oscura | Elfo Oscuro |
| 1067 | Scassinatori Scorpioni Oscuri | Dark Scorpion-Scassinatori |
| 1069 | Guardiana delle Fate | Fata Guardiana |
| 1071 | Mummia dall'Ascia Gigante | Mummia con Ascia Gigante |
| 1073 | Ala Grigia | Ali Grigie |
| 1077 | Tigre Re Wanghu | Tigre Reale Wanghu |
| 1080 | Kycoo Distruttore di Fantasmi | Kycoo il Distruttore di Spettri |
| 1081 | Pantera Signora | Signora Pantera |
| 1082 | Ninfa dell'Acqua | Vergine dell'Acqua |
| 1085 | Mushroom Man #2 | Uomo-Fungo #2 |
| 1087 | Nuvia la Malvagia | Nuvia lo Stregato |
| 1089 | Melma Rediviva | Gelatina Rianimata |
| 1090 | Guardiano Reale | Custode Reale |
| 1091 | Ryu-Kishin Pagliaccio | Clown Ryu-Kishin |
| 1092 | Senju delle Mille Mani | Senju dalle 1000 Mani |
| 1093 | Anima di Purezza e Luce | Anima della Luce e della Purezza |
| 1098 | Saggezza Corrotta | Saggezza Infetta |
| 1099 | Il Macellaio del Bistrot | Il Macellaio da Bistrò |
| 1100 | Il Piccolo Spadaccino di Aile | Piccolo Spadaccino di Aile |
| 1102 | Unità Scagliapietre | Unità Scagliapietra |
| 1106 | Vampire Baby | Bambino Vampiro |
| 1107 | Bazoo il Divora-Anime | Bazoo il Mangia-Anima |
| 1108 | Falcos il Saggio Alato | Saggio Falco Alato |
| 1109 | Cavaliere Mistico di Sciacallo | Cavaliere Mistico dello Sciacallo |
| 1112 | Spirito Silvano | Spiritello Silvestre |
| 1114 | Lupo Bicefalo | Lupo Bifronte |
| 1115 | Scorpione dalle 8 Chele | Scorpione 8 Artigli |
| 1116 | Uomo con Wdjat | Un Uomo con Wdjat |
| 1117 | Cobraman Sakuzy | Uomo Cobra Sakuzy |
| 1118 | Sovrano Oscuro Ha Des | Ha Des Sovrano Oscuro |
| 1119 | Gradius' Option | Opzione di Gradius |
| 1121 | Thunder Nyan Nyan | Tuono Nyan Nyan |
| 1124 | Falena Perfetta | Grande Falena Perfetta |
| 1127 | Campanella Cerimoniale | Campana Cerimoniale |
| 1128 | Skull Knight #2 | Teschio Cavaliere #2 |
| 1129 | Great Dezard | Grande Dezard |
| 1131 | Esiliatore della Luce | Epuratore della Luce |
| 1132 | Insetto Perforatore | Insetto-Trapano |
| 1134 | Creatura dell'Umidità | Creatura Umida |
| 1135 | Patrizio dell'Oscurità | Nobile dell'Oscurità |
| 1137 | Giara Trasformante #2 | Giara della Mutazione #2 |
| 1139 | Parassita Paracida | Insetto Parassita |
| 1142 | Cyber Saurus | Cyber-Sauro |
| 1143 | Drago Fuoconero | Drago del Fuoco Nero |
| 1145 | Imperatrice Giudice | Giudice Imperatrice |
| 1146 | Fantasma di Fiamma | Fantasma di Fuoco |
| 1147 | Lupo dei Fiori | Fiore di Lupo |
| 1151 | Drago di Metallo | Drago Metallico |
| 1154 | Serpente Oceanico Ruggente | Serpente Oceanico |
| 1158 | Spine del Mondo Oscuro | Aculei degli Abissi |
| 1160 | Cervello Antico | Antico Cervello |
| 1251 | Intuito Occhi Rossi | Intuizione Occhi Rossi |
| 1253 | Drago Metallo Nero | Drago Metallico Nero |
| 1254 | Bastone del Mago | Verga del Mago |
| 1255 | Cerchio Magico Oscuro | Circolo Magico Nero |
| 1256 | Anima Eterna | Anima Immortale |
| 1257 | Salvezza del Mago | Salvataggio del Mago |
| 1259 | Segreti della Magia Oscura | Segreti della Magia Nera |
| 1263 | Luce Autentica | Vera Luce |
| 1265 | Drago Bianco Alternativo Definitivo | Drago Finale Alternativo Occhi Blu |
| 1268 | Signora Arpia Toon | Lady Arpia Toon |
