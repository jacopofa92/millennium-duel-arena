/**
 * board-pieces.js — Pedine "3D" disegnate in SVG per le mappe dei tornei.
 * =====================================================================
 * Nate per la città di Battle City, dove i punti della mappa erano emoji
 * (🧑‍🎤 🕶️ 🃏 ❗ 🏪 🚁 ❓ 📍): minuscole, diverse da un sistema operativo
 * all'altro, e stonate sopra lo sfondo illustrato. Richiesta dell'utente:
 * "al posto delle emoticon metti qualcosa in 3D, come immagini" e poi
 * "puoi renderle più fighe?" — da qui il secondo giro: silhouette
 * riconoscibili a colpo d'occhio, luce di bordo, basamento luminoso e
 * piccole animazioni idle.
 *
 * PERCHÉ SVG E NON IMMAGINI PNG: le pedine devono restare nitide a ogni
 * densità di schermo (il telefono va a 2-3x), pesare nulla (il gioco gira
 * offline, su file:// e nell'APK) e poter cambiare colore con lo stato
 * della casella senza un file per ogni combinazione. Il volume lo danno i
 * gradienti (luce da sinistra in alto, come nello sfondo della città), una
 * luce di bordo sul lato opposto (rim light: è ciò che stacca la pedina
 * dallo sfondo scuro), lo spessore una seconda faccia più scura spostata
 * in basso, e l'ombra a terra un'ellisse sfocata.
 *
 * I GRADIENTI SONO DEFINITI UNA VOLTA SOLA (ensureDefs) e ogni pedina li
 * richiama per id. Due vincoli, già pagati in questo progetto col logo
 * (js/ui/game-logo.js): l'SVG che li contiene NON deve stare in un
 * contenitore `display:none` (un gradiente dentro un SVG non visualizzato
 * non si dipinge, e tutte le pedine resterebbero senza colore), e gli id
 * hanno un prefisso proprio (`bp-`) per non scontrarsi con altri SVG della
 * stessa pagina. Anche gli stili delle animazioni sono iniettati qui
 * (un solo <style>, ensureDefs): il modulo non dipende dal CSS della
 * pagina che lo usa e rispetta `prefers-reduced-motion` da sé.
 *
 * Uso: BoardPieces.markup('duelist') → stringa HTML da mettere in una
 * casella. Il tipo sconosciuto torna stringa vuota (casella senza pedina),
 * mai un errore: un tipo di casella nuovo non deve rompere la mappa.
 */
(function () {
    'use strict';

    const DEFS_ID = 'bpDefs';
    const STYLE_ID = 'bpStyle';

    const DEFS = `
        <linearGradient id="bp-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#fff6c2"/><stop offset=".45" stop-color="#f7bd3f"/><stop offset="1" stop-color="#9c5a0b"/>
        </linearGradient>
        <linearGradient id="bp-cyan-body" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#0b5878"/><stop offset=".3" stop-color="#47e6fb"/><stop offset=".62" stop-color="#1699bd"/><stop offset="1" stop-color="#052e44"/>
        </linearGradient>
        <radialGradient id="bp-skin" cx=".36" cy=".3" r=".8">
            <stop offset="0" stop-color="#ffe9d2"/><stop offset=".5" stop-color="#f1b98f"/><stop offset="1" stop-color="#b8754a"/>
        </radialGradient>
        <linearGradient id="bp-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#5a6fe8"/><stop offset=".5" stop-color="#2a2f86"/><stop offset="1" stop-color="#0f1140"/>
        </linearGradient>
        <linearGradient id="bp-purple-body" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#1b0b2a"/><stop offset=".3" stop-color="#7a3aa3"/><stop offset=".65" stop-color="#3f175a"/><stop offset="1" stop-color="#0f0518"/>
        </linearGradient>
        <radialGradient id="bp-hood" cx=".36" cy=".28" r=".85">
            <stop offset="0" stop-color="#8f58bf"/><stop offset=".45" stop-color="#3c1659"/><stop offset="1" stop-color="#12051d"/>
        </radialGradient>
        <linearGradient id="bp-base-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#d4e1ef"/><stop offset="1" stop-color="#4a5a70"/>
        </linearGradient>
        <linearGradient id="bp-amber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#fff3a6"/><stop offset=".5" stop-color="#f7b21f"/><stop offset="1" stop-color="#c06f05"/>
        </linearGradient>
        <linearGradient id="bp-card-back" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#b87430"/><stop offset=".55" stop-color="#6b3d16"/><stop offset="1" stop-color="#3c210b"/>
        </linearGradient>
        <linearGradient id="bp-foil" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#22d3ee" stop-opacity=".0"/><stop offset=".35" stop-color="#7df3ff" stop-opacity=".55"/>
            <stop offset=".6" stop-color="#e879f9" stop-opacity=".45"/><stop offset="1" stop-color="#fde68a" stop-opacity="0"/>
        </linearGradient>
        <radialGradient id="bp-holo" cx=".38" cy=".32" r=".78">
            <stop offset="0" stop-color="#d4fdff"/><stop offset=".42" stop-color="#1fb3d2"/><stop offset="1" stop-color="#05243a"/>
        </radialGradient>
        <radialGradient id="bp-pad" cx=".5" cy=".45" r=".6">
            <stop offset="0" stop-color="#7a2487"/><stop offset="1" stop-color="#25072d"/>
        </radialGradient>
        <linearGradient id="bp-wall-l" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#8aa0bb"/><stop offset="1" stop-color="#3f4e63"/>
        </linearGradient>
        <linearGradient id="bp-wall-r" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#e4eef9"/><stop offset="1" stop-color="#8296ae"/>
        </linearGradient>
        <linearGradient id="bp-steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#eef3fa"/><stop offset="1" stop-color="#6f8098"/>
        </linearGradient>
        <radialGradient id="bp-glow-cyan" cx=".5" cy=".5" r=".5">
            <stop offset="0" stop-color="#7df3ff" stop-opacity=".85"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="bp-glow-magenta" cx=".5" cy=".5" r=".5">
            <stop offset="0" stop-color="#f5d0fe" stop-opacity=".9"/><stop offset="1" stop-color="#e879f9" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="bp-glow-amber" cx=".5" cy=".5" r=".5">
            <stop offset="0" stop-color="#fff0a0" stop-opacity=".9"/><stop offset="1" stop-color="#f7b21f" stop-opacity="0"/>
        </radialGradient>`;

    // Animazioni idle. `transform-box: fill-box` fa ruotare/scalare ogni
    // elemento attorno al PROPRIO centro invece che all'angolo dell'SVG.
    const STYLE = `
        .bp-piece * { transform-box: fill-box; transform-origin: center; }
        .bp-blink { animation: bpBlink 1.5s ease-in-out infinite; }
        .bp-eye { animation: bpEye 2.4s ease-in-out infinite; }
        .bp-spin { animation: bpSpin 6s linear infinite; }
        .bp-spin-slow { animation: bpSpin 11s linear infinite reverse; }
        .bp-breathe { animation: bpBreathe 2.2s ease-in-out infinite; }
        .bp-sweep { animation: bpSweep 3.2s ease-in-out infinite; }
        .bp-lights circle { animation: bpBlink 1s steps(2, jump-none) infinite; }
        .bp-lights circle:nth-child(2n) { animation-delay: .5s; }
        @keyframes bpBlink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
        @keyframes bpEye { 0%,100% { opacity: .75; } 50% { opacity: 1; filter: brightness(1.5); } }
        @keyframes bpSpin { to { transform: rotate(360deg); } }
        @keyframes bpBreathe { 0%,100% { transform: scale(.94); opacity: .7; } 50% { transform: scale(1.06); opacity: 1; } }
        @keyframes bpSweep { 0%,55% { transform: translateX(-130%); } 100% { transform: translateX(130%); } }
        @media (prefers-reduced-motion: reduce) {
            .bp-piece * { animation: none !important; }
        }`;

    /** Inserisce una volta sola, nel <body>, l'SVG con i gradienti e lo <style> delle animazioni. */
    function ensureDefs() {
        if (!document.getElementById(STYLE_ID)) {
            const st = document.createElement('style');
            st.id = STYLE_ID;
            st.textContent = STYLE;
            document.head.appendChild(st);
        }
        if (document.getElementById(DEFS_ID)) return;
        const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        holder.setAttribute('id', DEFS_ID);
        holder.setAttribute('aria-hidden', 'true');
        holder.setAttribute('width', '0');
        holder.setAttribute('height', '0');
        // Fuori dal flusso ma VISUALIZZATO: vedi il commento in cima al file.
        holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
        holder.innerHTML = `<defs>${DEFS}</defs>`;
        document.body.appendChild(holder);
    }

    // Ombra a terra comune a ogni pedina: è lei a "posarla" sulla mappa.
    const SHADOW = '<ellipse cx="32" cy="58" rx="17" ry="3.8" fill="#000" opacity=".45"/>';
    // Basamento a disco con anello luminoso del colore della pedina.
    const base = (ring, glow) => `
        <ellipse cx="32" cy="55" rx="16" ry="5.6" fill="url(#${glow})" class="bp-breathe"/>
        <ellipse cx="32" cy="54.6" rx="14" ry="4.8" fill="#1d2735"/>
        <ellipse cx="32" cy="53" rx="14" ry="4.8" fill="url(#bp-base-top)"/>
        <ellipse cx="32" cy="53" rx="11" ry="3.5" fill="none" stroke="${ring}" stroke-width="1.4"/>`;

    const PIECES = {
        // Duellante: capelli a punte, giacca azzurra, Duel Disk dorato al
        // braccio con una carta già sul disco. Luce di bordo ciano a destra.
        duelist: `${SHADOW}${base('#22d3ee', 'bp-glow-cyan')}
            <path d="M19.5 52 C19.5 40 24 33 32 33 C40 33 44.5 40 44.5 52 Z" fill="url(#bp-cyan-body)"/>
            <path d="M42 36 C44.5 40 45 46 44.5 52 L41 52 C41.5 46 40.5 40 38.5 35.5 Z" fill="#9ff6ff" opacity=".55"/>
            <path d="M32 33.5 L27 37 L32 52 L37 37 Z" fill="#e8fdff" opacity=".9"/>
            <path d="M32 33.5 L29.6 35.6 L32 46 L34.4 35.6 Z" fill="#0b5878"/>
            <rect x="27.4" y="30" width="9.2" height="4.6" rx="1.8" fill="url(#bp-skin)"/>
            <circle cx="32" cy="23.6" r="8.8" fill="url(#bp-skin)"/>
            <path d="M22.6 22.5 L21 13 L26.2 17.2 L28 9.6 L32 16 L36 9.6 L37.8 17.2 L43 13 L41.4 22.5 C38.5 17 25.5 17 22.6 22.5 Z" fill="url(#bp-hair)"/>
            <path d="M27.6 12.6 L28.2 16.2 L30.4 14.4 Z" fill="#9aa8ff" opacity=".8"/>
            <circle cx="28.6" cy="24.6" r="1.35" fill="#14203a"/><circle cx="35.4" cy="24.6" r="1.35" fill="#14203a"/>
            <circle cx="29.0" cy="24.2" r=".45" fill="#fff"/><circle cx="35.8" cy="24.2" r=".45" fill="#fff"/>
            <path d="M29.8 28.6 Q32 30 34.2 28.6" fill="none" stroke="#7a3d1f" stroke-width=".9" stroke-linecap="round"/>
            <ellipse cx="29" cy="20.6" rx="3" ry="1.6" fill="#fff" opacity=".4" transform="rotate(-24 29 20.6)"/>
            <g transform="rotate(-18 16.5 42)">
                <ellipse cx="16.5" cy="45.4" rx="11" ry="4.2" fill="#6e3f06"/>
                <ellipse cx="16.5" cy="43.2" rx="11" ry="4.2" fill="url(#bp-gold)" stroke="#fff3c0" stroke-width=".7"/>
                <rect x="11.6" y="38.6" width="9.8" height="5.6" rx="1" fill="#0b2a44" stroke="#22d3ee" stroke-width=".6"/>
                <rect x="13" y="39.6" width="7" height="3.6" rx=".5" fill="#22d3ee" opacity=".55"/>
                <circle cx="9.4" cy="43.4" r="1.2" fill="#7df3ff" class="bp-blink"/>
            </g>`,
        // Rare Hunter: mantello scuro con spalle larghe, cappuccio, occhi
        // magenta incandescenti e l'Occhio del Millennio d'oro sul petto.
        // Anonimo apposta — l'identità si estrae entrando nella casella.
        hunter: `${SHADOW}${base('#e879f9', 'bp-glow-magenta')}
            <path d="M16.5 52.5 C16.5 40 22 31.5 32 31.5 C42 31.5 47.5 40 47.5 52.5 Z" fill="url(#bp-purple-body)"/>
            <path d="M44 34 C47 39 48 46 47.5 52.5 L43.5 52.5 C44 46 43 40 40.4 35.4 Z" fill="#e0a8ff" opacity=".5"/>
            <path d="M16.5 52.5 L20 45 L24 52.5 L28 46 L32 52.5 L36 46 L40 52.5 L44 45 L47.5 52.5 Z" fill="#12051d" opacity=".75"/>
            <path d="M20 36 C24 31.4 40 31.4 44 36 L41 40 C37 36.6 27 36.6 23 40 Z" fill="#6b2f93"/>
            <path d="M32 7 C40.8 7 45.5 16 44.4 25.8 C43.8 30.2 41 33 37.6 34 L26.4 34 C23 33 20.2 30.2 19.6 25.8 C18.5 16 23.2 7 32 7 Z" fill="url(#bp-hood)"/>
            <path d="M36.5 9 C41.6 11.6 44 18 43.4 24 C42.8 27 41.6 29 40 30.5 C41.4 24 40.6 15 36.5 9 Z" fill="#c58cf0" opacity=".4"/>
            <path d="M23.4 26 C23.4 20.6 27 17.6 32 17.6 C37 17.6 40.6 20.6 40.6 26 C40.6 31 37 33.4 32 33.4 C27 33.4 23.4 31 23.4 26 Z" fill="#05010a"/>
            <g class="bp-eye">
                <ellipse cx="28.2" cy="26" rx="2.4" ry="1.5" fill="#f0abfc"/><ellipse cx="35.8" cy="26" rx="2.4" ry="1.5" fill="#f0abfc"/>
                <ellipse cx="28.2" cy="26" rx="4.6" ry="3" fill="url(#bp-glow-magenta)"/><ellipse cx="35.8" cy="26" rx="4.6" ry="3" fill="url(#bp-glow-magenta)"/>
            </g>
            <path d="M24.8 43 Q32 36.4 39.2 43 Q32 49.6 24.8 43 Z" fill="url(#bp-gold)" stroke="#fff3c0" stroke-width=".6"/>
            <circle cx="32" cy="43" r="3" fill="#3a0f52"/><circle cx="32" cy="43" r="1.3" fill="#f5d0fe" class="bp-eye"/>
            <path d="M32 49.6 V53" stroke="#fcd34d" stroke-width="1" stroke-linecap="round"/>`,
        // Crediti: poche monete dorate tridimensionali, riconoscibili come
        // ricompensa economica senza confonderle con le Carte Locazione.
        credits: `${SHADOW}
            <ellipse cx="32" cy="55" rx="17" ry="4.8" fill="url(#bp-glow-amber)" class="bp-breathe"/>
            <ellipse cx="27" cy="45" rx="10" ry="4" fill="#8c5610" stroke="#ffe9a3" stroke-width="1"/>
            <path d="M17 40 V45 C17 47.5 21.5 49 27 49 S37 47.5 37 45 V40" fill="#d99524" stroke="#fff0b7" stroke-width="1"/>
            <ellipse cx="27" cy="40" rx="10" ry="4" fill="url(#bp-gold)" stroke="#fff4c2" stroke-width="1.2"/>
            <ellipse cx="39" cy="48" rx="9" ry="3.7" fill="#9a6417" stroke="#ffdf8b" stroke-width="1"/>
            <path d="M30 43 V48 C30 50.3 34.8 51.7 39 51.7 S48 50.3 48 48 V43" fill="#d39120" stroke="#ffeab0" stroke-width="1"/>
            <ellipse cx="39" cy="43" rx="9" ry="3.7" fill="url(#bp-gold)" stroke="#fff4c2" stroke-width="1.2"/>
            <path d="M26 38 l1.2 -2 1.2 2 2 .4 -1.6 1.3 .4 2 -2 -1 -1.8 1 .4 -2 -1.6 -1.3z" fill="#fff7d6" class="bp-blink"/>`,
        // Carta Locazione: carta in piedi, inclinata, con spessore, cornice
        // dorata, bersaglio del radar e una lama di luce olografica che la
        // attraversa ogni tanto (clip sulla sagoma della carta).
        locator: `${SHADOW}
            <ellipse cx="32" cy="55" rx="15" ry="4.6" fill="url(#bp-glow-cyan)" class="bp-breathe"/>
            <polygon points="46,10 50.5,12.6 52,53 47.4,51.4" fill="#2a1606"/>
            <polygon points="16.5,14.5 46,10 47.4,51.4 18,55.4" fill="url(#bp-card-back)" stroke="#f7d774" stroke-width="1.5" stroke-linejoin="round"/>
            <polygon points="21,19.4 42.6,16.2 43.8,46.8 22.4,50" fill="#0c1a2e" stroke="#f7d774" stroke-opacity=".7" stroke-width=".8"/>
            <circle cx="32.4" cy="33" r="10.4" fill="#062a3c" stroke="#22d3ee" stroke-width="1.5"/>
            <circle cx="32.4" cy="33" r="6.6" fill="none" stroke="#7df3ff" stroke-width="1" stroke-dasharray="2.4 2" class="bp-spin"/>
            <circle cx="32.4" cy="33" r="3" fill="none" stroke="#7df3ff" stroke-width="1"/>
            <circle cx="32.4" cy="33" r="1.4" fill="#e8fdff" class="bp-blink"/>
            <path d="M32.4 21 V25 M32.4 41 V45 M20.4 33 H24.4 M40.4 33 H44.4" stroke="#7df3ff" stroke-width="1.3" stroke-linecap="round"/>
            <clipPath id="bp-card-clip"><polygon points="16.5,14.5 46,10 47.4,51.4 18,55.4"/></clipPath>
            <g clip-path="url(#bp-card-clip)"><polygon class="bp-sweep" points="12,12 22,11 14,56 4,57" fill="#fff" opacity=".42"/></g>
            <polygon points="17.4,15.4 30,13.6 20,32" fill="url(#bp-foil)"/>
            <polygon points="19.4,53 22,52 20,56 18,56.4" fill="#f7d774"/>`,
        // Evento: cartello di pericolo smussato, con strisce a righe sul
        // piede, punto esclamativo luminoso che lampeggia.
        event: `${SHADOW}
            <ellipse cx="32" cy="55" rx="16" ry="4.8" fill="url(#bp-glow-amber)" class="bp-breathe"/>
            <polygon points="35.5,11 59,53.4 13,53.4" fill="#5d3503"/>
            <polygon points="32,6.5 56,49.8 8,49.8" fill="url(#bp-amber)" stroke="#fff6c8" stroke-width="1.2" stroke-linejoin="round"/>
            <polygon points="32,13.4 50.6,46.6 13.4,46.6" fill="#17110a" stroke="#fbbf24" stroke-width="1" stroke-linejoin="round"/>
            <polygon points="32,6.5 20.4,27.4 25,27.4 32,14 " fill="#fff" opacity=".35"/>
            <g class="bp-blink">
                <path d="M29.4 22 H34.6 L33.6 36.4 H30.4 Z" fill="#ffd54a"/>
                <circle cx="32" cy="41.4" r="2.8" fill="#ffd54a"/>
                <circle cx="32" cy="31" r="12" fill="url(#bp-glow-amber)" opacity=".5"/>
            </g>
            <path d="M12.5 50.5 L17.5 50.5 L14.5 54 L9.5 54 Z M22.5 50.5 L27.5 50.5 L24.5 54 L19.5 54 Z M37.5 50.5 L42.5 50.5 L39.5 54 L34.5 54 Z M47.5 50.5 L52.5 50.5 L49.5 54 L44.5 54 Z" fill="#17110a" opacity=".55"/>`,
        // Negozio: edificio isometrico con tenda a righe, vetrina accesa,
        // insegna al neon "24H" e luce calda sulla porta.
        shop: `${SHADOW}
            <ellipse cx="32" cy="56" rx="19" ry="4.6" fill="url(#bp-glow-cyan)" opacity=".55" class="bp-breathe"/>
            <polygon points="12,27 32,36.4 32,57 12,47.6" fill="url(#bp-wall-l)"/>
            <polygon points="32,36.4 52,27 52,47.6 32,57" fill="url(#bp-wall-r)"/>
            <polygon points="12,27 32,17.4 52,27 32,36.4" fill="#2b3f57"/>
            <polygon points="15.4,27 32,19.4 48.6,27 32,34.6" fill="#3d5878"/>
            <polygon points="32,36.4 52,27 52,24.6 32,34 12,24.6 12,27" fill="#1d2d42" opacity=".5"/>
            <polygon points="12,27 32,36.4 32,40 12,30.6" fill="#e04848"/>
            <polygon points="32,36.4 52,27 52,30.6 32,40" fill="#fafafa"/>
            <polygon points="12,30.6 32,40 32,41.6 12,32.2" fill="#8c2a2a"/>
            <polygon points="32,40 52,30.6 52,32.2 32,41.6" fill="#b8c2cf"/>
            <polygon points="36.4,44 43.6,40.6 43.6,53 36.4,56.4" fill="#1c2635"/>
            <polygon points="37.4,44.8 42.6,42.4 42.6,52 37.4,54.4" fill="#fcd34d" opacity=".75"/>
            <polygon points="15.2,36 28.8,42.4 28.8,48.6 15.2,42.2" fill="#22d3ee" opacity=".8"/>
            <polygon points="16.2,36.8 21,39 21,40.8 16.2,38.6" fill="#e8fdff" opacity=".85"/>
            <g class="bp-blink">
                <rect x="40.6" y="21.4" width="13" height="6" rx="1.4" fill="#06202e" stroke="#22d3ee" stroke-width=".9" transform="skewY(-26.6) translate(0 18)"/>
                <text x="47" y="26.4" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="4.4" font-weight="900" fill="#7df3ff" transform="skewY(-26.6) translate(0 18)">24H</text>
            </g>`,
        // Varco stradale: due cartelli luminosi indicano che questo
        // isolato porta in un altro quartiere. È distinto dalle icone degli
        // incontri, così la navigazione resta leggibile anche da mobile.
        districtGate: `${SHADOW}
            <ellipse cx="32" cy="55" rx="17" ry="4.5" fill="url(#bp-glow-cyan)" class="bp-breathe"/>
            <path d="M32 27 V53 M28.5 53 H35.5" stroke="#d3e5ef" stroke-width="3" stroke-linecap="round"/>
            <path d="M32 28 L23 19 L32 10 L41 19 Z" fill="url(#bp-steel)" stroke="#e8fdff" stroke-width="1.2"/>
            <path d="M32 14 L37 19 L32 24 L27 19 Z" fill="#06283c" stroke="#42e7ff" stroke-width="1"/>
            <path d="M28.7 19 H35.2 M32 15.8 L35.2 19 L32 22.2" fill="none" stroke="#b9faff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="bp-blink"/>
            <path d="M20 35 H44" stroke="#f7d774" stroke-width="1.5" stroke-dasharray="2 2" opacity=".8"/>`,
        // Zona di decollo: piazzola isometrica con la H, luci perimetrali
        // lampeggianti e l'elicottero sospeso con il rotore che gira.
        heliport: `${SHADOW}
            <ellipse cx="32" cy="51" rx="25" ry="9.4" fill="url(#bp-glow-magenta)" class="bp-breathe"/>
            <ellipse cx="32" cy="50.4" rx="22" ry="8.6" fill="#1a0420"/>
            <ellipse cx="32" cy="48" rx="22" ry="8.6" fill="url(#bp-pad)" stroke="#e879f9" stroke-width="1.5"/>
            <ellipse cx="32" cy="48" rx="15.5" ry="5.8" fill="none" stroke="#f5d0fe" stroke-opacity=".6" stroke-width="1"/>
            <g class="bp-lights" fill="#fdf4ff">
                <circle cx="10.4" cy="48" r="1.1"/><circle cx="20" cy="41.6" r="1.1"/><circle cx="44" cy="41.6" r="1.1"/>
                <circle cx="53.6" cy="48" r="1.1"/><circle cx="44" cy="54.4" r="1.1"/><circle cx="20" cy="54.4" r="1.1"/>
            </g>
            <path d="M26.4 45 V51 M37.6 45 V51 M26.4 48 H37.6" stroke="#fdf4ff" stroke-width="2.3" stroke-linecap="round"/>
            <g>
                <ellipse cx="32" cy="35.4" rx="6" ry="1.7" fill="#000" opacity=".28"/>
                <path d="M21 26 C21 20.4 25.6 18 31 18 C37 18 40.4 21.6 40.4 25.6 C40.4 29 37.4 30.4 32 30.4 C26 30.4 21 29.6 21 26 Z" fill="url(#bp-steel)" stroke="#3f4e63" stroke-width=".9"/>
                <path d="M39.6 24.6 L53 22 L53.8 25 L40 27.4" fill="#8296ae"/>
                <path d="M52.4 19.6 L55 19 L55 26.4 L53 26" fill="#5b6b82"/>
                <path d="M24.4 21 C25.8 19 28.8 18.6 30.6 18.7 L30.6 24.4 L23.4 24.4 Z" fill="#7df3ff" opacity=".9"/>
                <path d="M26 33 H38 M28 31 V33 M36 31 V33" stroke="#3f4e63" stroke-width="1" stroke-linecap="round"/>
                <ellipse cx="31" cy="15.4" rx="17" ry="1.9" fill="#e8f0f8" opacity=".6" class="bp-blink"/>
                <rect x="30.2" y="15.4" width="1.6" height="3" fill="#3f4e63"/>
            </g>`,
        // Missione: bersaglio a due anelli con il mirino, rosso come
        // l'avviso e con un punto centrale che lampeggia.
        quest: `${SHADOW}
            <ellipse cx="32" cy="55" rx="15" ry="4.4" fill="url(#bp-glow-amber)" class="bp-breathe"/>
            <circle cx="32" cy="31" r="21" fill="#3a0a10"/>
            <circle cx="32" cy="29" r="20" fill="#7f1d1d" stroke="#fecaca" stroke-width="1.3"/>
            <circle cx="32" cy="29" r="14" fill="#fafafa" stroke="#fecaca" stroke-width=".8"/>
            <circle cx="32" cy="29" r="8.4" fill="#dc2626"/>
            <circle cx="32" cy="29" r="3.4" fill="#fafafa" class="bp-blink"/>
            <path d="M32 4.5 V15 M32 43 V53.5 M7.5 29 H18 M46 29 H56.5" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>
            <ellipse cx="24" cy="17" rx="6" ry="3" fill="#fff" opacity=".3" transform="rotate(-32 24 17)"/>`,
        // Casella ignota: sfera olografica del radar con anelli che
        // ruotano, riflesso e il punto di domanda.
        hidden: `${SHADOW}
            <ellipse cx="32" cy="55" rx="14" ry="4.2" fill="url(#bp-glow-cyan)" class="bp-breathe"/>
            <circle cx="32" cy="30" r="19" fill="url(#bp-holo)" opacity=".94"/>
            <ellipse cx="32" cy="30" rx="19" ry="5.6" fill="none" stroke="#7df3ff" stroke-opacity=".6" stroke-width="1.1" class="bp-spin"/>
            <ellipse cx="32" cy="30" rx="7.4" ry="19" fill="none" stroke="#7df3ff" stroke-opacity=".35" stroke-width="1" class="bp-spin-slow"/>
            <ellipse cx="25" cy="20.6" rx="7" ry="3.8" fill="#fff" opacity=".45" transform="rotate(-32 25 20.6)"/>
            <path d="M16 36 Q32 44 48 36" fill="none" stroke="#7df3ff" stroke-opacity=".3" stroke-width=".9"/>
            <text x="32" y="38" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="21" font-weight="900" fill="#effeff" stroke="#0a5f80" stroke-width=".8" paint-order="stroke">?</text>`,
        // Casella già risolta: gettone d'acciaio spento con la spunta.
        done: `<ellipse cx="32" cy="46" rx="12.6" ry="3.6" fill="#000" opacity=".35"/>
            <ellipse cx="32" cy="42.4" rx="12" ry="4.4" fill="#2f3b4b"/>
            <ellipse cx="32" cy="40.2" rx="12" ry="4.4" fill="url(#bp-steel)"/>
            <ellipse cx="32" cy="40.2" rx="9" ry="3.1" fill="none" stroke="#8296ae" stroke-width=".8"/>
            <path d="M27.2 40 L30.8 42.2 L37 37.4" fill="none" stroke="#2a3a4e" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`,
        // Il segnalino del giocatore: puntina dorata in rilievo con gemma
        // ciano al centro e alone che respira.
        player: `<ellipse cx="32" cy="58" rx="10" ry="3" fill="#000" opacity=".45"/>
            <ellipse cx="32" cy="57" rx="12" ry="3.6" fill="url(#bp-glow-amber)" class="bp-breathe"/>
            <path d="M32 57 C28 47 18 39.4 18 25.5 A14 14 0 1 1 46 25.5 C46 39.4 36 47 32 57 Z" fill="url(#bp-gold)" stroke="#6b3a05" stroke-width="1.2"/>
            <path d="M40.6 14.4 C44.6 18 46 22 46 25.5 C46 33 42.4 39.4 38 45 C42 38 43 31 41.4 23.6 C41 20 40.6 17 40.6 14.4 Z" fill="#7a3f05" opacity=".35"/>
            <circle cx="32" cy="25.5" r="7.4" fill="#0b1830" stroke="#fff3c0" stroke-width="1.1"/>
            <circle cx="32" cy="25.5" r="4.4" fill="#22d3ee"/>
            <circle cx="32" cy="25.5" r="2" fill="#e8fdff" class="bp-blink"/>
            <ellipse cx="25.6" cy="17.6" rx="5" ry="2.8" fill="#fff" opacity=".6" transform="rotate(-28 25.6 17.6)"/>`
    };

    /**
     * L'HTML di una pedina. `variant` aggiunge una classe (bp-<variant>) per
     * gli stati che la pagina vuole distinguere senza cambiare disegno.
     */
    /**
     * Pedina "con volto" per un Duellante: al posto della figurina
     * disegnata, il personaggio vero. `opts.image` è il percorso del suo
     * PNG ritagliato; senza, torna la pedina generica (un personaggio
     * senza immagine non deve lasciare un buco).
     */
    // Luce di bordo e basamento per tipo: i Rare Hunter restano magenta
    // come la loro pedina standard, i Duellanti ciano.
    const PORTRAIT_STYLE = {
        duelist: { color: '#22d3ee', glow: 'bp-glow-cyan', rim: '125,243,255' },
        hunter: { color: '#e879f9', glow: 'bp-glow-magenta', rim: '240,171,252' }
    };

    function portraitMarkup(opts, kind) {
        const st = PORTRAIT_STYLE[kind] || PORTRAIT_STYLE.duelist;
        // Il personaggio RITAGLIATO (PNG trasparente, vedi
        // images/characters/pedine/) in piedi sul basamento, niente
        // medaglione né sfondo: richiesta dell'utente. Il box è largo e
        // alto quanto serve a farlo entrare mantenendo le proporzioni, con
        // i piedi (xMidYMax) appoggiati al basamento; un filo di luce di
        // bordo ciano lo stacca dallo sfondo scuro della mappa.
        return `${SHADOW}${base(st.color, st.glow)}
            <image href="${opts.image}" x="9" y="3" width="46" height="50" preserveAspectRatio="xMidYMax meet"
                onerror="BoardPieces._ritrattoMancante(this)"
                style="filter: drop-shadow(0 0 1.2px rgba(${st.rim},.95)) drop-shadow(0 1.5px 1px rgba(0,0,0,.55))"/>`;
    }

    // Ritratti la cui immagine non esiste: ricordarli evita di richiederli
    // (e di far lampeggiare il vuoto) ad ogni render della mappa.
    const ritrattiMancanti = new Set();

    /**
     * Se il PNG del personaggio non c'è nella cartella, la pedina torna a
     * quella STANDARD del suo tipo invece di restare vuota: così non serve
     * tenere un elenco di chi ha il ritaglio, basta mettere o togliere il
     * file. Chiamata dall'onerror dell'<image>.
     */
    function ritrattoMancante(imgEl) {
        const svg = imgEl.closest('svg');
        if (!svg) return;
        ritrattiMancanti.add(imgEl.getAttribute('href'));
        // Si torna alla pedina standard del SUO tipo (Duellante o Rare Hunter).
        svg.innerHTML = PIECES[svg.dataset.bpKind] || PIECES.duelist;
    }

    function markup(kind, variant, opts) {
        let body = PIECES[kind];
        if ((kind === 'duelist' || kind === 'hunter') && opts && opts.image && !ritrattiMancanti.has(opts.image)) body = portraitMarkup(opts, kind);
        if (!body) return '';
        ensureDefs();
        const cls = `bp-piece bp-${kind}${variant ? ' bp-' + variant : ''}`;
        return `<svg class="${cls}" data-bp-kind="${kind}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${body}</svg>`;
    }

    window.BoardPieces = {
        markup: markup,
        ensureDefs: ensureDefs,
        _ritrattoMancante: ritrattoMancante,
        kinds: () => Object.keys(PIECES)
    };
})();
