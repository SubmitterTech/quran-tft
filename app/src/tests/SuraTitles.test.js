import { splitSura9NamesAfterTransliteration, splitsSura9AfterTransliteration } from '../utils/SuraTitles';

describe('sura 9 header names', () => {
    test('only Persian and Tamil split after the transliteration', () => {
        expect(splitsSura9AfterTransliteration('fa')).toBe(true);
        expect(splitsSura9AfterTransliteration('ta')).toBe(true);
        ['en', 'tr', 'de', 'sv', 'az', 'nl', 'fr', 'ru', '', null].forEach((lang) => {
            expect(splitsSura9AfterTransliteration(lang)).toBe(false);
        });
    });

    test('two-word names keep the transliteration on the first line', () => {
        expect(splitSura9NamesAfterTransliteration('اتمام حجت  (برائة)  بدون بسم‏ اللَّه*'))
            .toBe('اتمام حجت (برائة)\nبدون بسم‏ اللَّه*');
        expect(splitSura9NamesAfterTransliteration("இறுதி நிபந்தனை  (பரா'அஹ்)  பிஸ்மில்லா இல்லை*"))
            .toBe("இறுதி நிபந்தனை (பரா'அஹ்)\nபிஸ்மில்லா இல்லை*");
        expect(splitSura9NamesAfterTransliteration('இறுதி நிபந்தனை')).toBe('இறுதி நிபந்தனை');
    });
});
