# Grafo del progetto con Graphify

Graphify e' installato nel progetto per Codex e Claude Code. Le skill sono in
`.codex/skills/graphify/` e `.claude/skills/graphify/`; le istruzioni sono
registrate in `AGENTS.md` e `CLAUDE.md`.

## File consultabili

- `graphify-out/graph.html`: visualizzazione interattiva, apribile nel browser.
- `graphify-out/GRAPH_REPORT.md`: riepilogo leggibile delle aree e dei nodi principali.
- `graphify-out/graph.json`: grafo completo interrogabile dalla CLI.

La prima generazione e' stata solo sul codice (714 file, 7.977 nodi e 14.539
relazioni), con analisi AST locale. Non sono stati inviati file o documenti a
un servizio esterno. Documentazione, immagini e audio sono esclusi dall'indice;
la mappa e i documenti esistenti del progetto restano la fonte per il contesto
narrativo e per le decisioni di prodotto.

## Comandi

Dal terminale aperto nella radice del progetto:

```powershell
graphify query "Come viene gestita la risoluzione degli effetti?"
graphify explain "DuelEngine"
graphify path "activateCard" "playZoneTransition"
graphify update .
```

In Codex si puo' richiamare la skill con `$graphify .`; in Claude Code con
`/graphify .`. Dopo l'installazione o una modifica al `PATH`, riavviare Codex
per caricare la skill e il percorso del comando.

`graphify-out/cache/` e `.graphify_root` sono locali e non versionati. I tre
file consultabili e i metadati del grafo sono invece nel repository, cosi' la
mappa e' visibile e condivisa.
