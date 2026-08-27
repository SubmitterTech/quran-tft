jest.mock('../utils/Device', () => ({
  supportsUnicodeRegex: () => true,
  supportsLookAhead: () => true,
  triggerActionHaptic: jest.fn(),
}));

jest.mock('../utils/Bookmarks', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    remove: jest.fn(),
    set: jest.fn(),
    format: jest.fn(() => ''),
  },
}));

import { getStandaloneAllahWordMatches } from '../components/Verse';
import { getSpecializedGodWordMatches } from '../utils/GodWords';
import quranData from '../assets/qurantft.json';
import quranFa from '../assets/translations/fa/quran_fa.json';
import quranRu from '../assets/translations/ru/quran_ru.json';

describe('getStandaloneAllahWordMatches', () => {
  test('matches standard Allah spelling as a standalone word', () => {
    const matches = getStandaloneAllahWordMatches('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');

    expect(matches).toHaveLength(1);
    expect(matches[0][0]).toBe('ٱللَّهِ');
  });

  test('matches hamza-prefixed Allah spelling used in 27:59 encrypted text', () => {
    const text = 'قُلِ ٱلْحَمْدُ لِلَّهِ وَسَلَٰمٌ عَلَىٰ عِبَادِهِ ٱلَّذِينَ ٱصْطَفَىٰٓ ءَآللَّهُ خَيْرٌ أَمَّا يُشْرِكُونَ';

    const matches = getStandaloneAllahWordMatches(text);

    expect(matches).toHaveLength(2);
    expect(matches[0][0]).toBe('لِلَّهِ');
    expect(matches[1][0]).toBe('ءَآللَّهُ');
  });

  test('matches the alif-hamza form used in 9:65 encrypted text', () => {
    const text = 'وَلَئِن سَأَلْتَهُمْ لَيَقُولُنَّ إِنَّمَا كُنَّا نَخُوضُ وَنَلْعَبُ قُلْ أَبِٱللَّهِ وَءَايَٰتِهِۦ وَرَسُولِهِۦ كُنتُمْ تَسْتَهْزِءُونَ';

    const matches = getStandaloneAllahWordMatches(text);

    expect(matches).toHaveLength(1);
    expect(matches[0][0]).toBe('أَبِٱللَّهِ');
  });
});

describe('specialized GOD word matching', () => {
  test('matches Russian grammatical forms as whole words', () => {
    const text = 'БОГ БОГА БОГУ БОГОМ БОГЕ БОЖЬЕГО БОЖЬИМИ БОЖЕ НЕБОГ';
    const matches = getSpecializedGodWordMatches(text, 'ru', 'test');

    expect(matches.map((match) => match.text)).toEqual([
      'БОГ', 'БОГА', 'БОГУ', 'БОГОМ', 'БОГЕ', 'БОЖЬЕГО', 'БОЖЬИМИ', 'БОЖЕ',
    ]);
  });

  test('keeps valid Persian inflections but excludes known false positives', () => {
    expect(getSpecializedGodWordMatches('خدای یکتا', 'fa', '112:1')).toHaveLength(1);
    expect(getSpecializedGodWordMatches('استخدام', 'fa', '12:54')).toHaveLength(0);
    expect(getSpecializedGodWordMatches('خداحافظی', 'fa', '38:33')).toHaveLength(0);
  });

  test('does not change matching for other languages', () => {
    expect(getSpecializedGodWordMatches('GUDs GUD', 'sv', '3:4')).toBeNull();
  });

  test('matches the corrected Arabic GOD count in every Russian and Persian verse', () => {
    const mismatches = [];
    const totals = { ar: 0, fa: 0, ru: 0, verses: 0 };

    Object.entries(quranData).forEach(([pageNumber, page]) => {
      Object.entries(page.sura || {}).forEach(([suraNumber, sura]) => {
        Object.entries(sura.encrypted || {}).forEach(([verseNumber, arabicText]) => {
          const verseKey = `${suraNumber}:${verseNumber}`;
          const expected = getStandaloneAllahWordMatches(arabicText).length;
          const faText = quranFa[pageNumber]?.sura?.[suraNumber]?.verses?.[verseNumber] || '';
          const ruText = quranRu[pageNumber]?.sura?.[suraNumber]?.verses?.[verseNumber] || '';
          const faCount = getSpecializedGodWordMatches(faText, 'fa', verseKey).length;
          const ruCount = getSpecializedGodWordMatches(ruText, 'ru', verseKey).length;

          totals.ar += expected;
          totals.fa += faCount;
          totals.ru += ruCount;
          totals.verses += 1;

          if (faCount !== expected || ruCount !== expected) {
            mismatches.push({ verseKey, expected, faCount, ruCount });
          }
        });
      });
    });

    expect(mismatches).toEqual([]);
    expect(totals).toEqual({ ar: 2698, fa: 2698, ru: 2698, verses: 6234 });
  }, 20000);
});
