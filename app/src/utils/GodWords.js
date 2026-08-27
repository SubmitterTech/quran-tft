const RUSSIAN_GOD_WORD_FORMS = Object.freeze([
    'БОЖЬЕГО',
    'БОЖЬИМИ',
    'БОЖИЕЙ',
    'БОЖЬЕЙ',
    'БОЖЬИХ',
    'БОЖЬИМ',
    'БОЖИЙ',
    'БОЖЬЯ',
    'БОЖЬИ',
    'БОЖЬЕ',
    'БОГОМ',
    'БОГА',
    'БОГУ',
    'БОГЕ',
    'БОЖЬЮ',
    'БОЖЕ',
    'БОГ',
]);

// These are occurrence indexes of خدا inside a verse, not character indexes.
// The Persian translation is static, so the exclusions can be compiled once and
// kept out of the render path. Valid inflections such as خدای and خدایی remain.
const PERSIAN_GOD_WORD_EXCLUSION_INDEXES = Object.freeze({
    '2:124': [0],
    '2:126': [1],
    '2:233': [0],
    '3:6': [0],
    '4:171': [4],
    '6:74': [0],
    '6:76': [0],
    '6:102': [1],
    '9:31': [1],
    '9:98': [0],
    '10:10': [0],
    '12:54': [0],
    '16:91': [1],
    '19:11': [0],
    '21:68': [0],
    '21:79': [0],
    '24:36': [1],
    '25:42': [0],
    '27:75': [0],
    '28:26': [0, 1],
    '29:17': [1],
    '29:46': [0, 1],
    '34:39': [0],
    '36:14': [0],
    '36:23': [0],
    '37:143': [0],
    '38:33': [0],
    '44:23': [0],
    '45:23': [0],
    '46:22': [0],
    '56:11': [0],
    '59:22': [1],
    '65:6': [0],
    '68:28': [0],
});

const FALLBACK_WORD_CHARACTER_REGEX = /[A-Za-z\u0400-\u052F0-9_]/;

const GOD_WORD_RULE_DEFINITIONS_BY_LANGUAGE = Object.freeze({
    fa: Object.freeze({
        matchMode: 'substring',
        forms: Object.freeze(['خدا']),
        excludedOccurrenceIndexesByVerse: PERSIAN_GOD_WORD_EXCLUSION_INDEXES,
    }),
    ru: Object.freeze({
        matchMode: 'whole-word',
        forms: RUSSIAN_GOD_WORD_FORMS,
        excludedOccurrenceIndexesByVerse: Object.freeze({}),
    }),
});

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const GOD_WORD_RULES_BY_LANGUAGE = new Map(
    Object.entries(GOD_WORD_RULE_DEFINITIONS_BY_LANGUAGE)
        .map(([lang, definition]) => {
            const forms = [...definition.forms].sort((a, b) => b.length - a.length);
            const exclusionsByVerse = new Map(
                Object.entries(definition.excludedOccurrenceIndexesByVerse || {})
                    .map(([verseKey, indexes]) => [verseKey, new Set(indexes)])
            );

            return [lang, {
                matchMode: definition.matchMode,
                regex: new RegExp(forms.map(escapeRegExp).join('|'), 'g'),
                exclusionsByVerse,
            }];
        })
);

let unicodeWordCharacterRegex = null;
try {
    unicodeWordCharacterRegex = new RegExp('[\\p{L}\\p{M}\\p{N}_]', 'u');
} catch {
    unicodeWordCharacterRegex = null;
}

const isWordCharacter = (character) => {
    if (!character) return false;
    return unicodeWordCharacterRegex
        ? unicodeWordCharacterRegex.test(character)
        : FALLBACK_WORD_CHARACTER_REGEX.test(character);
};

/**
 * Returns null for languages that intentionally keep the legacy matcher.
 * Each specialized language is data-driven: it selects its matching mode,
 * accepted forms, and optional per-verse occurrence exclusions in one rule.
 */
export const getSpecializedGodWordMatches = (text, lang, verseKey = '') => {
    const normalizedLang = String(lang || '').toLowerCase();
    const rule = GOD_WORD_RULES_BY_LANGUAGE.get(normalizedLang);
    if (!rule) return null;

    const source = String(text || '');
    const normalizedVerseKey = String(verseKey || '');
    const excludedIndexes = rule.exclusionsByVerse.get(normalizedVerseKey);
    rule.regex.lastIndex = 0;

    const candidates = [...source.matchAll(rule.regex)]
        .filter((match) => {
            if (rule.matchMode !== 'whole-word') return true;

            const start = match.index;
            const end = start + match[0].length;
            return !isWordCharacter(source[start - 1]) && !isWordCharacter(source[end]);
        });

    return candidates
        .filter((_match, occurrenceIndex) => !excludedIndexes?.has(occurrenceIndex))
        .map((match) => ({
            index: match.index,
            text: match[0],
        }));
};
