#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const INDEX_VERSION = 'dym-prebuilt-v1';
const SECTION_MAX_BYTES = {
  frequency: 900000,
  byLength: 650000,
  surfaceForms: 900000,
  searchableTexts: 1000000,
  bigramFrequency: 900000,
  trigramFrequency: 900000,
};

const ROOT_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'src', 'assets');
const TRANSLATIONS_DIR = path.join(ASSETS_DIR, 'translations');
const OUTPUT_DIR = path.join(ROOT_DIR, 'src', 'generated', 'didyoumean-indexes');
const LEGACY_PUBLIC_OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'didyoumean-indexes');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const languages = readJson(path.join(ASSETS_DIR, 'languages.json'));
const baseQuran = readJson(path.join(ASSETS_DIR, 'qurantft.json'));
const baseIntroduction = readJson(path.join(ASSETS_DIR, 'introduction.json'));
const baseAppendices = readJson(path.join(ASSETS_DIR, 'appendices.json'));
const baseApplication = readJson(path.join(ASSETS_DIR, 'application.json'));

const isWordChar = (ch) => {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  if (c >= 0x30 && c <= 0x39) return true;
  if (ch.toUpperCase() !== ch.toLowerCase()) return true;
  if (c >= 0x0621 && c <= 0x064A) return true;
  if (c >= 0x066E && c <= 0x06D3) return true;
  if (c >= 0x05D0 && c <= 0x05EA) return true;
  if (c >= 0x4E00 && c <= 0x9FFF) return true;
  if (c >= 0x0900 && c <= 0x0DFF) return true;
  if (c >= 0x0E00 && c <= 0x0E7F) return true;
  return false;
};

const splitQuerySegments = (text) => {
  const segments = [];
  if (!text) return segments;

  let current = '';
  let mode = null;
  for (const ch of String(text)) {
    const nextMode = isWordChar(ch) ? 'word' : 'sep';
    if (mode === null || mode === nextMode) {
      current += ch;
      mode = nextMode;
    } else {
      segments.push({ type: mode, value: current });
      current = ch;
      mode = nextMode;
    }
  }
  if (current) segments.push({ type: mode, value: current });
  return segments;
};

const foldRtlScript = (value) => {
  if (value == null) return value;
  return String(value)
    .replace(/[\u0640\u200c\u200d]/g, '')
    .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[ئى]/g, 'ی')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ةۀ]/g, 'ه');
};

const mapAppendices = (appendices, translationApplication) => {
  const appendixMap = {};
  let currentAppendixNum = 1;
  let globalContentOrder = 1;

  (appendices || []).forEach((page) => {
    if (page.page < 397) {
      return;
    }
    const allContentItems = [];

    Object.entries(page.titles || {}).forEach(([key, title]) => {
      allContentItems.push({
        type: 'title',
        content: title,
        key: parseInt(key, 10),
      });
    });

    const collectContent = (type, data, pageno) => {
      Object.entries(data || {}).forEach(([key, value]) => {
        if (value) {
          allContentItems.push({
            type,
            content: value,
            key: parseInt(key, 10),
            page: pageno,
          });
        }
      });
    };

    collectContent('text', page.text, page.page);
    collectContent('evidence', page.evidence, page.page);
    collectContent('table', page.table, page.page);
    collectContent('picture', page.picture, page.page);

    allContentItems.sort((a, b) => a.key - b.key);
    allContentItems.forEach((item) => {
      item.order = globalContentOrder++;
      if (item.type === 'title') {
        const appx = translationApplication ? translationApplication.appendix : 'Appendix';
        const match = item.content.match(new RegExp(`${appx}\\s*(\\d+)`));
        if (/\d+/.test(item.content) && match) {
          currentAppendixNum = match[1];
        }
      }
      if (!appendixMap[currentAppendixNum]) {
        appendixMap[currentAppendixNum] = { content: [] };
      }
      appendixMap[currentAppendixNum].content.push(item);
    });
  });

  Object.values(appendixMap).forEach((appendix) => {
    appendix.content.sort((a, b) => a.order - b.order);
  });

  return appendixMap;
};

const getLanguageDigits = (lang) => {
  const cfg = languages[lang] || languages.en || {};
  const nums = cfg.nums || '0 1 2 3 4 5 6 7 8 9';
  return nums.split(/\s+/).filter(Boolean);
};

const createSuggestionFold = (lang) => {
  const cfg = languages[lang] || languages.en || {};
  const isRtl = cfg.dir === 'rtl';

  return (text) => {
    let t = String(text || '');
    if (isRtl) {
      t = foldRtlScript(t);
    }
    if (lang === 'tr' || lang === 'az') {
      t = t.replace(/[İIıi]/g, 'i');
    }
    t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    t = t.toLocaleUpperCase(lang || 'en');
    return t;
  };
};

const TURKIC_SUFFIXES = [
  'LERİ', 'LARI', 'LERI', 'LARİ',
  'LER', 'LAR',
  'NIN', 'NİN', 'NUN', 'NÜN',
  'DAN', 'DEN', 'TAN', 'TEN',
  'YI', 'Yİ', 'YU', 'YÜ',
  'NI', 'Nİ', 'NU', 'NÜ',
  'IN', 'İN', 'UN', 'ÜN',
  'SI', 'Sİ', 'SU', 'SÜ',
  'IM', 'İM', 'UM', 'ÜM',
  'M',
];
const SINGLE_SUFFIXES = ['I', 'İ', 'U', 'Ü', 'A', 'E'];

const buildStemVariants = (token, lang) => {
  const isTurkic = lang === 'tr' || lang === 'az';
  if (!isTurkic || !token || token.length < 5) return [];

  const stems = new Set();
  const queue = [{ value: token, depth: 0 }];
  while (queue.length > 0) {
    const { value, depth } = queue.shift();
    if (depth >= 2) continue;

    TURKIC_SUFFIXES.forEach((suffix) => {
      if (!value.endsWith(suffix)) return;
      const stem = value.slice(0, -suffix.length);
      if (stem.length < 4 || stem === token || stems.has(stem)) return;
      stems.add(stem);
      queue.push({ value: stem, depth: depth + 1 });
    });

    if (value.length >= 7) {
      SINGLE_SUFFIXES.forEach((suffix) => {
        if (!value.endsWith(suffix)) return;
        const stem = value.slice(0, -suffix.length);
        if (stem.length < 4 || stem === token || stems.has(stem)) return;
        stems.add(stem);
        queue.push({ value: stem, depth: depth + 1 });
      });
    }
  }
  return Array.from(stems);
};

const buildIndex = ({ lang, quran, introduction, appendices, application }) => {
  const searchFold = createSuggestionFold(lang);
  const langDigits = getLanguageDigits(lang);
  const digitSet = new Set(langDigits);

  const hasAnyDigitLocal = (s) => {
    if (s == null) return false;
    if (/\d/.test(s)) return true;
    for (const ch of String(s)) if (digitSet.has(ch)) return true;
    return false;
  };

  const frequency = new Map();
  const surfaceForms = new Map();
  const searchableTextSet = new Set();
  const bigramFrequency = new Map();
  const trigramFrequency = new Map();

  const addToken = (token, weight = 1) => {
    if (!token || token.length < 2) return;
    if (hasAnyDigitLocal(token)) return;
    frequency.set(token, (frequency.get(token) || 0) + weight);
  };

  const addSurfaceForm = (foldedToken, originalToken, weight = 1) => {
    if (!foldedToken || foldedToken.length < 2 || !originalToken) return;
    if (hasAnyDigitLocal(foldedToken)) return;
    if (!surfaceForms.has(foldedToken)) {
      surfaceForms.set(foldedToken, new Map());
    }
    const variants = surfaceForms.get(foldedToken);
    variants.set(originalToken, (variants.get(originalToken) || 0) + weight);
  };

  const addText = (text, includeInSearchHitCheck = true) => {
    if (text == null) return;
    const sourceText = String(text);
    const foldedText = searchFold(sourceText);
    const trimmedText = foldedText.trim();
    if (includeInSearchHitCheck && trimmedText.length > 1) {
      searchableTextSet.add(trimmedText);
    }

    const wordTokens = [];
    splitQuerySegments(sourceText).forEach((segment) => {
      if (segment.type !== 'word') return;
      const foldedToken = searchFold(segment.value);
      if (!foldedToken || foldedToken.length < 2) return;

      addToken(foldedToken, 1);
      addSurfaceForm(foldedToken, segment.value, 1);
      buildStemVariants(foldedToken, lang).forEach((stem) => {
        addToken(stem, 0.42);
        addSurfaceForm(stem, segment.value, 0.42);
      });
      if (!hasAnyDigitLocal(segment.value)) {
        wordTokens.push(foldedToken);
      }
    });

    for (let i = 0; i < wordTokens.length - 1; i++) {
      const key = `${wordTokens[i]} ${wordTokens[i + 1]}`;
      bigramFrequency.set(key, (bigramFrequency.get(key) || 0) + 1);
    }
    for (let i = 0; i < wordTokens.length - 2; i++) {
      const key = `${wordTokens[i]} ${wordTokens[i + 1]} ${wordTokens[i + 2]}`;
      trigramFrequency.set(key, (trigramFrequency.get(key) || 0) + 1);
    }
  };

  Object.keys(quran || {}).forEach((page) => {
    const suras = quran[page].sura || {};
    Object.keys(suras).forEach((suraNumber) => {
      const verses = suras[suraNumber].verses || {};
      Object.keys(verses).forEach((verseNumber) => {
        addText(verses[verseNumber]);
      });

      const titles = suras[suraNumber].titles || {};
      Object.keys(titles).forEach((titleNumber) => {
        addText(titles[titleNumber]);
      });
    });

    const notes = quran[page].notes?.data;
    if (notes && notes.length > 0) {
      Object.values(notes).forEach((note) => addText(note));
    }
  });

  Object.keys(introduction || {}).forEach((section) => {
    const introContent = (introduction[section].page !== 1 && introduction[section].page !== 22)
      ? introduction[section]
      : null;
    if (!introContent) return;

    Object.entries(introContent).forEach(([type, content]) => {
      if (type === 'page') return;
      if (content && typeof content === 'object') {
        Object.values(content).forEach((value) => addText(value));
      } else {
        addText(content);
      }
    });
  });

  const appendixMap = mapAppendices(appendices, application);
  Object.keys(appendixMap || {}).forEach((appx) => {
    const appxContent = appendixMap[appx].content || [];
    appxContent
      .filter((element) => (
        element.type === 'text'
        || element.type === 'title'
        || (element.type === 'table' && element.content.ref && element.content.ref.trim() !== '')
      ))
      .forEach((element) => {
        const appendixText = element.type === 'table'
          ? element.content.ref.toString()
          : element.content.toString();
        addText(appendixText);
      });
  });

  if (application && typeof application === 'object') {
    Object.values(application).forEach((value) => {
      if (typeof value === 'string') {
        addText(value, false);
      }
    });
  }

  const byLength = new Map();
  frequency.forEach((_count, token) => {
    const len = token.length;
    if (!byLength.has(len)) byLength.set(len, []);
    byLength.get(len).push(token);
  });

  return {
    frequency,
    byLength,
    surfaceForms,
    searchableTexts: Array.from(searchableTextSet),
    bigramFrequency,
    trigramFrequency,
  };
};

const serializeIndex = (index) => ({
  frequency: Array.from(index.frequency.entries()),
  byLength: Array.from(index.byLength.entries()),
  surfaceForms: Array.from(index.surfaceForms.entries())
    .map(([token, variants]) => [token, Array.from(variants.entries())]),
  searchableTexts: index.searchableTexts,
  bigramFrequency: Array.from(index.bigramFrequency.entries()),
  trigramFrequency: Array.from(index.trigramFrequency.entries()),
});

const chunkArrayBySize = (items, maxBytes) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const chunks = [];
  let current = [];
  let currentSize = 2; // []

  items.forEach((item) => {
    const encoded = JSON.stringify(item);
    const itemSize = Buffer.byteLength(encoded, 'utf8') + (current.length > 0 ? 1 : 0);

    if (current.length > 0 && currentSize + itemSize > maxBytes) {
      chunks.push(current);
      current = [item];
      currentSize = 2 + Buffer.byteLength(encoded, 'utf8');
      return;
    }

    current.push(item);
    currentSize += itemSize;
  });

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
};

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data));
};

const writeLanguageIndex = (lang, serializedIndex) => {
  const langDir = path.join(OUTPUT_DIR, lang);
  fs.mkdirSync(langDir, { recursive: true });

  const sections = {};
  Object.entries(serializedIndex).forEach(([section, items]) => {
    const maxBytes = SECTION_MAX_BYTES[section] || 900000;
    const chunks = chunkArrayBySize(items, maxBytes);
    sections[section] = chunks.map((chunk, index) => {
      const fileName = `${section}.${index}.json`;
      writeJson(path.join(langDir, fileName), chunk);
      return fileName;
    });
  });

  writeJson(path.join(langDir, 'manifest.json'), {
    version: INDEX_VERSION,
    lang,
    sections,
  });
};

const getAvailableLanguages = () => {
  const languagesToBuild = new Set(['en']);

  if (!fs.existsSync(TRANSLATIONS_DIR)) {
    return Array.from(languagesToBuild);
  }

  const translationDirs = fs.readdirSync(TRANSLATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  translationDirs.forEach((lang) => {
    const quranPath = path.join(TRANSLATIONS_DIR, lang, `quran_${lang}.json`);
    if (fs.existsSync(quranPath)) {
      languagesToBuild.add(lang);
    }
  });

  return Array.from(languagesToBuild)
    .filter((lang) => !!languages[lang] || lang === 'en')
    .sort();
};

const loadLanguagePayload = (lang) => {
  if (lang === 'en') {
    return {
      quran: baseQuran,
      introduction: baseIntroduction,
      appendices: baseAppendices,
      application: baseApplication,
    };
  }

  const readTranslation = (prefix, fallback) => {
    const filePath = path.join(TRANSLATIONS_DIR, lang, `${prefix}_${lang}.json`);
    if (!fs.existsSync(filePath)) return fallback;
    return readJson(filePath);
  };

  return {
    quran: readTranslation('quran', baseQuran),
    introduction: readTranslation('introduction', baseIntroduction),
    appendices: readTranslation('appendices', baseAppendices),
    application: readTranslation('application', baseApplication),
  };
};

const run = () => {
  if (fs.existsSync(LEGACY_PUBLIC_OUTPUT_DIR)) {
    fs.rmSync(LEGACY_PUBLIC_OUTPUT_DIR, { recursive: true, force: true });
  }

  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const supportedLanguages = getAvailableLanguages();
  const generated = [];

  supportedLanguages.forEach((lang) => {
    const payload = loadLanguagePayload(lang);
    const index = buildIndex({
      lang,
      quran: payload.quran,
      introduction: payload.introduction,
      appendices: payload.appendices,
      application: payload.application,
    });

    writeLanguageIndex(lang, serializeIndex(index));
    generated.push(lang);
    console.log(`built didyoumean index: ${lang}`);
  });

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  writeJson(manifestPath, {
    version: INDEX_VERSION,
    generatedAt: new Date().toISOString(),
    languages: generated,
  });
  console.log(`didyoumean indexes generated: ${generated.join(', ')}`);
};

run();
