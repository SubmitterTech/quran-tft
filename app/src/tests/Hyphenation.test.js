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

    test('protected tokens can be reconstructed from serialized index payload', () => {
        const set = buildHyphenProtectedTokenSetFromSerializedIndex({
            protectedTokens: ['god', 'tanri'],
        });

        expect(set.has('god')).toBe(true);
        expect(set.has('tanri')).toBe(true);
    });
});
