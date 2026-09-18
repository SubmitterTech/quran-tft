import quranTr from '../assets/translations/tr/quran_tr.json';
import applicationTr from '../assets/translations/tr/application_tr.json';
import { getContentSources, getSourceUrl, isAllowedContentUrl } from '../utils/ContentSources';
import { isContentShaped } from '../utils/ContentStore';
import { mergeDownloadedLanguages } from '../utils/LanguageCatalog';

describe('content sources', () => {
    test('leaves our own platform right after the first source', () => {
        const order = getContentSources('de').map((source) => source.id);

        expect(order[0]).toBe('primary');
        // GitHub comes before the sibling domain: whatever takes one Cloudflare property down
        // usually takes the other one with it.
        expect(order.indexOf('jsdelivr')).toBeLessThan(order.indexOf('mirror'));
        expect(order.indexOf('raw')).toBeLessThan(order.indexOf('mirror'));
    });

    test('Turkish starts from the Turkish site', () => {
        expect(getContentSources('tr')[0].id).toBe('mirror');
        expect(getContentSources('tr-TR')[0].id).toBe('mirror');
        expect(getContentSources('tr').map((s) => s.id).sort()).toEqual(
            getContentSources('de').map((s) => s.id).sort(),
        );
    });

    test('addresses follow the layout of each source', () => {
        const [primary, jsdelivr] = getContentSources('de');

        expect(getSourceUrl(primary, 'quran', 'tr')).toBe('https://qurantft.com/content/quran_tr.json');
        expect(getSourceUrl(primary, 'languages')).toBe('https://qurantft.com/content/languages.json');
        // The repository keeps the translators' files, which the sync writes.
        expect(getSourceUrl(jsdelivr, 'quran', 'tr')).toContain('/app/src/assets/translations/tr/quran_tr.json');
        expect(getSourceUrl(jsdelivr, 'quran', 'en')).toContain('/app/src/assets/qurantft.json');
    });

    test('only our own hosts are followed', () => {
        expect(isAllowedContentUrl('https://qurantft.com/content/quran_tr.json')).toBe(true);
        expect(isAllowedContentUrl('https://raw.githubusercontent.com/x/y/main/a.json')).toBe(true);
        expect(isAllowedContentUrl('https://example.com/content/quran_tr.json')).toBe(false);
        expect(isAllowedContentUrl('not a url')).toBe(false);
    });
});

describe('content shape check', () => {
    test('accepts the real files', () => {
        expect(isContentShaped('quran', quranTr)).toBe(true);
        expect(isContentShaped('application', applicationTr)).toBe(true);
    });

    test('rejects an error page, a truncated file and an empty answer', () => {
        // What a single page app returns for a missing file, once parsed as far as it goes.
        expect(isContentShaped('quran', { html: '<!doctype html>' })).toBe(false);
        // A download that stopped early: the pages it did get are real, but there are too few.
        const truncated = Object.fromEntries(Object.entries(quranTr).slice(0, 12));
        expect(isContentShaped('quran', truncated)).toBe(false);
        expect(isContentShaped('quran', null)).toBe(false);
        expect(isContentShaped('application', { gw: 'TANRI' })).toBe(false);
    });
});

describe('language catalog', () => {
    test('a language added later appears only once its text is on the device', () => {
        const remote = {
            ur: { name: 'اردو ترجمہ', comp: 42, dir: 'rtl', nums: '0 1 2' },
            bn: { name: 'বাংলা অনুবাদ', comp: 10, dir: 'ltr' },
        };

        const catalog = mergeDownloadedLanguages(remote, ['ur']);

        expect(catalog.ur).toEqual(remote.ur);
        expect(catalog.bn).toBeUndefined();
    });

    test('bundled languages keep their entry and only refresh their completeness', () => {
        const catalog = mergeDownloadedLanguages({ tr: { name: 'Sahte', comp: 99, dir: 'rtl' } }, ['tr']);

        expect(catalog.tr.comp).toBe(99);
        expect(catalog.tr.dir).toBe('ltr');
        expect(catalog.tr.name).not.toBe('Sahte');
    });

    test('a catalog entry whose translation has not landed stays hidden', () => {
        // The shipped catalog already lists these with no text behind them.
        const catalog = mergeDownloadedLanguages({ hi: { name: 'x', comp: 80, dir: 'ltr' } }, []);

        expect(catalog.hi.comp).toBe(0);
    });

    test('ignores junk', () => {
        expect(mergeDownloadedLanguages(null, [])).toBeTruthy();
        expect(mergeDownloadedLanguages({ xx: 'not an object' }, ['xx']).xx).toBeUndefined();
    });
});
