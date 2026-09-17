// Tamil (ta) support. Shared components call these helpers only behind `isTamil(lang)`,
// so the code paths of the other languages stay as they were.

export const TAMIL_LANGUAGE = 'ta';

export const isTamil = (lang) => String(lang || '').toLowerCase().split('-')[0] === TAMIL_LANGUAGE;

// Vowel signs, the anusvara-like ஂ, the au length mark and the virama (்).
const TAMIL_SIGN_REGEX = /[\u0B82\u0BBE-\u0BCD\u0BD7]/;

// Letters together with their vowel signs and viramas; \p{L} alone splits Tamil words.
export const TAMIL_WORD_REGEX = /[\u0B80-\u0BFF]+/g;

const TRAILING_VIRAMA_REGEX = /\u0BCD+$/;

// A letter with its vowel signs and virama, so text can be cut without detaching signs.
export const splitTamilGraphemes = (value) => {
    const graphemes = [];
    for (const character of String(value ?? '')) {
        if (graphemes.length > 0 && TAMIL_SIGN_REGEX.test(character)) {
            graphemes[graphemes.length - 1] += character;
        } else {
            graphemes.push(character);
        }
    }
    return graphemes;
};

// Search normalization. Inflection replaces a word's final virama (கடவுள் → கடவுளின்),
// so ignoring viramas lets the base form find every inflected form.
export const foldTamilViramas = (value) => String(value ?? '').replace(/\u0BCD/g, '');

// A vowel sign or virama split into its own span is drawn detached from its letter,
// so highlight ranges grow to the signs of the letters they touch.
export const expandToTamilGraphemes = (chars, start, end) => {
    let expandedStart = start;
    let expandedEnd = end;
    while (expandedStart > 0 && TAMIL_SIGN_REGEX.test(chars[expandedStart] || '')) {
        expandedStart -= 1;
    }
    while (expandedEnd < chars.length && TAMIL_SIGN_REGEX.test(chars[expandedEnd] || '')) {
        expandedEnd += 1;
    }
    return [expandedStart, expandedEnd];
};

// The GOD word as a search pattern: "கடவுள்" becomes "கடவுள" to match "கடவுளின்".
export const stripTamilFinalVirama = (value) => String(value ?? '').replace(TRAILING_VIRAMA_REGEX, '');

// Stems of protected words that end with a virama; their inflections are protected too.
export const getTamilProtectedStems = (protectedTokens) => Array.from(protectedTokens || [])
    .filter((token) => TRAILING_VIRAMA_REGEX.test(token))
    .map((token) => token.replace(TRAILING_VIRAMA_REGEX, ''));

// Hyphenation keeps inflections of the GOD word intact, like TANRI'NIN in Turkish.
export const isTamilInflectionOfProtectedToken = (normalizedToken, protectedTokens) => (
    getTamilProtectedStems(protectedTokens).some((stem) => normalizedToken.startsWith(stem))
);

// Sura list sort key: the Arabic article is written "அல்-" (four code units).
export const stripTamilArticle = (name) => (
    String(name ?? '').startsWith('\u0B85\u0BB2\u0BCD-') ? String(name).slice(4) : String(name ?? '')
);
