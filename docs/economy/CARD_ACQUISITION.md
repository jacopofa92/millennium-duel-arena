# Acquisizione carte — fonte di verità

Regole implementate in `js/economy/card-acquisition.js`,
`js/data/card-rarity.js` e `js/economy/shop-catalog.js`. La Cartoteca mostra
anche la fonte nella scheda della carta.

Le Sfide accettano premi dati come `cards: [{ id, qty }]` e
`unlockPacks: ['id-pacchetto']`; entrambi persistono nel salvataggio.

## Limiti e deck

- Massimo 3 copie per carta.
- Starter/Structure non sommano i doppioni: la quantità diventa il massimo
  fra posseduta e contenuta nel singolo deck.
- Starter base subito; Yugi/Kaiba Evolution dopo il Regno dei Duellanti;
  Structure Yu-Gi-Oh dopo Battle City I. Qualsiasi difficoltà.
- La Grande Guerra non partecipa a queste regole.

## Rarità, rotazione e buste

Fasce: Comune, Rara, Super Rara, Ultra Rara, Leggendaria, Segreta e Mitica.
Segrete e Mitiche non entrano nelle buste generiche.

- 3 Comuni/giorno: 150 Crediti (solo Crediti, nessuna Stella).
- 2 Rare/giorno: 450 + 2; 1 Super/2 giorni: 900 + 4.
- 1 Ultra/settimana: 1800 + 8; 1 Leggendaria/2 settimane:
  3500 + 15 + 1 Carta del Millennio.
- Busta Base: 200 + 1 Stella; Avanzata: 450 + 2; Leggendaria:
  900 + 5 + 2 Carte Locazione, col 5% di Leggendaria.
- Ogni settimana: 2 tematiche da 1050 + 4 Stelle e 1 Premium da
  1800 + 8 Stelle + 1 Carta Locazione. Temi: Draghi, Incantatori, Macchine,
  Non-Morti, Guerrieri, Acqua, Arpie/Amazzoni, Toon e Fusioni.
- Ogni tematica contiene soltanto carte del proprio soggetto. Quattro slot
  sono creature base deboli; nella Premium gli slot base sono due.
- Le illustrazioni delle confezioni usano lo sprite originale
  `images/shop/generic-pack-emblems.png`, generato per il progetto senza
  testo. Le buste tematiche usano invece l'artwork di un mostro simbolo del
  tema già presente in `images/cards/` (per esempio Drago Bianco per i Draghi
  e Lady Arpia per le Arpie), non un emblema inventato.

Le carte firma entrano nel commercio soltanto dopo la prima copia ottenuta
dalla relativa impresa. I boss come Genesi del Vampiro sono Leggendari e
possono uscire da fonti premium coerenti.

## Lotto TCG prima serie (ID 1131-1160)

Il lotto aggiunto per completare LOB/MRD/SRL/PSV/LON/LOD/PGD è censito così:

| Rarità | Carte |
|---|---|
| Leggendaria | Golem di Lava |
| Ultra Rara | Ryu Senshi |
| Super Rara | Esiliatore della Luce, Giara Trasformante #2, Parassita Paracida, Mietitore dell'Incubo |
| Rara | Insetto Perforatore, Creatura dell'Umidità, Patrizio dell'Oscurità, Principessa Serpentina, Guardia Misteriosa, Rifornimento, Cyber Saurus, Drago Fuoconero, Squalo degli Abissi, Imperatrice Giudice, Lupo dei Fiori, Attacco Kaminari, Guerriero Karbonala, Drago di Metallo, Aquila Punita, Serpente Oceanico Ruggente, Cavaliere Teschio |
| Comune | Cavaliere di Fuoco Charubin, Fantasma di Fiamma, Fusionista, Piccolo Drago, Spine del Mondo Oscuro, Drago Minore, Cervello Antico |

Le rarità tengono conto sia della forza nel motore sia del costo reale di
Evocazione: le vecchie Fusioni Normali non diventano automaticamente Ultra
solo perché appartengono all'Extra Deck. Il catalogo completo contiene 797
Comuni, 91 Rare, 182 Super, 9 Ultra e 16 Leggendarie: affidarsi soltanto alla
rotazione generica renderebbe soprattutto Comuni e Super poco leggibili.

Per questo il lotto ha anche questi percorsi:

- **Forgia delle Fusioni**: busta tematica che raccoglie le Fusioni storiche,
  il loro supporto e i quattro Materiali Normali aggiunti col lotto. Il pool
  attuale è di 33 Comuni, 15 Rare, 7 Super, 1 Ultra e 4 Leggendarie.
- **Parassita Paracida**: prima copia dopo 15 vittorie contro Weevil a
  Difficile; poi può comparire come Super Rara fino al limite di 3 copie.
- **Golem di Lava**: prima copia dopo 20 vittorie contro Marik a Difficile;
  poi può comparire come Leggendaria fino al limite di 3 copie.
- Tutte le altre carte possono arrivare dalla rotazione e dalle buste ammesse
  dalla loro rarità; la Cartoteca mostra la fonte precisa carta per carta.

Le due imprese firma assegnano una sola prima copia: altre vittorie non
duplicano il premio. Anche qui resta valido il tetto globale di tre copie.

## Carte firma (sempre a Difficile)

- Kaiba 50/100: una copia di Drago Bianco per soglia.
- Yugi o Yami Yugi 50/100: una copia di Mago Nero per soglia.
- Joey 50: Drago Nero Occhi Rossi; Pegasus 50: Drago Toon Occhi Blu.
- Mai 50: Piumino delle Arpie; Bakura 25: Destiny Board.
- Pegasus 25: Elefante Volante; dopo la prima copia ha lo 0,2% nelle sole
  buste tematiche Premium, fino a 3 copie.

## Spirit Message

- I: Regno dei Duellanti; N: Battle City I; A: Mondo Virtuale;
  L: Battle City II. Qualsiasi difficoltà, una volta per carta.

## Carte Dio

- Obelisk: storia anime completa a Normale o Difficile.
- Slifer: Battle City I a Difficile; Strings 30 volte a Difficile e almeno
  una vittoria terminata con 4000 LP o più.
- Ra: Battle City II a Difficile; torneo Battle City 3 volte a Difficile;
  Marik 40 volte a Difficile, di cui 10 perdendo al massimo 2000 LP.

## Exodia

- Drop per vittoria PvE: Facile 0,15%, Normale 0,45%, Difficile 0,90%.
- Seeker a Difficile raddoppia la chance e garantisce un pezzo mancante ogni
  10 vittorie. Pity globale dopo 250 vittorie valide senza pezzo.
- Multiplayer e abbandoni esclusi. L'autowin admin conta per tutto.

## Passi successivi concordati

1. Simulazione del farming e bilanciamento con dati reali.
2. Animazione epica finto 3D del drop carta.
