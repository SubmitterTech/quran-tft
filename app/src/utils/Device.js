import { Device } from '@capacitor/device';
import { Clipboard } from '@capacitor/clipboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

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

export const setStatusBarStyle = async (theme, bgc, styleMode = null) => {
  const normalizedTheme = (theme || '').toLowerCase();
  const fallbackStyle = (normalizedTheme === 'light' || normalizedTheme === 'leaf' || normalizedTheme === 'pink') ? 'light' : 'dark';
  const normalizedStyle = (styleMode || fallbackStyle).toLowerCase();
  const st = normalizedStyle === 'light' ? Style.Light : Style.Dark;

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

export const triggerActionHaptic = async () => {
  if (!isNativePlatform) {
    await initPlatform();
  }

  if (!isNativePlatform) {
    return false;
  }

  try {
    await Haptics.impact({ style: ImpactStyle.Light });
    return true;
  } catch (_error) {
    return false;
  }
};

const writeToNavigatorClipboard = async (text) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_error) {
    return false;
  }
};

const writeWithExecCommand = (text) => {
  if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  const selection = typeof document.getSelection === 'function' ? document.getSelection() : null;
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch (_error) {
    return false;
  } finally {
    document.body.removeChild(textarea);
    if (selection) {
      selection.removeAllRanges();
      if (previousRange) {
        selection.addRange(previousRange);
      }
    }
  }
};

const writeToClipboard = async (text) => {
  const normalizedText = String(text ?? '');

  try {
    await Clipboard.write({
      string: normalizedText
    });
    return true;
  } catch (err) {
    console.error('Failed to copy text via Capacitor Clipboard, trying fallbacks: ', err);
  }

  if (await writeToNavigatorClipboard(normalizedText)) {
    return true;
  }

  return writeWithExecCommand(normalizedText);
};

const smartCopyState = new WeakMap();
const NOTE_REFERENCE_AT_START = /^(?:\*+\s*)?(\d+):(\d+(?:-\d+)?(?:,\s*\d+(?:-\d+)?)*)/u;
const NOTE_REFERENCE_STARRED_ANYWHERE = /\*+\s*\d+:\d+/u;
const NOTE_REFERENCE_START_LINE = /^\s*\*+\s*\d+:\d+(?:-\d+)?/;
const VERSE_REFERENCE = /(\d+):(\d+)/;
const NOTE_REFERENCE_CONNECTOR = /^(?:[&;,/]|and(?=\s)|v(?:e|\u0259)(?=\s)|und(?=\s)|et(?=\s)|en(?=\s)|y(?=\s)|\u0438(?=\s)|\u0648(?=\s))/iu;

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

const expandVerseFormula = (sura, verseFormula) => {
  return verseFormula.split(',').map((segment) => {
    const normalizedSegment = segment.trim();
    const [startValue, endValue] = normalizedSegment.split('-').map((value) => parseInt(value, 10));
    const startVerse = startValue;
    const endVerse = Number.isFinite(endValue) ? endValue : startValue;
    return {
      sura: parseInt(sura, 10),
      startVerse,
      endVerse
    };
  }).filter(({ sura: parsedSura, startVerse, endVerse }) => {
    return Number.isFinite(parsedSura) && Number.isFinite(startVerse) && Number.isFinite(endVerse);
  });
};

const skipWhitespace = (text, fromIndex) => {
  let cursor = fromIndex;
  while (cursor < text.length && /\s/u.test(text[cursor])) {
    cursor += 1;
  }
  return cursor;
};

const extractNoteOwnershipReferencesAtStart = (noteText) => {
  if (typeof noteText !== 'string') {
    return [];
  }

  const normalizedText = noteText.trimStart();
  const initialMatch = normalizedText.match(NOTE_REFERENCE_AT_START);
  if (!initialMatch) {
    return [];
  }

  const references = [
    ...expandVerseFormula(initialMatch[1], initialMatch[2])
  ];
  let cursor = initialMatch[0].length;

  while (cursor < normalizedText.length) {
    cursor = skipWhitespace(normalizedText, cursor);

    const directReferenceMatch = normalizedText.slice(cursor).match(NOTE_REFERENCE_AT_START);
    if (directReferenceMatch) {
      references.push(...expandVerseFormula(directReferenceMatch[1], directReferenceMatch[2]));
      cursor += directReferenceMatch[0].length;
      continue;
    }

    const connectorMatch = normalizedText.slice(cursor).match(NOTE_REFERENCE_CONNECTOR);
    if (!connectorMatch) {
      break;
    }

    cursor += connectorMatch[0].length;
    cursor = skipWhitespace(normalizedText, cursor);
    const nextReferenceMatch = normalizedText.slice(cursor).match(NOTE_REFERENCE_AT_START);
    if (!nextReferenceMatch) {
      break;
    }

    references.push(...expandVerseFormula(nextReferenceMatch[1], nextReferenceMatch[2]));
    cursor += nextReferenceMatch[0].length;
  }

  return references;
};

const extractNoteOwnershipReferences = (noteText) => {
  const referencesAtStart = extractNoteOwnershipReferencesAtStart(noteText);
  if (referencesAtStart.length > 0) {
    return referencesAtStart;
  }

  if (typeof noteText !== 'string') {
    return [];
  }

  const starredMatchIndex = noteText.search(NOTE_REFERENCE_STARRED_ANYWHERE);
  if (starredMatchIndex === -1) {
    return [];
  }

  return extractNoteOwnershipReferencesAtStart(noteText.slice(starredMatchIndex));
};

const getNotePlacement = (noteText, fallbackSura, fallbackVerse, verseEntries) => {
  const references = extractNoteOwnershipReferences(noteText);

  if (references.length === 0) {
    const fallbackEntry = verseEntries.find((entry) => entry.sura === fallbackSura && entry.verse === fallbackVerse);
    if (!fallbackEntry) {
      return null;
    }
    return { sura: fallbackSura, verse: fallbackVerse };
  }

  let placement = null;
  verseEntries.forEach((entry) => {
    const matchesReference = references.some(({ sura, startVerse, endVerse }) => {
      return entry.sura === sura && entry.verse >= startVerse && entry.verse <= endVerse;
    });

    if (matchesReference) {
      placement = { sura: entry.sura, verse: entry.verse };
    }
  });

  return placement;
};

const buildNotesByInsertPoint = (notes, verseEntries) => {
  const notesByInsertPoint = new Map();

  notes.forEach(({ text, fallbackSura, fallbackVerse }) => {
    const placement = getNotePlacement(text, fallbackSura, fallbackVerse, verseEntries);
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

  const notesByInsertPoint = buildNotesByInsertPoint(
    Array.from(copySession.notes.values()),
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

  const orderedEntries = sortedList.map((key) => {
    const { sura, verse } = parseVerseKey(key);
    return { key, sura, verse };
  });

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

        const placement = getNotePlacement(singleNote, fallbackSura, fallbackVerse, orderedEntries);
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
