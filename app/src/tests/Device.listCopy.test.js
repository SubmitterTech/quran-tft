import { listCopy, smartCopy } from '../utils/Device';
import { Clipboard } from '@capacitor/clipboard';

jest.mock('@capacitor/clipboard', () => ({
  Clipboard: {
    write: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('@capacitor/device', () => ({
  Device: {
    getInfo: jest.fn(),
    getLanguageCode: jest.fn()
  }
}));

jest.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    getInfo: jest.fn(),
    setStyle: jest.fn(),
    setBackgroundColor: jest.fn()
  },
  Style: {
    Light: 'Light',
    Dark: 'Dark'
  }
}));

jest.mock('@capacitor/screen-orientation', () => ({
  ScreenOrientation: {
    lock: jest.fn(),
    unlock: jest.fn()
  }
}));

const getCopiedText = () => {
  const calls = Clipboard.write.mock.calls;
  return calls[calls.length - 1][0].string;
};

describe('listCopy note placement', () => {
  beforeEach(() => {
    Clipboard.write.mockClear();
  });

  test('places a ranged note after the last selected verse in range', async () => {
    const quranmap = {
      50: {
        23: 'Verse 23',
        24: 'Verse 24',
        n23: '*50:23-28 note text'
      }
    };

    await listCopy(['50:24', '50:23'], quranmap);

    expect(getCopiedText()).toBe(
      '[50:23] Verse 23\n\n[50:24] Verse 24\n\n*50:23-28 note text'
    );
  });

  test('places a ranged note after range end when selection extends beyond range', async () => {
    const quranmap = {
      50: {
        23: 'Verse 23',
        24: 'Verse 24',
        25: 'Verse 25',
        26: 'Verse 26',
        27: 'Verse 27',
        28: 'Verse 28',
        29: 'Verse 29',
        n23: '*50:23-28 note text'
      }
    };

    await listCopy(['50:23', '50:24', '50:25', '50:26', '50:27', '50:28', '50:29'], quranmap);
    const copied = getCopiedText();

    expect(copied.indexOf('[50:28] Verse 28')).toBeLessThan(copied.indexOf('*50:23-28 note text'));
    expect(copied.indexOf('*50:23-28 note text')).toBeLessThan(copied.indexOf('[50:29] Verse 29'));
  });

  test('supports double-asterisk references even if note is attached to another verse key', async () => {
    const quranmap = {
      2: {
        2: 'Verse 2',
        3: 'Verse 3',
        n2: '**2:3 note text'
      }
    };

    await listCopy(['2:3'], quranmap);

    expect(getCopiedText()).toBe('[2:3] Verse 3\n\n**2:3 note text');
  });

  test('smartCopy places ranged notes after the last copied verse within the formula range', async () => {
    const accumulatedCopiesRef = { current: {} };

    await smartCopy('[50:23]', accumulatedCopiesRef, 'Verse 23', null, '*50:23-28 note text');
    await smartCopy('[50:24]', accumulatedCopiesRef, 'Verse 24', null, '*50:23-28 note text');
    await smartCopy('[50:27]', accumulatedCopiesRef, 'Verse 27', null, '*50:23-28 note text');
    await smartCopy('[50:31]', accumulatedCopiesRef, 'Verse 31', null, null);

    expect(getCopiedText()).toBe(
      '[50:23] Verse 23\n\n[50:24] Verse 24\n\n[50:27] Verse 27\n\n*50:23-28 note text\n\n[50:31] Verse 31'
    );
  });

  test('smartCopy detects formula even when the first token is not the verse formula', async () => {
    const accumulatedCopiesRef = { current: {} };

    await smartCopy('[50:23]', accumulatedCopiesRef, 'Verse 23', null, 'Note: *50:23-28 note text');
    await smartCopy('[50:27]', accumulatedCopiesRef, 'Verse 27', null, 'Note: *50:23-28 note text');

    expect(getCopiedText()).toBe(
      '[50:23] Verse 23\n\n[50:27] Verse 27\n\nNote: *50:23-28 note text'
    );
  });
});
