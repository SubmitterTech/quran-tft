import {
    BASE_CONTENT_LANGUAGE,
    getContent,
    getContentLanguages,
    getContentRevisions,
    getContentWithFallback,
    releaseContent,
} from '../utils/ContentStore';

describe('ContentStore', () => {
    test('reads a content file and keeps it in memory', async () => {
        const first = await getContent('quran', 'tr');
        const second = await getContent('quran', 'tr');

        expect(first['23'].sura['1'].verses['1']).toEqual(expect.any(String));
        // The same object, so a second reader never pays for the file again.
        expect(second).toBe(first);
    });

    test('callers asking at the same time share one read', async () => {
        releaseContent('de');
        const [first, second] = await Promise.all([
            getContent('quran', 'de'),
            getContent('quran', 'de'),
        ]);

        expect(second).toBe(first);
    });

    test('releaseContent hands the memory back', async () => {
        const first = await getContent('appendices', 'fr');
        releaseContent('fr');
        const second = await getContent('appendices', 'fr');

        expect(second).not.toBe(first);
        expect(second).toEqual(first);
    });

    test('only a couple of languages stay resident, and English is never evicted', async () => {
        const base = await getContent('quran', BASE_CONTENT_LANGUAGE);
        const oldest = await getContent('quran', 'sv');
        await getContent('quran', 'nl');
        await getContent('quran', 'ru');

        expect(await getContent('quran', BASE_CONTENT_LANGUAGE)).toBe(base);
        expect(await getContent('quran', 'sv')).not.toBe(oldest);
    });

    test('a language without content falls back to English', async () => {
        const english = await getContent('quran', BASE_CONTENT_LANGUAGE);

        await expect(getContent('quran', 'hi')).rejects.toThrow(/content_unavailable/);
        expect(await getContentWithFallback('quran', 'hi')).toBe(english);
    });

    test('reports a revision per language so derived caches can be invalidated', async () => {
        const revisions = await getContentRevisions();

        expect(revisions.tr).toEqual(expect.any(String));
        expect(revisions.ta).toEqual(expect.any(String));
        expect(revisions.tr).not.toBe(revisions.ta);
        expect(revisions.ku).toBeUndefined();
    });

    test('lists the languages that actually have a Quran file', async () => {
        const languages = await getContentLanguages();

        expect(languages).toEqual(expect.arrayContaining(['en', 'tr', 'ta']));
        // Listed in the catalog, but no files yet.
        expect(languages).not.toContain('ku');
        expect(languages).not.toContain('hi');
    });
});
