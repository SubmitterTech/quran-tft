import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from '../utils/Device';

const bookmarksKey = 'bookmarks';
const BACKUP_DIR = Directory.Data;
const BACKUP_PATH = 'backups/bookmarks.json';
const SCHEMA_VERSION = 2;

// ---------- utils ----------
const timestampRegex = /^(\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2}:\d{2})$/;

const parseJSON = (value) => {
    try { return JSON.parse(value); }
    catch (error) { console.error('Error parsing JSON:', error); return {}; }
};

const format = (timestamp) => {
    if (/^\d+$/.test(String(timestamp).trim())) {
        const d = new Date(parseInt(timestamp, 10));
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = d.getFullYear();
        const HH = String(d.getHours()).toString().padStart(2, '0');
        const MM = String(d.getMinutes()).toString().padStart(2, '0');
        const SS = String(d.getSeconds()).toString().padStart(2, '0');
        return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
    }
    return timestamp;
};

const toEpoch = (s) => {
    if (!s) return 0;
    if (/^\d+$/.test(String(s))) return Number(s);
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return 0;
    const [, dd, mm, yyyy, HH, MM, SS] = m.map(Number);
    return new Date(yyyy, mm - 1, dd, HH, MM, SS).getTime();
};

const toEpochSafe = (entry) => {
    const ts = entry && typeof entry === 'object' ? entry.timestamp : entry;
    return ts ? toEpoch(ts) : 0;
};

// Deterministic, newest-first ordering for UI + stable JSON output.
const sortByTimestampDesc = (map) => {
    const sortedEntries = Object.entries(map || {}).sort(([ka, va], [kb, vb]) => {
        const da = toEpochSafe(va);
        const db = toEpochSafe(vb);
        if (db !== da) return db - da;               // newer first
        return String(ka).localeCompare(String(kb)); // stable order when equal
    });
    return Object.fromEntries(sortedEntries);
};

const latestLocalEpoch = (obj) => {
    let max = 0;
    Object.values(obj || {}).forEach((v) => {
        const t = v && typeof v === 'object' ? v.timestamp : v;
        max = Math.max(max, toEpoch(t));
    });
    return max;
};

// Normalize legacy entries (string -> {value|null, timestamp})
const normalizeMap = (obj) => {
    const out = {};
    let changed = false;
    Object.entries(obj || {}).forEach(([k, v]) => {
        if (v && typeof v === 'object' && 'timestamp' in v) {
            // Ensure schema invariant: value must be string|null
            const next = { ...v };

            if (next.value === undefined) next.value = null; // defensive
            if (next.value !== null && typeof next.value !== 'string') {
                next.value = String(next.value);
                changed = true;
            }

            // Optional: normalize timestamp spacing if someone saved "dd/mm/yyyy  HH:MM:SS"
            if (typeof next.timestamp === 'string') {
                const fixedTs = next.timestamp.replace(timestampRegex, '$1 $2');
                if (fixedTs !== next.timestamp) {
                    next.timestamp = fixedTs;
                    changed = true;
                }
            }

            out[k] = next;
        } else {
            const raw = typeof v === 'string' ? v.trim() : '';
            if (!raw) return;
            if (timestampRegex.test(raw)) {
                out[k] = { value: null, timestamp: raw.replace(timestampRegex, '$1 $2') };
            } else {
                out[k] = { value: format(raw), timestamp: format(Date.now()) };
            }
            changed = true;
        }
    });
    return { map: out, changed };
};

const buildPayload = (data) => ({
    schema: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    bookmarks: data,
});

// ---------- FS helpers (native only) ----------
const readBackupFile = async () => {
    if (!isNative()) return null;
    try {
        const res = await Filesystem.readFile({ path: BACKUP_PATH, directory: BACKUP_DIR, encoding: 'utf8' });
        return JSON.parse(res.data);
    } catch { return null; }
};

const ensureBackupFolder = async () => {
    if (!isNative()) return;
    try {
        await Filesystem.mkdir({ path: 'backups', directory: BACKUP_DIR, recursive: true });
    } catch { /* already exists */ }
};

const writeBackupFile = async (payload) => {
    if (!isNative()) return;
    await ensureBackupFolder();
    await Filesystem.writeFile({
        path: BACKUP_PATH,
        directory: BACKUP_DIR,
        data: JSON.stringify(payload),
        encoding: 'utf8',
    });
};

// ---------- state ----------
let bookmarks = sortByTimestampDesc(parseJSON(localStorage.getItem(bookmarksKey)) || {});
let subscribers = {};
let initialized = false;

// ---------- reconciliation ----------
const reconcile = async () => {
    // Always normalize local (covers legacy web users too)
    const localRaw = parseJSON(localStorage.getItem(bookmarksKey)) || {};
    const { map: local, changed: localChanged } = normalizeMap(localRaw);
    const localEpoch = latestLocalEpoch(local);

    if (!isNative()) {
        bookmarks = sortByTimestampDesc(local);
        if (localChanged) localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
        return;
    }

    // Native: compare with backup file
    const backup = await readBackupFile();
    const { map: backupMap, changed: backupChanged } = normalizeMap(backup?.bookmarks || {});
    const backupEpoch = backup?.updatedAt
        ? Date.parse(backup.updatedAt)
        : latestLocalEpoch(backupMap) || 0;

    if (backup && backupMap && backupEpoch > localEpoch) {
        bookmarks = sortByTimestampDesc(backupMap);
        localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
        if (backupChanged) await writeBackupFile(buildPayload(bookmarks));
    } else if (localEpoch > 0) {
        bookmarks = sortByTimestampDesc(local);
        if (localChanged) localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
        await writeBackupFile(buildPayload(bookmarks));
    } else if (backup && backupMap) {
        bookmarks = sortByTimestampDesc(backupMap);
        localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
        if (backupChanged) await writeBackupFile(buildPayload(bookmarks));
    } else {
        bookmarks = {};
    }
};

// ---------- persistence ----------
const persistAll = async () => {
    localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
    if (isNative()) {
        try { await writeBackupFile(buildPayload(bookmarks)); } catch { /* ignore */ }
    }
};

// ---------- public API (original) ----------
const subscribe = (verseKey, callback) => {
    if (!subscribers[verseKey]) subscribers[verseKey] = [];
    subscribers[verseKey].push(callback);
};

const unsubscribe = (verseKey, callback) => {
    if (subscribers[verseKey]) {
        subscribers[verseKey] = subscribers[verseKey].filter(cb => cb !== callback);
        if (subscribers[verseKey].length === 0) delete subscribers[verseKey];
    }
};

const notifySubscribers = (verseKey) => {
    if (subscribers[verseKey]) {
        subscribers[verseKey].forEach(callback => callback(bookmarks[verseKey]));
    }
};

const get = (verseKey) => {
    if (Object.prototype.hasOwnProperty.call(bookmarks, verseKey)) {
        const bookmark = bookmarks[verseKey];
        return bookmark?.value !== null ? bookmark.value : bookmark?.timestamp ?? null;
    }
    return null;
};

const set = (verseKey, value) => {
    const safeValue = (value === null || value === undefined) ? '' : String(value);
    const trimmedValue = safeValue.trim();
    const currentTimestamp = format(Date.now());
    const normalizedValue = trimmedValue ? trimmedValue.replace(timestampRegex, "$1 $2") : '';

    if (bookmarks[verseKey]) {
        if (normalizedValue === bookmarks[verseKey].timestamp) {
            bookmarks[verseKey] = { value: null, timestamp: currentTimestamp };
        } else {
            bookmarks[verseKey] = { value: trimmedValue ? safeValue : null, timestamp: currentTimestamp };
        }
    } else {
        bookmarks[verseKey] = { value: trimmedValue ? safeValue : null, timestamp: currentTimestamp };
    }

    bookmarks = sortByTimestampDesc(bookmarks);
    persistAll().then(() => notifySubscribers(verseKey));
};

const remove = async (verseKey) => {
    const bookmark = bookmarks[verseKey];
    if (bookmark && bookmark.value) {
        const confirmed = await new Promise((resolve) => {
            const event = new CustomEvent('bookmarks:confirm-delete', {
                detail: { data: { key: verseKey, value: bookmark.value }, resolve }
            });
            window.dispatchEvent(event);
        });
        if (!confirmed) return;
    }
    delete bookmarks[verseKey];
    bookmarks = sortByTimestampDesc(bookmarks);
    await persistAll();
    notifySubscribers(verseKey);
};

const all = () => {
    const result = {};
    Object.entries(bookmarks).forEach(([key, bookmark]) => {
        result[key] = bookmark?.value !== null ? bookmark?.value : bookmark?.timestamp ?? null;
    });
    return result;
};

// Cross-tab sync (web only effect; harmless on native)
window.addEventListener('storage', (event) => {
    if (event.key === bookmarksKey) {
        bookmarks = sortByTimestampDesc(parseJSON(event.newValue) || {});
        Object.keys(subscribers).forEach(verseKey => notifySubscribers(verseKey));
    }
});

// ---------- lifecycle & helpers ----------
export const init = async () => {
    if (initialized) return;
    initialized = true;
    await reconcile();
};

export const restoreFromBackup = async () => {
    if (!isNative()) return false; // web: use Import JSON instead
    const backup = await readBackupFile();
    if (backup && backup.bookmarks) {
        const { map } = normalizeMap(backup.bookmarks);
        bookmarks = sortByTimestampDesc(map);
        await persistAll();
        Object.keys(subscribers).forEach(verseKey => notifySubscribers(verseKey));
        return true;
    }
    return false;
};

/**
 * Export a single JSON file. On native, opens Share sheet; on web, downloads a file.
 * Provide translated UI strings via params.
 * @param {Object} opts
 * @param {string} [opts.shareTitle='Bookmarks backup']
 * @param {string} [opts.shareText='Save this JSON backup.']
 * @param {string} [opts.shareDialogTitle='Share backup']
 * @param {string} [opts.fileBaseName='bookmarks'] - base name for the file (extension added automatically)
 */
export const exportToUserFile = async ({
    shareTitle = 'Bookmarks backup',
    shareText = 'Save this JSON backup.',
    shareDialogTitle = 'Share backup',
    fileBaseName = 'bookmarks',
} = {}) => {
    const { map: sanitized } = normalizeMap(bookmarks || {});
    const payload = buildPayload(sanitized);
    const content = JSON.stringify(payload, null, 2);
    const fileName = `${fileBaseName}-${Date.now()}.json`;

    if (isNative()) {
        await Filesystem.writeFile({
            path: fileName,
            directory: Directory.Cache,
            data: content,
            encoding: 'utf8',
        });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({
            title: shareTitle,
            text: shareText,
            url: uri,
            dialogTitle: shareDialogTitle,
        });
    } else {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    }
};

/**
 * Preview an import (SMART merge). No changes applied.
 * Strictly validates the file is one of *our* exports:
 *  - Top-level keys are exactly: schema, updatedAt, bookmarks
 *  - schema === SCHEMA_VERSION
 *  - updatedAt is a valid ISO date
 *  - bookmarks is an object with <= 6500 entries
 *  - each entry is { value: string|null, timestamp: "dd/mm/yyyy HH:MM:SS" } and timestamp parses
 *
 * Returns:
 *   { ok: true, stats: { totalIncoming, added, updatedNewer, skippedOlder, unchanged } }
 * or:
 *   { ok: false, error: string }
 */
export const previewImportFile = async (file) => {
    // small helper
    const isPlainObject = (x) => !!x && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype;
    const SAFE_KEYS = new Set(['schema', 'updatedAt', 'bookmarks']);
    const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    const MAX_BOOKMARKS = 6500;

    let payload;
    try {
        const text = await file.text();
        payload = JSON.parse(text);
    } catch {
        return { ok: false, error: 'Could not read file.' };
    }

    // ----- top-level shape -----
    if (!isPlainObject(payload)) return { ok: false, error: 'Invalid backup file.' };
    const topKeys = Object.keys(payload);
    if (topKeys.length !== 3 || topKeys.some(k => !SAFE_KEYS.has(k))) {
        return { ok: false, error: 'Invalid backup file (unexpected structure).' };
    }

    // schema must match
    if (payload.schema !== SCHEMA_VERSION) {
        return { ok: false, error: 'Backup schema version is not supported.' };
    }

    // updatedAt must be a valid, parseable date
    if (typeof payload.updatedAt !== 'string' || Number.isNaN(Date.parse(payload.updatedAt))) {
        return { ok: false, error: 'Backup updatedAt is invalid.' };
    }

    // bookmarks object & size limit
    const bm = payload.bookmarks;
    if (!isPlainObject(bm)) {
        return { ok: false, error: 'Invalid backup file (bookmarks missing).' };
    }
    const bmKeys = Object.keys(bm);
    if (bmKeys.length > MAX_BOOKMARKS) {
        return { ok: false, error: 'Backup contains too many bookmarks.' };
    }

    // ----- entries must match our export shape exactly -----
    for (const k of bmKeys) {
        if (typeof k !== 'string' || RESERVED_KEYS.has(k)) {
            return { ok: false, error: 'Backup contains unsafe or invalid keys.' };
        }
        const v = bm[k];
        if (!isPlainObject(v)) {
            return { ok: false, error: 'Backup entry has invalid shape.' };
        }
        const vKeys = Object.keys(v);
        if (vKeys.length !== 2 || !vKeys.includes('value') || !vKeys.includes('timestamp')) {
            return { ok: false, error: 'Backup entry has unexpected fields.' };
        }

        // value must be string or null
        if (!(typeof v.value === 'string' || v.value === null)) {
            return { ok: false, error: 'Backup entry value type is invalid.' };
        }

        // timestamp must match our dd/mm/yyyy HH:MM:SS and be parseable
        if (typeof v.timestamp !== 'string' || !timestampRegex.test(v.timestamp)) {
            return { ok: false, error: 'Backup entry timestamp format is invalid.' };
        }
        const epoch = toEpoch(v.timestamp);
        if (!Number.isFinite(epoch)) {
            return { ok: false, error: 'Backup entry timestamp is not parseable.' };
        }
        // sanity: not absurdly in the future (allow a small clock skew)
        const FUTURE_SLOP_MS = 5 * 60 * 1000;
        if (epoch > Date.now() + FUTURE_SLOP_MS) {
            return { ok: false, error: 'Backup entry timestamp is in the future.' };
        }
    }

    // ----- compute SMART preview stats against current local state -----
    const incoming = bm; // already strictly validated to our exported shape
    const { map: current } = normalizeMap(bookmarks || {});

    let added = 0, updatedNewer = 0, skippedOlder = 0, unchanged = 0;

    for (const [k, inc] of Object.entries(incoming)) {
        const cur = current[k];
        if (!cur) { added++; continue; }

        if ((cur.value === inc.value) && (cur.timestamp === inc.timestamp)) {
            unchanged++; continue;
        }

        const ei = toEpochSafe(inc);
        const ec = toEpochSafe(cur);
        if (ei > ec) updatedNewer++; else skippedOlder++;
    }

    return {
        ok: true,
        stats: {
            totalIncoming: bmKeys.length,
            added,
            updatedNewer,
            skippedOlder,
            unchanged
        }
    };
};

/**
 * Import bookmarks from a JSON file.
 * Default: Smart merge (newest wins per key, adds missing, keeps others).
 * Returns { ok, stats } and is truthy for simple boolean checks.
 */
export const importFromUserFile = async (file) => {
    try {
        const text = await file.text();
        const payload = JSON.parse(text);
        if (!payload?.bookmarks || typeof payload.bookmarks !== 'object') {
            return { ok: false, error: 'Invalid backup file format.' };
        }

        const { map: incoming } = normalizeMap(payload.bookmarks);
        const current = { ...bookmarks };

        // SMART MERGE (newest wins)
        const next = { ...current };
        let added = 0, updatedNewer = 0, skippedOlder = 0, unchanged = 0;

        Object.entries(incoming).forEach(([k, inc]) => {
            const cur = current[k];
            if (!cur) { next[k] = inc; added++; return; }

            if (JSON.stringify(cur) === JSON.stringify(inc)) { unchanged++; return; }

            const ei = toEpochSafe(inc), ec = toEpochSafe(cur);
            if (ei > ec) { next[k] = inc; updatedNewer++; }
            else if (ei < ec) { /* keep current */ skippedOlder++; }
            else {
                // equal timestamps but different content → favor import (user intent)
                next[k] = inc; updatedNewer++;
            }
        });

        const changedKeys = new Set();
        const allKeys = new Set([...Object.keys(current), ...Object.keys(next)]);
        allKeys.forEach((k) => {
            if (JSON.stringify(current[k]) !== JSON.stringify(next[k])) changedKeys.add(k);
        });

        bookmarks = sortByTimestampDesc(next);
        await persistAll();

        // notify value changes (note: pure reorders won't hit this)
        changedKeys.forEach((k) => notifySubscribers(k));


        return {
            ok: true,
            stats: {
                totalIncoming: Object.keys(incoming).length,
                added, updatedNewer, skippedOlder, unchanged
            }
        };
    } catch {
        return { ok: false, error: 'Could not read file.' };
    }
};

const Bookmarks = {
    subscribe,
    unsubscribe,
    get,
    set,
    remove,
    all,
    format,
    init,
    restoreFromBackup,
    exportToUserFile,
    previewImportFile,
    importFromUserFile,
};

export default Bookmarks;
