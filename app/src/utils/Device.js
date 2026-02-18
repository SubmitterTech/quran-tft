import { Device } from '@capacitor/device';
import { Clipboard } from '@capacitor/clipboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ScreenOrientation } from '@capacitor/screen-orientation';

let hasStatusBarPromise = null;
let isNativePlatform = false;
let platform = 'web';
let initPlatformPromise = null;
const PHONE_SMALLEST_SIDE_THRESHOLD = 600;

export const initPlatform = async () => {
  if (initPlatformPromise) {
    return initPlatformPromise;
  }

  initPlatformPromise = (async () => {
    try {
      const info = await Device.getInfo();
      platform = info?.platform || 'web';
      isNativePlatform = (platform === 'ios' || platform === 'android');
    } catch (error) {
      console.error('Failed to detect platform', error);
      platform = 'web';
      isNativePlatform = false;
    }
  })();

  return initPlatformPromise;
};

export const isNative = () => {
  return isNativePlatform;
};

export const which = () => {
  return platform;
};

const getSmallestScreenSide = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const screenWidth = window.screen?.width;
  const screenHeight = window.screen?.height;
  if (typeof screenWidth === 'number' && typeof screenHeight === 'number' && screenWidth > 0 && screenHeight > 0) {
    return Math.min(screenWidth, screenHeight);
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  if (typeof viewportWidth === 'number' && typeof viewportHeight === 'number' && viewportWidth > 0 && viewportHeight > 0) {
    return Math.min(viewportWidth, viewportHeight);
  }

  return null;
};

const isTabletSizedScreen = () => {
  const smallestScreenSide = getSmallestScreenSide();
  if (smallestScreenSide === null) {
    return false;
  }
  return smallestScreenSide >= PHONE_SMALLEST_SIDE_THRESHOLD;
};

export const applyConditionalOrientationLock = async () => {
  await initPlatform();

  if (!isNativePlatform) {
    return;
  }

  try {
    if (isTabletSizedScreen()) {
      await ScreenOrientation.unlock();
      return;
    }

    await ScreenOrientation.lock({ orientation: 'portrait' });
  } catch (error) {
    console.error('Failed to apply conditional orientation lock', error);
  }
};

export const supportsUnicodeRegex = () => {
  try {
    new RegExp("\\p{L}", "u");
    return true;
  } catch (e) {
    return false;
  }
};

export const supportsLookAhead = () => {
  try {
    new RegExp("(?<=test)test");
    return true;
  } catch (e) {
    return false;
  }
};

export const getDeviceLanguage = async () => {
  const info = await Device.getLanguageCode();
  return info.value;
};

export const setInitialLanguage = async () => {
  const existingLang = localStorage.getItem("lang");
  if (existingLang) {
    return existingLang;
  }
  try {
    const langCode = await getDeviceLanguage();
    localStorage.setItem("lang", langCode);
    return langCode;
  } catch (error) {
    console.error("Failed to get device language", error);
    const fallbackLang = process.env.REACT_APP_DEFAULT_LANG || "en";
    localStorage.setItem("lang", fallbackLang);
    return fallbackLang;
  }
};

export const setStatusBarStyle = async (theme, bgc) => {
  const st = theme === 'light' ? Style.Light : Style.Dark;

  if (hasStatusBarPromise === null) {
    hasStatusBarPromise = (async () => {
      try {
        await StatusBar.getInfo();
        return true;
      } catch (error) {
        return false;
      }
    })();
  }

  const hasStatusBar = await hasStatusBarPromise;

  if (hasStatusBar) {
    await StatusBar.setStyle({ style: st });
    await StatusBar.setBackgroundColor({ color: bgc });
  }
};

const writeToClipboard = async (text) => {
  try {
    await Clipboard.write({
      string: text
    });
    return true;
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
};

const smartCopyState = new WeakMap();
const NOTE_REFERENCE_AT_START = /^\s*\*+\s*(\d+):(\d+)(?:-(\d+))?/;
const NOTE_REFERENCE_STARRED_ANYWHERE = /\*+\s*(\d+):(\d+)(?:-(\d+))?/;
const NOTE_REFERENCE_START_LINE = /^\s*\*+\s*\d+:\d+(?:-\d+)?/;
const VERSE_REFERENCE = /(\d+):(\d+)/;

const parseVerseKey = (key) => {
  const match = String(key).match(VERSE_REFERENCE);
  if (!match) {
    return { sura: NaN, verse: NaN };
  }
  return {
    sura: parseInt(match[1], 10),
    verse: parseInt(match[2], 10)
  };
};

const splitNotesByReference = (noteText) => {
  if (!noteText) return [];

  const lines = noteText.split(/\r?\n/);
  const notes = [];
  let current = "";

  lines.forEach((line) => {
    if (NOTE_REFERENCE_START_LINE.test(line) && current.trim()) {
      notes.push(current.trim());
      current = line;
      return;
    }

    if (!current) {
      current = line;
      return;
    }

    current += `\n${line}`;
  });

  if (current.trim()) {
    notes.push(current.trim());
  }

  return notes;
};

const extractNoteReference = (noteText) => {
  if (typeof noteText !== 'string') {
    return null;
  }

  const starredMatch = noteText.match(NOTE_REFERENCE_STARRED_ANYWHERE);
  if (starredMatch) {
    const noteSura = parseInt(starredMatch[1], 10);
    const startVerse = parseInt(starredMatch[2], 10);
    const endVerse = starredMatch[3] ? parseInt(starredMatch[3], 10) : startVerse;
    return { noteSura, startVerse, endVerse };
  }

  const startMatch = noteText.match(NOTE_REFERENCE_AT_START);
  if (startMatch) {
    const noteSura = parseInt(startMatch[1], 10);
    const startVerse = parseInt(startMatch[2], 10);
    const endVerse = startMatch[3] ? parseInt(startMatch[3], 10) : startVerse;
    return { noteSura, startVerse, endVerse };
  }

  return null;
};

const getNotePlacement = (noteText, fallbackSura, fallbackVerse, selectedBySura) => {
  const reference = extractNoteReference(noteText);

  if (!reference) {
    const selectedVersesInFallbackSura = selectedBySura.get(fallbackSura) || [];
    if (!selectedVersesInFallbackSura.includes(fallbackVerse)) {
      return null;
    }
    return { sura: fallbackSura, verse: fallbackVerse };
  }

  const { noteSura, startVerse, endVerse } = reference;
  const selectedVersesInSura = selectedBySura.get(noteSura) || [];
  const coveredVerses = selectedVersesInSura.filter((verse) => verse >= startVerse && verse <= endVerse);

  if (coveredVerses.length === 0) {
    return null;
  }

  return { sura: noteSura, verse: coveredVerses[coveredVerses.length - 1] };
};

const buildSelectedBySuraMap = (verseEntries) => {
  const selectedBySura = new Map();

  verseEntries.forEach(({ sura, verse }) => {
    if (isNaN(sura) || isNaN(verse)) {
      return;
    }

    if (!selectedBySura.has(sura)) {
      selectedBySura.set(sura, []);
    }
    selectedBySura.get(sura).push(verse);
  });

  selectedBySura.forEach((verses) => verses.sort((a, b) => a - b));
  return selectedBySura;
};

const buildNotesByInsertPoint = (notes, selectedBySura, verseEntries) => {
  const notesByInsertPoint = new Map();

  notes.forEach(({ text, fallbackSura, fallbackVerse }) => {
    const placement = getNotePlacement(text, fallbackSura, fallbackVerse, selectedBySura);
    if (!placement) {
      return;
    }

    const targetEntry = verseEntries.find(
      (entry) => entry.sura === placement.sura && entry.verse === placement.verse
    );

    if (!targetEntry) {
      return;
    }

    if (!notesByInsertPoint.has(targetEntry.key)) {
      notesByInsertPoint.set(targetEntry.key, []);
    }
    notesByInsertPoint.get(targetEntry.key).push(text);
  });

  return notesByInsertPoint;
};

export const smartCopy = async (key, accumulatedCopiesRef, verseText, hasTitle = null, hasNotes = null) => {
  const parsedCurrentVerse = parseVerseKey(key);
  const verseKey = `${key} ${verseText}`;
  let accumulatedText = verseKey;

  if (hasTitle && parsedCurrentVerse.verse !== 1) {
    accumulatedText = `${hasTitle}\n${accumulatedText}`;
  }

  if (!accumulatedCopiesRef.current || Object.keys(accumulatedCopiesRef.current).length === 0) {
    accumulatedCopiesRef.current = {};
    smartCopyState.set(accumulatedCopiesRef, { notes: new Map() });
  }

  const copySession = smartCopyState.get(accumulatedCopiesRef) || { notes: new Map() };
  if (!smartCopyState.has(accumulatedCopiesRef)) {
    smartCopyState.set(accumulatedCopiesRef, copySession);
  }

  accumulatedCopiesRef.current = {
    ...accumulatedCopiesRef.current,
    [key]: accumulatedText
  };

  if (hasNotes) {
    splitNotesByReference(hasNotes).forEach((singleNote) => {
      const normalizedNote = singleNote.replace(/\s+/g, ' ').trim();
      if (!normalizedNote || copySession.notes.has(normalizedNote)) {
        return;
      }

      copySession.notes.set(normalizedNote, {
        text: singleNote,
        fallbackSura: parsedCurrentVerse.sura,
        fallbackVerse: parsedCurrentVerse.verse
      });
    });
  }

  const orderedEntries = Object.keys(accumulatedCopiesRef.current).map((entryKey) => {
    const { sura, verse } = parseVerseKey(entryKey);
    return {
      key: entryKey,
      sura,
      verse,
      text: accumulatedCopiesRef.current[entryKey]
    };
  });

  const selectedBySura = buildSelectedBySuraMap(orderedEntries);
  const notesByInsertPoint = buildNotesByInsertPoint(
    Array.from(copySession.notes.values()),
    selectedBySura,
    orderedEntries
  );

  const blocks = orderedEntries.map(({ key: entryKey, text }) => {
    const notesForEntry = notesByInsertPoint.get(entryKey);
    if (!notesForEntry || notesForEntry.length === 0) {
      return text;
    }
    return `${text}\n\n${notesForEntry.join('\n\n')}`;
  });

  const textToCopy = blocks.join("\n\n");
  return await writeToClipboard(textToCopy);
};

export const listCopy = async (list, quranmap) => {
  const sortedList = [...list].sort((a, b) => {
    const [suraA, verseA] = a.split(':').map(Number);
    const [suraB, verseB] = b.split(':').map(Number);

    if (suraA !== suraB) {
      return suraA - suraB;
    } else {
      return verseA - verseB;
    }
  });

  const selectedBySura = new Map();
  sortedList.forEach((key) => {
    const { sura, verse } = parseVerseKey(key);
    if (!selectedBySura.has(sura)) {
      selectedBySura.set(sura, []);
    }
    selectedBySura.get(sura).push(verse);
  });

  selectedBySura.forEach((verses) => verses.sort((a, b) => a - b));

  const notesByInsertPoint = new Map();
  const seenNotes = new Set();

  Object.entries(quranmap).forEach(([suraKey, suraMap]) => {
    const fallbackSura = parseInt(suraKey, 10);
    if (!suraMap || isNaN(fallbackSura)) return;

    Object.entries(suraMap).forEach(([noteKey, noteText]) => {
      if (!noteKey.startsWith('n') || typeof noteText !== 'string' || !noteText.trim()) {
        return;
      }

      const fallbackVerse = parseInt(noteKey.slice(1), 10);
      if (isNaN(fallbackVerse)) return;

      splitNotesByReference(noteText).forEach((singleNote) => {
        const normalizedNote = singleNote.replace(/\s+/g, ' ').trim();
        if (!normalizedNote || seenNotes.has(normalizedNote)) {
          return;
        }

        const placement = getNotePlacement(singleNote, fallbackSura, fallbackVerse, selectedBySura);
        if (!placement) {
          return;
        }

        const insertKey = `${placement.sura}:${placement.verse}`;
        if (!notesByInsertPoint.has(insertKey)) {
          notesByInsertPoint.set(insertKey, []);
        }
        notesByInsertPoint.get(insertKey).push(singleNote);
        seenNotes.add(normalizedNote);
      });
    });
  });

  const blocks = sortedList.map((key) => {
    const [sura, verse] = key.split(':');
    let text = "";

    if (quranmap[sura] && quranmap[sura][`t${verse}`]) {
      text += `${quranmap[sura][`t${verse}`]}\n`;
    }

    text += `[${key}] ${quranmap[sura][verse]}`;
    const notes = notesByInsertPoint.get(key);
    if (notes && notes.length > 0) {
      text += `\n\n${notes.join('\n\n')}`;
    }

    return text;
  });

  const textToCopy = blocks.join("\n\n");

  return await writeToClipboard(textToCopy);
};
