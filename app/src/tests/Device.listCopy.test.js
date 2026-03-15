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

jest.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: jest.fn().mockResolvedValue(undefined)
  },
  ImpactStyle: {
    Light: 'LIGHT'
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

  test('includes notes when the selected verse matches a later ownership ref in the note header', async () => {
    const quranmap = {
      15: {
        1: 'Verse 1',
        9: 'Verse 9',
        n1: '*15:1 & *15:9 note text'
      }
    };

    await listCopy(['15:9'], quranmap);

    expect(getCopiedText()).toBe('[15:9] Verse 9\n\n*15:1 & *15:9 note text');
  });

  test('includes notes when a later ownership ref is not starred', async () => {
    const quranmap = {
      11: {
        40: 'Verse 40',
        44: 'Verse 44',
        n40: '*11:40 & 11:44 note text'
      }
    };

    await listCopy(['11:44'], quranmap);

    expect(getCopiedText()).toBe('[11:44] Verse 44\n\n*11:40 & 11:44 note text');
  });

  test('supports localized connectors in ownership refs', async () => {
    const quranmap = {
      16: {
        115: 'Verse 115',
        118: 'Verse 118',
        n115: '*16:115 \u0438 16:118. note text'
      }
    };

    await listCopy(['16:118'], quranmap);

    expect(getCopiedText()).toBe('[16:118] Verse 118\n\n*16:115 \u0438 16:118. note text');
  });

  test('uses only the leading ownership header when the note body mentions other verses', async () => {
    const quranmap = {
      18: {
        8: 'Verse 8',
        9: 'Verse 9',
        21: 'Verse 21',
        n8: '*18:8-9 As it turns out, the history is directly connected with the end as stated in 18:9 & 18:21.'
      }
    };

    await listCopy(['18:8'], quranmap);
    expect(getCopiedText()).toBe(
      '[18:8] Verse 8\n\n*18:8-9 As it turns out, the history is directly connected with the end as stated in 18:9 & 18:21.'
    );

    await listCopy(['18:9'], quranmap);
    expect(getCopiedText()).toBe(
      '[18:9] Verse 9\n\n*18:8-9 As it turns out, the history is directly connected with the end as stated in 18:9 & 18:21.'
    );

    await listCopy(['18:21'], quranmap);
    expect(getCopiedText()).toBe('[18:21] Verse 21');
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

  test('smartCopy places multi-reference notes after the last matching copied verse in output order', async () => {
    const accumulatedCopiesRef = { current: {} };

    await smartCopy('[15:9]', accumulatedCopiesRef, 'Verse 9', null, '*15:1 & *15:9 note text');
    await smartCopy('[15:1]', accumulatedCopiesRef, 'Verse 1', null, '*15:1 & *15:9 note text');

    expect(getCopiedText()).toBe(
      '[15:9] Verse 9\n\n[15:1] Verse 1\n\n*15:1 & *15:9 note text'
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

  test('smartCopy falls back to execCommand when Clipboard.write fails', async () => {
    Clipboard.write.mockRejectedValueOnce(new Error('clipboard blocked'));

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    const originalExecCommand = document.execCommand;
    const originalNavigatorClipboard = navigator.clipboard;
    document.execCommand = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true
    });

    try {
      const copied = await smartCopy('[2:255]', { current: {} }, 'Ayat text');
      expect(copied).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith('copy');
    } finally {
      consoleErrorSpy.mockRestore();
      document.execCommand = originalExecCommand;
      Object.defineProperty(navigator, 'clipboard', {
        value: originalNavigatorClipboard,
        configurable: true
      });
    }
  });
});
