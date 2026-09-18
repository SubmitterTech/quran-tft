// Where updated content can come from, in the order they are tried.
//
// The first source is our own site. If it does not answer, the next ones are deliberately on a
// different platform: a problem that takes our site down (a bad deploy, a blocked domain, a zone
// misconfiguration) usually takes the sibling domain with it, since both are on the same
// Cloudflare account. GitHub is where the same files live anyway, the project being open source.
//
// The last line of defence is not in this list: it is the copy inside the app package, which is
// what the app reads by default. Everything here is an optimisation on top of that.

const PUBLISHED = 'published';
const REPOSITORY = 'repository';

const PRIMARY_ORIGIN = process.env.REACT_APP_CONTENT_ORIGIN || 'https://qurantft.com';
const MIRROR_ORIGIN = process.env.REACT_APP_CONTENT_MIRROR || 'https://sonahit.org';
const REPOSITORY_PATH = 'SubmitterTech/quran-tft';

// Base files do not follow the <kind>_<lang>.json convention in the repository.
const REPOSITORY_BASE_FILES = {
    quran: 'qurantft.json',
    appendices: 'appendices.json',
    introduction: 'introduction.json',
    application: 'application.json',
    cover: 'cover.json',
};

const SOURCES = [
    { id: 'primary', origin: PRIMARY_ORIGIN, layout: PUBLISHED },
    { id: 'jsdelivr', origin: `https://cdn.jsdelivr.net/gh/${REPOSITORY_PATH}@main`, layout: REPOSITORY },
    { id: 'raw', origin: `https://raw.githubusercontent.com/${REPOSITORY_PATH}/main`, layout: REPOSITORY },
    { id: 'mirror', origin: MIRROR_ORIGIN, layout: PUBLISHED },
];

// The mirror is the Turkish site, reachable where our main domain sometimes is not.
const MIRROR_FIRST_LANGUAGES = new Set(['tr']);

export const getContentSources = (lang) => {
    const language = String(lang || '').toLowerCase().split('-')[0];
    if (!MIRROR_FIRST_LANGUAGES.has(language)) {
        return SOURCES;
    }
    const mirror = SOURCES.filter((source) => source.id === 'mirror');
    return [...mirror, ...SOURCES.filter((source) => source.id !== 'mirror')];
};

/**
 * Address of one content file at one source. The repository layout points at the files the
 * translators' sync writes; they are the same content, only indented.
 */
export const getSourceUrl = (source, kind, lang) => {
    if (!source?.origin) {
        return null;
    }

    if (source.layout === PUBLISHED) {
        return kind === 'languages'
            ? `${source.origin}/content/languages.json`
            : `${source.origin}/content/${kind}_${lang}.json`;
    }

    const assets = `${source.origin}/app/src/assets`;
    if (kind === 'languages') {
        return `${assets}/languages.json`;
    }
    if (lang === 'en') {
        const fileName = REPOSITORY_BASE_FILES[kind];
        return fileName ? `${assets}/${fileName}` : null;
    }
    return `${assets}/translations/${lang}/${kind}_${lang}.json`;
};

/**
 * Only addresses we publish ourselves are followed. A redirect that leaves them is a reason to
 * stop, not to keep going.
 */
export const isAllowedContentUrl = (url) => {
    const allowed = SOURCES.map((source) => {
        try {
            return new URL(source.origin).host;
        } catch (error) {
            return null;
        }
    }).filter(Boolean);

    try {
        return allowed.includes(new URL(url).host);
    } catch (error) {
        return false;
    }
};
