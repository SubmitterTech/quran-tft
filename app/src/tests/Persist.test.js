// What the reader left behind has to come back even when the web view's own store does not
// have it any more, which is the failure these tests stand in for.

const mockFiles = new Map();

jest.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
}));

jest.mock('@capacitor/filesystem', () => ({
    __esModule: true,
    Directory: { LibraryNoCloud: 'LIBRARY_NO_CLOUD' },
    Filesystem: {
        mkdir: () => Promise.resolve(),
        readFile: ({ path }) => {
            if (!mockFiles.has(path)) {
                return Promise.reject(new Error('File does not exist'));
            }
            return Promise.resolve({ data: mockFiles.get(path) });
        },
        writeFile: ({ path, data }) => {
            mockFiles.set(path, data);
            return Promise.resolve();
        },
    },
}));

const PREFS_PATH = 'state/prefs.json';

const loadPersist = () => {
    let module;
    jest.isolateModules(() => {
        module = require('../utils/Persist');
    });
    return module;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// Every start leaves a mark of its own; the tests below are about the reader's values.
const keptValues = () => {
    const { 'qurantft-store-probe': mark, ...rest } = JSON.parse(mockFiles.get(PREFS_PATH)).values;
    return rest;
};

describe('persisted state', () => {
    beforeEach(() => {
        mockFiles.clear();
        localStorage.clear();
        jest.useRealTimers();
    });

    test('writes every kept value to the app’s own file', async () => {
        const { primePersistedState, persistSet, flushPersistedState } = loadPersist();

        await primePersistedState();
        persistSet('qurantft-pn', 137);
        persistSet('qurantft-magnify-st', 'rehberlik');
        await flushPersistedState();

        expect(localStorage.getItem('qurantft-pn')).toBe('137');
        expect(keptValues()).toEqual({
            'qurantft-pn': '137',
            'qurantft-magnify-st': 'rehberlik',
        });
    });

    test('brings the values back when the web view store has lost them', async () => {
        mockFiles.set(PREFS_PATH, JSON.stringify({
            version: 1,
            values: { 'qurantft-pn': '137', 'qurantft-magnify-st': 'rehberlik' },
        }));

        const { primePersistedState } = loadPersist();
        await primePersistedState();

        expect(localStorage.getItem('qurantft-pn')).toBe('137');
        expect(localStorage.getItem('qurantft-magnify-st')).toBe('rehberlik');
    });

    test('the file wins over a store that answers with an older value', async () => {
        localStorage.setItem('qurantft-pn', '136');
        mockFiles.set(PREFS_PATH, JSON.stringify({ version: 1, values: { 'qurantft-pn': '138' } }));

        const { primePersistedState } = loadPersist();
        await primePersistedState();

        expect(localStorage.getItem('qurantft-pn')).toBe('138');
    });

    test('the first start after the update keeps what is already there', async () => {
        localStorage.setItem('qurantft-pn', '42');
        localStorage.setItem('theme', 'dark');

        const { primePersistedState, flushPersistedState } = loadPersist();
        await primePersistedState();
        await flushPersistedState();
        await settle();

        expect(keptValues()).toEqual({
            'qurantft-pn': '42',
            theme: 'dark',
        });
    });

    test('a removal travels to the next start instead of coming back', async () => {
        mockFiles.set(PREFS_PATH, JSON.stringify({ version: 1, values: { 'qurantft-magnify-st': 'rehberlik' } }));

        const first = loadPersist();
        await first.primePersistedState();
        first.persistRemove('qurantft-magnify-st');
        await first.flushPersistedState();

        localStorage.clear();
        const second = loadPersist();
        await second.primePersistedState();

        expect(localStorage.getItem('qurantft-magnify-st')).toBeNull();
    });
});

describe('a store that stops keeping what it is given', () => {
    const PROBE = 'qurantft-store-probe';
    const RESET_MARKER = 'state/reset-web-storage';

    beforeEach(() => {
        mockFiles.clear();
        localStorage.clear();
    });

    const startWith = async (fileValues, health) => {
        mockFiles.set(PREFS_PATH, JSON.stringify({ version: 1, values: fileValues, health }));
        const persist = loadPersist();
        await persist.primePersistedState();
        await persist.flushPersistedState();
        return JSON.parse(mockFiles.get(PREFS_PATH));
    };

    test('a store that kept the mark is left alone', async () => {
        localStorage.setItem(PROBE, 'mark-1');
        const after = await startWith({ [PROBE]: 'mark-1', 'qurantft-pn': '137' }, { starts: 0, resets: 0 });

        expect(after.health).toMatchObject({ starts: 0, resets: 0, pendingClear: false, standIn: 'not-needed' });
        expect(mockFiles.has(RESET_MARKER)).toBe(false);
    });

    test('one start that lost the mark is not enough to clear anything', async () => {
        localStorage.setItem(PROBE, 'stale');
        const after = await startWith({ [PROBE]: 'mark-1', 'qurantft-pn': '137' }, { starts: 0, resets: 0 });

        expect(after.health.starts).toBe(1);
        // A store that lost the mark is not trusted for the rest of the session either.
        expect(after.health.standIn).toBe('installed');
        expect(mockFiles.has(RESET_MARKER)).toBe(false);
    });

    test('the second one asks the native side to clear the store', async () => {
        localStorage.setItem(PROBE, 'stale');
        const after = await startWith({ [PROBE]: 'mark-1', 'qurantft-pn': '137' }, { starts: 1, resets: 0 });

        expect(mockFiles.has(RESET_MARKER)).toBe(true);
        expect(after.health).toMatchObject({ starts: 0, resets: 1, pendingClear: true });
    });

    test('the start after a clearing finds an empty store and puts everything back', async () => {
        const after = await startWith(
            { [PROBE]: 'mark-1', 'qurantft-pn': '137', theme: 'dark' },
            { starts: 0, resets: 1, pendingClear: true },
        );

        expect(localStorage.getItem('qurantft-pn')).toBe('137');
        expect(localStorage.getItem('theme')).toBe('dark');
        // An empty store is what a clearing leaves behind, so this one time it is not held
        // against it.
        expect(after.health).toMatchObject({ starts: 0, resets: 1, pendingClear: false });
        expect(mockFiles.has(RESET_MARKER)).toBe(false);
    });

    test('a store that comes back empty on its own counts against it', async () => {
        // Nothing was asked for, so an empty store is a store that forgot everything.
        const after = await startWith({ [PROBE]: 'mark-1', 'qurantft-pn': '137' }, { starts: 1, resets: 0 });

        expect(mockFiles.has(RESET_MARKER)).toBe(true);
        expect(after.health).toMatchObject({ starts: 0, resets: 1, pendingClear: true });
    });

    test('clearing is not tried for ever', async () => {
        localStorage.setItem(PROBE, 'stale');
        const after = await startWith({ [PROBE]: 'mark-1', 'qurantft-pn': '137' }, { starts: 1, resets: 2 });

        expect(mockFiles.has(RESET_MARKER)).toBe(false);
        expect(after.health).toMatchObject({ starts: 2, resets: 2, pendingClear: false });
    });

    test('every start leaves a new mark in both places', async () => {
        localStorage.setItem(PROBE, 'mark-1');
        const after = await startWith({ [PROBE]: 'mark-1' }, { starts: 0, resets: 0 });

        expect(after.values[PROBE]).not.toBe('mark-1');
        expect(localStorage.getItem(PROBE)).toBe(after.values[PROBE]);
    });
});

describe('a store that takes no writes at all', () => {
    const PROBE = 'qurantft-store-probe';
    let realStorage;

    beforeEach(() => {
        mockFiles.clear();
        localStorage.clear();
        realStorage = window.localStorage;
    });

    afterEach(() => {
        Object.defineProperty(window, 'localStorage', { value: realStorage, configurable: true });
    });

    // The worst kind: reads answer with nothing and writes are refused, which would hand every
    // screen the defaults of a first-time install.
    const breakTheStore = () => {
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: {
                getItem: () => null,
                setItem: () => { throw new Error('store is read only'); },
                removeItem: () => { throw new Error('store is read only'); },
                clear: () => {},
                key: () => null,
                length: 0,
            },
        });
    };

    test('the reader gets what the file knows instead of the defaults', async () => {
        mockFiles.set(PREFS_PATH, JSON.stringify({
            version: 1,
            values: { [PROBE]: 'mark-1', 'qurantft-pn': '137', lang: 'tr' },
            health: { starts: 0, resets: 0, pendingClear: false },
        }));
        breakTheStore();

        const { primePersistedState } = loadPersist();
        await primePersistedState();

        expect(localStorage.getItem('qurantft-pn')).toBe('137');
        expect(localStorage.getItem('lang')).toBe('tr');
    });

    test('what the app writes still reaches the file, and nothing is lost from it', async () => {
        mockFiles.set(PREFS_PATH, JSON.stringify({
            version: 1,
            values: { [PROBE]: 'mark-1', 'qurantft-pn': '137', lang: 'tr' },
            health: { starts: 0, resets: 0, pendingClear: false },
        }));
        breakTheStore();

        const { primePersistedState, persistSet, flushPersistedState } = loadPersist();
        await primePersistedState();
        persistSet('qurantft-pn', 140);
        await flushPersistedState();

        const kept = JSON.parse(mockFiles.get(PREFS_PATH)).values;
        expect(kept['qurantft-pn']).toBe('140');
        expect(kept.lang).toBe('tr');
        expect(localStorage.getItem('qurantft-pn')).toBe('140');
    });
});
