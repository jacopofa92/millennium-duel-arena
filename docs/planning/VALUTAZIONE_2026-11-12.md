# Valutazione del progetto — 12 novembre 2026

Resoconto scritto per chi riprende il lavoro (persona o modello IA) senza aver
seguito le sessioni precedenti. Stato di partenza: versione 1.6.42, cache
`v692`, branch `main` pulito, 470 spec in `tests/specs/`, nessuna
`missingEffectNote` in `data/cards.json`. In questa valutazione non è stato
modificato nulla del gioco.

Regole del progetto da conoscere prima di iniziare (dettagli in `CLAUDE.md`):
si risponde in italiano; la suite completa non si lancia di propria
iniziativa (solo gli spec toccati, con `node tests/run-all.js <filtro>`); le
modalità non toccano `js/engine/`; git è in
`D:\Programmi\PortableGit\bin\git.exe`.

## Punti solidi

- Il nucleo ha la forma giusta: regole senza interfaccia, duelli interi in
  Node (`tools/duello-senza-testa.js`), Multiplayer a passo comune, posti al
  tavolo, modalità fuori dal motore. È la base di tutte le espansioni.
- Le carte non hanno scostamenti noti dal testo, e i guardrail coprono i modi
  tipici di rompere le cose in silenzio.
- Sicurezza: cancello lato server (Cloudflare Worker) e relay Multiplayer
  autenticato (1.6.34).

## Rischi

1. **`CLAUDE.md` pesa 620 KB (4.867 righe) e `PROJECT_MAP.md` 114 KB.** Si
   caricano a ogni sessione e consumano gran parte del contesto. Sono una
   cronologia versione per versione, non un insieme di regole.
2. **La suite completa non gira pulita da molto.** L'ultima documentata è
   401/405 alla 1.5.0; alla 1.6.34 è stata tentata senza completarla (errori
   di avvio dei relay locali). L'11 novembre sono stati rilanciati molti
   gruppi di spec: gli unici rossi erano test rimasti indietro, poi corretti.
3. **Documenti di piano in parte scaduti.** `docs/planning/TODO.md` è fermo
   al 9 ottobre. Nella memoria di Claude Code cinque promemoria "da fare"
   sono già fatti: Tutorial del Tag (1.5.39, 1.5.42), duelli Tag nella Storia
   (1.5.35), frequenza di Obelisco e Ra (1.5.40), z-index delle icone e
   numeri ATK/DEF (1.5.39), dado e moneta in WebGL (1.5.39).
4. **File molto grandi dell'interfaccia.** `duelMonstersCore.html` 327 KB,
   `torneo-battle-city.html` 196 KB, `torneo-regno-duellanti.html` 183 KB; le
   due mappe dei tornei hanno logica duplicata (pedine, camminata, orme).
5. Resta il branch `codex/contenuti-per-utente` (locale e remoto): verificare
   che sia tutto in `main` e in caso eliminarlo.
6. Limite noto e accettato: il gioco esegue le regole sul client, quindi un
   account approvato può leggere il codice e i controlli offline non sono
   una protezione forte.

## Lavori aperti

| Lavoro | Dove è descritto | Note |
|---|---|---|
| Accorciare `CLAUDE.md` (proposta sotto) | questo file | Da fare per primo: riduce il costo di ogni sessione |
| Ripulire `TODO.md` e i promemoria scaduti | `docs/planning/TODO.md` | Piccolo |
| Suite completa come base certa | — | Solo su richiesta dell'utente |
| Forbidden Memories come secondo set di regole | `docs/planning/MOTORE_FORBIDDEN_MEMORIES.md` | Lavoro lungo sul nucleo, su un branch |
| Merge dei dati monotoni nella sincronizzazione | `WORK_IN_PROGRESS.md`, "Sincronizzazione tra dispositivi" | Solo se i conflitti reali sono frequenti |
| Errore raro `Cannot read properties of null (reading 'card')` nei turni del bot | `WORK_IN_PROGRESS.md`, Priorità 0 | Cercarlo con semi nel duello senza testa |
| Test fragile di `duello-senza-testa` | `TODO.md` punto 2 | Costruire la situazione a mano invece di cercarla in una partita |
| `// @ts-check` sulle parti delle carte | `WORK_IN_PROGRESS.md`, Priorità 1 | Circa 100 errori per parte, un file alla volta |
| Spezzare i file grandi; componente unico per le mappe dei tornei | `WORK_IN_PROGRESS.md`, "Manutenzione" | Su un branch |
| Audit Strings, dimensione dei mazzi 40/45/50, Negozio e Cartoteca | `WORK_IN_PROGRESS.md` | Simulazioni con `tools/audit-matrice-completa.js` |
| Flicker residui su mobile, prove a mano sull'APK | `TODO.md` punto 3 | Serve il telefono vero |
| Strumenti di simulazione della Storia che non leggono i ritocchi dell'Editor Mappa | `TODO.md` punto 5 | Piccolo |
| 6 PNG di avatar senza uso | `WORK_IN_PROGRESS.md`, "Contenuti" | Decisione dell'utente |

Ordine consigliato: `CLAUDE.md`, pulizia dei piani, suite completa, poi
Forbidden Memories.

Quale modello: i lavori lunghi sul nucleo (Forbidden Memories, merge della
sincronizzazione, caccia all'errore raro, divisione dei file grandi)
beneficiano di un modello più capace; simulazioni, audit e ritocchi grafici
si fanno bene con un modello più economico.

## Proposta per `CLAUDE.md` (in attesa di approvazione)

- `CLAUDE.md` resta di circa 150 righe: dove gira il gioco, comandi e regola
  sulla suite, struttura del codice, convenzioni, regole del motore (modalità
  fuori dal motore, `Decisioni`, `Tavolo`, passo comune, `EventiDuello`),
  Git, graphify.
- La cronologia si sposta senza tagli in `docs/storia/`, un file per serie
  di versioni (1.0–1.3, 1.4, 1.5, 1.6), con una riga di rimando.
- Le lezioni ricorrenti (PowerShell e codifica, prove sul telefono, insidie
  dei test) vanno in `docs/architecture/INSIDIE.md`.
- `.claude/CLAUDE.md` resta com'è.

Attenzione nello spostamento: `tests/specs/guardrail-estensione-immagini`
legge anche i percorsi citati nei documenti, e i file contengono accenti
(usare strumenti che scrivono UTF-8 senza BOM, mai `Get-Content`/`Set-Content`
di PowerShell 5.1).

## Segnalazione di `/usage` sul server `ccd_turn`

Non compare in nessuna configurazione leggibile (`~/.claude.json`,
`~/.claude/settings.json`, `.mcp.json`, impostazioni del progetto): non è un
server configurato per progetto. Nessuna modifica fatta.
