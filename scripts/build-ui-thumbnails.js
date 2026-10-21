#!/usr/bin/env node
/**
 * Genera le miniature leggere usate esclusivamente dai selettori UI.
 * Gli originali restano intatti: servono nei dialoghi, nelle scene e come
 * fondali del duello, dove la risoluzione piena ha davvero valore.
 *
 * Playwright e Chromium sono gia' dipendenze di sviluppo del progetto; il
 * canvas del browser produce WebP senza introdurre un secondo tool grafico.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const JOBS = [
    {
        nome: 'carte',
        source: path.join(ROOT, 'images', 'cards'),
        output: path.join(ROOT, 'images', 'cards', 'thumbs'),
        width: 256,
        height: 256,
        quality: 0.74
    },
    {
        // Illustrazioni alternative delle carte (js/data/artwork-alternativi.js): stessa miniatura delle carte.
        nome: 'carte-alt',
        source: path.join(ROOT, 'images', 'cards', 'alt'),
        output: path.join(ROOT, 'images', 'cards', 'alt', 'thumbs'),
        width: 256,
        height: 256,
        quality: 0.74
    },
    {
        nome: 'personaggi',
        source: path.join(ROOT, 'images', 'characters'),
        output: path.join(ROOT, 'images', 'characters', 'thumbs'),
        width: 400,   // le caselle dei Duellanti sono ~150px CSS: 400px bastano anche a 2.75x e pesano meta'
        height: 400,
        quality: 0.72
    },
    {
        source: path.join(ROOT, 'images', 'fields'),
        output: path.join(ROOT, 'images', 'fields', 'thumbs'),
        width: 480,
        height: 300,
        quality: 0.72
    }
];

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function converti(page, input, job) {
    const mime = path.extname(input).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${fs.readFileSync(input).toString('base64')}`;
    const webp = await page.evaluate(async ({ dataUrl, width, height, quality }) => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const w = image.naturalWidth * scale;
        const h = image.naturalHeight * scale;
        ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
        return canvas.toDataURL('image/webp', quality).split(',')[1];
    }, { dataUrl, width: job.width, height: job.height, quality: job.quality });
    const output = path.join(job.output, path.parse(input).name + '.webp');
    fs.writeFileSync(output, Buffer.from(webp, 'base64'));
    return output;
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    let count = 0;
    try {
        const solo = process.argv[2];
        for (const job of JOBS.filter((j) => !solo || j.nome === solo)) {
            fs.mkdirSync(job.output, { recursive: true });
            const files = fs.readdirSync(job.source)
                .map((name) => path.join(job.source, name))
                .filter((file) => fs.statSync(file).isFile() && IMAGE_EXT.has(path.extname(file).toLowerCase()));
            for (const file of files) {
                await converti(page, file, job);
                count++;
            }
        }
    } finally {
        await browser.close();
    }
    console.log(`Generate ${count} miniature UI WebP.`);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
