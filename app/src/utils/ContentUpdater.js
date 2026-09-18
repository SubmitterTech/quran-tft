// One pass, once per cold start, in the background: is there newer text for the language on
// screen, and if so, fetch it for the next start.
//
// What it never does: sit in the way of reading. The app reads the copy it already has; this only
// replaces that copy for the next start. A failure here is not an error, it is simply "not today".
//
// Sources are tried in the order ContentSources gives. A failure at the network level ends the
// pass, because that means the device has no working connection and walking the chain would only
// waste four timeouts. A failure at the HTTP level moves to the next source, because that means
// the connection works and this particular source is broken.

import { CapacitorHttp } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import {
    discardStaged,
    getDownloadedRevisions,
    getStagedSize,
    getStagedTarget,
    getState,
    isDownloadSupported,
    isQuarantined,
    prepareStagingDirectory,
    promoteStaged,
    quarantineUnfinished,
    rememberCheckTime,
} from './ContentFiles';
import { getContentSources, getSourceUrl, isAllowedContentUrl } from './ContentSources';

export const CONTENT_UPDATE_PROGRESS_EVENT = 'content:update-progress';
export const CONTENT_UPDATED_EVENT = 'content:updated';

const CHECK_TIMEOUT_MS = 4000;
const DOWNLOAD_CONNECT_TIMEOUT_MS = 10000;
const DOWNLOAD_READ_TIMEOUT_MS = 60000;
const PASS_BUDGET_MS = 90000;

// Everything a language needs to stand on its own.
const UPDATABLE_KINDS = ['quran', 'appendices', 'introduction', 'map', 'application', 'cover'];

// An error page is a few kilobytes of HTML; this is the floor each kind of content stays above.
// Compression means the announced length can be much smaller than the file on disk, so the
// announced size is never compared for equality, only used as a hint.
const MINIMUM_BYTES_BY_KIND = {
    quran: 40000,
    appendices: 10000,
    introduction: 2000,
    map: 10000,
    application: 800,
    cover: 100,
    languages: 200,
};

const minimumBytes = (kind) => MINIMUM_BYTES_BY_KIND[kind] || 1000;

let passStarted = false;

const emitProgress = (progress) => {
    if (typeof window === 'undefined') {
        return;
    }
    window.dispatchEvent(new CustomEvent(CONTENT_UPDATE_PROGRESS_EVENT, {
        detail: {
            active: false,
            percent: 0,
            stage: null,
            currentLanguage: null,
            ...progress,
        },
    }));
};

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

const headerValue = (headers, name) => {
    if (!headers) return '';
    const key = Object.keys(headers).find((header) => header.toLowerCase() === name);
    return key ? String(headers[key] || '') : '';
};

/**
 * Asks one source whether a file changed, without downloading it. Returns the file's current
 * tag and size, or a reason to stop.
 */
const askSource = async (source, kind, lang) => {
    const url = getSourceUrl(source, kind, lang);
    if (!url || !isAllowedContentUrl(url)) {
        return { outcome: 'skip' };
    }

    let response;
    try {
        response = await CapacitorHttp.request({
            url,
            method: 'HEAD',
            connectTimeout: CHECK_TIMEOUT_MS,
            readTimeout: CHECK_TIMEOUT_MS,
        });
    } catch (error) {
        // No connection, or none that reaches this host: the whole pass ends here.
        return { outcome: 'offline' };
    }

    if (response.status !== 200) {
        return { outcome: 'source-broken' };
    }

    const type = headerValue(response.headers, 'content-type');
    const bytes = Number(headerValue(response.headers, 'content-length')) || 0;
    const etag = headerValue(response.headers, 'etag');

    // Our own domains answer a missing file with the app shell, so the type matters more than
    // the status. The repository serves plain text, which is fine.
    // Our own domains answer a missing file with the app shell, so an HTML answer is a broken
    // source, not content. A body far below the floor is the same thing by another route.
    if (type.includes('text/html') || (bytes > 0 && bytes < minimumBytes(kind))) {
        return { outcome: 'source-broken' };
    }

    return { outcome: 'ok', url, etag, bytes };
};

const downloadFile = async (url, kind, name, onProgress) => {
    const target = getStagedTarget(name);
    let listener = null;
    try {
        // The plugin throttles these to every 100ms, so they are cheap enough to pass straight
        // to the progress bar the app already shows for background work.
        listener = await Filesystem.addListener('progress', (status) => {
            if (status?.url === url && status.contentLength > 0) {
                onProgress(status.bytes / status.contentLength);
            }
        });
        await Filesystem.downloadFile({
            url,
            path: target.path,
            directory: target.directory,
            recursive: true,
            progress: true,
            connectTimeout: DOWNLOAD_CONNECT_TIMEOUT_MS,
            readTimeout: DOWNLOAD_READ_TIMEOUT_MS,
        });
    } catch (error) {
        await discardStaged(name);
        return false;
    } finally {
        await listener?.remove?.();
    }

    // The plugin writes whatever arrives, so an error page or an empty answer has to be caught
    // here. Whether it is really our text is settled the first time it is read and parsed.
    const written = await getStagedSize(name);
    if (written < minimumBytes(kind)) {
        await discardStaged(name);
        return false;
    }
    return true;
};

/**
 * Checks one file against the sources and downloads it when it changed.
 * Returns 'offline' when nothing on the network answers, which ends the pass.
 */
const refreshFile = async ({ kind, lang, name, sources, known, onProgress }) => {
    let answer = null;

    for (const source of sources) {
        const result = await askSource(source, kind, lang);
        if (result.outcome === 'offline') {
            return 'offline';
        }
        if (result.outcome === 'ok') {
            answer = { ...result, source };
            break;
        }
    }

    if (!answer || !answer.etag) return 'unavailable';
    if (known[name] === answer.etag) return 'unchanged';
    if (isQuarantined(name, answer.etag)) return 'unchanged';

    const ok = await downloadFile(answer.url, kind, name, onProgress);
    if (!ok) return 'failed';

    const promoted = await promoteStaged(name, {
        etag: answer.etag,
        bytes: answer.bytes,
        source: answer.source.id,
    });
    return promoted ? 'updated' : 'failed';
};

/**
 * Runs the pass. Safe to call on the web and on a device without a connection: it returns
 * without doing anything.
 */
export const runContentUpdateOnce = async ({ language } = {}) => {
    if (passStarted || !isDownloadSupported() || isOffline()) {
        return { ran: false };
    }
    passStarted = true;

    const lang = String(language || 'en').toLowerCase().split('-')[0];
    const startedAt = Date.now();
    const outOfTime = () => (Date.now() - startedAt) > PASS_BUDGET_MS;

    await getState();
    // A file that broke the previous start never gets a second chance.
    await quarantineUnfinished();
    await prepareStagingDirectory();

    const sources = getContentSources(lang);
    const kinds = lang === 'en' ? UPDATABLE_KINDS.filter((kind) => kind !== 'map') : UPDATABLE_KINDS;
    let updated = 0;
    let done = 0;

    // The catalog first: it is tiny and it is what tells us a new language exists at all.
    const steps = [{ kind: 'languages', lang: 'catalog', name: 'languages' }]
        .concat(kinds.map((kind) => ({ kind, lang, name: `${kind}_${lang}` })));

    emitProgress({ active: true, percent: 2, stage: 'content-check', currentLanguage: lang });

    for (const step of steps) {
        if (outOfTime()) break;

        const stepsDone = done;
        const outcome = await refreshFile({
            kind: step.kind,
            lang: step.lang,
            name: step.name,
            sources,
            known: getDownloadedRevisions(),
            onProgress: (fraction) => emitProgress({
                active: true,
                percent: Math.round(((stepsDone + Math.max(0, Math.min(1, fraction))) / steps.length) * 100),
                stage: 'content-download',
                currentLanguage: lang,
            }),
        });

        if (outcome === 'offline') {
            emitProgress({ active: false, percent: 100, stage: 'content-check' });
            await rememberCheckTime(startedAt);
            return { ran: true, updated, offline: true };
        }
        if (outcome === 'updated') {
            updated += 1;
        }

        done += 1;
        emitProgress({
            active: true,
            percent: Math.round((done / steps.length) * 100),
            stage: 'content-check',
            currentLanguage: lang,
        });
    }

    await rememberCheckTime(startedAt);

    // When something was fetched the work is not over: it still has to be put on screen and the
    // indexes built from it refreshed. The channel stays open until the screen says it is done,
    // so the reader sees one bar rather than one closing and another opening behind it.
    emitProgress(updated > 0
        ? { active: true, percent: 95, stage: 'content-apply', currentLanguage: lang }
        : { active: false, percent: 0, stage: 'content-check', currentLanguage: lang });

    if (updated > 0 && typeof window !== 'undefined') {
        // The screens read the new text straight away; there is nothing to gain by holding it
        // back until the next start.
        window.dispatchEvent(new CustomEvent(CONTENT_UPDATED_EVENT, { detail: { language: lang, updated } }));
    }

    return { ran: true, updated };
};
