# Report generati

Questa cartella contiene i dati grezzi degli audit e delle simulazioni. I file
sono separati per area per evitare di affollare la radice del repository:

- `forbidden-memories/`: audit dei duellanti di Forbidden Memories;
- `main-duellists/`: audit dei duellanti della serie principale;
- `logs/`: log diagnostici conservati come riferimento;
- `pegasus/`: verifiche dedicate alle strategie di Pegasus;
- `story/`: simulazioni della storia e della progressione delle difficoltà.
- `matrix/`: la matrice completa deck x duellanti x livelli (`matrice-completa.jsonl` e riassunti), prodotta da
  `tools/audit-matrice-completa.js` e commentata in `docs/audits/FULL_MATRIX_AUDIT.md`;
- `archetypes/`: baseline e confronti dei supporti moderni per gli archetipi
  classici; l'eventuale deck personale `Custom` resta una metrica separata.

Le conclusioni leggibili sono conservate in `docs/audits/`. Quando si esegue
uno strumento con `--output`, va indicato un percorso sotto questa cartella; gli
strumenti con un output predefinito sono già configurati per farlo.

