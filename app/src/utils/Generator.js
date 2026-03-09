import languagesCatalog from '../assets/languages.json';

export const getRandom = () => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return (array[0] % 6234) + 1;
};

const DYM_ALGO_VERSION = 'dym-runtime-v2';
const DYM_SCHEMA_VERSION = 1;
const DYM_DB_NAME = 'quran-tft-cache';
const DYM_DB_VERSION = 2;
const DYM_STORE_NAME = 'didyoumean';
const DYM_MANIFEST_KEY = 'manifest';
const DYM_PROGRESS_EVENT = 'didyoumean:build-progress';
const DYM_READY_EVENT = 'didyoumean:ready';
const DYM_BUILD_PROGRESS_UPDATE_TEXT_EVERY = 96;
const DYM_BUILD_YIELD_TEXT_EVERY = 320;
const DYM_BUILD_YIELD_MIN_INTERVAL_MS = 20;
const DYM_BUILD_PROGRESS_MIN_DELTA = 0.005;

const HYPH_ALGO_VERSION = 'hyphen-runtime-v4';
const HYPH_SCHEMA_VERSION = 1;
const HYPH_DB_NAME = DYM_DB_NAME;
const HYPH_DB_VERSION = DYM_DB_VERSION;
const HYPH_STORE_NAME = 'hyphenation';
const HYPH_MANIFEST_KEY = 'manifest';
const HYPHEN_CHAR = '\u00AD';
// LTR langs with runtime hyphen fallback need. As of 2026-03 caniuse checks
// against our supported set keep this limited to Turkish + Azerbaijani.
const RUNTIME_HYPHEN_LANGUAGES = ['tr', 'az'];

const TURKIC_SUFFIXES = [
    'LERİ', 'LARI', 'LERI', 'LARİ',
    'LER', 'LAR',
    'NIN', 'NİN', 'NUN', 'NÜN',
    'DAN', 'DEN', 'TAN', 'TEN',
    'YI', 'Yİ', 'YU', 'YÜ',
    'NI', 'Nİ', 'NU', 'NÜ',
    'IN', 'İN', 'UN', 'ÜN',
    'SI', 'Sİ', 'SU', 'SÜ',
    'IM', 'İM', 'UM', 'ÜM',
    'M',
];
const SINGLE_SUFFIXES = ['I', 'İ', 'U', 'Ü', 'A', 'E'];

const quranTranslationContext = require.context(
    '../assets/translations',
    true,
    /quran_[a-z0-9-]+\.json$/,
    'lazy',
);

const RUNTIME_DYM_LANGUAGES = Array.from(new Set([
    'en',
    ...quranTranslationContext.keys()
        .map((filePath) => {
            const match = filePath.match(/^\.\/([^/]+)\/quran_[^/]+\.json$/);
            return match ? match[1].toLowerCase() : null;
        })
        .filter(Boolean),
])).filter((lang) => !!languagesCatalog[lang] || lang === 'en').sort();

const DB_STORES_BY_NAME = {
    [DYM_DB_NAME]: [DYM_STORE_NAME, HYPH_STORE_NAME],
};

let runtimeCachesBuildPromise = null;
let didYouMeanBuildProgress = {
    active: false,
    total: 0,
    completed: 0,
    percent: 0,
    currentLanguage: null,
    stage: null,
    cacheType: null,
    startupBlocking: false,
};

const dbPromiseCache = new Map();
const hyphenatorPromiseCache = new Map();

const asLanguageCode = (value) => String(value || 'en').toLowerCase();

const getPrimaryLanguageCode = (value) => asLanguageCode(value).split('-')[0];

const getDidYouMeanIndexKey = (lang) => `index:${asLanguageCode(lang)}`;
const getHyphenIndexKey = (lang) => `index:${asLanguageCode(lang)}`;
const normalizeRequestedLanguages = (languages) => {
    if (languages == null) return [];

    const source = Array.isArray(languages) ? languages : [languages];
    const normalized = [];
    const seen = new Set();

    source.forEach((value) => {
        const asCode = asLanguageCode(value);
        const primary = getPrimaryLanguageCode(asCode);

        [asCode, primary].forEach((candidate) => {
            if (!candidate || seen.has(candidate)) return;
            seen.add(candidate);
            normalized.push(candidate);
        });
    });

    return normalized;
};

const updateDidYouMeanBuildProgress = (progress, onProgress) => {
    didYouMeanBuildProgress = {
        ...progress,
        stage: progress?.stage || null,
        cacheType: progress?.cacheType || null,
        startupBlocking: Boolean(progress?.startupBlocking),
    };

    if (typeof onProgress === 'function') {
        onProgress(didYouMeanBuildProgress);
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(DYM_PROGRESS_EVENT, { detail: didYouMeanBuildProgress }));
    }
};

const emitDidYouMeanReady = (detail) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(DYM_READY_EVENT, { detail }));
    }
};

const waitForFrame = () => new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => resolve());
        return;
    }
    setTimeout(resolve, 0);
});

const openIndexedKeyValueDb = ({ dbName, dbVersion, storeName }) => {
    if (typeof indexedDB === 'undefined') {
        return Promise.resolve(null);
    }

    const cacheKey = `${dbName}:${storeName}:${dbVersion}`;
    if (dbPromiseCache.has(cacheKey)) {
        return dbPromiseCache.get(cacheKey);
    }

    const promise = new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onupgradeneeded = () => {
            const db = request.result;
            const stores = new Set([storeName, ...(DB_STORES_BY_NAME[dbName] || [])]);
            stores.forEach((candidateStoreName) => {
                if (!db.objectStoreNames.contains(candidateStoreName)) {
                    db.createObjectStore(candidateStoreName);
                }
            });
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    dbPromiseCache.set(cacheKey, promise);
    return promise;
};

const idbGetFrom = async ({ dbName, dbVersion, storeName }, key) => {
    const db = await openIndexedKeyValueDb({ dbName, dbVersion, storeName });
    if (!db) return null;

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
    });
};

const idbSetTo = async ({ dbName, dbVersion, storeName }, key, value) => {
    const db = await openIndexedKeyValueDb({ dbName, dbVersion, storeName });
    if (!db) return;

    await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const idbHasKeyIn = async ({ dbName, dbVersion, storeName }, key) => {
    const value = await idbGetFrom({ dbName, dbVersion, storeName }, key);
    return value != null;
};

const dymDbConfig = {
    dbName: DYM_DB_NAME,
    dbVersion: DYM_DB_VERSION,
    storeName: DYM_STORE_NAME,
};

const hyphenDbConfig = {
    dbName: HYPH_DB_NAME,
    dbVersion: HYPH_DB_VERSION,
    storeName: HYPH_STORE_NAME,
};

const dymIdbGet = async (key) => idbGetFrom(dymDbConfig, key);
const dymIdbSet = async (key, value) => idbSetTo(dymDbConfig, key, value);
const dymIdbHasKey = async (key) => idbHasKeyIn(dymDbConfig, key);

const hyphenIdbGet = async (key) => idbGetFrom(hyphenDbConfig, key);
const hyphenIdbSet = async (key, value) => idbSetTo(hyphenDbConfig, key, value);
const hyphenIdbHasKey = async (key) => idbHasKeyIn(hyphenDbConfig, key);

const readDidYouMeanManifest = async () => {
    const manifest = await dymIdbGet(DYM_MANIFEST_KEY);
    return manifest || null;
};

const writeDidYouMeanManifest = async ({
    appVersion,
    languagesReady,
    failed = {},
}) => {
    await dymIdbSet(DYM_MANIFEST_KEY, {
        schemaVersion: DYM_SCHEMA_VERSION,
        appVersion,
        algoVersion: DYM_ALGO_VERSION,
        languagesReady: Array.from(new Set(languagesReady || [])).sort(),
        failed,
        updatedAt: new Date().toISOString(),
    });
};

const readHyphenManifest = async () => {
    const manifest = await hyphenIdbGet(HYPH_MANIFEST_KEY);
    return manifest || null;
};

const writeHyphenManifest = async ({
    appVersion,
    languagesReady,
    failed = {},
}) => {
    await hyphenIdbSet(HYPH_MANIFEST_KEY, {
        schemaVersion: HYPH_SCHEMA_VERSION,
        appVersion,
        algoVersion: HYPH_ALGO_VERSION,
        languagesReady: Array.from(new Set(languagesReady || [])).sort(),
        failed,
        updatedAt: new Date().toISOString(),
    });
};

const getRuntimeBuildSignature = () => {
    if (typeof window === 'undefined') return 'server';
    if (process.env.NODE_ENV !== 'production') return 'dev';

    const scripts = Array.from(document.getElementsByTagName('script'))
        .map((script) => script?.src || '')
        .filter(Boolean);

    const mainScript = scripts.find((src) => /\/static\/js\/main\.[^.]+\.js/.test(src));
    if (!mainScript) return `prod-${window.location.origin}`;

    const match = mainScript.match(/main\.([^.]+)\.js/);
    if (!match || !match[1]) return mainScript;
    return match[1];
};

const doesManifestMatch = ({ manifest, schemaVersion, algoVersion, appVersion }) => Boolean(
    manifest
    && manifest.schemaVersion === schemaVersion
    && manifest.algoVersion === algoVersion
    && String(manifest.appVersion || '') === String(appVersion),
);

const isWordChar = (ch) => {
    if (!ch) return false;
    const c = ch.charCodeAt(0);
    if (c >= 0x30 && c <= 0x39) return true;
    if (ch.toUpperCase() !== ch.toLowerCase()) return true;
    if (c >= 0x0621 && c <= 0x064A) return true;
    if (c >= 0x066E && c <= 0x06D3) return true;
    if (c >= 0x05D0 && c <= 0x05EA) return true;
    if (c >= 0x4E00 && c <= 0x9FFF) return true;
    if (c >= 0x0900 && c <= 0x0DFF) return true;
    if (c >= 0x0E00 && c <= 0x0E7F) return true;
    return false;
};

const splitQuerySegments = (text) => {
    const segments = [];
    if (!text) return segments;

    let current = '';
    let mode = null;
    for (const ch of String(text)) {
        const nextMode = isWordChar(ch) ? 'word' : 'sep';
        if (mode === null || mode === nextMode) {
            current += ch;
            mode = nextMode;
        } else {
            segments.push({ type: mode, value: current });
            current = ch;
            mode = nextMode;
        }
    }
    if (current) segments.push({ type: mode, value: current });
    return segments;
};

const foldRtlScript = (value) => {
    if (value == null) return value;
    return String(value)
        .replace(/[\u0640\u200c\u200d]/g, '')
        .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ؤ/g, 'و')
        .replace(/[ئى]/g, 'ی')
        .replace(/[ي]/g, 'ی')
        .replace(/[ك]/g, 'ک')
        .replace(/[ةۀ]/g, 'ه');
};

const mapAppendices = (appendices, translationApplication) => {
    const appendixMap = {};
    let currentAppendixNum = 1;
    let globalContentOrder = 1;
    const appendixPages = Array.isArray(appendices) ? appendices : Object.values(appendices || {});

    appendixPages.forEach((page) => {
        if (!page || page.page < 397) {
            return;
        }

        const allContentItems = [];

        Object.entries(page.titles || {}).forEach(([key, title]) => {
            allContentItems.push({
                type: 'title',
                content: title,
                key: parseInt(key, 10),
            });
        });

        const collectContent = (type, data, pageNo) => {
            Object.entries(data || {}).forEach(([key, value]) => {
                if (!value) return;
                allContentItems.push({
                    type,
                    content: value,
                    key: parseInt(key, 10),
                    page: pageNo,
                });
            });
        };

        collectContent('text', page.text, page.page);
        collectContent('evidence', page.evidence, page.page);
        collectContent('table', page.table, page.page);
        collectContent('picture', page.picture, page.page);

        allContentItems.sort((a, b) => a.key - b.key);
        allContentItems.forEach((item) => {
            item.order = globalContentOrder++;
            if (item.type === 'title') {
                const appendixWord = translationApplication ? translationApplication.appendix : 'Appendix';
                const appendixMatch = String(item.content || '').match(new RegExp(`${appendixWord}\\s*(\\d+)`));
                if (/\d+/.test(String(item.content || '')) && appendixMatch) {
                    currentAppendixNum = appendixMatch[1];
                }
            }
            if (!appendixMap[currentAppendixNum]) {
                appendixMap[currentAppendixNum] = { content: [] };
            }
            appendixMap[currentAppendixNum].content.push(item);
        });
    });

    Object.values(appendixMap).forEach((appendix) => {
        appendix.content.sort((a, b) => a.order - b.order);
    });

    return appendixMap;
};

const collectLanguageTextQueue = ({ quran = {}, introduction = {}, appendices = {}, application = {} }) => {
    const textQueue = [];

    const enqueueText = (text, includeInSearchHitCheck = true) => {
        if (text == null) return;
        textQueue.push({ text, includeInSearchHitCheck });
    };

    Object.keys(quran || {}).forEach((page) => {
        const suras = quran[page]?.sura || {};
        Object.keys(suras).forEach((suraNumber) => {
            const verses = suras[suraNumber]?.verses || {};
            Object.keys(verses).forEach((verseNumber) => {
                enqueueText(verses[verseNumber]);
            });

            const titles = suras[suraNumber]?.titles || {};
            Object.keys(titles).forEach((titleNumber) => {
                enqueueText(titles[titleNumber]);
            });
        });

        const notes = quran[page]?.notes?.data;
        if (notes && notes.length > 0) {
            Object.values(notes).forEach((note) => enqueueText(note));
        }
    });

    Object.keys(introduction || {}).forEach((section) => {
        const introSection = introduction[section];
        const introContent = (introSection?.page !== 1 && introSection?.page !== 22)
            ? introSection
            : null;
        if (!introContent) return;

        Object.entries(introContent).forEach(([type, content]) => {
            if (type === 'page') return;
            if (content && typeof content === 'object') {
                Object.values(content).forEach((value) => enqueueText(value));
            } else {
                enqueueText(content);
            }
        });
    });

    const appendixMap = mapAppendices(appendices, application);
    Object.keys(appendixMap || {}).forEach((appendixNo) => {
        const appendixContent = appendixMap[appendixNo]?.content || [];
        appendixContent
            .filter((element) => (
                element.type === 'text'
                || element.type === 'title'
                || (element.type === 'table' && element.content?.ref && String(element.content.ref).trim() !== '')
            ))
            .forEach((element) => {
                const appendixText = element.type === 'table'
                    ? String(element.content.ref)
                    : String(element.content);
                enqueueText(appendixText);
            });
    });

    if (application && typeof application === 'object') {
        Object.values(application).forEach((value) => {
            if (typeof value === 'string') {
                enqueueText(value, false);
            }
        });
    }

    return textQueue;
};

const getLanguageDigits = (lang, languagesConfig) => {
    const config = languagesConfig[lang] || languagesConfig.en || {};
    const numbers = config.nums || '0 1 2 3 4 5 6 7 8 9';
    return numbers.split(/\s+/).filter(Boolean);
};

const createSuggestionFold = (lang, languagesConfig) => {
    const config = languagesConfig[lang] || languagesConfig.en || {};
    const isRtl = config.dir === 'rtl';

    return (text) => {
        let value = String(text || '');
        if (isRtl) {
            value = foldRtlScript(value);
        }
        if (lang === 'tr' || lang === 'az') {
            value = value.replace(/[İIıi]/g, 'i');
        }
        value = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        value = value.toLocaleUpperCase(lang || 'en');
        return value;
    };
};

const buildStemVariants = (token, lang) => {
    const isTurkic = lang === 'tr' || lang === 'az';
    if (!isTurkic || !token || token.length < 5) return [];

    const stems = new Set();
    const queue = [{ value: token, depth: 0 }];
    while (queue.length > 0) {
        const { value, depth } = queue.shift();
        if (depth >= 2) continue;

        TURKIC_SUFFIXES.forEach((suffix) => {
            if (!value.endsWith(suffix)) return;
            const stem = value.slice(0, -suffix.length);
            if (stem.length < 4 || stem === token || stems.has(stem)) return;
            stems.add(stem);
            queue.push({ value: stem, depth: depth + 1 });
        });

        if (value.length >= 7) {
            SINGLE_SUFFIXES.forEach((suffix) => {
                if (!value.endsWith(suffix)) return;
                const stem = value.slice(0, -suffix.length);
                if (stem.length < 4 || stem === token || stems.has(stem)) return;
                stems.add(stem);
                queue.push({ value: stem, depth: depth + 1 });
            });
        }
    }
    return Array.from(stems);
};

const buildDidYouMeanIndex = async ({ lang, quran, introduction, appendices, application, languagesConfig, onProgress = null, textQueue = null }) => {
    const searchFold = createSuggestionFold(lang, languagesConfig);
    const languageDigits = getLanguageDigits(lang, languagesConfig);
    const digitSet = new Set(languageDigits);

    const hasAnyDigitLocal = (value) => {
        if (value == null) return false;
        if (/\d/.test(value)) return true;
        for (const ch of String(value)) {
            if (digitSet.has(ch)) return true;
        }
        return false;
    };

    const frequency = new Map();
    const surfaceForms = new Map();
    const searchableTextSet = new Set();
    const bigramFrequency = new Map();
    const trigramFrequency = new Map();

    const addToken = (token, weight = 1) => {
        if (!token || token.length < 2) return;
        if (hasAnyDigitLocal(token)) return;
        frequency.set(token, (frequency.get(token) || 0) + weight);
    };

    const addSurfaceForm = (foldedToken, originalToken, weight = 1) => {
        if (!foldedToken || foldedToken.length < 2 || !originalToken) return;
        if (hasAnyDigitLocal(foldedToken)) return;
        if (!surfaceForms.has(foldedToken)) {
            surfaceForms.set(foldedToken, new Map());
        }
        const variants = surfaceForms.get(foldedToken);
        variants.set(originalToken, (variants.get(originalToken) || 0) + weight);
    };

    const addText = (text, includeInSearchHitCheck = true) => {
        if (text == null) return;
        const sourceText = String(text);
        const foldedText = searchFold(sourceText);
        const trimmedText = foldedText.trim();
        if (includeInSearchHitCheck && trimmedText.length > 1) {
            searchableTextSet.add(trimmedText);
        }

        const wordTokens = [];
        splitQuerySegments(sourceText).forEach((segment) => {
            if (segment.type !== 'word') return;
            const foldedToken = searchFold(segment.value);
            if (!foldedToken || foldedToken.length < 2) return;

            addToken(foldedToken, 1);
            addSurfaceForm(foldedToken, segment.value, 1);
            buildStemVariants(foldedToken, lang).forEach((stem) => {
                addToken(stem, 0.42);
                addSurfaceForm(stem, segment.value, 0.42);
            });
            if (!hasAnyDigitLocal(segment.value)) {
                wordTokens.push(foldedToken);
            }
        });

        for (let i = 0; i < wordTokens.length - 1; i++) {
            const key = `${wordTokens[i]} ${wordTokens[i + 1]}`;
            bigramFrequency.set(key, (bigramFrequency.get(key) || 0) + 1);
        }
        for (let i = 0; i < wordTokens.length - 2; i++) {
            const key = `${wordTokens[i]} ${wordTokens[i + 1]} ${wordTokens[i + 2]}`;
            trigramFrequency.set(key, (trigramFrequency.get(key) || 0) + 1);
        }
    };

    const queue = textQueue || collectLanguageTextQueue({ quran, introduction, appendices, application });
    const totalTextEntries = Math.max(queue.length, 1);
    let processedTextEntries = 0;
    let lastReportedProgress = -1;
    let lastYieldAt = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
    const nowMs = () => (
        (typeof performance !== 'undefined' && typeof performance.now === 'function')
            ? performance.now()
            : Date.now()
    );

    const reportProgress = (force = false) => {
        if (typeof onProgress !== 'function') {
            return;
        }

        const progress = Math.max(0, Math.min(1, processedTextEntries / totalTextEntries));
        if (!force && lastReportedProgress >= 0 && (progress - lastReportedProgress) < DYM_BUILD_PROGRESS_MIN_DELTA) {
            return;
        }
        lastReportedProgress = progress;
        onProgress(progress);
    };

    reportProgress(true);
    for (const entry of queue) {
        addText(entry.text, entry.includeInSearchHitCheck);
        processedTextEntries += 1;

        if (
            processedTextEntries === totalTextEntries
            || processedTextEntries % DYM_BUILD_PROGRESS_UPDATE_TEXT_EVERY === 0
        ) {
            reportProgress(false);
        }

        if (processedTextEntries % DYM_BUILD_YIELD_TEXT_EVERY === 0) {
            const now = nowMs();
            if ((now - lastYieldAt) >= DYM_BUILD_YIELD_MIN_INTERVAL_MS) {
                await waitForFrame();
                lastYieldAt = nowMs();
            }
        }
    }
    reportProgress(true);

    const byLength = new Map();
    frequency.forEach((_count, token) => {
        const length = token.length;
        if (!byLength.has(length)) {
            byLength.set(length, []);
        }
        byLength.get(length).push(token);
    });

    return {
        frequency,
        byLength,
        surfaceForms,
        searchableTexts: Array.from(searchableTextSet),
        bigramFrequency,
        trigramFrequency,
    };
};

const serializeDidYouMeanIndex = (index) => ({
    frequency: Array.from(index.frequency.entries()),
    byLength: Array.from(index.byLength.entries()),
    surfaceForms: Array.from(index.surfaceForms.entries())
        .map(([token, variants]) => [token, Array.from(variants.entries())]),
    searchableTexts: index.searchableTexts,
    bigramFrequency: Array.from(index.bigramFrequency.entries()),
    trigramFrequency: Array.from(index.trigramFrequency.entries()),
});

const normalizeHyphenToken = (token, lang) => {
    let value = String(token || '');
    if (lang === 'tr' || lang === 'az') {
        value = value.replace(/[İIıi]/g, 'i');
    }
    value = value.normalize('NFC');
    return value.toLocaleLowerCase(lang || 'en');
};

const buildHyphenProtectedTokenSet = ({ lang, application }) => {
    const normalizedLang = getPrimaryLanguageCode(lang);
    const protectedTokens = new Set();
    const godWord = application?.gw;

    if (godWord == null) {
        return protectedTokens;
    }

    splitQuerySegments(String(godWord)).forEach((segment) => {
        if (segment.type !== 'word') {
            return;
        }

        const normalized = normalizeHyphenToken(segment.value, normalizedLang);
        if (!normalized) {
            return;
        }

        protectedTokens.add(normalized);
    });

    return protectedTokens;
};

const resolveHyphenLoaderLanguage = (lang) => {
    if (lang === 'az') return 'tr';
    if (lang === 'tr') return 'tr';
    return null;
};

const loadHyphenModule = async (loaderLanguage) => {
    switch (loaderLanguage) {
        case 'tr':
            return import(/* webpackChunkName: "hyphen-tr" */ 'hyphen/tr');
        default:
            return null;
    }
};

const resolveHyphenateWord = async (lang) => {
    const normalizedLang = asLanguageCode(lang);

    if (hyphenatorPromiseCache.has(normalizedLang)) {
        return hyphenatorPromiseCache.get(normalizedLang);
    }

    const promise = (async () => {
        const loaderLanguage = resolveHyphenLoaderLanguage(normalizedLang);
        if (!loaderLanguage) {
            return null;
        }

        const hyphenModule = await loadHyphenModule(loaderLanguage).catch(() => null);
        if (!hyphenModule) {
            return null;
        }

        const hyphenateWord = hyphenModule?.hyphenateSync
            || hyphenModule?.hyphenate
            || hyphenModule?.default?.hyphenateSync
            || hyphenModule?.default?.hyphenate
            || null;

        return (typeof hyphenateWord === 'function') ? hyphenateWord : null;
    })();

    hyphenatorPromiseCache.set(normalizedLang, promise);
    return promise;
};

const buildHyphenIndex = async ({
    lang,
    hyphenateWord,
    textQueue,
    protectedTokens = null,
    onProgress = null,
}) => {
    const protectedTokenSet = protectedTokens instanceof Set ? protectedTokens : new Set();
    const uniqueTokens = new Set();
    const queue = textQueue || [];
    const totalTextEntries = Math.max(queue.length, 1);
    let processedTextEntries = 0;
    let lastReportedProgress = -1;

    let lastYieldAt = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
    const nowMs = () => (
        (typeof performance !== 'undefined' && typeof performance.now === 'function')
            ? performance.now()
            : Date.now()
    );

    const reportProgress = (nextProgress, force = false) => {
        if (typeof onProgress !== 'function') {
            return;
        }

        const progress = Math.max(0, Math.min(1, Number(nextProgress) || 0));
        if (!force && lastReportedProgress >= 0 && (progress - lastReportedProgress) < DYM_BUILD_PROGRESS_MIN_DELTA) {
            return;
        }

        lastReportedProgress = progress;
        onProgress(progress);
    };

    reportProgress(0, true);

    for (const entry of queue) {
        splitQuerySegments(String(entry.text || '')).forEach((segment) => {
            if (segment.type !== 'word') return;
            if (/\d/.test(segment.value)) return;

            const normalized = normalizeHyphenToken(segment.value, lang);
            if (!normalized || normalized.length < 5) return;
            if (protectedTokenSet.has(normalized)) return;
            uniqueTokens.add(normalized);
        });

        processedTextEntries += 1;
        if (
            processedTextEntries === totalTextEntries
            || processedTextEntries % DYM_BUILD_PROGRESS_UPDATE_TEXT_EVERY === 0
        ) {
            reportProgress((processedTextEntries / totalTextEntries) * 0.45, false);
        }

        if (processedTextEntries % DYM_BUILD_YIELD_TEXT_EVERY === 0) {
            const now = nowMs();
            if ((now - lastYieldAt) >= DYM_BUILD_YIELD_MIN_INTERVAL_MS) {
                await waitForFrame();
                lastYieldAt = nowMs();
            }
        }
    }

    const tokens = Array.from(uniqueTokens);
    const hyphenMap = new Map();
    const totalTokens = Math.max(tokens.length, 1);
    let processedTokens = 0;

    for (const token of tokens) {
        try {
            const hyphenatedMaybePromise = hyphenateWord(token, {
                hyphenChar: HYPHEN_CHAR,
                minWordLength: 5,
            });
            const hyphenated = (hyphenatedMaybePromise && typeof hyphenatedMaybePromise.then === 'function')
                ? await hyphenatedMaybePromise
                : hyphenatedMaybePromise;

            if (
                typeof hyphenated === 'string'
                && hyphenated.includes(HYPHEN_CHAR)
                && hyphenated !== token
            ) {
                hyphenMap.set(token, hyphenated);
            }
        } catch (_error) {
            // Skip failed token-level hyphenation silently to keep builder resilient.
        }

        processedTokens += 1;
        if (
            processedTokens === totalTokens
            || processedTokens % DYM_BUILD_PROGRESS_UPDATE_TEXT_EVERY === 0
        ) {
            reportProgress(0.45 + ((processedTokens / totalTokens) * 0.55), false);
        }

        if (processedTokens % DYM_BUILD_YIELD_TEXT_EVERY === 0) {
            const now = nowMs();
            if ((now - lastYieldAt) >= DYM_BUILD_YIELD_MIN_INTERVAL_MS) {
                await waitForFrame();
                lastYieldAt = nowMs();
            }
        }
    }

    reportProgress(1, true);

    return {
        entries: Array.from(hyphenMap.entries()),
        tokenCount: tokens.length,
        hyphenatedCount: hyphenMap.size,
    };
};

export const buildDidYouMeanSerializedIndex = async ({
    lang = 'en',
    quran = {},
    introduction = {},
    appendices = {},
    application = {},
    languagesConfig = languagesCatalog,
    onProgress = null,
    textQueue = null,
}) => serializeDidYouMeanIndex(await buildDidYouMeanIndex({
    lang,
    quran,
    introduction,
    appendices,
    application,
    languagesConfig,
    onProgress,
    textQueue,
}));

export const buildHyphenSerializedIndex = async ({
    lang = 'tr',
    quran = {},
    introduction = {},
    appendices = {},
    application = {},
    hyphenateWord = null,
    onProgress = null,
    textQueue = null,
}) => {
    const normalizedLang = asLanguageCode(lang);
    const resolvedHyphenator = hyphenateWord || await resolveHyphenateWord(normalizedLang);
    if (typeof resolvedHyphenator !== 'function') {
        if (typeof onProgress === 'function') {
            onProgress(1);
        }
        return {
            entries: [],
            tokenCount: 0,
            hyphenatedCount: 0,
            protectedTokens: [],
        };
    }

    const queue = textQueue || collectLanguageTextQueue({ quran, introduction, appendices, application });
    const protectedTokens = buildHyphenProtectedTokenSet({
        lang: normalizedLang,
        application,
    });

    const hyphenIndex = await buildHyphenIndex({
        lang: normalizedLang,
        hyphenateWord: resolvedHyphenator,
        textQueue: queue,
        protectedTokens,
        onProgress,
    });

    return {
        ...hyphenIndex,
        protectedTokens: Array.from(protectedTokens).sort(),
    };
};

const loadTranslation = async (lang, prefix, fallback) => {
    const normalizedLang = asLanguageCode(lang);
    const module = await import(
        `../assets/translations/${normalizedLang}/${prefix}_${normalizedLang}.json`
    ).catch(() => null);
    if (module?.default) {
        return module.default;
    }
    if (typeof fallback === 'function') {
        return fallback();
    }
    return fallback;
};

const loadBaseQuran = async () => (await import('../assets/qurantft.json')).default;
const loadBaseIntroduction = async () => (await import('../assets/introduction.json')).default;
const loadBaseAppendices = async () => (await import('../assets/appendices.json')).default;
const loadBaseApplication = async () => (await import('../assets/application.json')).default;

const loadLanguagePayload = async (lang) => {
    const normalizedLang = asLanguageCode(lang);
    if (normalizedLang === 'en') {
        const [quran, introduction, appendices, application] = await Promise.all([
            loadBaseQuran(),
            loadBaseIntroduction(),
            loadBaseAppendices(),
            loadBaseApplication(),
        ]);

        return {
            quran,
            introduction,
            appendices,
            application,
        };
    }

    return {
        quran: await loadTranslation(normalizedLang, 'quran', loadBaseQuran),
        introduction: await loadTranslation(normalizedLang, 'introduction', loadBaseIntroduction),
        appendices: await loadTranslation(normalizedLang, 'appendices', loadBaseAppendices),
        application: await loadTranslation(normalizedLang, 'application', loadBaseApplication),
    };
};

const buildDidYouMeanLanguageIndex = async (lang, payload = null, onProgress = null) => {
    const report = (fraction) => {
        if (typeof onProgress !== 'function') return;
        const normalized = Math.max(0, Math.min(1, Number(fraction) || 0));
        onProgress(normalized);
    };

    report(0.02);
    const loadedPayload = payload || await loadLanguagePayload(lang);
    const textQueue = collectLanguageTextQueue(loadedPayload);
    report(0.12);
    const serializedIndex = await buildDidYouMeanSerializedIndex({
        lang,
        quran: loadedPayload.quran,
        introduction: loadedPayload.introduction,
        appendices: loadedPayload.appendices,
        application: loadedPayload.application,
        textQueue,
        onProgress: (fraction) => {
            report(0.12 + (Math.max(0, Math.min(1, fraction)) * 0.82));
        },
    });
    report(0.95);

    await dymIdbSet(getDidYouMeanIndexKey(lang), {
        lang: asLanguageCode(lang),
        version: DYM_ALGO_VERSION,
        generatedAt: new Date().toISOString(),
        index: serializedIndex,
    });
    report(1);
};

const buildHyphenLanguageIndex = async (lang, payload = null, onProgress = null) => {
    const report = (fraction) => {
        if (typeof onProgress !== 'function') return;
        const normalized = Math.max(0, Math.min(1, Number(fraction) || 0));
        onProgress(normalized);
    };

    report(0.02);
    const loadedPayload = payload || await loadLanguagePayload(lang);
    const textQueue = collectLanguageTextQueue(loadedPayload);

    report(0.12);
    const hyphenateWord = await resolveHyphenateWord(lang);
    report(0.18);

    const serializedIndex = await buildHyphenSerializedIndex({
        lang,
        quran: loadedPayload.quran,
        introduction: loadedPayload.introduction,
        appendices: loadedPayload.appendices,
        application: loadedPayload.application,
        hyphenateWord,
        textQueue,
        onProgress: (fraction) => {
            report(0.18 + (Math.max(0, Math.min(1, fraction)) * 0.78));
        },
    });

    report(0.97);
    await hyphenIdbSet(getHyphenIndexKey(lang), {
        lang: asLanguageCode(lang),
        version: HYPH_ALGO_VERSION,
        generatedAt: new Date().toISOString(),
        index: serializedIndex,
    });
    report(1);
};

const verifyReusableDidYouMeanLanguages = async (languagesReady = [], targetLanguages = []) => {
    const targetSet = new Set((targetLanguages || []).map(asLanguageCode));
    const candidates = Array.from(new Set((languagesReady || []).map(asLanguageCode)))
        .filter((lang) => targetSet.size === 0 || targetSet.has(lang));

    if (candidates.length === 0) {
        return [];
    }

    const checks = await Promise.all(candidates.map(async (lang) => {
        const exists = await dymIdbHasKey(getDidYouMeanIndexKey(lang));
        return exists ? lang : null;
    }));

    return checks.filter(Boolean);
};

const verifyReusableHyphenLanguages = async (languagesReady = [], targetLanguages = []) => {
    const targetSet = new Set((targetLanguages || []).map(asLanguageCode));
    const candidates = Array.from(new Set((languagesReady || []).map(asLanguageCode)))
        .filter((lang) => targetSet.size === 0 || targetSet.has(lang));

    if (candidates.length === 0) {
        return [];
    }

    const checks = await Promise.all(candidates.map(async (lang) => {
        const exists = await hyphenIdbHasKey(getHyphenIndexKey(lang));
        return exists ? lang : null;
    }));

    return checks.filter(Boolean);
};

export const ensureRuntimeCachesReady = async ({
    allLanguages = true,
    languages = null,
    onProgress = null,
    startupBlocking = false,
} = {}) => {
    if (runtimeCachesBuildPromise) {
        if (typeof onProgress === 'function') {
            onProgress(didYouMeanBuildProgress);
        }
        return runtimeCachesBuildPromise;
    }

    runtimeCachesBuildPromise = (async () => {
        const appVersion = getRuntimeBuildSignature();
        const requestedLanguages = normalizeRequestedLanguages(languages);

        let dymTargetLanguages = (allLanguages ? RUNTIME_DYM_LANGUAGES : ['en']).map(asLanguageCode);
        let hyphenTargetLanguages = (allLanguages ? RUNTIME_HYPHEN_LANGUAGES : []).map(asLanguageCode);

        if (requestedLanguages.length > 0) {
            const requestedSet = new Set(requestedLanguages);
            const availableDidYouMeanLanguages = new Set(RUNTIME_DYM_LANGUAGES.map(asLanguageCode));
            const availableHyphenLanguages = new Set(RUNTIME_HYPHEN_LANGUAGES.map(asLanguageCode));

            dymTargetLanguages = requestedLanguages.filter((lang) => availableDidYouMeanLanguages.has(lang));
            hyphenTargetLanguages = requestedLanguages.filter((lang) => availableHyphenLanguages.has(lang));

            // If caller requested only unsupported aliases (e.g. en-US), include supported primaries.
            if (dymTargetLanguages.length === 0) {
                const fallbackDidYouMean = Array.from(requestedSet)
                    .map(getPrimaryLanguageCode)
                    .filter((lang) => availableDidYouMeanLanguages.has(lang));
                dymTargetLanguages = Array.from(new Set(fallbackDidYouMean));
            }

            if (hyphenTargetLanguages.length === 0) {
                const fallbackHyphen = Array.from(requestedSet)
                    .map(getPrimaryLanguageCode)
                    .filter((lang) => availableHyphenLanguages.has(lang));
                hyphenTargetLanguages = Array.from(new Set(fallbackHyphen));
            }
        }

        const dymTargetSet = new Set(dymTargetLanguages);
        const hyphenTargetSet = new Set(hyphenTargetLanguages);
        const targetLanguages = Array.from(new Set([...dymTargetLanguages, ...hyphenTargetLanguages]));

        const didYouMeanManifest = await readDidYouMeanManifest();
        const hyphenManifest = await readHyphenManifest();

        const dymManifestMatches = doesManifestMatch({
            manifest: didYouMeanManifest,
            schemaVersion: DYM_SCHEMA_VERSION,
            algoVersion: DYM_ALGO_VERSION,
            appVersion,
        });

        const hyphenManifestMatches = doesManifestMatch({
            manifest: hyphenManifest,
            schemaVersion: HYPH_SCHEMA_VERSION,
            algoVersion: HYPH_ALGO_VERSION,
            appVersion,
        });

        const didYouMeanReadySet = new Set(
            dymManifestMatches
                ? await verifyReusableDidYouMeanLanguages(
                    didYouMeanManifest?.languagesReady || [],
                    dymTargetLanguages,
                )
                : []
        );

        const hyphenReadySet = new Set(
            hyphenManifestMatches
                ? await verifyReusableHyphenLanguages(
                    hyphenManifest?.languagesReady || [],
                    hyphenTargetLanguages,
                )
                : []
        );

        const didYouMeanFailed = {};
        const hyphenFailed = {};

        const buildLanguages = targetLanguages.filter((lang) => {
            const needsDidYouMean = dymTargetSet.has(lang) && !didYouMeanReadySet.has(lang);
            const needsHyphen = hyphenTargetSet.has(lang) && !hyphenReadySet.has(lang);
            return needsDidYouMean || needsHyphen;
        });

        if (buildLanguages.length === 0) {
            updateDidYouMeanBuildProgress({
                active: false,
                total: targetLanguages.length,
                completed: targetLanguages.length,
                percent: 100,
                currentLanguage: null,
                stage: 'finalizing',
                cacheType: null,
                startupBlocking,
            }, onProgress);

            const result = {
                ready: true,
                built: false,
                missingLanguages: [],
                missingDidYouMeanLanguages: [],
                missingHyphenLanguages: [],
                appVersion,
                algoVersion: DYM_ALGO_VERSION,
                hyphenAlgoVersion: HYPH_ALGO_VERSION,
            };
            emitDidYouMeanReady(result);
            return result;
        }

        let completedLanguages = 0;
        const totalBuildLanguages = buildLanguages.length;
        let lastProgressPercent = -1;
        let lastProgressTimestamp = 0;

        const nowTime = () => {
            if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
                return performance.now();
            }
            return Date.now();
        };

        const emitActiveBuildProgress = ({
            completed = 0,
            languageFraction = 0,
            currentLanguage = null,
            stage = 'didyoumean',
            cacheType = null,
            force = false,
        }) => {
            const safeCompleted = Math.max(0, Math.min(totalBuildLanguages, Number(completed) || 0));
            const safeLanguageFraction = Math.max(0, Math.min(1, Number(languageFraction) || 0));
            const exactCompleted = Math.min(totalBuildLanguages, safeCompleted + safeLanguageFraction);
            const percent = Number(((exactCompleted / totalBuildLanguages) * 100).toFixed(1));
            const timestamp = nowTime();
            const hasMeaningfulDelta = (percent - lastProgressPercent) >= 0.2;
            const staleEnough = (timestamp - lastProgressTimestamp) >= 120;

            if (!force) {
                if (lastProgressPercent >= 0 && percent <= lastProgressPercent) {
                    return;
                }
                if (!hasMeaningfulDelta && !staleEnough) {
                    return;
                }
            }

            lastProgressPercent = Math.max(lastProgressPercent, percent);
            lastProgressTimestamp = timestamp;

            updateDidYouMeanBuildProgress({
                active: true,
                total: totalBuildLanguages,
                completed: safeCompleted,
                percent,
                currentLanguage,
                stage,
                cacheType,
                startupBlocking,
            }, onProgress);
        };

        for (const lang of buildLanguages) {
            const needsHyphen = hyphenTargetSet.has(lang) && !hyphenReadySet.has(lang);
            const needsDidYouMean = dymTargetSet.has(lang) && !didYouMeanReadySet.has(lang);
            const totalSteps = (needsHyphen ? 1 : 0) + (needsDidYouMean ? 1 : 0);
            const completedBeforeLanguage = completedLanguages;
            const toLanguageFraction = (stepIndex, fraction) => {
                if (totalSteps <= 0) return 1;
                const safeFraction = Math.max(0, Math.min(1, Number(fraction) || 0));
                return (stepIndex + safeFraction) / totalSteps;
            };

            let loadedPayload = null;
            let currentStepIndex = 0;

            if (needsHyphen) {
                emitActiveBuildProgress({
                    completed: completedBeforeLanguage,
                    languageFraction: toLanguageFraction(currentStepIndex, 0),
                    currentLanguage: lang,
                    stage: 'hyphen',
                    cacheType: 'hyphen',
                    force: true,
                });

                try {
                    loadedPayload = loadedPayload || await loadLanguagePayload(lang);
                    await buildHyphenLanguageIndex(lang, loadedPayload, (fraction) => {
                        emitActiveBuildProgress({
                            completed: completedBeforeLanguage,
                            languageFraction: toLanguageFraction(currentStepIndex, fraction),
                            currentLanguage: lang,
                            stage: 'hyphen',
                            cacheType: 'hyphen',
                            force: false,
                        });
                    });
                    hyphenReadySet.add(lang);
                } catch (error) {
                    hyphenFailed[lang] = error?.message || 'build_failed';
                }

                await writeHyphenManifest({
                    appVersion,
                    languagesReady: Array.from(hyphenReadySet),
                    failed: hyphenFailed,
                });

                currentStepIndex += 1;
            }

            if (needsDidYouMean) {
                emitActiveBuildProgress({
                    completed: completedBeforeLanguage,
                    languageFraction: toLanguageFraction(currentStepIndex, 0),
                    currentLanguage: lang,
                    stage: 'didyoumean',
                    cacheType: 'didyoumean',
                    force: true,
                });

                try {
                    loadedPayload = loadedPayload || await loadLanguagePayload(lang);
                    await buildDidYouMeanLanguageIndex(lang, loadedPayload, (fraction) => {
                        emitActiveBuildProgress({
                            completed: completedBeforeLanguage,
                            languageFraction: toLanguageFraction(currentStepIndex, fraction),
                            currentLanguage: lang,
                            stage: 'didyoumean',
                            cacheType: 'didyoumean',
                            force: false,
                        });
                    });
                    didYouMeanReadySet.add(lang);
                } catch (error) {
                    didYouMeanFailed[lang] = error?.message || 'build_failed';
                }

                await writeDidYouMeanManifest({
                    appVersion,
                    languagesReady: Array.from(didYouMeanReadySet),
                    failed: didYouMeanFailed,
                });
            }

            completedLanguages += 1;
            const nextLang = completedLanguages < buildLanguages.length
                ? buildLanguages[completedLanguages]
                : null;
            const nextNeedsHyphen = Boolean(nextLang && hyphenTargetSet.has(nextLang) && !hyphenReadySet.has(nextLang));
            const nextStage = nextLang
                ? (nextNeedsHyphen ? 'hyphen' : 'didyoumean')
                : 'finalizing';

            emitActiveBuildProgress({
                completed: completedLanguages,
                languageFraction: 0,
                currentLanguage: nextLang,
                stage: nextStage,
                cacheType: nextLang ? (nextNeedsHyphen ? 'hyphen' : 'didyoumean') : null,
                force: true,
            });

            if (!startupBlocking) {
                await waitForFrame();
            }
        }

        await writeDidYouMeanManifest({
            appVersion,
            languagesReady: Array.from(didYouMeanReadySet),
            failed: didYouMeanFailed,
        });

        await writeHyphenManifest({
            appVersion,
            languagesReady: Array.from(hyphenReadySet),
            failed: hyphenFailed,
        });

        const missingDidYouMeanAfterBuild = dymTargetLanguages.filter((lang) => !didYouMeanReadySet.has(lang));
        const missingHyphenAfterBuild = hyphenTargetLanguages.filter((lang) => !hyphenReadySet.has(lang));

        updateDidYouMeanBuildProgress({
            active: false,
            total: totalBuildLanguages,
            completed: totalBuildLanguages,
            percent: 100,
            currentLanguage: null,
            stage: 'finalizing',
            cacheType: null,
            startupBlocking,
        }, onProgress);

        const result = {
            ready: missingDidYouMeanAfterBuild.length === 0 && missingHyphenAfterBuild.length === 0,
            built: true,
            missingLanguages: missingDidYouMeanAfterBuild,
            missingDidYouMeanLanguages: missingDidYouMeanAfterBuild,
            missingHyphenLanguages: missingHyphenAfterBuild,
            appVersion,
            algoVersion: DYM_ALGO_VERSION,
            hyphenAlgoVersion: HYPH_ALGO_VERSION,
        };

        emitDidYouMeanReady(result);
        return result;
    })().finally(() => {
        runtimeCachesBuildPromise = null;
    });
    return runtimeCachesBuildPromise;
};

export const ensureDidYouMeanCacheReady = async ({
    allLanguages = true,
    onProgress = null,
} = {}) => ensureRuntimeCachesReady({
    allLanguages,
    onProgress,
    startupBlocking: false,
});

export const getDidYouMeanBuildProgress = () => didYouMeanBuildProgress;

export const loadDidYouMeanCachedIndex = async (lang) => {
    const preferred = asLanguageCode(lang);
    const candidates = Array.from(new Set([preferred, preferred.split('-')[0], 'en']));

    for (const candidate of candidates) {
        const payload = await dymIdbGet(getDidYouMeanIndexKey(candidate));
        if (!payload || !payload.index) continue;
        return {
            lang: payload.lang || candidate,
            index: payload.index,
            version: payload.version || DYM_ALGO_VERSION,
        };
    }

    return null;
};

export const loadHyphenCachedIndex = async (lang) => {
    const preferred = asLanguageCode(lang);
    const candidates = Array.from(new Set([
        preferred,
        preferred.split('-')[0],
        ...RUNTIME_HYPHEN_LANGUAGES,
    ]));

    for (const candidate of candidates) {
        const payload = await hyphenIdbGet(getHyphenIndexKey(candidate));
        if (!payload || !payload.index) continue;
        return {
            lang: payload.lang || candidate,
            index: payload.index,
            version: payload.version || HYPH_ALGO_VERSION,
        };
    }

    return null;
};

export const getDidYouMeanManifest = async () => readDidYouMeanManifest();
export const getHyphenManifest = async () => readHyphenManifest();
