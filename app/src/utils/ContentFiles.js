// Content files downloaded onto the device, and the record of what is there.
//
// Only the native apps keep downloaded copies. On the web the service worker cache already plays
// this role, so every function here answers "nothing downloaded" and the app reads the copy that
// ships with the build.
//
// Layout under the app's private directory (iOS: Library without iCloud backup, Android: the
// app's files directory):
//
//   content/state.json          what is downloaded, which revision, which source
//   content/staged/<name>.json  a download that has not been accepted yet
//   content/<name>.json         a file in use
//
// A staged file is only promoted after its size matches what the server announced. Whether it is
// really our text is decided the first time it is read, because that is where it gets parsed
// anyway; a file that fails there is quarantined and the app falls back to the bundled copy.

import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

const DIRECTORY = Directory.LibraryNoCloud;
// The download plugin writes under the app's Documents folder whatever directory it is given,
// so a download lands there first and is moved into place once it has been checked. It stays
// there for seconds, not long enough to reach a backup.
const STAGING_DIRECTORY = Directory.Documents;
const CONTENT_DIR = 'content';
const STAGED_DIR = 'content-staged';
const STATE_PATH = `${CONTENT_DIR}/state.json`;

const EMPTY_STATE = { files: {}, quarantined: {}, trying: null, checkedAt: 0 };

let statePromise = null;
let stateCache = null;

export const isDownloadSupported = () => {
    try {
        return Capacitor.isNativePlatform();
    } catch (error) {
        return false;
    }
};

const filePath = (name) => `${CONTENT_DIR}/${name}.json`;
const stagedPath = (name) => `${STAGED_DIR}/${name}.json`;

const readState = async () => {
    if (!isDownloadSupported()) {
        return { ...EMPTY_STATE };
    }
    try {
        const result = await Filesystem.readFile({ path: STATE_PATH, directory: DIRECTORY, encoding: 'utf8' });
        const parsed = JSON.parse(result.data);
        return {
            ...EMPTY_STATE,
            ...parsed,
            files: parsed?.files || {},
            quarantined: parsed?.quarantined || {},
        };
    } catch (error) {
        return { ...EMPTY_STATE };
    }
};

const writeState = async (state) => {
    stateCache = state;
    statePromise = Promise.resolve(state);
    if (!isDownloadSupported()) {
        return;
    }
    try {
        await Filesystem.mkdir({ path: CONTENT_DIR, directory: DIRECTORY, recursive: true }).catch(() => null);
        await Filesystem.writeFile({
            path: STATE_PATH,
            directory: DIRECTORY,
            encoding: 'utf8',
            data: JSON.stringify(state),
        });
    } catch (error) {
        // Losing the record only means the next start re-downloads; never a reason to fail.
    }
};

export const getState = () => {
    if (!statePromise) {
        statePromise = readState().then((state) => {
            stateCache = state;
            return state;
        });
    }
    return statePromise;
};

/**
 * Address the app should read a content file from: the downloaded copy when there is one,
 * otherwise null so the caller uses the copy inside the app package.
 */
export const getDownloadedUrl = (name) => {
    const entry = stateCache?.files?.[name];
    if (!entry?.uri) {
        return null;
    }
    try {
        return Capacitor.convertFileSrc(entry.uri);
    } catch (error) {
        return null;
    }
};

/**
 * Reads a downloaded file through the web view, which keeps the bytes off the JavaScript bridge.
 */
export const readDownloaded = async (name) => {
    const url = getDownloadedUrl(name);
    if (!url) {
        return null;
    }
    try {
        const response = await fetch(url);
        return response.ok ? await response.json() : null;
    } catch (error) {
        return null;
    }
};

export const getDownloadedRevisions = () => {
    const files = stateCache?.files || {};
    return Object.entries(files).reduce((acc, [name, entry]) => {
        if (entry?.etag) {
            acc[name] = entry.etag;
        }
        return acc;
    }, {});
};

export const isQuarantined = (name, etag) => Boolean(etag) && stateCache?.quarantined?.[name] === etag;

/**
 * Remembers that this file is about to be read for the first time. If the app starts again with
 * the mark still set, the file broke the previous start and is dropped.
 */
export const markTrying = async (name) => {
    const state = await getState();
    if (state.trying === name) {
        return;
    }
    await writeState({ ...state, trying: name });
};

export const clearTrying = async () => {
    const state = await getState();
    if (!state.trying) {
        return;
    }
    await writeState({ ...state, trying: null });
};

/**
 * Drops a downloaded file and refuses that exact version until a newer one appears.
 */
export const quarantine = async (name) => {
    const state = await getState();
    const entry = state.files?.[name];
    const files = { ...state.files };
    delete files[name];
    const quarantined = { ...state.quarantined };
    if (entry?.etag) {
        quarantined[name] = entry.etag;
    }
    await writeState({ ...state, files, quarantined, trying: null });

    if (isDownloadSupported()) {
        await Filesystem.deleteFile({ path: filePath(name), directory: DIRECTORY }).catch(() => null);
    }
};

/**
 * A file left behind by a start that did not finish is dropped before anything reads it.
 */
export const quarantineUnfinished = async () => {
    const state = await getState();
    if (!state.trying) {
        return null;
    }
    const name = state.trying;
    await quarantine(name);
    return name;
};

export const getStagedTarget = (name) => ({ path: stagedPath(name), directory: STAGING_DIRECTORY });

export const prepareStagingDirectory = async () => {
    if (!isDownloadSupported()) {
        return;
    }
    await Filesystem.mkdir({ path: STAGED_DIR, directory: STAGING_DIRECTORY, recursive: true }).catch(() => null);
};

export const getStagedSize = async (name) => {
    if (!isDownloadSupported()) {
        return 0;
    }
    try {
        const stat = await Filesystem.stat({ path: stagedPath(name), directory: STAGING_DIRECTORY });
        return Number(stat?.size) || 0;
    } catch (error) {
        return 0;
    }
};

export const discardStaged = async (name) => {
    if (!isDownloadSupported()) {
        return;
    }
    await Filesystem.deleteFile({ path: stagedPath(name), directory: STAGING_DIRECTORY }).catch(() => null);
};

/**
 * Accepts a staged download: it replaces the file in use and is recorded.
 */
export const promoteStaged = async (name, { etag, bytes, source }) => {
    if (!isDownloadSupported()) {
        return false;
    }

    try {
        await Filesystem.deleteFile({ path: filePath(name), directory: DIRECTORY }).catch(() => null);
        await Filesystem.mkdir({ path: CONTENT_DIR, directory: DIRECTORY, recursive: true }).catch(() => null);
        await Filesystem.rename({
            from: stagedPath(name),
            to: filePath(name),
            directory: STAGING_DIRECTORY,
            toDirectory: DIRECTORY,
        });
        const uri = (await Filesystem.getUri({ path: filePath(name), directory: DIRECTORY }))?.uri;
        const state = await getState();
        const quarantined = { ...state.quarantined };
        delete quarantined[name];
        await writeState({
            ...state,
            quarantined,
            files: { ...state.files, [name]: { etag, bytes, source, uri } },
        });
        return true;
    } catch (error) {
        await discardStaged(name);
        return false;
    }
};

export const rememberCheckTime = async (timestamp) => {
    const state = await getState();
    await writeState({ ...state, checkedAt: timestamp });
};
