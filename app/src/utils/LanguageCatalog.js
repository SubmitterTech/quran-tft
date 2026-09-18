// The list of languages the app offers.
//
// It starts as the catalog that ships with the build and can grow: a language added after the
// release appears here once its text is actually on the device. That rule is the one the app
// already followed, only stated out loud — a language is offered when it can be read offline,
// so there is never a language in the list that needs a download to open.
//
// Consumers import this instead of the JSON file and keep reading it synchronously.

import bundledLanguages from '../assets/languages.json';
import { getState, isDownloadSupported, readDownloaded } from './ContentFiles';
import { getContentLanguages } from './ContentStore';

const catalog = { ...bundledLanguages };

/**
 * Adds languages that arrived with a content update. Called during bootstrap, before the first
 * render, with the entries whose text is already downloaded.
 */
export const mergeDownloadedLanguages = (remoteCatalog, availableLanguages) => {
    if (!remoteCatalog || typeof remoteCatalog !== 'object') {
        return catalog;
    }

    const available = new Set(availableLanguages || []);
    Object.entries(remoteCatalog).forEach(([code, entry]) => {
        const lang = String(code || '').toLowerCase();
        if (!lang || !entry || typeof entry !== 'object' || !available.has(lang)) {
            // Without text on the device the entry stays as it shipped. The catalog lists
            // languages whose translation has not landed yet, and they must not surface here.
            return;
        }
        if (bundledLanguages[lang]) {
            // A language that ships with the build keeps its own entry; only its completeness
            // figure is worth refreshing.
            if (typeof entry.comp === 'number') {
                catalog[lang] = { ...catalog[lang], comp: entry.comp };
            }
            return;
        }
        if (entry.name && entry.dir) {
            catalog[lang] = entry;
        }
    });

    return catalog;
};

/**
 * Bootstrap step: folds in a catalog that arrived with a content update, limited to the
 * languages whose text is on the device.
 */
export const primeCatalogFromDownloads = async () => {
    if (!isDownloadSupported()) {
        return catalog;
    }
    try {
        const state = await getState();
        const remote = await readDownloaded('languages');
        const downloaded = Object.keys(state?.files || {})
            .filter((name) => name.startsWith('quran_'))
            .map((name) => name.slice('quran_'.length));
        const bundled = await getContentLanguages();
        return mergeDownloadedLanguages(remote, [...bundled, ...downloaded]);
    } catch (error) {
        return catalog;
    }
};

export default catalog;
