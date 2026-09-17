// Sura 9 header names ("Ultimatum (Barã’ah) No Basmalah*") are shown on two lines. The
// default split takes the first two words, which fits one-word names. Persian (اتمام حجت)
// and Tamil (இறுதி நிபந்தனை) names span two words, so for these languages the second line
// starts after the transliteration in parentheses.
const SURA9_SPLIT_AFTER_TRANSLITERATION = new Set(['fa', 'ta']);

export const splitsSura9AfterTransliteration = (lang) => (
    SURA9_SPLIT_AFTER_TRANSLITERATION.has(String(lang || '').toLowerCase().split('-')[0])
);

export const splitSura9NamesAfterTransliteration = (names) => {
    const value = String(names ?? '');
    const closing = value.indexOf(')');
    if (closing === -1) {
        return value;
    }
    const firstLine = value.slice(0, closing + 1).replace(/\s+/g, ' ').trim();
    const secondLine = value.slice(closing + 1).replace(/\s+/g, ' ').trim();
    return secondLine ? `${firstLine}\n${secondLine}` : firstLine;
};
