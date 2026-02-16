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

export const smartCopy = async (key, accumulatedCopiesRef, verseText, hasTitle = null, hasNotes = null) => {
  const verseKey = `${key} ${verseText}`;
  let accumulatedText = verseKey;
  if (hasTitle && parseInt(key.split(":")[1]) !== 1) {
    accumulatedText = `${hasTitle}\n${accumulatedText}`;
  }

  function normalizeText(text) {
    // Remove all non-ASCII characters
    text = text.replace(/[^\u0020-\u007E]/g, '');
    // Convert to lowercase
    text = text.toLowerCase();
    // Normalize to remove diacritics
    text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, '');
    // Remove all characters except for a-z and 0-9
    text = text.replace(/[^a-z0-9]/g, '');
    return text;
  }

  // Update the current verse copy before checking for notes
  accumulatedCopiesRef.current = {
    ...accumulatedCopiesRef.current,
    [key]: accumulatedText
  };

  if (hasNotes) {
    // Normalize and check the whole current text for notes
    let currentText = Object.values(accumulatedCopiesRef.current).join("\n\n");
    let sourcetext = normalizeText(currentText);
    let notestext = normalizeText(hasNotes);

    if (!sourcetext.includes(notestext)) {
      accumulatedCopiesRef.current[key] += `\n\n${hasNotes}`;
    }
  }

  let textToCopy = "";
  Object.values(accumulatedCopiesRef.current).forEach((txt) => {
    textToCopy += txt + "\n\n";
  });

  return await writeToClipboard(textToCopy);
};

export const listCopy = async (list, quranmap) => {
  const sortedList = list.sort((a, b) => {
    const [suraA, verseA] = a.split(':').map(Number);
    const [suraB, verseB] = b.split(':').map(Number);

    if (suraA !== suraB) {
      return suraA - suraB;
    } else {
      return verseA - verseB;
    }
  });

  let textToCopy = sortedList.map((key) => {
    const [sura, verse] = key.split(':');
    let text = "";

    if (quranmap[sura] && quranmap[sura][`t${verse}`]) {
      text += `${quranmap[sura][`t${verse}`]}\n`;
    }

    text += `[${key}] ${quranmap[sura][verse]}`;

    if (quranmap[sura] && quranmap[sura][`n${verse}`]) {
      text += `\n\n${quranmap[sura][`n${verse}`]}`;
    }

    return text;
  }).join("\n\n");

  return await writeToClipboard(textToCopy);
};
