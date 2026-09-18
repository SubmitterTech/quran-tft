// The small pieces of state the app remembers between launches: the page the reader was on,
// the last search, the chosen language, theme and font, the bookmarks.
//
// On a phone the web view's localStorage is not a safe place to keep them on its own. Its
// writes land in memory and are committed to disk by the browser process a few seconds later,
// so a system that kills the app in the meantime throws them away; and a store that ends up
// damaged keeps answering reads with the values it already holds while silently dropping every
// write, which looks to the reader like the app is frozen in the past. Both were seen in the
// field, on devices that manage processes aggressively.
//
// So on the native apps every value is also written to a file in the app's own directory, which
// is an ordinary, immediate file write with none of that machinery in between. At startup the
// file is read back into localStorage before anything renders, so the rest of the app goes on
// reading localStorage exactly as it always has.
//
// That file is also what makes the repair possible. Every start leaves a mark in both places;
// a start that finds the store answering with an older mark than the file knows it was given
// has caught the store dropping writes. After two such starts the app asks the native side to
// throw the store away before the next web view is built, and the file puts the reader's state
// back into the new one. Clearing a store is only safe because there is a copy of what was in it.

import { Capacitor } from '@capacitor/core';

const STATE_DIR = 'state';
const PREFS_PATH = `${STATE_DIR}/prefs.json`;
// Read by the native side before the web view exists; see MainActivity.
const RESET_MARKER_PATH = `${STATE_DIR}/reset-web-storage`;
const PROBE_KEY = 'qurantft-store-probe';
// One start that loses its mark can be an app that was killed within seconds of opening, which
// is normal. Two in a row is a store that is not taking writes any more.
const STARTS_BEFORE_RESET = 2;
// If clearing the store twice has not made it keep a mark, the trouble is not the store and
// there is nothing to gain by clearing it again.
const MAX_RESETS = 2;
// Long enough to fold a burst of page turns into one write, short enough that leaving the app
// right after a change still catches it.
const WRITE_DELAY_MS = 250;

// A removed key is kept as null so that a removal travels to the next start like any other
// change, instead of the old value coming back from the file.
let values = null;
let writeTimer = null;
let pendingWrite = Promise.resolve();
let listenersAttached = false;
let filesystem = null;
// How the store has been behaving across starts, kept in the same file as the values.
let health = { starts: 0, resets: 0, pendingClear: false, standIn: null };

// Loaded only where there is a file system to talk to, so the web build never carries it.
const getFilesystem = () => {
    if (!filesystem) {
        filesystem = import('@capacitor/filesystem').then((module) => {
            const api = module?.Filesystem ? module : module?.default;
            return { Filesystem: api.Filesystem, directory: api.Directory.LibraryNoCloud };
        });
    }
    return filesystem;
};

const isSupported = () => {
    try {
        return Capacitor.isNativePlatform();
    } catch (error) {
        return false;
    }
};

const readLocal = (key) => {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
};

const writeLocal = (key, value) => {
    try {
        if (value === null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, value);
        }
    } catch (error) {
        // A full or damaged store is exactly what the file is here for.
    }
};

const snapshotLocalStorage = () => {
    const collected = {};
    try {
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key === null) {
                continue;
            }
            const value = localStorage.getItem(key);
            if (typeof value === 'string') {
                collected[key] = value;
            }
        }
    } catch (error) {
        return collected;
    }
    return collected;
};

// Only reached when something went wrong before the file was read, in which case whatever is in
// localStorage is the best picture of the reader's state there is; starting from an empty object
// would write a file that has lost everything else.
const ensureValues = () => {
    if (!values) {
        values = snapshotLocalStorage();
    }
    return values;
};

const writeFile = async () => {
    const data = JSON.stringify({ version: 1, values: { ...values }, health: { ...health } });
    try {
        const { Filesystem, directory } = await getFilesystem();
        await Filesystem.mkdir({ path: STATE_DIR, directory, recursive: true }).catch(() => null);
        await Filesystem.writeFile({
            path: PREFS_PATH,
            directory,
            encoding: 'utf8',
            data,
        });
    } catch (error) {
        // Nothing to do about it here; localStorage still holds the value for this session.
    }
};

const queueWrite = () => {
    pendingWrite = pendingWrite.then(writeFile, writeFile);
    return pendingWrite;
};

const scheduleWrite = () => {
    if (writeTimer !== null) {
        return;
    }
    writeTimer = window.setTimeout(() => {
        writeTimer = null;
        void queueWrite();
    }, WRITE_DELAY_MS);
};

/**
 * Writes whatever is still waiting, without waiting for the timer. Used when the app is about
 * to go away, which is the moment the delayed write would otherwise be lost.
 */
export const flushPersistedState = () => {
    if (!isSupported() || !values) {
        return Promise.resolve();
    }
    if (writeTimer !== null) {
        window.clearTimeout(writeTimer);
        writeTimer = null;
    }
    return queueWrite();
};

const attachListeners = () => {
    if (listenersAttached || typeof window === 'undefined') {
        return;
    }
    listenersAttached = true;
    const flush = () => {
        void flushPersistedState();
    };
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flush();
        }
    });
    window.addEventListener('pagehide', flush);
};

// Leaves the request the native side reads on the next cold start, before it builds a web view.
// Answered by MainActivity on Android and by AppDelegate on iOS; anywhere else the file below is
// what keeps the reader's state right, without the store being touched.
const canResetWebStorage = () => {
    try {
        const platform = Capacitor.getPlatform();
        return platform === 'android' || platform === 'ios';
    } catch (error) {
        return false;
    }
};

const requestWebStorageReset = async () => {
    if (!canResetWebStorage()) {
        return false;
    }
    try {
        const { Filesystem, directory } = await getFilesystem();
        await Filesystem.mkdir({ path: STATE_DIR, directory, recursive: true }).catch(() => null);
        await Filesystem.writeFile({
            path: RESET_MARKER_PATH,
            directory,
            encoding: 'utf8',
            data: 'clear local storage',
        });
        return true;
    } catch (error) {
        return false;
    }
};

// The mark this start hands to both places, so that the next one can tell whether the store
// kept it.
const leaveMark = (mark) => {
    values[PROBE_KEY] = mark;
    writeLocal(PROBE_KEY, mark);
};

// A store can be broken badly enough that it answers reads with nothing and takes no writes at
// all. Every screen reads its starting values from localStorage, so the reader would be handed
// the defaults of a first-time install, and the app would then write those defaults over the good
// values in the file. Rather than let that happen, localStorage is replaced for this session by
// a plain object holding what the file knows. Reads are right again, writes still reach the file,
// and the store itself is left to be thrown away on the next start.
const installMemoryStore = () => {
    const memory = new Map(
        Object.entries(values).filter(([, value]) => typeof value === 'string'),
    );
    const storage = {
        getItem: (key) => (memory.has(String(key)) ? memory.get(String(key)) : null),
        setItem: (key, value) => {
            memory.set(String(key), String(value));
        },
        removeItem: (key) => {
            memory.delete(String(key));
        },
        clear: () => {
            memory.clear();
        },
        key: (index) => {
            const keys = Array.from(memory.keys());
            return index >= 0 && index < keys.length ? keys[index] : null;
        },
        get length() {
            return memory.size;
        },
    };
    try {
        Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Works out whether the store is still keeping what it is given, and asks for it to be thrown
 * away when it is not. Must run before the file is put back, because the evidence is what
 * localStorage held on its own. Returns the mark this start leaves behind, and whether the store
 * failed to give back the one before it.
 */
const judgeStore = async (stored) => {
    const mark = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const expected = stored?.[PROBE_KEY];

    if (!stored || !expected) {
        // The first start that leaves a mark. It says nothing about the store yet.
        health = { ...health, starts: 0 };
        return { mark, lostTheMark: false };
    }

    if (health.pendingClear) {
        // The store was thrown away on purpose before this start, so it is meant to come back
        // without the mark. Asked for once, forgiven once.
        health = { ...health, starts: 0, pendingClear: false };
        return { mark, lostTheMark: false };
    }

    if (readLocal(PROBE_KEY) === expected) {
        health = { ...health, starts: 0 };
        return { mark, lostTheMark: false };
    }

    // The store answered with something other than what it was last given, or with nothing at
    // all. A store that drops writes and a store that forgets everything are equally unusable.
    health = { ...health, starts: health.starts + 1 };
    if (health.starts >= STARTS_BEFORE_RESET && health.resets < MAX_RESETS) {
        if (await requestWebStorageReset()) {
            health = { starts: 0, resets: health.resets + 1, pendingClear: true };
        }
    }
    return { mark, lostTheMark: true };
};

// A store is stood in for as soon as there is any reason to distrust it: it did not give back the
// mark it was left, or it will not even give back the one it was just handed. The first is the
// telling one. A store that lost the last mark can also empty itself again part way through a
// session, after the values have been put back into it and before the screens read them, and then
// every screen would show the defaults of a first-time install and write them over the good values
// in the file. What was decided is kept in the file, because it is the only way to see from the
// outside which kind of trouble a device is in.
const standInForUnusableStore = (mark, lostTheMark) => {
    if (!lostTheMark && readLocal(PROBE_KEY) === mark) {
        health = { ...health, standIn: 'not-needed' };
        return;
    }
    health = { ...health, standIn: installMemoryStore() ? 'installed' : 'refused' };
};

/**
 * Reads the file back into localStorage. Must finish before anything renders, because the
 * screens read their starting values from localStorage while they mount.
 */
export const primePersistedState = async () => {
    if (values) {
        return;
    }
    if (!isSupported()) {
        values = {};
        return;
    }

    let stored = null;
    try {
        const { Filesystem, directory } = await getFilesystem();
        const result = await Filesystem.readFile({ path: PREFS_PATH, directory, encoding: 'utf8' });
        const parsed = JSON.parse(result.data);
        if (parsed && typeof parsed === 'object' && parsed.values && typeof parsed.values === 'object') {
            stored = parsed.values;
            health = {
                starts: Number(parsed.health?.starts) || 0,
                resets: Number(parsed.health?.resets) || 0,
                pendingClear: Boolean(parsed.health?.pendingClear),
                standIn: parsed.health?.standIn || null,
            };
        }
    } catch (error) {
        stored = null;
    }

    attachListeners();

    // Before anything is put back, while localStorage still shows what it kept on its own.
    const { mark, lostTheMark } = await judgeStore(stored);

    if (!stored) {
        // First start after the update: whatever localStorage still holds is the reader's state,
        // and it becomes the first copy of the file.
        values = snapshotLocalStorage();
        leaveMark(mark);
        standInForUnusableStore(mark, false);
        void queueWrite();
        return;
    }

    values = { ...stored };
    Object.entries(stored).forEach(([key, value]) => {
        if (typeof value !== 'string' && value !== null) {
            return;
        }
        if (readLocal(key) !== value) {
            writeLocal(key, value);
        }
    });

    // Keys written before this file existed, or by code that still writes localStorage directly,
    // are taken along rather than dropped on the next write.
    const local = snapshotLocalStorage();
    Object.entries(local).forEach(([key, value]) => {
        if (!(key in values)) {
            values[key] = value;
        }
    });

    leaveMark(mark);
    standInForUnusableStore(mark, lostTheMark);
    void queueWrite();
};

/**
 * Keeps a value: in localStorage for everything that reads it, and in the file so that it
 * survives the app being killed.
 */
export const persistSet = (key, value) => {
    const text = typeof value === 'string' ? value : String(value);
    writeLocal(key, text);
    if (!isSupported()) {
        return;
    }
    ensureValues();
    if (values[key] === text) {
        return;
    }
    values[key] = text;
    scheduleWrite();
};

/**
 * Forgets a value in both places.
 */
export const persistRemove = (key) => {
    writeLocal(key, null);
    if (!isSupported()) {
        return;
    }
    ensureValues();
    if (values[key] === null) {
        return;
    }
    values[key] = null;
    scheduleWrite();
};
