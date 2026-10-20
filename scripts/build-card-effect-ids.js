#!/usr/bin/env node
/**
 * build-card-effect-ids.js — genera js/data/card-effect-ids.generated.js: l'elenco degli id di carta che hanno un
 * effetto REGISTRATO nel motore (CardEffects), cioe' quelli per cui DuelEngine.getDefinition(id) risponde.
 *
 * Perche': la Cartoteca, Creazione Deck e la vista Cartoteca del menu caricavano l'intero motore del duello
 * (circa 586KB di script) solo per rispondere a "questo mostro ha un effetto?" nel filtro "Categoria Mostro"
 * (getMonsterFilterCategory in js/data/cards-db.js). Con questo elenco il filtro risponde senza il motore.
 *
 * Va rilanciato quando si aggiunge/toglie una carta registrata (lo sorveglia
 * tests/specs/guardrail-elenco-effetti.spec.js, che confronta l'elenco col motore vero):
 *     node scripts/build-card-effect-ids.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RADICE = path.join(__dirname, '..');
const USCITA = path.join(RADICE, 'js', 'data', 'card-effect-ids.generated.js');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; });
        await page.goto('file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/'));
        await page.waitForFunction(() => typeof DuelEngine !== 'undefined' && typeof DuelEngine.getDefinition === 'function' && typeof cardDatabase !== 'undefined' && cardDatabase.length > 0, null, { timeout: 30000 });
        const ids = await page.evaluate(() => cardDatabase.filter((c) => DuelEngine.getDefinition(c.id)).map((c) => c.id).sort((a, b) => a - b));
        const testo = '// GENERATO da scripts/build-card-effect-ids.js — NON modificare a mano (vedi l\'intestazione dello script).\n'
            + '// Id delle carte con un effetto registrato nel motore: serve al filtro "Categoria Mostro" senza caricare il motore.\n'
            + 'window.CARD_EFFECT_IDS = new Set([' + ids.join(',') + ']);\n';
        fs.writeFileSync(USCITA, testo, 'utf8');
        console.log(`Scritte ${ids.length} carte con effetto in ${path.relative(RADICE, USCITA)}.`);
    } finally {
        await browser.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
