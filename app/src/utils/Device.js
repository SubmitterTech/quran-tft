import { Device } from '@capacitor/device';
import { Clipboard } from '@capacitor/clipboard';

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

    return text;
  }).join("\n\n");

  return await writeToClipboard(textToCopy);
};