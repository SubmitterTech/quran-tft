// Single access layer for the large content files: the Quran text, the appendices, the
// introduction and the sura map.
//
// The files are published as static assets under /content by scripts/build-content-assets.mjs,
// so they never become JavaScript chunks. This module owns everything about them:
//
//   - path convention: /content/<kind>_<lang>.json
//   - one request per file, shared by every caller that asks while it is in flight
//   - parsed content stays in memory for at most MAX_RESIDENT_LANGUAGES languages
//   - releaseContent() lets bulk index builds hand the memory back right away
//
// The last point is the reason this module exists. A dynamic import() keeps the parsed file
// in webpack's module cache forever; building the search caches for every language used to
// leave all of them resident. Plain fetch + JSON.parse can be dropped.

import {
    clearTrying,
    getDownloadedRevisions,
    getDownloadedUrl,
    getState,
    markTrying,
    quarantine,
} from './ContentFiles';

export const CONTENT_KINDS = ['quran', 'appendices', 'introduction', 'map', 'application', 'cover'];

export const BASE_CONTENT_LANGUAGE = 'en';

// Besides the pinned English base: the language on screen and the one before it.
const MAX_RESIDENT_LANGUAGES = 2;

const contentCache = new Map();
const inFlight = new Map();
const languageUse = [];

let inventoryPromise = null;

const asLanguage = (lang) => String(lang || '').trim().toLowerCase() || BASE_CONTENT_LANGUAGE;

const cacheKey = (kind, lang) => `${kind}:${lang}`;

const contentUrl = (kind, lang) => `${process.env.PUBLIC_URL || ''}/content/${kind}_${lang}.json`;

// Jest has no HTTP server, so the source files are read straight from disk there. The branch is
// removed from browser builds, webpack does not follow requires inside a statically false test.
const readContentFromDisk = (kind, lang) => {
    if (process.env.NODE_ENV === 'test') {
        /* eslint-disable global-require */
        const fs = require('fs');
        const path = require('path');
        /* eslint-enable global-require */
        const assetsRoot = path.join(process.cwd(), 'src', 'assets');
        const baseNames = {
            quran: 'qurantft.json',
            appendices: 'appendices.json',
            introduction: 'introduction.json',
            application: 'application.json',
            cover: 'cover.json',
        };
        const filePath = lang === BASE_CONTENT_LANGUAGE
            ? path.join(assetsRoot, baseNames[kind] || `${kind}.json`)
            : path.join(assetsRoot, 'translations', lang, `${kind}_${lang}.json`);
        if (!fs.existsSync(filePath)) {
            throw new Error(`content_unavailable:${kind}_${lang}`);
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    throw new Error('content_disk_read_unavailable');
};

// Enough to tell our text apart from an error page or half a download, and no more: the shape
// comes from the printed book and does not change, so this never needs a version to compare to.
export const isContentShaped = (kind, data) => {
    if (!data || typeof data !== 'object') {
        return false;
    }
    if (kind === 'quran') {
        const pages = Object.keys(data);
        if (pages.length < 300) return false;
        const page = data[pages[Math.floor(pages.length / 2)]];
        const suras = Object.values(page?.sura || {});
        return suras.length > 0 && Object.values(suras[0]?.verses || {}).some((v) => typeof v === 'string');
    }
    if (kind === 'appendices' || kind === 'introduction') {
        return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object';
    }
    if (kind === 'application') {
        return Object.keys(data).length > 20 && typeof data.gw === 'string';
    }
    if (kind === 'cover') {
        return typeof data.quran === 'string' && typeof data.title === 'string';
    }
    return Object.keys(data).length > 0;
};

const readJsonFrom = async (url, kind, lang) => {
    const response = await fetch(url);
    // A missing file can come back as the single page app shell with status 200, so the
    // content type decides, not the status. Downloaded files are read from disk and carry
    // no useful type, so those are judged by their shape alone.
    const type = response.headers.get('content-type') || '';
    if (!response.ok || (type && !type.includes('json') && !type.includes('octet-stream') && !type.includes('text/plain'))) {
        throw new Error(`content_unavailable:${kind}_${lang}`);
    }
    return response.json();
};

const fetchContent = async (kind, lang) => {
    if (process.env.NODE_ENV === 'test') {
        return readContentFromDisk(kind, lang);
    }

    const name = `${kind}_${lang}`;
    await getState();
    const downloadedUrl = getDownloadedUrl(name);

    if (downloadedUrl) {
        try {
            // If the app does not finish starting after this, the file is dropped on the next try.
            await markTrying(name);
            const data = await readJsonFrom(downloadedUrl, kind, lang);
            if (!isContentShaped(kind, data)) {
                throw new Error(`content_malformed:${name}`);
            }
            await clearTrying();
            return data;
        } catch (error) {
            await quarantine(name);
        }
    }

    return readJsonFrom(contentUrl(kind, lang), kind, lang);
};

const touchLanguage = (lang) => {
    // English is the fallback every language leans on, so it is never the one evicted.
    if (lang === BASE_CONTENT_LANGUAGE) {
        return;
    }
    const index = languageUse.indexOf(lang);
    if (index !== -1) {
        languageUse.splice(index, 1);
    }
    languageUse.push(lang);
};

const evictLanguage = (lang) => {
    CONTENT_KINDS.forEach((kind) => contentCache.delete(cacheKey(kind, lang)));
    const index = languageUse.indexOf(lang);
    if (index !== -1) {
        languageUse.splice(index, 1);
    }
};

const enforceResidentLimit = () => {
    while (languageUse.length > MAX_RESIDENT_LANGUAGES) {
        evictLanguage(languageUse[0]);
    }
};

/**
 * Reads one content file. Rejects when the language has no such file; callers decide whether
 * to fall back to English.
 */
export const getContent = (kind, lang) => {
    const language = asLanguage(lang);
    const key = cacheKey(kind, language);

    if (contentCache.has(key)) {
        touchLanguage(language);
        return Promise.resolve(contentCache.get(key));
    }

    if (inFlight.has(key)) {
        return inFlight.get(key);
    }

    const request = fetchContent(kind, language)
        .then((data) => {
            contentCache.set(key, data);
            touchLanguage(language);
            enforceResidentLimit();
            return data;
        })
        .finally(() => {
            inFlight.delete(key);
        });

    inFlight.set(key, request);
    return request;
};

/**
 * Same read, but falls back to the English base file and finally to null, which is the
 * behaviour the screens relied on while the files were imported.
 */
export const getContentWithFallback = async (kind, lang) => {
    const language = asLanguage(lang);
    try {
        return await getContent(kind, language);
    } catch (error) {
        if (language === BASE_CONTENT_LANGUAGE) {
            return null;
        }
    }

    try {
        return await getContent(kind, BASE_CONTENT_LANGUAGE);
    } catch (error) {
        return null;
    }
};

/**
 * Hands back the memory held for a language. Used by the runtime cache builder, which walks
 * every language and would otherwise keep all of them resident.
 */
export const releaseContent = (lang) => {
    evictLanguage(asLanguage(lang));
};

// The inventory of what this build shipped, written by scripts/build-content-assets.mjs.
// It is read from the app's own package only, never from a mirror.
const loadInventory = async () => {
    if (process.env.NODE_ENV === 'test') {
        /* eslint-disable global-require */
        const fs = require('fs');
        const path = require('path');
        /* eslint-enable global-require */
        const translationsRoot = path.join(process.cwd(), 'src', 'assets', 'translations');
        const languages = {
            [BASE_CONTENT_LANGUAGE]: { revision: 'test', kinds: ['quran', 'appendices', 'introduction'] },
        };
        fs.readdirSync(translationsRoot).forEach((lang) => {
            const kinds = CONTENT_KINDS.filter((kind) => (
                fs.existsSync(path.join(translationsRoot, lang, `${kind}_${lang}.json`))
            ));
            if (kinds.length > 0) {
                languages[lang] = { revision: `test-${lang}`, kinds };
            }
        });
        return { revision: 'test', languages };
    }

    const response = await fetch(`${process.env.PUBLIC_URL || ''}/content/inventory.json`);
    if (!response.ok) {
        throw new Error('content_inventory_unavailable');
    }
    return response.json();
};

const getInventory = () => {
    if (!inventoryPromise) {
        inventoryPromise = loadInventory().catch((error) => {
            inventoryPromise = null;
            throw error;
        });
    }
    return inventoryPromise;
};

/**
 * Languages that actually have a published Quran file. The catalog in languages.json also
 * lists languages whose translation has not landed yet, so it cannot answer this.
 */
export const getContentLanguages = async () => {
    try {
        const inventory = await getInventory();
        return Object.entries(inventory?.languages || {})
            .filter(([, entry]) => Array.isArray(entry?.kinds) && entry.kinds.includes('quran'))
            .map(([lang]) => lang)
            .sort();
    } catch (error) {
        return [BASE_CONTENT_LANGUAGE];
    }
};

/**
 * Per-language content revisions. Caches derived from the text (search suggestions,
 * hyphenation) compare against these, so a translation update invalidates them.
 */
export const getContentRevisions = async () => {
    try {
        const inventory = await getInventory();
        const revisions = Object.entries(inventory?.languages || {}).reduce((acc, [lang, entry]) => {
            if (entry?.revision) {
                acc[lang] = entry.revision;
            }
            return acc;
        }, {});

        // A language read from a downloaded copy carries that copy's revision, otherwise an
        // update would arrive as new text with a search index still built from the old one.
        await getState();
        Object.entries(getDownloadedRevisions()).forEach(([name, etag]) => {
            if (name.startsWith('quran_')) {
                revisions[name.slice('quran_'.length)] = etag;
            }
        });

        return revisions;
    } catch (error) {
        return {};
    }
};
