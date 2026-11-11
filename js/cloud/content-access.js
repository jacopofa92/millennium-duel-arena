/**
 * Contenuti opzionali: un solo criterio per cataloghi, link diretti e relay.
 * I database completi restano intatti: nasconderli al motore cancellerebbe
 * indirettamente carte e progressi quando i salvataggi vengono normalizzati.
 */
(function (root) {
    'use strict';
    const NOMI = { ww1: 'WW1', ww2: 'WW2', extra: 'Extra' };
    function crea(permette, cataloghi) {
        cataloghi = cataloghi || {};
        const personaggi = () => typeof cataloghi.personaggi === 'function' ? cataloghi.personaggi() : [];
        const carte = () => typeof cataloghi.carte === 'function' ? cataloghi.carte() : [];
        function origine(origin) { return origin === 'ww1' || origin === 'ww2' ? origin : null; }
        function personaggio(c) {
            if (typeof c === 'string') {
                if (/^ww1_/.test(c)) return 'ww1';
                if (/^ww2_/.test(c)) return 'ww2';
                if (['robertoGiacobbo', 'albertoAngela', 'alessandroBarbero'].includes(c)) return 'extra';
                c = personaggi().find((p) => p.id === c || p.image === c) || { image: c };
            }
            if (!c) return null;
            const completo = personaggi().find((p) => p.id === c.id || (c.image && p.image === c.image)) || c;
            if (NOMI[completo.series]) return completo.series;
            let image = String(completo.image || '').replace(/\\/g, '/');
            try { image = decodeURIComponent(image); } catch (e) { /* percorso già leggibile */ }
            if (/\/ww1_/i.test(image)) return 'ww1';
            if (/\/ww2_/i.test(image)) return 'ww2';
            if (/\/(rg|albertoAngela|alessandroBarbero)\./i.test(image)) return 'extra';
            return null;
        }
        function campo(file) {
            let percorso = String(file || '');
            try { percorso = decodeURIComponent(percorso); } catch (e) { /* percorso non codificato */ }
            const nome = percorso.replace(/\\/g, '/').split(/[?#]/)[0].split('/').pop();
            if (/(^|_)(grandeGuerra|ww1)/i.test(nome)) return 'ww1';
            if (/(^|_)(secondaGuerra|ww2)/i.test(nome)) return 'ww2';
            if (/(^|_)freedom/i.test(nome)) return 'extra';
            return null;
        }
        function campagna(id) { return id === 'freedom' ? 'extra' : origine(String(id || '').split('@')[0]); }
        function carta(c) {
            if (typeof c === 'number' || typeof c === 'string') c = carte().find((x) => String(x.id) === String(c));
            return c ? origine(c.origin) : null;
        }
        const ammesso = (pack) => !pack || !!permette(pack);
        function carteVietate(deck) {
            const viste = new Set();
            return [...((deck && deck.main) || []), ...((deck && deck.extra) || [])].filter((v) => {
                const id = v && typeof v === 'object' ? v.id : v;
                if (viste.has(id)) return false;
                viste.add(id);
                // Si usa il catalogo canonico: un origin fornito dal client può mentire.
                return !ammesso(carta(id));
            }).map((v) => {
                const id = v && typeof v === 'object' ? v.id : v;
                const c = carte().find((x) => String(x.id) === String(id));
                return c && c.name || 'Carta #' + id;
            });
        }
        function azioneAmmessa(action) {
            const pending = [action];
            let budget = 5000;
            while (pending.length && --budget > 0) {
                const obj = pending.pop();
                if (!obj || typeof obj !== 'object') continue;
                for (const [key, value] of Object.entries(obj)) {
                    if (typeof value === 'string') {
                        if (key === 'origin' && !ammesso(origine(value))) return false;
                        if ((key === 'field' || key === 'campo') && !ammesso(campo(value))) return false;
                        if (['pedina', 'personaggio', 'characterId', 'image', 'raid'].includes(key) && !ammesso(personaggio(value))) return false;
                        if (key === 'specchio') {
                            const elenco = typeof cataloghi.mazzi === 'function' ? cataloghi.mazzi() : [];
                            const pack = elenco.find((p) => p.packId === value);
                            if (!pack || carteVietate(pack).length) return false;
                        }
                    }
                    if (key === 'spec' && value && Array.isArray(value.main) && carteVietate(value).length) return false;
                    if (value && typeof value === 'object') pending.push(value);
                }
            }
            return budget > 0;
        }
        return {
            nomi: NOMI, permette: ammesso,
            carta: (c) => ammesso(carta(c)), personaggio: (c) => ammesso(personaggio(c)),
            campo: (f) => ammesso(campo(f)), campagna: (id) => ammesso(campagna(id)),
            origine: (o) => ammesso(origine(o)), carteVietate,
            azioneMultiplayer: azioneAmmessa,
            pacchettoPersonaggio: personaggio, pacchettoCampo: campo, pacchettoCampagna: campagna
        };
    }
    if (typeof module !== 'undefined' && module.exports) { module.exports = { crea }; return; }
    root.Contenuti = crea((pack) => !!(root.CloudSync && root.CloudSync.hasContent(pack)), {
        personaggi: () => typeof characterDatabase !== 'undefined' ? characterDatabase : [],
        mazzi: () => typeof starterStructureDeckDatabase !== 'undefined' ? starterStructureDeckDatabase : [],
        carte: () => {
            const extra = root.CARD_ORIGIN_EXCEPTIONS || [];
            const db = typeof cardDatabase !== 'undefined' ? cardDatabase : [];
            return extra.concat(db.filter((c) => !extra.some((x) => x.id === c.id)));
        }
    });
    root.Contenuti.motivoPagina = function () {
        const p = new URLSearchParams(root.location.search);
        const accesso = root.Contenuti;
        if (!accesso.campagna(p.get('campaign')) || !accesso.origine(p.get('origin'))
            || !accesso.personaggio(p.get('character')) || !accesso.campo(p.get('field'))) {
            return 'Questo contenuto non è abilitato per il tuo account.';
        }
        return '';
    };
    root.Contenuti.voce = function (item) {
        if (!item.href) return true;
        const p = new URL(item.href, root.location.href).searchParams;
        return root.Contenuti.campagna(p.get('campaign')) && root.Contenuti.origine(p.get('origin'))
            && root.Contenuti.personaggio(p.get('character')) && root.Contenuti.campo(p.get('field'));
    };
    root.Contenuti.filtraMenu = function filtraMenu(items) {
        return items.filter(root.Contenuti.voce).map((item) => item.children
            ? Object.assign({}, item, { children: filtraMenu(item.children) }) : item)
            .filter((item) => !item.children || item.children.length > 0);
    };
    root.Contenuti.blocca = function (motivo) {
        if (root.PageLoader) root.PageLoader.hide();
        document.documentElement.classList.remove('avvio-in-corso');
        if (document.getElementById('contenuto-non-abilitato')) return false;
        const box = document.createElement('div');
        box.id = 'contenuto-non-abilitato';
        box.style.cssText = 'position:fixed;inset:0;z-index:2147483002;background:#0b0d14;color:#f7d774;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:24px;text-align:center;font:18px Arial';
        const testo = document.createElement('p');
        testo.textContent = motivo;
        const link = document.createElement('a');
        link.href = 'index.html';
        link.textContent = 'Torna al menu';
        link.style.color = '#fff';
        box.append(testo, link);
        // Il gate può rispondere mentre il parser è ancora nell'head.
        // Come auth-gate, ci si appoggia all'elemento radice già esistente.
        document.documentElement.appendChild(box);
        return false;
    };
    // Un cambio verificato online ricarica la pagina con la nuova disponibilità.
    // Nessun dato di possesso viene riscritto: anche un deck disabilitato resta salvato.
    root.addEventListener('contenuti:aggiornati', () => root.location.reload());
})(typeof window !== 'undefined' ? window : globalThis);
