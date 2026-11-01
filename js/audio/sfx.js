/**
 * sfx.js — Effetti sonori di duello, GENERATI (non file audio).
 * ---------------------------------------------------------------
 * Ogni suono qui è sintetizzato al volo con la Web Audio API (oscillatori
 * + rumore bianco filtrato + inviluppi di volume): non ci sono file .mp3
 * da scaricare né problemi di licenza, e i suoni restano leggerissimi
 * (nessun download, nessuna cache). Sono volutamente semplici/retrò —
 * per un effetto sonoro "vero" da un pacchetto professionale servirebbe
 * un file audio fornito dall'utente, come già fatto per la colonna
 * sonora in js/audio/audio-manager.js.
 *
 * Libreria PURAMENTE ADDITIVA, stesso spirito di js/ui/effects.js (FX): non
 * legge né modifica gameState. Rispetta mute/volume della musica di
 * sottofondo (js/audio/audio-manager.js / window.DuelMusic), così un solo
 * cursore controlla tutto l'audio del gioco.
 *
 * Funzioni esposte (window.SFX):
 *   draw()            — carta pescata
 *   place()            — carta Set coperta (mostro in difesa, magia/trappola)
 *   summon(position)   — Evocazione mostro ('attack' più squillante, 'defense' più ovattata)
 *   tribute()          — sacrificio per Evocazione Tributo
 *   attackSwing()       — un mostro dichiara e parte all'attacco
 *   clash()             — impatto mostro-contro-mostro
 *   destroy()           — un mostro viene distrutto
 *   directHit()         — attacco diretto ai Life Points
 *   lifePointsLost()     — Life Points persi (qualunque causa: battaglia,
 *                          danno diretto, effetto carta) — vedi il ritardo
 *                          apposta in ACTIONS.dealDamage/duel-engine.js,
 *                          che la fa sentire SEMPRE dopo l'eventuale suono
 *                          di distruzione (destroy()) della stessa azione.
 *   lifePointsGained()   — Life Points recuperati (stessa causa/ritardo)
 *   turnChange()        — cambio turno
 *   phaseChange()        — cambio fase
 *   activateSpell()      — Magia attivata
 *   activateTrap()        — Trappola attivata
 *   activateChain()       — la Catena compare a tutto schermo (js/ui/catena-webgl.js)
 *   tagSwitch()           — scambio fra compagni/avversari nel Tag Team (js/ui/tag-scambio.js)
 *   swordsOfRevealingLight() — Spade Rivelatrici: fruscio + rintocchi scaglionati
 *   raigeki()             — Raigeki: tuono, crepitii e scariche sfalsate
 *   darkHole()            — Buco Nero: risucchio grave + impatto
 *   victory() / defeat()  — fine duello
 */
(function () {
    'use strict';

    let ctx = null;
    function ensureCtx() {
        if (!ctx) {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return null;
            ctx = new Ctor();
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
    }

    /** Volume/mute proprio degli effetti sonori (js/audio/audio-manager.js#DuelSFX), separato dalla musica di sottofondo — vedi impostazioni.html. */
    function masterVolume() {
        if (window.DuelSFX) {
            if (DuelSFX.isMuted()) return 0;
            return DuelSFX.getVolume();
        }
        return 0.5;
    }

    /**
     * Un tono semplice, opzionalmente con una "scivolata" di frequenza
     * (sweepTo) durante la sua durata — è la base di quasi tutti i suoni
     * qui sotto: un fischio ascendente per un'azione positiva, uno
     * discendente per un impatto/perdita.
     */
    function tone(freq, duration, options) {
        options = options || {};
        const vol = masterVolume() * (options.gain !== undefined ? options.gain : 0.22);
        const c = ensureCtx();
        if (!c || vol <= 0) return;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = options.type || 'sine';
        const t0 = c.currentTime + (options.delay || 0);
        osc.frequency.setValueAtTime(freq, t0);
        if (options.sweepTo !== undefined) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(options.sweepTo, 1), t0 + duration);
        }
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.015, duration / 4));
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        osc.connect(gain).connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
    }

    /** Rumore bianco filtrato con inviluppo — la base di impatti/esplosioni/distruzioni. */
    function noiseBurst(duration, options) {
        options = options || {};
        const vol = masterVolume() * (options.gain !== undefined ? options.gain : 0.25);
        const c = ensureCtx();
        if (!c || vol <= 0) return;
        const t0 = c.currentTime + (options.delay || 0);
        const bufferSize = Math.max(1, Math.round(c.sampleRate * duration));
        const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const src = c.createBufferSource();
        src.buffer = buffer;
        const filter = c.createBiquadFilter();
        filter.type = options.filterType || 'lowpass';
        filter.frequency.setValueAtTime(options.filterFreq || 1400, t0);
        if (options.filterSweepTo !== undefined) {
            filter.frequency.exponentialRampToValueAtTime(Math.max(options.filterSweepTo, 40), t0 + duration);
        }
        const gain = c.createGain();
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        src.connect(filter).connect(gain).connect(c.destination);
        src.start(t0);
    }

    // synthesizedSFX invece di window.SFX diretto: window.SFX (in fondo a
    // questo file) avvolge ognuna di queste funzioni per dare prima una
    // possibilità a un file audio "standard" vero (js/audio/audio-library.js,
    // Howler.js) — se esiste, sostituisce il suono sintetizzato; se no
    // (oggi sempre, cartella audio/standard/ vuota), il comportamento
    // resta quello sintetizzato di sempre, senza nessun cambiamento.
    const synthesizedSFX = {
        draw() {
            tone(680, 0.1, { type: 'triangle', sweepTo: 980, gain: 0.16 });
        },
        place() {
            tone(260, 0.11, { type: 'square', sweepTo: 180, gain: 0.16 });
        },
        summon(position) {
            if (position === 'defense') {
                tone(320, 0.16, { type: 'sine', sweepTo: 220, gain: 0.18 });
            } else {
                tone(320, 0.16, { type: 'sawtooth', sweepTo: 560, gain: 0.2 });
                tone(720, 0.14, { type: 'sine', gain: 0.14, delay: 0.09 });
            }
        },
        tribute() {
            tone(560, 0.32, { type: 'sine', sweepTo: 90, gain: 0.2 });
            noiseBurst(0.25, { gain: 0.12, filterFreq: 2200, filterSweepTo: 300, delay: 0.05 });
        },
        attackSwing() {
            tone(220, 0.22, { type: 'sawtooth', sweepTo: 780, gain: 0.2 });
        },
        clash() {
            noiseBurst(0.16, { gain: 0.28, filterFreq: 2600, filterSweepTo: 600 });
            tone(160, 0.14, { type: 'square', sweepTo: 80, gain: 0.18 });
        },
        destroy() {
            noiseBurst(0.4, { gain: 0.32, filterFreq: 1900, filterSweepTo: 120 });
            tone(220, 0.3, { type: 'sawtooth', sweepTo: 35, gain: 0.22 });
        },
        directHit() {
            noiseBurst(0.42, { gain: 0.38, filterFreq: 1000, filterSweepTo: 80 });
            tone(100, 0.36, { type: 'square', sweepTo: 28, gain: 0.28 });
        },
        lifePointsLost() {
            tone(150, 0.2, { type: 'square', sweepTo: 55, gain: 0.2 });
        },
        lifePointsGained() {
            tone(480, 0.24, { type: 'sine', sweepTo: 860, gain: 0.18 });
        },
        turnChange() {
            tone(440, 0.11, { type: 'sine', gain: 0.18 });
            tone(660, 0.16, { type: 'sine', gain: 0.18, delay: 0.11 });
        },
        phaseChange() {
            tone(520, 0.09, { type: 'triangle', gain: 0.13 });
        },
        activateSpell() {
            tone(700, 0.16, { type: 'sine', sweepTo: 1100, gain: 0.18 });
        },
        activateTrap() {
            tone(300, 0.18, { type: 'square', sweepTo: 520, gain: 0.18 });
        },
        /** Catena (scena a tutto schermo): normalmente sostituito da audio/standard/activateChain.mp3; qui un rintocco metallico di scorta. */
        activateChain() {
            noiseBurst(0.18, { gain: 0.2, filterType: 'highpass', filterFreq: 2400, filterSweepTo: 5200 });
            [820, 1230, 1640].forEach((f, i) => tone(f, 0.16, { type: 'triangle', sweepTo: f * 0.8, gain: 0.14, delay: i * 0.07 }));
        },
        /** Tag Team, scambio fra compagni o fra avversari (js/ui/tag-scambio.js): normalmente sostituito da audio/standard/tagSwitch.mp3; qui un fruscio con un colpo di scorta. */
        tagSwitch() {
            noiseBurst(0.3, { gain: 0.16, filterFreq: 900, filterSweepTo: 4200 });
            tone(240, 0.22, { type: 'triangle', sweepTo: 520, gain: 0.16, delay: 0.22 });
        },
        /** Spade Rivelatrici: un fruscio discendente (le spade che calano) seguito da rintocchi metallici scaglionati (ogni spada che si conficca). */
        swordsOfRevealingLight() {
            noiseBurst(0.5, { gain: 0.16, filterFreq: 3200, filterSweepTo: 900 });
            [1200, 1500, 1800, 1500, 1200].forEach((f, i) => {
                tone(f, 0.14, { type: 'triangle', sweepTo: f * 0.7, gain: 0.15, delay: 0.28 + i * 0.08 });
            });
        },
        /** Fusione: normalmente sostituito da audio/standard/fusion.mp3.
         *  Questa breve convergenza sintetica resta solo come fallback se
         *  il file non e' disponibile o non e' ancora stato caricato. */
        fusion() {
            noiseBurst(1.2, { gain: 0.17, filterFreq: 320, filterSweepTo: 2800 });
            [180, 260, 390, 585].forEach((f, i) => {
                tone(f, 0.48, { type: 'sine', sweepTo: f * 1.7, gain: 0.11, delay: i * 0.16 });
            });
        },
        /** Evocazione epica di Livello 7+: normalmente sostituita da
         *  audio/standard/evocation.mp3. Non va confusa con summon(), che
         *  resta il suono breve delle Evocazioni ordinarie. */
        evocation() {
            noiseBurst(1.1, { gain: 0.2, filterFreq: 420, filterSweepTo: 3200 });
            [110, 165, 247, 370, 555].forEach((f, i) => {
                tone(f, 0.55, { type: 'triangle', sweepTo: f * 1.45, gain: 0.12, delay: i * 0.13 });
            });
        },
        /** Buco Nero: un risucchio grave e crescente (rumore filtrato che
         *  sale di frequenza, come aria aspirata) seguito da un impatto
         *  sordo quando il vortice raggiunge il centro. */
        /** Raigeki: tuono grave iniziale e cinque scariche acute, una per slot. */
        raigeki() {
            noiseBurst(0.85, { gain: 0.3, filterFreq: 2600, filterSweepTo: 180 });
            tone(58, 0.75, { type: 'sawtooth', sweepTo: 31, gain: 0.28 });
            [2100, 1750, 2400, 1850, 2250].forEach((f, i) => {
                tone(f, 0.09, { type: 'square', sweepTo: 420, gain: 0.13, delay: 0.28 + i * 0.075 });
            });
        },
        darkHole() {
            noiseBurst(1.65, { gain: 0.27, filterFreq: 170, filterSweepTo: 2900 });
            tone(76, 1.35, { type: 'sawtooth', sweepTo: 24, gain: 0.3, delay: 0.04 });
            tone(43, 1.05, { type: 'sine', sweepTo: 17, gain: 0.32, delay: 0.48 });
            [310, 245, 185, 126].forEach((f, i) => {
                tone(f, 0.34, { type: 'triangle', sweepTo: f * 0.48, gain: 0.11, delay: 0.28 + i * 0.29 });
            });
            tone(34, 0.52, { type: 'square', sweepTo: 19, gain: 0.25, delay: 1.78 });
        },
        victory() {
            [660, 880, 1100].forEach((f, i) => tone(f, 0.28, { type: 'sine', gain: 0.2, delay: i * 0.13 }));
        },
        defeat() {
            [440, 330, 220].forEach((f, i) => tone(f, 0.32, { type: 'sawtooth', gain: 0.18, delay: i * 0.15 }));
        }
    };

    // window.SFX pubblico: stessa firma di ogni funzione di
    // synthesizedSFX qui sopra, ma prova PRIMA un file audio "standard"
    // vero (vedi il commento sopra synthesizedSFX) tramite
    // window.AudioLibrary (js/audio/audio-library.js) — se quel modulo non è
    // caricato in questa pagina, tryPlayStandard torna sempre false e il
    // comportamento è quello sintetizzato di sempre.
    window.SFX = {};
    Object.keys(synthesizedSFX).forEach((name) => {
        window.SFX[name] = function (...args) {
            if (window.AudioLibrary && AudioLibrary.tryPlayStandard(name)) return;
            synthesizedSFX[name].apply(null, args);
        };
    });
})();
