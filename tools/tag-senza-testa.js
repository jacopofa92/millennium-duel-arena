#!/usr/bin/env node
/**
 * tag-senza-testa.js — duelli Tag Team interi, IA contro IA, senza pagina.
 * =====================================================================
 * Fase 2 del piano (docs/planning/PIANO_TAG_TEAM.md): misurare le squadre
 * come la matrice completa misura i duelli 1 contro 1. Riusa il duello senza
 * testa (tools/duello-senza-testa.js) e la variante js/modes/tag.js, che non
 * ha interfaccia: le stesse regole della pagina, con l'IA su tutti i membri.
 *
 * Il lato 'player' è sempre una squadra (il "giocatore" e il suo compagno);
 * con --avversario2 lo è anche il lato 'bot' (2 contro 2). La scelta di chi
 * affrontare a inizio turno (D12) la fa l'IA con il valore predefinito (chi
 * ha giocato per ultimo), con il limite di D13.
 *
 *   node tools/tag-senza-testa.js [--giocatore yugiMuto] [--compagno joey]
 *        [--avversario kaiba] [--avversario2 pegasus] [--livello medium]
 *        [--livello-giocatore hard] [--mazzo-compagno medium] [--lp membro|lato]
 *        [--inizia player|bot|alterna] [--partite 20] [--seme 1] [--turni 80]
 *        [--limite 2] [--dettaglio] [--boss]
 *
 * --boss: Boss a squadre, l'avversario solo ha tagDatabase.lpBoss Life Point
 * (usare con --livello hard, come la pagina; --avversario2 non vale).
 *
 * Esce con 1 se una partita lancia un errore, rompe un invariante o si ferma
 * senza vincitore (uno stallo, non il limite di turni).
 */
'use strict';

const path = require('path');
const { giocaPartita } = require(path.join(__dirname, 'duello-senza-testa.js'));

function argomenti() {
    const a = process.argv.slice(2);
    const val = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 && a[i + 1] ? a[i + 1] : d; };
    return {
        giocatore: val('giocatore', 'yugiMuto'),
        compagno: val('compagno', 'joey'),
        avversario: val('avversario', 'kaiba'),
        avversario2: val('avversario2', null),
        livello: val('livello', 'medium'),
        livelloGiocatore: val('livello-giocatore', 'hard'),
        mazzoCompagno: val('mazzo-compagno', 'medium'),
        lp: val('lp', 'membro') === 'lato' ? 'lato' : 'membro',
        inizia: val('inizia', 'alterna'),
        partite: Number(val('partite', '20')),
        seme: Number(val('seme', '1')),
        turni: Number(val('turni', '80')),
        limite: Number(val('limite', '2')),
        dettaglio: a.includes('--dettaglio'),
        boss: a.includes('--boss')
    };
}

/** Il codice che prepara le squadre, come lo fa tag-mode.js nella pagina. */
function preparazione(o, iniziaBot) {
    return `
        (function () {
            const nome = (id) => ((characterDatabase.find((c) => c.id === id) || {}).name || id);
            ${iniziaBot ? "gameState.currentPlayer = 'bot';" : ''}
            // Gli stessi Life Point della pagina (D19: 4000 a testa per la coppia nel 2 contro 1).
            const lp = tagDatabase.lpSquadra(${o.avversario2 ? 'false' : 'true'});
            const lpAvv = tagDatabase.lpSquadra(false);
            TagTeam.preparaSquadra('player', {
                primo: { nome: nome(${JSON.stringify(o.giocatore)}), personaggio: ${JSON.stringify(o.giocatore)}, controllore: 'ia', livelloIA: ${JSON.stringify(o.livelloGiocatore)} },
                secondo: { nome: nome(${JSON.stringify(o.compagno)}), personaggio: ${JSON.stringify(o.compagno)}, controllore: 'ia', livelloIA: ${JSON.stringify(o.livelloGiocatore)} },
                mazzoSecondo: getCharacterDeck(${JSON.stringify(o.compagno)}, ${JSON.stringify(o.mazzoCompagno)}),
                regolaLp: ${JSON.stringify(o.lp)}, lp, limiteBersaglio: ${o.limite}
            });
            ${o.avversario2 ? `TagTeam.preparaSquadra('bot', {
                primo: { nome: nome(${JSON.stringify(o.avversario)}), personaggio: ${JSON.stringify(o.avversario)}, controllore: 'ia', livelloIA: ${JSON.stringify(o.livello)} },
                secondo: { nome: nome(${JSON.stringify(o.avversario2)}), personaggio: ${JSON.stringify(o.avversario2)}, controllore: 'ia', livelloIA: ${JSON.stringify(o.livello)} },
                mazzoSecondo: getCharacterDeck(${JSON.stringify(o.avversario2)}, ${JSON.stringify(o.livello)}),
                regolaLp: ${JSON.stringify(o.lp)}, lp: lpAvv, limiteBersaglio: ${o.limite}
            });` : ''}
            ${o.boss ? 'gameState.botLP = tagDatabase.lpBoss;' : ''}
            window.__fronti = { player: [], bot: [] };
            EventiDuello.ascolta('registro', (m) => {
                const t = String(m);
                if (t.indexOf('⚔️') === 0 && t.indexOf(' affronta ') !== -1) (gameState.currentPlayer === 'player' ? __fronti.bot : __fronti.player).push(t);
            });
        })();
    `;
}

const ALLA_FINE = `({
    player: TagTeam.riassunto('player'),
    bot: TagTeam.riassunto('bot'),
    fronti: { player: __fronti.player.length, bot: __fronti.bot.length },
    limite: __logDuello.filter((r) => r.indexOf('turni di fila') !== -1).length
})`;

/**
 * Una partita a squadre. `iniziaBot`: il primo turno è del lato avversario.
 * @returns {Promise<any>}
 */
function giocaTag(o, n, iniziaBot) {
    return giocaPartita({
        avversario: o.avversario,
        livello: o.livello,
        giocatore: o.giocatore,
        livelloGiocatore: o.livelloGiocatore,
        seme: o.seme,
        turni: o.turni,
        scriptAggiuntivi: ['js/data/tag-db.js', 'js/modes/tag.js'],
        primaDelTurno: preparazione(o, iniziaBot),
        allaFine: ALLA_FINE
    }, n);
}

async function main() {
    const o = argomenti();
    if (o.boss) o.avversario2 = null;
    let ok = true;
    const conta = { partite: 0, vinte: 0, perse: 0, pari: 0, limite: 0, stalli: 0, errori: 0, turni: 0, inizioPlayer: [0, 0], inizioBot: [0, 0], limiteD13: 0, eliminatiG: 0, eliminatiA: 0 };
    for (let n = 0; n < o.partite; n++) {
        const iniziaBot = o.inizia === 'bot' || (o.inizia === 'alterna' && n % 2 === 1);
        let r;
        try {
            r = await giocaTag(o, n, iniziaBot);
        } catch (e) {
            ok = false;
            conta.errori++;
            console.error(`Partita ${n + 1} (seme ${o.seme + n}): ERRORE\n${e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : e}`);
            continue;
        }
        conta.partite++;
        conta.turni += r.turno;
        if (r.esito === true) conta.vinte++;
        else if (r.esito === false) conta.perse++;
        else if (r.esito === 'draw') conta.pari++;
        else if (r.alLimite) conta.limite++;
        else { conta.stalli++; ok = false; }
        const casella = iniziaBot ? conta.inizioBot : conta.inizioPlayer;
        casella[1]++;
        if (r.esito === true) casella[0]++;
        const x = r.extra || {};
        conta.limiteD13 += x.limite || 0;
        if (x.player) conta.eliminatiG += x.player.membri.filter((m) => !m.vivo).length;
        if (x.bot) conta.eliminatiA += x.bot.membri.filter((m) => !m.vivo).length;
        if (r.erroriCarte.length || r.invarianti.length) {
            ok = false;
            console.log(`Partita ${n + 1}: errori ${[...new Set(r.erroriCarte)].slice(0, 3).join(' | ')} ${r.invarianti.join(' | ')}`);
        }
        if (o.dettaglio || (r.esito == null && !r.alLimite)) {
            const esito = r.esito === true ? 'vince la tua squadra' : r.esito === false ? 'vince l\'avversario' : r.esito === 'draw' ? 'pareggio' : r.alLimite ? 'al limite di turni' : 'FERMA';
            const mem = (s) => (s ? s.membri.map((m) => `${m.nome} ${m.vivo ? m.lp : 'fuori'}`).join(', ') : '');
            console.log(`Partita ${n + 1} (seme ${r.seme}, comincia ${iniziaBot ? 'bot' : 'player'}): ${esito} al turno ${r.turno} — [${mem(x.player)}] / [${x.bot ? mem(x.bot) : r.lpB}]`);
            if (r.esito == null && !r.alLimite) console.log(`  fermo in fase ${r.fasi}, di turno ${r.chi}; catena ${r.catena}, finestra ${r.finestra}\n    ${r.log.join('\n    ')}`);
        }
    }
    const pct = (a, b) => (b ? Math.round(100 * a / b) + '%' : '-');
    const formato = o.avversario2 ? `${o.giocatore} + ${o.compagno} contro ${o.avversario} + ${o.avversario2}` : `${o.giocatore} + ${o.compagno} contro ${o.avversario}`;
    console.log(`\n${formato} (avversario ${o.livello}, LP ${o.lp}, limite D13 ${o.limite})`);
    console.log(`Partite ${conta.partite}: vince la tua squadra ${conta.vinte} (${pct(conta.vinte, conta.partite)}), perde ${conta.perse}, pari ${conta.pari}, al limite ${conta.limite}, ferme ${conta.stalli}, errori ${conta.errori}`);
    console.log(`Quando comincia la tua squadra: ${pct(conta.inizioPlayer[0], conta.inizioPlayer[1])} su ${conta.inizioPlayer[1]}; quando comincia l'avversario: ${pct(conta.inizioBot[0], conta.inizioBot[1])} su ${conta.inizioBot[1]}`);
    console.log(`Turni medi ${conta.partite ? Math.round(conta.turni / conta.partite) : '-'}; membri eliminati: tua squadra ${conta.eliminatiG}, avversari ${conta.eliminatiA}; scelte forzate da D13 ${conta.limiteD13}`);
    process.exit(ok ? 0 : 1);
}

if (require.main === module) main();
module.exports = { giocaTag };
