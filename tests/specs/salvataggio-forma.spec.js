// La FORMA del salvataggio: è il dato che, se si rovina, non si recupera.
// Qui si sorveglia che:
//   1) dopo una sessione "piena" (valute, carte, Sfide, Storia, Torneo,
//      modalità) il salvataggio abbia la forma attesa (SaveManager.motivoRifiuto);
//   2) ogni campo di primo livello sia descritto in types/salvataggio.d.ts:
//      un campo nuovo senza tipo fa fallire la suite (e ricorda dove aggiungerlo);
//   3) un salvataggio rovinato che arriva da fuori (cloud, backup, file) venga
//      RIFIUTATO senza toccare quello buono;
//   4) un salvataggio già salvato con un contenitore della forma sbagliata venga
//      riparato da load() invece di rompere ogni lettura.
const fs = require('fs');
const path = require('path');

const TIPI = fs.readFileSync(path.join(__dirname, '..', '..', 'types', 'salvataggio.d.ts'), 'utf8');

module.exports = {
    name: 'Forma del salvataggio: controllo, tipi aggiornati, rifiuto dei file rovinati, riparazione',
    async run(t) {
        const r = await t.evaluate(() => {
            const out = { problemi: [] };
            SaveManager.createNew('Prova');
            SaveManager.addCurrency('credits', 321);
            SaveManager.addOwnedCards(7, 2);
            if (SaveManager.setChallengeProgress) SaveManager.setChallengeProgress('prova-sfida', { count: 2, completed: false });
            if (SaveManager.setTournamentState) SaveManager.setTournamentState('provaTorneo', { fase: 1 });
            if (SaveManager.setStoryState) SaveManager.setStoryState('provaStoria', { passo: 3 });
            if (SaveManager.setModeState) SaveManager.setModeState('provaModalita', { x: 1 });

            const salvato = SaveManager.load();
            out.motivo = SaveManager.motivoRifiuto(salvato);
            out.chiavi = Object.keys(salvato);

            // 3) Rifiuti: il salvataggio buono resta com'è.
            const prima = JSON.stringify(SaveManager.load());
            const base = () => JSON.parse(prima);
            const rovinati = {
                'sfide a stringa': Object.assign(base(), { challenges: 'rotto' }),
                'pacchetti a oggetto': Object.assign(base(), { ownedPacks: { a: 1 } }),
                'valute a elenco': Object.assign(base(), { currency: [1, 2] }),
                'storia a numero': Object.assign(base(), { story: 5 }),
                'collezione con testo': Object.assign(base(), { collection: { 7: 'molte' } }),
                'mazzi senza elenco': Object.assign(base(), { decks: [{ id: 'a' }] }),
                'nessun mazzo': Object.assign(base(), { decks: [] })
            };
            out.rifiuti = {};
            Object.keys(rovinati).forEach((nome) => {
                try { SaveManager.applyExternalSave(rovinati[nome]); out.rifiuti[nome] = 'ACCETTATO'; } catch (e) { out.rifiuti[nome] = 'rifiutato'; }
            });
            out.intatto = JSON.stringify(SaveManager.load()) === prima;

            // 4) Riparazione di un salvataggio rovinato già salvato.
            const rotto = JSON.parse(prima);
            rotto.challenges = ['non', 'un', 'oggetto'];
            rotto.ownedPacks = 'non un elenco';
            rotto.currency.credits = 'tanti';
            localStorage.setItem('yugiohDuelArenaSave', JSON.stringify(rotto));
            const riparato = SaveManager.load();
            out.riparato = {
                sfide: riparato.challenges && !Array.isArray(riparato.challenges) && typeof riparato.challenges === 'object',
                pacchetti: Array.isArray(riparato.ownedPacks),
                crediti: riparato.currency.credits === 0,
                forma: SaveManager.motivoRifiuto(riparato)
            };
            return out;
        });

        t.assert(r.motivo === null, 'dopo una sessione piena il salvataggio ha forma rifiutata: ' + r.motivo);

        // 2) Ogni campo di primo livello è nei tipi.
        const senzaTipo = r.chiavi.filter((k) => !new RegExp('\\b' + k + '\\??:').test(TIPI));
        t.assert(senzaTipo.length === 0,
            'campi del salvataggio non descritti in types/salvataggio.d.ts (aggiungili lì e, se sono contenitori, in CONTENITORI_* di save-manager.js): ' + senzaTipo.join(', '));

        const accettati = Object.keys(r.rifiuti).filter((k) => r.rifiuti[k] !== 'rifiutato');
        t.assert(accettati.length === 0, 'salvataggi rovinati ACCETTATI: ' + accettati.join(', '));
        t.assert(r.intatto, 'un file rifiutato ha comunque cambiato il salvataggio');

        t.assert(r.riparato.sfide && r.riparato.pacchetti && r.riparato.crediti, 'load() non ha riparato: ' + JSON.stringify(r.riparato));
        t.assert(r.riparato.forma === null, 'dopo la riparazione la forma deve essere valida: ' + r.riparato.forma);
    }
};
