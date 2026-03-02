import languagesCatalog from '../assets/languages.json';
import baseQuran from '../assets/qurantft.json';
import baseIntroduction from '../assets/introduction.json';
import baseAppendices from '../assets/appendices.json';
import baseApplication from '../assets/application.json';

export const getRandom = () => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return (array[0] % 6234) + 1;
};

const DYM_ALGO_VERSION = 'dym-runtime-v2';
const DYM_SCHEMA_VERSION = 1;
const DYM_DB_NAME = 'quran-tft-cache';
const DYM_DB_VERSION = 1;
const DYM_STORE_NAME = 'didyoumean';
const DYM_MANIFEST_KEY = 'manifest';
const DYM_PROGRESS_EVENT = 'didyoumean:build-progress';
const DYM_READY_EVENT = 'didyoumean:ready';
const DYM_BUILD_PROGRESS_UPDATE_TEXT_EVERY = 96;
const DYM_BUILD_YIELD_TEXT_EVERY = 320;
const DYM_BUILD_YIELD_MIN_INTERVAL_MS = 20;
const DYM_BUILD_PROGRESS_MIN_DELTA = 0.005;

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

let didYouMeanDbPromise = null;
let didYouMeanBuildPromise = null;
let didYouMeanBuildProgress = {
    active: false,
    total: 0,
    completed: 0,
    percent: 0,
    currentLanguage: null,
};

const asLanguageCode = (value) => String(value || 'en').toLowerCase();

const getDidYouMeanIndexKey = (lang) => `index:${asLanguageCode(lang)}`;

const updateDidYouMeanBuildProgress = (progress, onProgress) => {
    didYouMeanBuildProgress = progress;
    if (typeof onProgress === 'function') {
        onProgress(progress);
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(DYM_PROGRESS_EVENT, { detail: progress }));
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

const openDidYouMeanDb = () => {
    if (typeof indexedDB === 'undefined') {
        return Promise.resolve(null);
    }

    if (didYouMeanDbPromise) {
        return didYouMeanDbPromise;
    }

    didYouMeanDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DYM_DB_NAME, DYM_DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(DYM_STORE_NAME)) {
                db.createObjectStore(DYM_STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return didYouMeanDbPromise;
};

const idbGet = async (key) => {
    const db = await openDidYouMeanDb();
    if (!db) return null;

    return new Promise((resolve, reject) => {
        const tx = db.transaction(DYM_STORE_NAME, 'readonly');
        const store = tx.objectStore(DYM_STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
    });
};

const idbSet = async (key, value) => {
    const db = await openDidYouMeanDb();
    if (!db) return;

    await new Promise((resolve, reject) => {
        const tx = db.transaction(DYM_STORE_NAME, 'readwrite');
        const store = tx.objectStore(DYM_STORE_NAME);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const idbHasKey = async (key) => {
    const value = await idbGet(key);
    return value != null;
};

const readDidYouMeanManifest = async () => {
    const manifest = await idbGet(DYM_MANIFEST_KEY);
    return manifest || null;
};

const writeDidYouMeanManifest = async ({
    appVersion,
    languagesReady,
    failed = {},
}) => {
    await idbSet(DYM_MANIFEST_KEY, {
        schemaVersion: DYM_SCHEMA_VERSION,
        appVersion,
        algoVersion: DYM_ALGO_VERSION,
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

const buildDidYouMeanIndex = async ({ lang, quran, introduction, appendices, application, languagesConfig, onProgress = null }) => {
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
        const introContent = (introduction[section].page !== 1 && introduction[section].page !== 22)
            ? introduction[section]
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

    const totalTextEntries = Math.max(textQueue.length, 1);
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
    for (const entry of textQueue) {
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

export const buildDidYouMeanSerializedIndex = async ({
    lang = 'en',
    quran = {},
    introduction = {},
    appendices = {},
    application = {},
    languagesConfig = languagesCatalog,
    onProgress = null,
}) => serializeDidYouMeanIndex(await buildDidYouMeanIndex({
    lang,
    quran,
    introduction,
    appendices,
    application,
    languagesConfig,
    onProgress,
}));

const loadTranslation = async (lang, prefix, fallback) => {
    const normalizedLang = asLanguageCode(lang);
    const module = await import(
        `../assets/translations/${normalizedLang}/${prefix}_${normalizedLang}.json`
    ).catch(() => null);
    return module?.default || fallback;
};

const loadLanguagePayload = async (lang) => {
    const normalizedLang = asLanguageCode(lang);
    if (normalizedLang === 'en') {
        return {
            quran: baseQuran,
            introduction: baseIntroduction,
            appendices: baseAppendices,
            application: baseApplication,
        };
    }

    return {
        quran: await loadTranslation(normalizedLang, 'quran', baseQuran),
        introduction: await loadTranslation(normalizedLang, 'introduction', baseIntroduction),
        appendices: await loadTranslation(normalizedLang, 'appendices', baseAppendices),
        application: await loadTranslation(normalizedLang, 'application', baseApplication),
    };
};

const buildDidYouMeanLanguageIndex = async (lang, onProgress = null) => {
    const report = (fraction) => {
        if (typeof onProgress !== 'function') return;
        const normalized = Math.max(0, Math.min(1, Number(fraction) || 0));
        onProgress(normalized);
    };

    report(0.02);
    const payload = await loadLanguagePayload(lang);
    report(0.12);
    const serializedIndex = await buildDidYouMeanSerializedIndex({
        lang,
        quran: payload.quran,
        introduction: payload.introduction,
        appendices: payload.appendices,
        application: payload.application,
        onProgress: (fraction) => {
            report(0.12 + (Math.max(0, Math.min(1, fraction)) * 0.82));
        },
    });
    report(0.95);

    await idbSet(getDidYouMeanIndexKey(lang), {
        lang: asLanguageCode(lang),
        version: DYM_ALGO_VERSION,
        generatedAt: new Date().toISOString(),
        index: serializedIndex,
    });
    report(1);
};

const verifyReusableLanguages = async (languagesReady = []) => {
    const reusable = [];
    for (const lang of languagesReady) {
        const exists = await idbHasKey(getDidYouMeanIndexKey(lang));
        if (exists) reusable.push(asLanguageCode(lang));
    }
    return reusable;
};

export const ensureDidYouMeanCacheReady = async ({
    allLanguages = true,
    onProgress = null,
} = {}) => {
    if (didYouMeanBuildPromise) {
        if (typeof onProgress === 'function') {
            onProgress(didYouMeanBuildProgress);
        }
        return didYouMeanBuildPromise;
    }

    didYouMeanBuildPromise = (async () => {
        const appVersion = getRuntimeBuildSignature();
        const targetLanguages = allLanguages ? RUNTIME_DYM_LANGUAGES : ['en'];
        const targetSet = new Set(targetLanguages.map(asLanguageCode));
        const manifest = await readDidYouMeanManifest();

        const manifestMatches = Boolean(
            manifest
            && manifest.schemaVersion === DYM_SCHEMA_VERSION
            && manifest.algoVersion === DYM_ALGO_VERSION
            && String(manifest.appVersion || '') === String(appVersion),
        );

        const reusableLanguages = manifestMatches
            ? await verifyReusableLanguages(manifest.languagesReady || [])
            : [];
        const readySet = new Set(reusableLanguages.map(asLanguageCode));
        const missingLanguages = targetLanguages.filter((lang) => !readySet.has(asLanguageCode(lang)));
        const failed = {};

        if (missingLanguages.length === 0) {
            updateDidYouMeanBuildProgress({
                active: false,
                total: targetLanguages.length,
                completed: targetLanguages.length,
                percent: 100,
                currentLanguage: null,
            }, onProgress);
            const result = {
                ready: true,
                built: false,
                missingLanguages: [],
                appVersion,
                algoVersion: DYM_ALGO_VERSION,
            };
            emitDidYouMeanReady(result);
            return result;
        }

        let completed = 0;
        const totalBuildLanguages = missingLanguages.length;
        let lastProgressPercent = -1;
        let lastProgressTimestamp = 0;
        const nowTime = () => {
            if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
                return performance.now();
            }
            return Date.now();
        };
        const emitActiveBuildProgress = (completedLanguages, languageFraction = 0, currentLanguage = null, force = false) => {
            const safeCompleted = Math.max(0, Math.min(totalBuildLanguages, Number(completedLanguages) || 0));
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
            }, onProgress);
        };

        emitActiveBuildProgress(completed, 0, missingLanguages[0], true);

        for (const lang of missingLanguages) {
            emitActiveBuildProgress(completed, 0, lang, true);

            try {
                const completedBeforeLanguage = completed;
                await buildDidYouMeanLanguageIndex(lang, (languageFraction) => {
                    emitActiveBuildProgress(completedBeforeLanguage, languageFraction, lang, false);
                });
                readySet.add(asLanguageCode(lang));
            } catch (error) {
                failed[lang] = error?.message || 'build_failed';
            }

            completed += 1;
            await writeDidYouMeanManifest({
                appVersion,
                languagesReady: Array.from(readySet),
                failed,
            });

            emitActiveBuildProgress(
                completed,
                0,
                completed < missingLanguages.length ? missingLanguages[completed] : null,
                true,
            );

            await waitForFrame();
        }

        updateDidYouMeanBuildProgress({
            active: false,
            total: missingLanguages.length,
            completed: missingLanguages.length,
            percent: 100,
            currentLanguage: null,
        }, onProgress);

        await writeDidYouMeanManifest({
            appVersion,
            languagesReady: Array.from(readySet),
            failed,
        });

        const missingAfterBuild = Array.from(targetSet).filter((lang) => !readySet.has(lang));
        const result = {
            ready: missingAfterBuild.length === 0,
            built: true,
            missingLanguages: missingAfterBuild,
            appVersion,
            algoVersion: DYM_ALGO_VERSION,
        };
        emitDidYouMeanReady(result);
        return result;
    })().finally(() => {
        didYouMeanBuildPromise = null;
    });

    return didYouMeanBuildPromise;
};

export const getDidYouMeanBuildProgress = () => didYouMeanBuildProgress;

export const loadDidYouMeanCachedIndex = async (lang) => {
    const preferred = asLanguageCode(lang);
    const candidates = Array.from(new Set([preferred, 'en']));
    for (const candidate of candidates) {
        const payload = await idbGet(getDidYouMeanIndexKey(candidate));
        if (!payload || !payload.index) continue;
        return {
            lang: payload.lang || candidate,
            index: payload.index,
            version: payload.version || DYM_ALGO_VERSION,
        };
    }
    return null;
};

export const getDidYouMeanManifest = async () => readDidYouMeanManifest();
