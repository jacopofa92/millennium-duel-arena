// Nessun mp3 del gioco porta un tag ID3 enorme (la copertina incorporata). Android MediaPlayer, che nell'APK suona la
// soundtrack in streaming (NativeMusicPlugin), fallisce o resta muto con un tag da ~1 MB prima del primo frame audio: nel
// 1.4.68 non partivano le 55 tracce che avevano la copertina, solo quelle con il tag piccolo. Il browser invece le suona
// senza problemi, quindi un problema cosi' si vede SOLO sul telefono. Analisi statica dei file.
//
// `standalone`: non apre nessuna pagina.
const fs = require('fs');
const path = require('path');

const LIMITE = 100000;

function mp3(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? mp3(p) : (p.toLowerCase().endsWith('.mp3') ? [p] : []);
    });
}

module.exports = {
    name: 'Guardrail: nessun mp3 ha un tag ID3 enorme (copertina incorporata) che blocca MediaPlayer su Android',
    standalone: true,
    async run({ assert }) {
        const radice = path.join(__dirname, '..', '..', 'audio');
        const grossi = [];
        const lista = mp3(radice);
        lista.forEach((f) => {
            const fd = fs.openSync(f, 'r');
            const b = Buffer.alloc(10);
            fs.readSync(fd, b, 0, 10, 0);
            fs.closeSync(fd);
            if (b.slice(0, 3).toString() !== 'ID3') return;
            const dim = ((b[6] & 127) << 21) | ((b[7] & 127) << 14) | ((b[8] & 127) << 7) | (b[9] & 127);
            if (dim > LIMITE) grossi.push(`${path.relative(radice, f)} (${Math.round(dim / 1024)} KB)`);
        });
        assert(lista.length > 50, `Servono i file audio (trovati ${lista.length})`);
        assert(grossi.length === 0, `Tag ID3 troppo grandi (togliere la copertina senza ricodificare, tenendo il frame Xing): ${grossi.join(', ')}`);
    }
};
