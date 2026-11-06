/**
 * icon-library.js — Icone SVG a tema Antico Egitto/Yu-Gi-Oh, al posto
 * delle emoji generiche di sistema usate finora per le voci di menu, le
 * topbar e i titoli di sezione in tutto il sito.
 * =====================================================================
 * Stesso principio "un solo punto di verità" di js/ui/card-renderer.js per
 * le carte: ogni pagina segna dove vuole un'icona con
 *
 *   <span class="icon" data-icon="duel"></span>
 *
 * (nessuna emoji nell'HTML), poi richiama Icons.hydrate() dopo il resto
 * dello script di pagina — sostituisce ogni segnaposto con l'SVG vero.
 *
 * Ogni icona è disegnata con `fill`/`stroke` a "currentColor": prende
 * automaticamente il colore CSS dell'elemento che la contiene (di solito
 * var(--gold) o var(--gold-strong), già definite in ogni pagina), così
 * non serve un gradiente ripetuto in ogni singolo SVG — un solo punto
 * dove cambiare il colore-tema, se mai servisse.
 *
 * SOLO le icone "identitarie" (destinazioni di menu, titoli di sezione,
 * topbar) sono state ridisegnate qui: le emoji "funzionali" universali
 * già presenti nel resto del gioco (✅ conferma, ✖ annulla, ⚠️ avviso,
 * → frecce, 🗑️ elimina nei bottoni d'azione...) restano emoji di
 * sistema di proposito — sono glifi di INTERFACCIA che l'utente deve
 * riconoscere all'istante, non elementi "a tema" da ridisegnare.
 */
(function () {
    'use strict';

    // Ogni definizione è il contenuto INTERNO di un <svg viewBox="0 0 24 24">
    // (niente tag <svg> qui: aggiunto da buildIcon sotto), scritto con forme
    // semplici — così resta leggibile anche a 18-20px, la dimensione tipica
    // di un'icona di menu.
    const ICONS = {
        // Duelli — due lame di khopesh incrociate.
        duel: `
            <path d="M4 4 L13 13 L11 19 L9 17 L11 12 L4 5 Z" fill="currentColor"/>
            <path d="M20 4 L11 13 L13 19 L15 17 L13 12 L20 5 Z" fill="currentColor"/>
            <circle cx="12" cy="12.5" r="1.4" fill="currentColor"/>
        `,
        // Carte — mazzo di 3 carte a ventaglio, la prima con un piccolo Occhio.
        cards: `
            <rect x="3.5" y="7" width="9" height="13" rx="1.4" transform="rotate(-14 8 13.5)" fill="currentColor" opacity="0.55"/>
            <rect x="7.5" y="6.4" width="9" height="13" rx="1.4" transform="rotate(6 12 13)" fill="currentColor" opacity="0.8"/>
            <rect x="7" y="5.5" width="9" height="13.4" rx="1.4" fill="currentColor"/>
            <ellipse cx="11.5" cy="9.3" rx="2.1" ry="1.15" fill="none" stroke="#0b0d1c" stroke-width="0.9"/>
            <circle cx="11.5" cy="9.3" r="0.55" fill="#0b0d1c"/>
        `,
        // Multiplayer — tre nodi collegati (rete di duellanti).
        multiplayer: `
            <circle cx="12" cy="4.6" r="2.5" fill="currentColor"/>
            <circle cx="5" cy="18" r="2.5" fill="currentColor"/>
            <circle cx="19" cy="18" r="2.5" fill="currentColor"/>
            <path d="M12 7.1 L5.9 15.9 M12 7.1 L18.1 15.9 M7.4 18.6 L16.6 18.6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        `,
        // Profilo — Ankh, simbolo egizio dell'identità/vita.
        profile: `
            <circle cx="12" cy="6.2" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M12 9.7 V21 M7 13 H17" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
        `,
        // Regole — papiro arrotolato.
        rules: `
            <rect x="6.2" y="3" width="11.6" height="18" rx="1" fill="currentColor" opacity="0.18"/>
            <circle cx="6.2" cy="4.2" r="2.1" fill="currentColor"/>
            <circle cx="6.2" cy="19.8" r="2.1" fill="currentColor"/>
            <rect x="6.2" y="2.1" width="11.6" height="1.8" fill="currentColor"/>
            <rect x="6.2" y="20.1" width="11.6" height="1.8" fill="currentColor"/>
            <path d="M9.5 8 H15 M9.5 11.5 H15 M9.5 15 H13" stroke="#0b0d1c" stroke-width="1.1" stroke-linecap="round" opacity="0.65"/>
        `,
        // Impostazioni — disco solare raggiante (Aton) al posto di un ingranaggio.
        settings: `
            <circle cx="12" cy="12" r="4.3" fill="currentColor"/>
            <g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M12 2.4 V5.4 M12 18.6 V21.6 M2.4 12 H5.4 M18.6 12 H21.6"/>
                <path d="M5.1 5.1 L7.2 7.2 M16.8 16.8 L18.9 18.9 M5.1 18.9 L7.2 16.8 M16.8 7.2 L18.9 5.1"/>
            </g>
        `,
        // Esci — portale/pilone egizio (due piloni a scarpa con architrave).
        exit: `
            <path d="M4 21 V6.5 L8 3 H10 V21 Z" fill="currentColor"/>
            <path d="M20 21 V6.5 L16 3 H14 V21 Z" fill="currentColor"/>
            <path d="M9.3 20 V11 L12 8.4 L14.7 11 V20 Z" fill="#0b0d1c"/>
        `,
        // Storia — stele con geroglifici, per la futura modalità avventura.
        story: `
            <path d="M6 21 V6.5 C6 4 8.7 2.3 12 2.3 C15.3 2.3 18 4 18 6.5 V21 Z" fill="currentColor" opacity="0.92"/>
            <path d="M9 9.2 H15 M9 12.4 H15 M9 15.6 H12.5" stroke="#0b0d1c" stroke-width="1.15" stroke-linecap="round" opacity="0.7"/>
        `,
        // Duello Libero — singola carta con Occhio, l'azione di duello più diretta.
        freeDuel: `
            <rect x="5" y="3" width="14" height="18" rx="1.6" fill="currentColor"/>
            <ellipse cx="12" cy="10.5" rx="4.6" ry="2.5" fill="none" stroke="#0b0d1c" stroke-width="1.3"/>
            <circle cx="12" cy="10.5" r="1.2" fill="#0b0d1c"/>
            <path d="M8 16.2 H16 M8.8 18.6 H15.2" stroke="#0b0d1c" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/>
        `,
        // Tornei — scarabeo, simbolo egizio di vittoria/rinascita.
        tournament: `
            <ellipse cx="12" cy="13.2" rx="6.4" ry="7.6" fill="currentColor"/>
            <circle cx="12" cy="5.6" r="2.6" fill="currentColor"/>
            <path d="M12 8.5 V19.5 M7.2 11 L16.8 11 M7 15 L17 15" stroke="#0b0d1c" stroke-width="1.05" opacity="0.6"/>
            <path d="M9 4 L6.4 1.8 M15 4 L17.6 1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        `,
        // Negozio — anfora/vaso di beni.
        shop: `
            <path d="M9.5 2.6 H14.5 V5 H9.5 Z" fill="currentColor"/>
            <path d="M8.5 5 H15.5 L17.5 10 C18.3 13 17.6 21.4 12 21.4 C6.4 21.4 5.7 13 6.5 10 Z" fill="currentColor"/>
            <path d="M7 4 C7 3 7.8 2.4 8.6 2.9 M17 4 C17 3 16.2 2.4 15.4 2.9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        `,
        // Cartoteca — libro/papiro aperto (collezione da consultare).
        collection: `
            <path d="M12 5.5 C10.3 4.1 7.6 3.6 5 4.1 V18.4 C7.6 17.9 10.3 18.4 12 19.8 C13.7 18.4 16.4 17.9 19 18.4 V4.1 C16.4 3.6 13.7 4.1 12 5.5 Z" fill="currentColor"/>
            <path d="M12 5.5 V19.8" stroke="#0b0d1c" stroke-width="1.1" opacity="0.55"/>
        `,
        // Creazione Deck — mazzo di carte con uno stilo (costruzione/modifica).
        deckBuilder: `
            <rect x="4.5" y="5" width="11" height="15" rx="1.4" fill="currentColor" opacity="0.85"/>
            <rect x="7" y="3" width="11" height="15" rx="1.4" fill="currentColor"/>
            <path d="M9.5 8 H15.5 M9.5 11 H15.5" stroke="#0b0d1c" stroke-width="1.1" stroke-linecap="round" opacity="0.6"/>
            <path d="M15 15.5 L20.5 10 L22 11.5 L16.5 17 L14.7 17.3 Z" fill="currentColor" stroke="#0b0d1c" stroke-width="0.6"/>
        `,
        // Crea Carta — cartiglio (riquadro ovale del nome, geroglifico) con uno stilo.
        cardMaker: `
            <rect x="3" y="7" width="16" height="10.5" rx="5.2" fill="none" stroke="currentColor" stroke-width="2"/>
            <circle cx="8.2" cy="12.2" r="1" fill="currentColor"/>
            <circle cx="12" cy="12.2" r="1" fill="currentColor"/>
            <circle cx="15.8" cy="12.2" r="1" fill="currentColor"/>
            <path d="M16 15.5 L21 10.5 L22.5 12 L17.5 17 L15.7 17.3 Z" fill="currentColor"/>
        `,
        // Demo Duello Sandbox — vaso canopo (recipiente rituale egizio),
        // qui reinterpretato come "provetta da laboratorio" per una
        // modalità di prova/test.
        sandbox: `
            <path d="M9 2.4 H15 V5.2 H9 Z" fill="currentColor"/>
            <path d="M8.2 5.2 H15.8 L15.8 10.5 L18.6 17.5 C19.6 20.2 17.6 21.8 15 21.8 H9 C6.4 21.8 4.4 20.2 5.4 17.5 L8.2 10.5 Z" fill="currentColor" opacity="0.9"/>
            <path d="M6.6 15.5 H17.4" stroke="#0b0d1c" stroke-width="1.3" opacity="0.55"/>
            <circle cx="10.2" cy="18" r="1" fill="#0b0d1c" opacity="0.6"/>
            <circle cx="13.4" cy="19.2" r="0.7" fill="#0b0d1c" opacity="0.6"/>
        `,
        // Puzzle — il Puzzle del Millennio: piramide ROVESCIATA con l'Occhio
        // (dritta, con un punto al centro, si leggeva come un cartello di
        // pericolo).
        puzzle: `
            <path d="M2.8 3.4 H21.2 L12 21.2 Z" fill="currentColor"/>
            <path d="M7.6 8.6 C9.4 6.7 14.6 6.7 16.4 8.6 C14.6 10.5 9.4 10.5 7.6 8.6 Z" fill="#0b0d1c" opacity="0.75"/>
            <circle cx="12" cy="8.6" r="1.1" fill="currentColor"/>
            <path d="M12 10.6 V15.2" stroke="#0b0d1c" stroke-width="1.2" opacity="0.6"/>
        `,
        // Rivincite — due carte incrociate.
        rematch: `
            <rect x="3.5" y="5" width="9.5" height="14" rx="1.4" fill="currentColor" transform="rotate(-12 8.2 12)"/>
            <rect x="11" y="5" width="9.5" height="14" rx="1.4" fill="currentColor" opacity="0.82" transform="rotate(12 15.8 12)"/>
            <path d="M10 12 H14 M12 10 V14" stroke="#0b0d1c" stroke-width="1.4" stroke-linecap="round"/>
        `,
        // Torre dei Duellanti — torre a gradoni.
        tower: `
            <path d="M8 21.4 V8.5 L12 3 L16 8.5 V21.4 Z" fill="currentColor"/>
            <path d="M5 21.4 V14 H8 M19 21.4 V14 H16" stroke="currentColor" stroke-width="1.8" fill="none"/>
            <path d="M10.3 12 H13.7 M10.3 16 H13.7" stroke="#0b0d1c" stroke-width="1.3" opacity="0.6"/>
        `,
        // Portafoglio — sacchetto con monete.
        wallet: `
            <path d="M6 9 C6 6 8.5 3.4 12 3.4 C15.5 3.4 18 6 18 9 L19 9.4 C20 9.8 20.3 11 19.6 11.8 L18.4 13.1 C18.9 17.3 15.9 20.6 12 20.6 C8.1 20.6 5.1 17.3 5.6 13.1 L4.4 11.8 C3.7 11 4 9.8 5 9.4 Z" fill="currentColor"/>
            <circle cx="12" cy="12.5" r="2.1" fill="#0b0d1c"/>
        `,
        // Account Cloud — nuvola essenziale (unico elemento non a tema egizio: rappresenta un concetto moderno).
        cloud: `
            <path d="M7.5 17.5 C4.8 17.5 3 15.5 3 13.2 C3 11.1 4.5 9.4 6.5 9 C7.1 6.3 9.5 4.3 12.3 4.3 C15.4 4.3 18 6.7 18.3 9.7 C20.4 10.1 21.7 11.8 21.7 13.7 C21.7 15.8 19.9 17.5 17.7 17.5 Z" fill="currentColor"/>
        `,
        // Audio — onde sonore da un piccolo disco.
        audio: `
            <circle cx="6.2" cy="12" r="2.4" fill="currentColor"/>
            <path d="M11 7.5 C13 9 13 15 11 16.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M14.3 4.7 C18 7.5 18 16.5 14.3 19.3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        `,
        // Salvataggio — tavoletta di pietra incisa (registro permanente).
        save: `
            <rect x="3.5" y="6" width="17" height="13" rx="1.3" fill="currentColor"/>
            <path d="M6.5 10 H17.5 M6.5 13 H17.5 M6.5 16 H13.5" stroke="#0b0d1c" stroke-width="1.1" stroke-linecap="round" opacity="0.6"/>
            <path d="M17 3.5 L20.5 7 L18.7 8.8 L15.2 5.3 Z" fill="currentColor"/>
        `,
        // Accedi — chiave (anello + dente), per l'accesso all'account cloud.
        login: `
            <circle cx="8.5" cy="8.5" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/>
            <circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/>
            <path d="M11.7 11.7 L19.5 19.5 M15.5 15.5 V18.5 M18 18 V21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        `,
        // Chat — fumetto pieno con tre punti incisi (stesso stile "pietra e oro" delle altre icone).
        chat: `
            <path d="M5 4.5 H19 A2.5 2.5 0 0 1 21.5 7 V14 A2.5 2.5 0 0 1 19 16.5 H11.5 L7 20.8 V16.5 H5 A2.5 2.5 0 0 1 2.5 14 V7 A2.5 2.5 0 0 1 5 4.5 Z" fill="currentColor"/>
            <circle cx="8" cy="10.5" r="1.3" fill="#0b0d1c" opacity="0.7"/>
            <circle cx="12" cy="10.5" r="1.3" fill="#0b0d1c" opacity="0.7"/>
            <circle cx="16" cy="10.5" r="1.3" fill="#0b0d1c" opacity="0.7"/>
        `,
        // Azioni dell'editor dei mazzi (stesso tratto pieno e arrotondato delle altre): aggiungi, chiudi, clona, elimina, conferma.
        plus: `
            <path d="M12 4.5v15M4.5 12h15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        `,
        close: `
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        `,
        clone: `
            <rect x="8.5" y="8.5" width="12" height="12" rx="2.2" fill="currentColor"/>
            <path d="M15.5 4.5H6.2a1.7 1.7 0 0 0-1.7 1.7v9.3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M11.5 14.5h6M14.5 11.5v6" stroke="#0b0d1c" stroke-width="1.6" stroke-linecap="round" opacity="0.65"/>
        `,
        trash: `
            <path d="M4 7h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M9.2 7V4.8h5.6V7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M6.2 7.8l1 11.4a1.3 1.3 0 0 0 1.3 1.2h7a1.3 1.3 0 0 0 1.3-1.2l1-11.4z" fill="currentColor"/>
            <path d="M10 11v6M14 11v6" stroke="#0b0d1c" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        `,
        check: `
            <path d="M4.5 12.8l4.7 4.7L19.5 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        `,
        // Negozio: schede e sezioni (calendario, busta di carte, cambio, lampadina).
        calendar: `
            <rect x="3.5" y="5.5" width="17" height="15" rx="2" fill="currentColor"/>
            <path d="M3.5 10h17" stroke="#0b0d1c" stroke-width="1.4" opacity="0.6"/>
            <path d="M8 3.5v4M16 3.5v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <circle cx="8.5" cy="14" r="1.1" fill="#0b0d1c" opacity="0.6"/><circle cx="12" cy="14" r="1.1" fill="#0b0d1c" opacity="0.6"/><circle cx="15.5" cy="14" r="1.1" fill="#0b0d1c" opacity="0.6"/>
        `,
        pack: `
            <path d="M6 3.5h12l1.5 3-1.5 1V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7.5l-1.5-1z" fill="currentColor"/>
            <path d="M6 7.5h12" stroke="#0b0d1c" stroke-width="1.2" opacity="0.55"/>
            <path d="M12 11l1.4 2.9 3.1.4-2.3 2.1.6 3.1L12 17.9l-2.8 1.6.6-3.1-2.3-2.1 3.1-.4z" fill="#0b0d1c" opacity="0.6"/>
        `,
        exchange: `
            <path d="M4 8.5h13l-3.2-3.2M20 15.5H7l3.2 3.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        `,
        bulb: `
            <path d="M12 3.5a6 6 0 0 0-3.4 10.9c.6.5.9 1.2.9 1.9v.7h5v-.7c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3.5z" fill="currentColor"/>
            <path d="M9.8 19h4.4M10.6 21h2.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        `,
        // Registrati — scintilla a 4 punte (nuovo inizio), stesso motivo dorato del logo del menu.
        signup: `
            <path d="M12 2 L14.1 9.1 L21 12 L14.1 14.9 L12 22 L9.9 14.9 L3 12 L9.9 9.1 Z" fill="currentColor"/>
        `,
        // Continua in locale — cartiglio con un "avanti" al centro (riprendi il viaggio).
        continueLocal: `
            <rect x="2.3" y="6.8" width="19.4" height="10.4" rx="5.2" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M9.3 8.8 L14.5 12 L9.3 15.2 Z" fill="currentColor"/>
        `,
        // Carica su Cloud — nuvola con freccia verso l'alto.
        cloudUp: `
            <path d="M6.5 16.8 C4.2 16.8 2.5 15 2.5 12.9 C2.5 10.9 4 9.3 5.9 8.9 C6.5 6.4 8.7 4.5 11.4 4.5 C14.3 4.5 16.6 6.8 16.9 9.6 C18.9 10 20.2 11.6 20.2 13.5 C20.2 15.5 18.5 16.8 16.5 16.8 Z" fill="currentColor" opacity="0.5"/>
            <path d="M11.4 20.8 V11.5 M8.1 14.4 L11.4 11 L14.7 14.4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        `,
        // Scarica da Cloud — stessa nuvola, freccia verso il basso.
        cloudDown: `
            <path d="M6.5 16.8 C4.2 16.8 2.5 15 2.5 12.9 C2.5 10.9 4 9.3 5.9 8.9 C6.5 6.4 8.7 4.5 11.4 4.5 C14.3 4.5 16.6 6.8 16.9 9.6 C18.9 10 20.2 11.6 20.2 13.5 C20.2 15.5 18.5 16.8 16.5 16.8 Z" fill="currentColor" opacity="0.5"/>
            <path d="M11.4 11 V20.3 M8.1 17.4 L11.4 20.8 L14.7 17.4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        `,
        // Elimina account — vaso canopico (urna), per l'eliminazione definitiva.
        deleteAccount: `
            <path d="M9 3 H15 V5 H9 Z" fill="currentColor"/>
            <path d="M7.4 5 H16.6 L15.7 20.1 C15.6 21.1 14.7 21.7 13.7 21.7 H10.3 C9.3 21.7 8.4 21.1 8.3 20.1 Z" fill="currentColor"/>
            <path d="M10.3 8.5 V17.8 M13.7 8.5 V17.8" stroke="#0b0d1c" stroke-width="1.3" stroke-linecap="round" opacity="0.55"/>
        `,
        // Cambia account — frecce circolari (scambio/ricomincia la scelta).
        switchAccount: `
            <path d="M12 4.3 A7.7 7.7 0 1 1 4.9 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M4.9 9 L3.8 4.4 M4.9 9 L9.3 7.4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        `,
        // Cimitero (zona di gioco) — stele funeraria con un ankh inciso.
        graveyard: `
            <path d="M6 21 V11 C6 6.5 8.7 3.5 12 3.5 C15.3 3.5 18 6.5 18 11 V21 Z" fill="currentColor"/>
            <circle cx="12" cy="8.6" r="1.7" fill="none" stroke="#0b0d1c" stroke-width="1.2" opacity="0.75"/>
            <path d="M12 10.3 V15.5 M9.3 12.6 H14.7" stroke="#0b0d1c" stroke-width="1.3" stroke-linecap="round" opacity="0.75"/>
            <rect x="5" y="19.6" width="14" height="1.8" rx="0.5" fill="currentColor"/>
        `,
        // Extra Deck / Fusione (zona di gioco) — vortice a doppia spirale, il
        // portale di Fusione delle vere carte Yu-Gi-Oh.
        fusionDeck: `
            <path d="M12 2.6 C17.1 2.6 21.4 6.9 21.4 12 C21.4 15.7 19.1 18.9 16 20.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M12 21.4 C6.9 21.4 2.6 17.1 2.6 12 C2.6 8.3 4.9 5.1 8 3.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
        `,
        // Magia Terreno (zona di gioco) — piramide sul deserto.
        fieldSpell: `
            <path d="M12 3 L21 20 H3 Z" fill="currentColor"/>
            <path d="M12 3 L15.6 20 H8.4 Z" fill="#0b0d1c" opacity="0.35"/>
            <path d="M2.3 20 H21.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        `,
        // Corona del Faraone — indica di chi è il turno, accanto al nome.
        crown: `
            <path d="M3.5 17.5 L2 8 L7.2 11.6 L12 4 L16.8 11.6 L22 8 L20.5 17.5 Z" fill="currentColor"/>
            <rect x="3.2" y="18.3" width="17.6" height="2.4" rx="0.6" fill="currentColor"/>
            <circle cx="12" cy="7.6" r="1.3" fill="#0b0d1c"/>
        `,
        // Posizione di Attacco — pugnale con lama a rombo: più corto e
        // "pesante" al centro del precedente khopesh verticale (che, pur
        // avendo il riquadro SVG centrato, aveva il grosso della forma
        // (elsa+pomo) concentrato in basso — si percepiva "non centrato"
        // anche se il bounding box lo era, verificato via screenshot
        // ravvicinato). Estensione verticale 2.5–22, orizzontale 7.5–16.5:
        // centro geometrico (12, 12.25) ~ centro reale del viewBox.
        attackPos: `
            <path d="M12 2.5 L14.2 12 L12 14.8 L9.8 12 Z" fill="currentColor"/>
            <rect x="7.5" y="12.7" width="9" height="2" rx="0.7" fill="currentColor"/>
            <rect x="11" y="14.9" width="2" height="5" rx="0.6" fill="currentColor"/>
            <path d="M9.7 19.9 H14.3 L13.4 22 H10.6 Z" fill="currentColor"/>
        `,
        // Posizione di Difesa — scudo araldico con emblema a croce: la
        // sagoma esterna era già centrata, ma la croce interna incrociava
        // fuori dal vero centro (y=9.6 invece di 12) spostando il "fuoco"
        // visivo verso l'alto — ricentrata qui.
        defensePos: `
            <path d="M12 2.2 L19.6 5.1 V11.6 C19.6 16.6 16.4 20.1 12 21.8 C7.6 20.1 4.4 16.6 4.4 11.6 V5.1 Z" fill="currentColor"/>
            <path d="M12 6.5 V17.5 M8.3 12 H15.7" stroke="#0b0d1c" stroke-width="1.2" opacity="0.55"/>
        `,
        // --- Icone del Profilo (portafoglio e statistiche): prima erano
        // emoji di sistema, che stonavano accanto all'oro del resto. ---
        // Crediti — moneta con l'Occhio inciso.
        coin: `
            <circle cx="12" cy="12" r="8.6" fill="currentColor"/>
            <circle cx="12" cy="12" r="6.4" fill="none" stroke="#0b0d1c" stroke-width="0.9" opacity="0.5"/>
            <ellipse cx="12" cy="12" rx="3" ry="1.7" fill="none" stroke="#0b0d1c" stroke-width="1.1"/>
            <circle cx="12" cy="12" r="0.8" fill="#0b0d1c"/>
        `,
        // Stelle dell'Esagono — stella a cinque punte.
        star: `
            <path d="M12 2.6 L14.7 8.6 L21.2 9.2 L16.3 13.5 L17.8 19.9 L12 16.5 L6.2 19.9 L7.7 13.5 L2.8 9.2 L9.3 8.6 Z" fill="currentColor"/>
        `,
        // Carte Locazione — mappa ripiegata in tre.
        map: `
            <path d="M3 5.5 L8.5 3.5 L15.5 6 L21 4 V18.5 L15.5 20.5 L8.5 18 L3 20 Z" fill="currentColor"/>
            <path d="M8.5 3.5 V18 M15.5 6 V20.5" stroke="#0b0d1c" stroke-width="1" opacity="0.5"/>
        `,
        // Oggetti / Carte del Millennio — l'Occhio di Wedjat.
        eye: `
            <path d="M2.5 11 C6 5.8 18 5.8 21.5 11 C18 16 6 16 2.5 11 Z" fill="currentColor"/>
            <circle cx="12" cy="11" r="2.9" fill="#0b0d1c"/>
            <circle cx="12" cy="11" r="1.1" fill="currentColor"/>
            <path d="M10 14.8 L8.6 20 M13.5 15 L16.5 18.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        `,
        // Sfide — medaglia col nastro.
        medal: `
            <path d="M8 2.5 L11 9 M16 2.5 L13 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="12" cy="14.6" r="6.2" fill="currentColor"/>
            <path d="M12 11.2 L13.1 13.4 L15.5 13.7 L13.7 15.3 L14.2 17.7 L12 16.5 L9.8 17.7 L10.3 15.3 L8.5 13.7 L10.9 13.4 Z" fill="#0b0d1c" opacity="0.55"/>
        `,
        // Avversario più battuto — bersaglio.
        target: `
            <circle cx="12" cy="12" r="8.8" fill="none" stroke="currentColor" stroke-width="2"/>
            <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/>
            <circle cx="12" cy="12" r="1.8" fill="currentColor"/>
        `,
        // Bestia nera — teschio.
        skull: `
            <path d="M12 2.8 C7 2.8 4 6.3 4 10.4 C4 13 5.3 14.8 7 15.8 V19 C7 19.9 7.7 20.6 8.6 20.6 H15.4 C16.3 20.6 17 19.9 17 19 V15.8 C18.7 14.8 20 13 20 10.4 C20 6.3 17 2.8 12 2.8 Z" fill="currentColor"/>
            <circle cx="9" cy="11" r="1.9" fill="#0b0d1c"/>
            <circle cx="15" cy="11" r="1.9" fill="#0b0d1c"/>
            <path d="M12 13.6 L10.9 15.6 H13.1 Z M10 18.4 V20.4 M12 18.4 V20.4 M14 18.4 V20.4" stroke="#0b0d1c" stroke-width="0.9" fill="#0b0d1c"/>
        `,
        // Modifica (il nome) — stilo di canna da scriba.
        pencil: `
            <path d="M15.6 3.6 L20.4 8.4 L9 19.8 L3.6 20.4 L4.2 15 Z" fill="currentColor"/>
            <path d="M13.4 5.8 L18.2 10.6" stroke="#0b0d1c" stroke-width="1.1" opacity="0.55"/>
        `,
        // Ricerca — lente con l'Occhio di Wedjat al posto del glifo di sistema.
        search: `
            <circle cx="10.2" cy="10.2" r="6.4" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M14.8 14.8 L21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M6.7 10.2 C8.2 8.1 12.2 8.1 13.7 10.2 C12.2 12.2 8.2 12.2 6.7 10.2 Z" fill="currentColor"/>
            <circle cx="10.2" cy="10.2" r="1" fill="#0b0d1c"/>
        `,
        // Arena — portale monumentale con due lame incrociate.
        arena: `
            <path d="M4 21 V7 L8 3 H16 L20 7 V21 H16.8 V9 H7.2 V21 Z" fill="currentColor"/>
            <path d="M9 12 L15 18 M15 12 L9 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="12" cy="15" r="1.2" fill="currentColor"/>
        `,
        // Casuale — piccolo oracolo a quattro direzioni, senza dado emoji.
        random: `
            <circle cx="12" cy="12" r="3.2" fill="currentColor"/>
            <path d="M12 2.5 V7 M12 17 V21.5 M2.5 12 H7 M17 12 H21.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M12 2.5 L10.2 4.5 M12 2.5 L13.8 4.5 M21.5 12 L19.5 10.2 M21.5 12 L19.5 13.8 M12 21.5 L10.2 19.5 M12 21.5 L13.8 19.5 M2.5 12 L4.5 10.2 M2.5 12 L4.5 13.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        `
    };

    /** Costruisce l'elemento <svg> vero per `name`, o null se il nome non esiste (avviso in console, mai un errore che blocca la pagina). */
    function buildIcon(name) {
        const inner = ICONS[name];
        if (!inner) {
            console.warn(`[Icons] icona "${name}" non trovata.`);
            return null;
        }
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('class', 'themed-icon');
        svg.innerHTML = inner;
        return svg;
    }

    /**
     * Sostituisce ogni [data-icon] dentro `root` (default: tutto il
     * documento) con l'SVG vero corrispondente — va richiamata una volta
     * dopo che il resto della pagina ha finito di costruire il proprio
     * markup (es. in fondo allo script di pagina, o dopo un renderMenu()
     * che genera nuovi [data-icon] dinamicamente).
     */
    function hydrate(root) {
        (root || document).querySelectorAll('[data-icon]').forEach((el) => {
            const icon = buildIcon(el.dataset.icon);
            if (icon) { el.innerHTML = ''; el.appendChild(icon); }
        });
    }

    // Stile base iniettato una volta sola da questo stesso file, così
    // nessuna pagina deve ricordarsi di aggiungerlo al proprio <style>:
    // l'icona riempie il proprio contenitore per default (si adatta a
    // .menu-item-icon, .topbar-title, ecc. già dimensionati da ogni
    // pagina) ed eredita il colore di testo dell'elemento (currentColor).
    const style = document.createElement('style');
    style.textContent = `
        .themed-icon {
            width: 1em;
            height: 1em;
            display: inline-block;
            vertical-align: -0.15em;
            flex-shrink: 0;
        }
    `;
    document.head.appendChild(style);

    window.Icons = { hydrate: hydrate, buildIcon: buildIcon, NAMES: Object.keys(ICONS) };
})();
