const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'Duellanti Extra storici: roster, risorse, mazzi e battute',
    async run(t) {
        const expected = [
            { id: 'albertoAngela', file: 'albertoAngela', flagship: 709 },
            { id: 'alessandroBarbero', file: 'alessandroBarbero', flagship: 1280 }
        ];
        const contexts = ['battleStart', 'victory', 'attack', 'turnStart', 'damaged', 'activate'];

        expected.forEach(({ file }) => {
            ['images/characters/' + file + '.jpg',
                'images/characters/avatarTrasparenza/' + file + '.png',
                'images/characters/pedine/' + file + '.png'].forEach((relative) => {
                t.assert(fs.existsSync(path.join(process.cwd(), relative)), `Risorsa mancante: ${relative}`);
            });
        });

        const result = await t.evaluate(({ expected, contexts }) => {
            const cards = new Map(cardDatabase.map((card) => [card.id, card]));
            return expected.map(({ id, file, flagship }) => {
                const character = characterDatabase.find((entry) => entry.id === id);
                const deck = characterDeckDatabase[id];
                const levels = ['easy', 'medium', 'hard'];
                return {
                    id,
                    inExtra: !!character && character.series === 'extra',
                    image: character && character.image,
                    unlocked: CharacterUnlocks.sbloccato(id),
                    declaredUnlocked: CharacterUnlocks.EXTRA_DISPONIBILI.includes(id),
                    flagship: deck && deck.flagship === flagship,
                    decks: !!deck && levels.every((level) => {
                        const spec = deck[level];
                        return spec.main.reduce((sum, entry) => sum + entry.qty, 0) === 40
                            && spec.main.every((entry) => cards.has(entry.id)
                                && (cards.get(entry.id).origin || 'yu-gi-oh') === 'yu-gi-oh')
                            && spec.extra.every((entry) => cards.has(entry.id) && cards.get(entry.id).extraDeck);
                    }),
                    profile: !!DuelDialogues._assignments[id],
                    personal: !!DuelDialogues._personal[id]
                        && contexts.every((context) => DuelDialogues._personal[id][context].length === 3),
                    special: Object.keys(DuelDialogues._specials[id] || {}).length >= 2,
                    expectedImage: `images/characters/${file}.jpg`
                };
            });
        }, { expected, contexts });

        result.forEach((entry) => {
            t.assert(entry.inExtra, `${entry.id}: deve comparire nella sezione Extra`);
            t.assert(entry.image === entry.expectedImage, `${entry.id}: ritratto principale errato`);
            t.assert(entry.unlocked && entry.declaredUnlocked, `${entry.id}: deve essere subito sfidabile`);
            t.assert(entry.flagship && entry.decks, `${entry.id}: i tre mazzi tematici non sono integri`);
            t.assert(entry.profile && entry.personal, `${entry.id}: battute contestuali incomplete`);
            t.assert(entry.special, `${entry.id}: servono almeno due evocazioni speciali`);
        });
    }
};
