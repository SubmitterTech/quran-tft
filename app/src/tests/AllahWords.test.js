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
});
