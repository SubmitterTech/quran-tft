import {
    applyCachedHyphenationToText,
    buildHyphenProtectedTokenSetFromSerializedIndex,
} from '../utils/Hyphenation';

const SOFT_HYPHEN = '\u00AD';
const ZERO_WIDTH_SPACE = '\u200B';

describe('Hyphenation exceptions for Turkic GOD word', () => {
    test('tr: TANRI should not be hyphenated even if cache contains breaks', () => {
        const hyphenBreakMap = new Map([
            ['tanri', [3]],
            ['kitaplar', [5]],
        ]);
        const protectedTokens = new Set(['tanri']);

        const tanri = applyCachedHyphenationToText('TANRI', 'tr', hyphenBreakMap, protectedTokens);
        const kitaplar = applyCachedHyphenationToText('kitaplar', 'tr', hyphenBreakMap, protectedTokens);

        expect(tanri).toBe('TANRI');
        expect(kitaplar).toBe(`kitap${SOFT_HYPHEN}lar`);
    });

    test('tr: TANRI apostrophe suffix should break at apostrophe', () => {
        const hyphenBreakMap = new Map([
            ['tanri', [3]],
        ]);
        const protectedTokens = new Set(['tanri']);

        const output = applyCachedHyphenationToText("TANRI'YA", 'tr', hyphenBreakMap, protectedTokens);
        expect(output).toBe(`TANRI'${ZERO_WIDTH_SPACE}YA`);
    });

    test('az: Tanrı apostrophe suffix should break at apostrophe', () => {
        const hyphenBreakMap = new Map([
            ['tanri', [3]],
        ]);
        const protectedTokens = new Set(['tanri']);

        const output = applyCachedHyphenationToText('Tanrı’ya', 'az', hyphenBreakMap, protectedTokens);
        expect(output).toBe(`Tanrı’${ZERO_WIDTH_SPACE}ya`);
    });

    test('ta: vowel signs and viramas stay inside the cached token', () => {
        // Break positions from hyphen/ta: நம்-பிக்-கை
        const hyphenBreakMap = new Map([
            ['நம்பிக்கை', [3, 7]],
        ]);

        const output = applyCachedHyphenationToText('நம்பிக்கை கொண்டனர்', 'ta', hyphenBreakMap, new Set());
        expect(output).toBe(`நம்${SOFT_HYPHEN}பிக்${SOFT_HYPHEN}கை கொண்டனர்`);
    });

    test('ta: GOD word and its inflections should not be hyphenated even if cache contains breaks', () => {
        const hyphenBreakMap = new Map([
            ['கடவுள்', [2]],
            ['கடவுளின்', [2, 4]],
            ['கடவுளுக்கு', [2, 4, 7]],
            ['பெயரால்', [2, 3]],
        ]);
        const protectedTokens = new Set(['கடவுள்']);

        const output = applyCachedHyphenationToText('கடவுளின் பெயரால் கடவுள் கடவுளுக்கு', 'ta', hyphenBreakMap, protectedTokens);
        expect(output).toBe(`கடவுளின் பெ${SOFT_HYPHEN}ய${SOFT_HYPHEN}ரால் கடவுள் கடவுளுக்கு`);
    });

    test('protected tokens can be reconstructed from serialized index payload', () => {
        const set = buildHyphenProtectedTokenSetFromSerializedIndex({
            protectedTokens: ['god', 'tanri'],
        });

        expect(set.has('god')).toBe(true);
        expect(set.has('tanri')).toBe(true);
    });
});
