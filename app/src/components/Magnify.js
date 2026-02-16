import { useState, useEffect, useCallback, useRef } from 'react';
import { mapAppendices, mapQuran } from '../utils/Mapper';
import { isNative } from '../utils/Device';
import languages from '../assets/languages.json';


// Word-boundary check: a character is a boundary (not part of a word) if it's
// NOT a letter or digit. Covers whitespace, punctuation, brackets, etc.
// Uses charCodeAt for iPhone 7 safety (no regex lookbehind).
const isWordChar = (ch) => {
    if (!ch) return false;
    const c = ch.charCodeAt(0);
    if (c >= 0x30 && c <= 0x39) return true;  // 0-9
    if (ch.toUpperCase() !== ch.toLowerCase()) return true; // Case-paired letters
    if (c >= 0x0621 && c <= 0x064A) return true; // Arabic letters
    if (c >= 0x066E && c <= 0x06D3) return true; // Arabic extended
    if (c >= 0x05D0 && c <= 0x05EA) return true; // Hebrew letters
    if (c >= 0x4E00 && c <= 0x9FFF) return true; // CJK
    if (c >= 0x0900 && c <= 0x0DFF) return true; // Devanagari, Bengali, etc.
    if (c >= 0x0E00 && c <= 0x0E7F) return true; // Thai
    return false;
};
// Exact-match: find "phrase" in haystack, treating any whitespace run in keyword
// as matching any whitespace/punctuation run in haystack.
// Boundaries: string edge or any non-word character (punctuation, whitespace, etc.)
const exactIndexOf = (hay, phrase, startFrom) => {
    const phraseWords = phrase.split(/\s+/).filter(Boolean);
    if (phraseWords.length === 0) return -1;

    let pos = startFrom || 0;
    while (pos <= hay.length - 1) {
        const idx = hay.indexOf(phraseWords[0], pos);
        if (idx === -1) return -1;

        // Left boundary: must be start-of-string or non-word character
        if (idx > 0 && isWordChar(hay[idx - 1])) { pos = idx + 1; continue; }

        // Walk through remaining words, allowing non-word gaps
        let cursor = idx + phraseWords[0].length;
        let ok = true;
        for (let w = 1; w < phraseWords.length; w++) {
            // Must have at least one non-word char between words
            if (cursor >= hay.length || isWordChar(hay[cursor])) { ok = false; break; }
            while (cursor < hay.length && !isWordChar(hay[cursor])) cursor++;
            // Next word must start here
            if (hay.indexOf(phraseWords[w], cursor) !== cursor) { ok = false; break; }
            cursor += phraseWords[w].length;
        }
        if (!ok) { pos = idx + 1; continue; }

        // Right boundary: must be end-of-string or non-word character
        if (cursor < hay.length && isWordChar(hay[cursor])) { pos = idx + 1; continue; }

        return idx; // match found
    }
    return -1;
};

const Magnify = ({ colors, theme, translationApplication, quran, map, appendices, introduction, onClose, onConfirm, direction, multiSelect, setMultiSelect, selectedVerseList, setSelectedVerseList }) => {
    const lang = localStorage.getItem("lang");

    const [searchTerm, setSearchTerm] = useState(localStorage.getItem("qurantft-magnify-st") || "");
    const [exactMatch, setExactMatch] = useState(() => {
        const saved = localStorage.getItem("exact");
        return saved !== null ? JSON.parse(saved) : false;
    });
    const [caseSensitive, setCaseSensitive] = useState(() => {
        const saved = localStorage.getItem("case");
        return (saved !== null && direction !== 'rtl') ? JSON.parse(saved) : false;
    });
    const [normalize, setNormalize] = useState(() => {
        const saved = localStorage.getItem("norm");
        return (saved !== null && direction !== 'rtl') ? JSON.parse(saved) : direction !== 'rtl';
    });
    const [optionsVisible, setOptionsVisible] = useState(false);
    const selectedVerseSet = new Set(selectedVerseList);

    const [titlesVisible, setTitlesVisible] = useState(isNative() ? false : true);
    const [versesVisible, setVersesVisible] = useState(true);
    const [notesVisible, setNotesVisible] = useState(isNative() ? false : true);
    const [appendicesVisible, setAppendicesVisible] = useState(isNative() ? false : true);

    const [searchResultTitles, setSearchResultTitles] = useState([]);
    const [searchResultVerses, setSearchResultVerses] = useState([]);
    const [searchResultNotes, setSearchResultNotes] = useState([]);
    const [searchResultAppendices, setSearchResultAppendices] = useState([]);
    const [hitCounts, setHitCounts] = useState([]);

    const [loadedTitles, setLoadedTitles] = useState([]);
    const [loadedVerses, setLoadedVerses] = useState([]);
    const [loadedNotes, setLoadedNotes] = useState([]);
    const [loadedMap, setLoadedMap] = useState([]);
    const [loadedAppendices, setLoadedAppendices] = useState([]);


    const batchSize = 19;
    const observerTitles = useRef();
    const observerVerses = useRef();
    const observerNotes = useRef();
    const observerAppendices = useRef();

    const inputRef = useRef(null);

    const [openTheme, setOpenTheme] = useState(null);
    const [openSubTheme, setOpenSubTheme] = useState({});

    const [quranmap, setQuranmap] = useState({});
    const [appsmap, setAppsmap] = useState({});

    const lastSelection = useRef(localStorage.getItem("qurantft-magnify-ls") || "");
    const hasConsumedLastSelection = useRef(false);
    const saveLastSelection = useRef(false);
    const [notify, setNotify] = useState(null);
    const loadingElementsTimer = useRef(null);

    const titlesReferences = useRef({});
    const versesReferences = useRef({});
    const notesReferences = useRef({});
    const appendicesReferences = useRef({});
    const singleReferences = useRef({});

    useEffect(() => {
        setQuranmap(mapQuran(quran));
    }, [quran]);

    useEffect(() => {
        setAppsmap(mapAppendices(appendices, translationApplication));
    }, [appendices, translationApplication]);

    const handleThemeClick = (index) => {
        setOpenTheme(openTheme === index ? null : index);

        if (openTheme !== index) {
            setTimeout(() => {
                document.getElementById(`theme-container-${index}`).scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 76);
        }
    }

    const handleSubThemeClick = (parentIndex, subIndex) => {
        setOpenSubTheme(prevState => ({
            ...prevState,
            [parentIndex]: {
                ...prevState[parentIndex],
                [subIndex]: !prevState[parentIndex]?.[subIndex],
            }
        }));
    };

    useEffect(() => {
        if (inputRef.current && lastSelection.current === "") {
            inputRef.current.focus();
        }
    }, []);

    useEffect(() => {
        if (searchTerm !== "") {
            localStorage.setItem("qurantft-magnify-st", searchTerm)
        }
    }, [searchTerm]);

    useEffect(() => {
        localStorage.setItem("case", JSON.stringify(caseSensitive));
    }, [caseSensitive]);

    useEffect(() => {
        localStorage.setItem("norm", JSON.stringify(normalize));
    }, [normalize]);

    useEffect(() => {
        localStorage.setItem("exact", JSON.stringify(exactMatch));
    }, [exactMatch]);

    const normalizeText = (text) => {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    const removePunctuations = (text) => {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    const searchFold = useCallback((text) => {
        let t = text;
        if ((lang === "tr" || lang === "az") && normalize) {
            t = t.replace(/[İIıi]/g, "i");
        }
        if (normalize) {
            t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        }
        if (!caseSensitive) {
            t = t.toLocaleUpperCase(lang);
        }
        return t;
    }, [lang, normalize, caseSensitive]);

    const performSearch = useCallback((term) => {
        if (!term) return;

        // ---- lang-aware digit set & helpers (scoped to this call) ----
        const langCfg = languages && languages[lang] ? languages[lang] : null;
        const isRTL = !!(langCfg && langCfg.dir === 'rtl');
        const langDigits = (langCfg && langCfg.nums ? langCfg.nums.split(/\s+/).filter(Boolean) : []);
        const digitSet = new Set(langDigits); // e.g., ["۰","۱",...,"۹"] for fa

        function hasAnyDigitLocal(s) {
            if (s == null) return false;
            if (/\d/.test(s)) return true;                // ASCII
            for (const ch of String(s)) if (digitSet.has(ch)) return true;
            return false;
        }

        function isSingleDigitLocal(s) {
            const str = String(s ?? '');
            if (str.length !== 1) return false;
            return /\d/.test(str) || digitSet.has(str);
        }

        // Normalize digits + ONLY RTL numeric separators inside numeric tokens.
        function normalizeNumericTokenForLang(token) {
            if (!isRTL) return token; // only enhance for RTL langs as requested
            if (!token) return token;
            let out = '';
            for (const ch of token) {
                if (digitSet.has(ch)) { out += String(langDigits.indexOf(ch)); continue; } // map FA/AR digits -> ASCII
                // map common RTL list/separator glyphs so formulas like "۲:،۳:" work
                if (ch === '،') { out += ','; continue; }   // Arabic comma
                if (ch === '؛') { out += ';'; continue; }   // Arabic semicolon
                if (ch === '：' || ch === '﹕') { out += ':'; continue; } // fullwidth/small colon (rare, but harmless)
                if (ch === '−' || ch === '–' || ch === '—' || ch === '‐' || ch === '﹣' || ch === '－') { out += '-'; continue; } // dashes → '-'
                out += ch;
            }
            return out;
        }

        // original early-exit, but recognize single localized digit too
        if (term.length < 2 && !isSingleDigitLocal(term)) {
            setSearchResultTitles([]); setSearchResultVerses([]); setSearchResultNotes([]); setSearchResultAppendices([]);
            return;
        }

        // ---- original pre-processing (unchanged) ----
        let processedTerm = searchFold(term);

        // Split the search term by '|' to get OR terms (unchanged)
        const orTerms = processedTerm.split('|').map(t => t.trim()).filter(t => t !== '');

        // Keep internal commas so "۲:،۳:" stays "2:,3:" (parseNumericRefs will split later).
        const keywordGroups = orTerms.map(term => {
            const tokens = term.split(/\s+/).filter(t => t.trim() !== '');
            const numericParts = [];
            const textParts = [];

            tokens.forEach(token => {
                if (hasAnyDigitLocal(token)) {
                    numericParts.push(normalizeNumericTokenForLang(token));
                } else {
                    textParts.push(token);
                }
            });

            // In exact mode: text words stay as one phrase, numeric tokens separate
            // In normal mode: all tokens are individual keywords
            const result = [];
            if (exactMatch && textParts.length > 0) {
                result.push(textParts.join(' '));
            } else {
                result.push(...textParts);
            }
            result.push(...numericParts);
            return result.filter(k => k.trim() !== '');
        });

        // Helper: does haystack contain all keywords? (exact-match aware)
        function hayContains(hay, keywords) {
            return keywords.every(k => {
                if (exactMatch && !hasAnyDigitLocal(k)) {
                    return exactIndexOf(hay, k, 0) !== -1;
                }
                return hay.includes(k);
            });
        }

        const titleResults = [];
        const verseResults = [];
        const notesResults = [];
        const appendicesResults = [];

        /**
         * Turn a formula string like
         *   "2:1-2, 5, 9, 12-15, 3:7"
         *   "2:,3:"         // 2: and 3: => full Sura 2 & 3
         *   ":12"           // all suras' verse 12
         *   "2:5-3"         // invalid range => verse 5 only
         * into a map:
         *   { 2: [{1,2},{5,5},{9,9},{12,15}], 3:[{7,7}], '*':[{12,12}] }
         */
        function parseNumericRefs(formula) {
            const tokens = formula
                .split(/[,\s;]+/)      // split on comma, whitespace or semicolon
                .filter(Boolean);

            const refs = {};
            let currentSura = null;

            tokens.forEach(tok => {
                if (tok.includes(':')) {
                    // sura:verses or sura:
                    let [sRaw, vRaw = ''] = tok.split(':');
                    currentSura = sRaw === '' ? '*' : Number(sRaw);
                    if (!refs[currentSura]) refs[currentSura] = [];

                    if (!vRaw) {
                        // e.g. "2:" or "3:" => full sura
                        refs[currentSura].push({ start: 1, end: Infinity });
                    } else {
                        pushRanges(refs[currentSura], vRaw);
                    }
                } else {
                    // plain number or plain range; belongs to last seen sura
                    if (currentSura == null) return;   // no context => skip
                    pushRanges(refs[currentSura], tok);
                }
            });

            return refs;
        }

        function pushRanges(arr, part) {
            const [a, b] = part.split('-').map(Number);
            if (isNaN(a)) return;
            if (!isNaN(b) && b >= a) {
                arr.push({ start: a, end: b });
            } else {
                arr.push({ start: a, end: a });
            }
        }

        function matchesNumeric(refs, suraNumber, verseNumber) {
            const s = Number(suraNumber), v = Number(verseNumber);
            if (refs['*'] && refs['*'].some(r => v >= r.start && v <= r.end)) return true;
            if (refs[s] && refs[s].some(r => v >= r.start && v <= r.end)) return true;
            return false;
        }

        // ---- original scanning (unchanged, except digit test) ----
        for (const page in quran) {
            const suras = quran[page].sura;
            for (const suraNumber in suras) {
                const verses = suras[suraNumber].verses;
                for (const verseNumber in verses) {
                    const verseText = verses[verseNumber];
                    const hay = searchFold(verseText);

                    if (keywordGroups.some(keywords => {
                        // 1) any pure-text match?
                        if (hayContains(hay, keywords)) return true;

                        // 2) numeric-formula match?
                        const numericTokens = keywords.filter(k => hasAnyDigitLocal(k));
                        if (numericTokens.length === 0) return false;

                        const formula = numericTokens.join(',');
                        const refs = parseNumericRefs(formula);
                        return matchesNumeric(refs, suraNumber, verseNumber);
                    })) {
                        verseResults.push({ suraNumber, verseNumber, verseText });
                    }
                }

                const titles = suras[suraNumber].titles;
                for (const titleNumber in titles) {
                    const titleText = titles[titleNumber];
                    let processedTitleText = searchFold(titleText);

                    if (keywordGroups.some(keywords => hayContains(processedTitleText, keywords))) {
                        titleResults.push({ suraNumber, titleNumber, titleText });
                    }
                }

                const notes = quran[page].notes?.data;
                if (notes && notes.length > 0) {
                    Object.values(notes).forEach((note) => {
                        let processedNote = searchFold(note);

                        if (keywordGroups.some(keywords => hayContains(processedNote, keywords))) {
                            const match = String(note).match(/\*+\d+:\d+/g);
                            if (match && match.length > 0) {
                                let cleanedRef = match[0].replace(/^\*+/, '');
                                if (match[1] && match[1] === '*9:127') cleanedRef = match[1].replace(/^\*+/, '');
                                const ref = cleanedRef.split(':');
                                const suraNumberRef = ref[0];
                                const verseNumberRef = ref[1];

                                if (!notesResults.some(result =>
                                    result.suraNumber === suraNumberRef &&
                                    result.verseNumber === verseNumberRef &&
                                    result.note.replace(/^\*+/, '') === String(note).replace(/^\*+/, '')
                                )) {
                                    notesResults.push({ suraNumber: suraNumberRef, verseNumber: verseNumberRef, note });
                                }
                            }
                        }
                    });
                }
            }
        }

        for (const section in introduction) {
            const introContent = (introduction[section].page !== 1 && introduction[section].page !== 22) ? introduction[section] : null;
            if (introContent) {
                let page = 0;
                Object.entries(introContent).forEach(([type, content]) => {
                    page = type === "page" ? content : page;
                    Object.entries(content).forEach(([order, value]) => {
                        const appx = '0';
                        const introText = value.toString();
                        const key = page + "-" + type + "-" + order;
                        let processedIntroText = searchFold(introText);

                        if (keywordGroups.some(keywords => hayContains(processedIntroText, keywords))) {
                            appendicesResults.push({ appx, key, introText });
                        }
                    });
                });
            }
        }

        for (const appx in appsmap) {
            const appxContent = appsmap[appx].content;
            Object.values(appxContent)
                .filter(element => (element.type === "text" || element.type === "title" || (element.type === "table" && element.content.ref && element.content.ref.trim() !== "")))
                .forEach(element => {
                    const appendixText = element.type === 'table' ? element.content.ref.toString() : element.content.toString();
                    const key = element.type + "-" + element.key + "-" + element.order;
                    let processedAppendixText = searchFold(appendixText);

                    if (keywordGroups.some(keywords => hayContains(processedAppendixText, keywords))) {
                        appendicesResults.push({ appx, key, appendixText });
                    }
                });
        }

        // ---- hit count per keyword (verses only, text keywords only) ----
        const verseTexts = verseResults.map(r => searchFold(r.verseText));
        const counts = keywordGroups.map(keywords => {
            // Filter out numeric keywords — no hit count for formulas like "2:5"
            const textKeywords = keywords.filter(k => !hasAnyDigitLocal(k));
            return textKeywords.map(k => {
                let total = 0;
                for (const hay of verseTexts) {
                    if (exactMatch) {
                        let pos = 0;
                        while ((pos = exactIndexOf(hay, k, pos)) !== -1) {
                            total++;
                            const words = k.split(/\s+/).filter(Boolean);
                            let cursor = pos;
                            for (let w = 0; w < words.length; w++) {
                                if (w > 0) { while (cursor < hay.length && !isWordChar(hay[cursor])) cursor++; }
                                cursor += words[w].length;
                            }
                            pos = cursor;
                        }
                    } else {
                        let idx = 0;
                        while ((idx = hay.indexOf(k, idx)) !== -1) { total++; idx += k.length || 1; }
                    }
                }
                return total;
            });
        });
        setHitCounts(counts);

        setSearchResultTitles(titleResults);
        setSearchResultVerses(verseResults);
        setSearchResultNotes(notesResults);
        setSearchResultAppendices(appendicesResults);

    }, [quran, introduction, appsmap, lang, exactMatch, searchFold]);


    const performSearchSingleLetter = useCallback((term) => {
        const capitalizedTerm = term.toLocaleUpperCase(lang);
        if (capitalizedTerm.length === 1 && map[capitalizedTerm]) {
            setLoadedMap(map[capitalizedTerm]);
        }
    }, [map, lang]);

    useEffect(() => {
        if (searchTerm) {
            if (searchTerm.length > 1 || (searchTerm.length === 1 && /^\d$/.test(searchTerm))) {
                performSearch(searchTerm);
            } else if (searchTerm.length === 1 && !/^\d$/.test(searchTerm)) {
                performSearchSingleLetter(searchTerm);
            }
        }
    }, [searchTerm, performSearch, performSearchSingleLetter]);

    const highlightText = useCallback((originalText, keyword) => {
        if (!keyword || keyword.trim() === '') return [originalText];

        const origChars = [...originalText];
        let searchStr = "";
        const posMap = [];

        for (let i = 0; i < origChars.length; i++) {
            let ch = origChars[i];
            if ((lang === "tr" || lang === "az") && normalize) {
                ch = ch.replace(/[İIıi]/g, "i");
            }
            if (normalize) {
                ch = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            }
            if (!caseSensitive) {
                ch = ch.toLocaleUpperCase(lang);
            }
            for (let j = 0; j < ch.length; j++) {
                searchStr += ch[j];
                posMap.push(i);
            }
        }

        let processedKeyword = keyword;
        if ((lang === "tr" || lang === "az") && normalize) {
            processedKeyword = processedKeyword.replace(/[İIıi]/g, "i");
        }
        if (normalize) {
            processedKeyword = normalizeText(processedKeyword);
        }
        if (!processedKeyword || processedKeyword.trim() === '') return [originalText];
        processedKeyword = !caseSensitive ? processedKeyword.toLocaleUpperCase(lang) : processedKeyword;

        const parts = [];
        let lastOrigEnd = 0;

        if (exactMatch) {
            // Boundary-aware exact matching (no regex, iPhone 7 safe)
            // No regex escaping needed — exactIndexOf uses indexOf, not regex
            let pos = 0;
            while (true) {
                const idx = exactIndexOf(searchStr, processedKeyword, pos);
                if (idx === -1) break;
                // Walk to find actual match end (whitespace-flexible)
                const phraseWords = processedKeyword.split(/\s+/).filter(Boolean);
                let cursor = idx;
                for (let w = 0; w < phraseWords.length; w++) {
                    if (w > 0) { while (cursor < searchStr.length && !isWordChar(searchStr[cursor])) cursor++; }
                    cursor += phraseWords[w].length;
                }
                const origStart = posMap[idx];
                const origEnd = posMap[cursor - 1] + 1;
                const matchText = origChars.slice(origStart, origEnd).join("");

                if (origStart > lastOrigEnd) {
                    parts.push(origChars.slice(lastOrigEnd, origStart).join(""));
                }
                parts.push(<span className={`font-bold ${colors[theme]["matching-text"]}`}>{matchText}</span>);
                lastOrigEnd = origEnd;
                pos = cursor;
            }
        } else {
            const escapedKeyword = removePunctuations(processedKeyword);
            if (!escapedKeyword || escapedKeyword.trim() === '') return [originalText];
            const regex = new RegExp(escapedKeyword, caseSensitive ? 'g' : 'gi');
            let match;

            while ((match = regex.exec(searchStr)) !== null) {
                if (match[0].length === 0) { regex.lastIndex++; continue; }
                const origStart = posMap[match.index];
                const origEnd = posMap[match.index + match[0].length - 1] + 1;
                const matchText = origChars.slice(origStart, origEnd).join("");

                if (origStart > lastOrigEnd) {
                    parts.push(origChars.slice(lastOrigEnd, origStart).join(""));
                }
                parts.push(<span className={`font-bold ${colors[theme]["matching-text"]}`}>{matchText}</span>);
                lastOrigEnd = origEnd;
            }
        }

        if (lastOrigEnd < origChars.length) {
            parts.push(origChars.slice(lastOrigEnd).join(""));
        }

        return parts.length > 0 ? parts : [originalText];
    }, [caseSensitive, normalize, lang, colors, theme, exactMatch]);

    const lightWords = useCallback((text) => {
        let processedTerm = searchFold(searchTerm);
        let keywords;
        if (exactMatch) {
            // Separate numeric tokens, keep text words as one phrase per OR-group
            const orParts = processedTerm.split('|').map(t => t.trim()).filter(t => t !== '');
            keywords = [];
            orParts.forEach(part => {
                const tokens = part.split(/\s+/).filter(t => t.trim() !== '');
                const textTokens = tokens.filter(t => !/\d/.test(t));
                if (textTokens.length > 0) keywords.push(textTokens.join(' '));
            });
        } else {
            keywords = processedTerm.split(' ').filter(keyword => (keyword.trim() !== '' && keyword.trim() !== '|' && keyword.trim().length > 0));
        }
        let highlightedText = [text];

        keywords.forEach((keyword) => {
            highlightedText = highlightedText.flatMap(part => typeof part === 'string' ? highlightText(part, keyword) : part);
        });

        return highlightedText;
    }, [searchTerm, highlightText, exactMatch, searchFold]);

    const lastTitleElementRef = useCallback(node => {
        if (observerTitles.current) observerTitles.current.disconnect();
        observerTitles.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && loadedTitles.length < searchResultTitles.length) {
                setLoadedTitles(prevLoaded => [
                    ...prevLoaded,
                    ...searchResultTitles.slice(prevLoaded.length, prevLoaded.length + batchSize)
                ]);
            }
        });
        if (node) observerTitles.current.observe(node);
    }, [searchResultTitles, loadedTitles]);

    const lastVerseElementRef = useCallback(node => {
        if (observerVerses.current) observerVerses.current.disconnect();
        observerVerses.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && loadedVerses.length < searchResultVerses.length) {
                setLoadedVerses(prevLoaded => [
                    ...prevLoaded,
                    ...searchResultVerses.slice(prevLoaded.length, prevLoaded.length + batchSize)
                ]);
            }
        });
        if (node) observerVerses.current.observe(node);
    }, [searchResultVerses, loadedVerses]);

    const lastNoteElementRef = useCallback(node => {
        if (observerNotes.current) observerNotes.current.disconnect();
        observerNotes.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && loadedNotes.length < searchResultNotes.length) {
                setLoadedNotes(prevLoaded => [
                    ...prevLoaded,
                    ...searchResultNotes.slice(prevLoaded.length, prevLoaded.length + batchSize)
                ]);
            }
        });
        if (node) observerNotes.current.observe(node);
    }, [searchResultNotes, loadedNotes]);

    const lastAppendixElementRef = useCallback(node => {
        if (observerAppendices.current) observerAppendices.current.disconnect();
        observerAppendices.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && loadedAppendices.length < searchResultAppendices.length) {
                setLoadedAppendices(prevLoaded => [
                    ...prevLoaded,
                    ...searchResultAppendices.slice(prevLoaded.length, prevLoaded.length + batchSize)
                ]);
            }
        });
        if (node) observerAppendices.current.observe(node);
    }, [searchResultAppendices, loadedAppendices]);

    useEffect(() => {
        if (!multiSelect) {
            setSelectedVerseList([]);
        }
    }, [multiSelect, setSelectedVerseList]);

    useEffect(() => {
        const titleLoad = searchResultTitles.slice(0, batchSize);
        const verseLoad = searchResultVerses.slice(0, batchSize);
        const notesLoad = searchResultNotes.slice(0, batchSize);
        const appendicesLoad = searchResultAppendices.slice(0, batchSize);

        setLoadedTitles(titleLoad);
        setLoadedVerses(verseLoad);
        setLoadedNotes(notesLoad);
        setLoadedAppendices(appendicesLoad);

        if (lastSelection.current && lastSelection.current !== "") {
            const [typeofselection, key] = lastSelection.current.split('_');
            if (loadingElementsTimer.current) return;

            let setLoadedData, searchResultData, initialLoad, references, extractor;
            switch (typeofselection) {
                case "title":
                    setLoadedData = setLoadedTitles;
                    searchResultData = searchResultTitles;
                    initialLoad = titleLoad;
                    references = titlesReferences;
                    extractor = (item) => `${item.suraNumber}:${item.titleNumber}`;
                    setTitlesVisible(true);
                    setVersesVisible(false);
                    setNotesVisible(false);
                    setAppendicesVisible(false);
                    break;
                case "verse":
                    setLoadedData = setLoadedVerses;
                    searchResultData = searchResultVerses;
                    initialLoad = verseLoad;
                    references = versesReferences;
                    extractor = (item) => `${item.suraNumber}:${item.verseNumber}`;
                    setTitlesVisible(false);
                    setVersesVisible(true);
                    setNotesVisible(false);
                    setAppendicesVisible(false);
                    break;
                case "footnote":
                    setLoadedData = setLoadedNotes;
                    searchResultData = searchResultNotes;
                    initialLoad = notesLoad;
                    references = notesReferences;
                    extractor = (item) => `${item.suraNumber}:${item.verseNumber}`;
                    setTitlesVisible(false);
                    setVersesVisible(false);
                    setNotesVisible(true);
                    setAppendicesVisible(false);
                    break;
                case "appendix":
                    setLoadedData = setLoadedAppendices;
                    searchResultData = searchResultAppendices;
                    initialLoad = appendicesLoad;
                    references = appendicesReferences;
                    extractor = (item) => item.appx === 0 ? `intro:${item.key}` : `appx:${item.appx}-${item.key}`;
                    setTitlesVisible(false);
                    setVersesVisible(false);
                    setNotesVisible(false);
                    setAppendicesVisible(true);
                    break;
                default:
                    try {
                        const data = JSON.parse(typeofselection);

                        if (data && typeof data === 'object') {
                            const sskey = Object.keys(data)[0];
                            setOpenTheme(sskey);
                            setOpenSubTheme(data);
                        } else {
                            setOpenTheme(data);
                        }
                    } catch (e) {
                        lastSelection.current = "";
                        hasConsumedLastSelection.current = true;
                        break;
                    }

                    if (loadingElementsTimer.current === null) {
                        loadingElementsTimer.current = setTimeout(() => {
                            setTimeout(() => {
                                const ref = singleReferences.current[key];
                                if (ref) {
                                    ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    setNotify(`single_${key}`);
                                    setTimeout(() => setNotify(null), 5350);
                                }
                            }, 190);
                            lastSelection.current = "";
                            hasConsumedLastSelection.current = true;
                            loadingElementsTimer.current = null;
                        }, 19);
                    }
                    break;
            }

            if (!hasConsumedLastSelection.current && searchTerm?.length > 1 && searchResultData?.length > 0) {
                loadingElementsTimer.current = setTimeout(() => {
                    const isLoaded = initialLoad.some((item) => extractor(item) === key);

                    if (!isLoaded) {
                        let newLoad = initialLoad;

                        while (!newLoad.some((item) => extractor(item) === key) && newLoad.length < searchResultData.length) {
                            newLoad = [
                                ...newLoad,
                                ...searchResultData.slice(newLoad.length, newLoad.length + batchSize)
                            ];
                            setLoadedData(newLoad);
                        }
                    }

                    setTimeout(() => {
                        if (references.current[key]) {
                            references.current[key].scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setNotify(typeofselection + `_` + key);
                            setTimeout(() => {
                                setNotify(null);
                            }, 5350);
                        }
                    }, 266);

                    lastSelection.current = "";
                    hasConsumedLastSelection.current = true;
                    loadingElementsTimer.current = null;
                }, 19);
            }
        }

    }, [searchResultTitles, searchResultVerses, searchResultNotes, searchResultAppendices, searchTerm]);

    useEffect(() => {
        return () => {
            if (hasConsumedLastSelection.current && !saveLastSelection.current) {
                localStorage.removeItem("qurantft-magnify-ls");
            }
        }
    }, []);

    const handleSelectAll = useCallback(() => {
        if (multiSelect && selectedVerseList.length === 0) {
            let list = [];
            searchResultVerses.forEach((item) => {
                const key = `${item.suraNumber}:${item.verseNumber}`;
                list.push(key);
            });
            setSelectedVerseList(list);
        }
    }, [multiSelect, selectedVerseList, setSelectedVerseList, searchResultVerses]);

    const handleClose = useCallback(() => {
        if (lastSelection.current && lastSelection.current !== "") {
            saveLastSelection.current = true;
            localStorage.setItem("qurantft-magnify-ls", lastSelection.current);
        }
        onClose && onClose();
    }, [onClose]);

    const handleConfirm = useCallback((key, typeofselection = null) => {
        return () => {
            if (multiSelect) {
                if (typeofselection && typeofselection === 'verse') {
                    setSelectedVerseList((prevList) => {
                        if (prevList.includes(key)) {
                            return prevList.filter((verse) => verse !== key);
                        } else {
                            return [...prevList, key];
                        }
                    });
                }
            } else {
                if (onConfirm) {
                    lastSelection.current = typeofselection + '_' + key;
                    saveLastSelection.current = true;
                    onConfirm(key);
                    handleClose();
                }
            }
        };
    }, [multiSelect, onConfirm, handleClose, setSelectedVerseList]);

    const renderref = (ref, tree = null, from = null) => {
        if (ref) {
            const verseResults = [];
            ref.split(";").forEach(refPart => {
                const [sura, verses] = refPart.split(":").map(part => part.trim());
                if (verses) {
                    if (verses.includes(',')) {
                        verses.split(",").forEach(verse => {
                            if (verse.includes("-")) {
                                // Range of verses
                                const [start, end] = verse.split("-").map(Number);
                                for (let i = start; i <= end; i++) {
                                    const verseText = quranmap[sura]?.[`${i}`];
                                    if (verseText) {
                                        verseResults.push({ suraNumber: sura, verseNumber: i, text: verseText });
                                    }
                                }
                            } else {
                                // Single verse
                                const verseText = quranmap[sura]?.[verse.trim()];
                                if (verseText) {
                                    verseResults.push({ suraNumber: sura, verseNumber: verse.trim(), text: verseText });
                                }
                            }
                        });
                    } else {
                        if (verses.includes("-")) {
                            // Range of verses
                            const [start, end] = verses.split("-").map(Number);
                            for (let i = start; i <= end; i++) {
                                const verseText = quranmap[sura]?.[`${i}`];
                                if (verseText) {
                                    verseResults.push({ suraNumber: sura, verseNumber: `${i}`, text: verseText });
                                }
                            }
                        } else {
                            const verseText = quranmap[sura]?.[verses.trim()];
                            if (verseText) {
                                verseResults.push({ suraNumber: sura, verseNumber: verses.trim(), text: verseText });
                            }
                        }
                    }
                }
            });

            if (tree && typeof tree === 'object') {
                const passontree = {};
                passontree[from] = tree[from];
                tree = passontree;
            }

            return verseResults.map(({ suraNumber, verseNumber, text }, index) => {
                const thekey = `${suraNumber}:${verseNumber}`;
                const pulsate = notify === `single_${thekey}` ? `animate-pulse` : ``;
                return (
                    <div
                        key={index}
                        ref={(node) => { singleReferences.current[thekey] = node; }}
                        className={`rounded p-2  ${colors[theme]["text-background"]} ${pulsate}`}
                        onClick={handleConfirm(`${suraNumber}:${verseNumber}`, JSON.stringify(tree))}>
                        <span className={`text-sky-500 ${direction === 'rtl' ? "ml-1" : "mr-1"}`}>{suraNumber}:{verseNumber}</span>{text}
                    </div>
                )
            });
        }
        return null;
    };

    return (
        <div className={` w-screen h-screen fixed z-[90] left-0 top-0 backdrop-blur-2xl`} id="jump-screen"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) * 0.57)' }}
        >
            <div className={`fixed flex flex-col items-center justify-start faster inset-0 outline-none focus:outline-none overflow-auto `}>
                <div className={`w-full flex p-1.5 sticky top-0 backdrop-blur-2xl z-20`} style={{ paddingTop: 'calc((env(safe-area-inset-top) * 0.76) + 0.3rem)' }}>
                    <div className={`relative w-full flex rounded  space-x-2`}>
                        <div className={`relative w-full`}>
                            <input
                                type="text"
                                dir={direction}
                                ref={inputRef}
                                id="searchBar"
                                placeholder={translationApplication.search + "..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onFocus={() => { setOptionsVisible(false) }}
                                className={`w-full p-2 rounded ${colors[theme]["app-background"]} ${colors[theme]["page-text"]} ring-1 ${theme === 'light' ? `ring-black/10` : `ring-white/10`} focus:outline-none focus:ring-2 ${colors[theme]["focus-ring"]} ${colors[theme]["focus-text"]}`}
                            />
                            {hitCounts.length > 0 && searchTerm.length > 1 && (
                                <span
                                    className={`absolute top-0 ${direction === 'rtl' ? 'left-1' : 'right-1'} text-xs pointer-events-none ${colors[theme]["matching-text"]} max-w-[97%] overflow-hidden whitespace-nowrap text-ellipsis`}
                                >
                                    {hitCounts.map((group, gi) => (
                                        <span key={gi}>
                                            {gi > 0 && ' | '}
                                            {group.map((count, ci) => (
                                                <span key={ci}>
                                                    {ci > 0 && ' '}
                                                    {count > 0 && count % 19 === 0
                                                        ? <span dir="ltr">{count} (<span className="text-nowrap">19 x {count / 19}</span>)</span>
                                                        : count}
                                                </span>
                                            ))}
                                        </span>
                                    ))}
                                </span>
                            )}
                        </div>
                        <button
                            className={`flex items-center justify-center transition-all duration-300 ease-linear ${optionsVisible ? " -rotate-180 " : " rotate-0"} ${optionsVisible ? colors[theme]["matching-text"] : colors[theme]["log-text"]}`}
                            onClick={() => setOptionsVisible(!optionsVisible)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 `}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>

                        </button>

                        <button className={`flex items-center justify-center ${colors[theme]["text"]}`}
                            onClick={() => {
                                if (searchTerm.length > 0) {
                                    setSearchTerm("");
                                    localStorage.removeItem("qurantft-magnify-st");
                                    inputRef.current && inputRef.current.focus();
                                } else {
                                    handleClose();
                                }
                            }}>
                            {searchTerm.length === 0 ?
                                (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>)
                                :
                                (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.374-6.375a1.125 1.125 0 0 1 0-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33Z" />
                                </svg>
                                )}
                        </button>
                    </div>
                </div>
                {(searchTerm.length > 1 || (searchTerm.length === 1 && /^\d$/.test(searchTerm))) &&
                    <div
                        dir={direction}
                        className={`flex flex-col lg:grid lg:grid-cols-2 lg:grid-flow-row lg:px-1 gap-1 w-full overflow-auto py-0.5 flex-1`}
                        style={{
                            marginBottom: `calc(env(safe-area-inset-bottom) * 0.57 + ${window.innerWidth >= 1024 ? '4rem' : '3rem'})`
                        }}>
                        <div className={`${loadedTitles.length > 0 ? titlesVisible ? `flex-1 mx-1 lg:mx-0 ring-1 ${colors[theme]["text-background"]}` : `h-10 p-1 mx-1 lg:mx-0 ring-1 ${colors[theme]["base-background"]}` : "hidden"} ${loadedVerses.length > 0 ? "" : "lg:col-span-2"} transition-all duration-100 ease-linear  overflow-auto rounded ${colors[theme]["ring"]} `}>
                            <div
                                onClick={() => setTitlesVisible(!titlesVisible)}
                                className={`${loadedTitles.length > 0 ? "opacity-100" : "opacity-0 h-0"} ${titlesVisible ? `sticky z-40 top-0 text-base md:text-lg mb-1.5 p-2 justify-center rounded-t drop-shadow-md backdrop-blur-xl` : ` h-full justify-between px-2 text-xl md:text-2xl`} transition-all duration-100 ease-linear flex items-center text-center ${colors[theme]["page-text"]}`}>
                                <div className={`${titlesVisible ? "" : "flex justify-between w-full"}`}>{translationApplication.titles}{` `}<span className={`${colors[theme]["matching-text"]}`}>{searchResultTitles.length}</span></div>
                            </div>
                            <div className={`text-sm md:text-base w-full ${colors[theme]["text"]} `}>
                                <div className={`w-full flex flex-col space-y-1.5 ${titlesVisible ? `pb-1.5` : ``}`}>
                                    {titlesVisible &&
                                        (
                                            loadedTitles.map((result, index) => {
                                                const thekey = `${result.suraNumber}:${result.titleNumber}`;
                                                const pulsate = notify === `title_${thekey}` ? `animate-pulse` : ``;
                                                return (
                                                    <div
                                                        ref={(node) => {
                                                            titlesReferences.current[thekey] = node;
                                                            if (index === loadedTitles.length - 1) {
                                                                lastTitleElementRef(node);
                                                            }
                                                        }}
                                                        key={`title-${thekey}-${index}`}
                                                        className={`py-2 px-5 rounded relative ${colors[theme]["app-background"]} cursor-pointer mx-1.5 md:mr-2 whitespace-pre-line text-center ${pulsate}`}
                                                        onClick={handleConfirm(thekey, `title`)}>
                                                        <span className="text-sky-500 absolute top-1 left-1 text-xs">{result.suraNumber}:{result.titleNumber}</span> {lightWords(result.titleText)}
                                                    </div>
                                                );
                                            })
                                        )}
                                </div>
                            </div>
                        </div>

                        <div className={`${loadedVerses.length > 0 ? versesVisible ? " flex-1 mx-1 lg:mx-0 ring-1 " : "h-10 mx-1 lg:mx-0 ring-1 " : "hidden"} ${loadedTitles.length > 0 ? "" : " lg:col-span-2"} transition-all duration-100 ease-linear overflow-auto rounded ${colors[theme]["ring"]} ${colors[theme]["base-background"]}`}>
                            <div className={`${loadedVerses.length > 0 ? "opacity-100" : "opacity-0 h-0"} ${versesVisible ? `sticky top-0 text-base md:text-lg mb-1.5 justify-between rounded-t drop-shadow-md backdrop-blur-xl` : ` h-full justify-between text-xl md:text-2xl`} transition-all duration-100 ease-linear flex items-center text-center ${colors[theme]["page-text"]}`}>
                                {versesVisible &&
                                    <div
                                        onClick={() => handleSelectAll()}
                                        disabled={!multiSelect || selectedVerseList.length !== 0}
                                        className={` ${direction === 'rtl' ? `ml-3 mr-0.5` : `mr-3 ml-0.5`} cursor-pointer mt-0.5 p-1 transition-all duration-100 ease-linear ${colors[theme]["text"]} ${(multiSelect && selectedVerseList.length === 0) ? `opacity-100` : `opacity-0`}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={`w-8 h-7 `}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12" />
                                        </svg>
                                    </div>
                                }
                                <div
                                    onClick={() => setVersesVisible(!versesVisible)}
                                    className={`flex items-center w-full p-3 h-10`}>
                                    <div dir={direction} className={`w-full flex items-center ${versesVisible ? `justify-center space-x-2` : `justify-between`}`}>
                                        <div className={`${direction === 'rtl' ? `pl-5` : ``}`}>{translationApplication.verses}{` `}</div>
                                        <div className={`${colors[theme]["matching-text"]}`}>{searchResultVerses.length}</div>
                                    </div>
                                </div>
                                {versesVisible &&
                                    <div
                                        onClick={() => setMultiSelect(!multiSelect)}
                                        style={{ animation: 'animate-scale 0.3s ease-in-out' }}
                                        className={` ${direction === 'rtl' ? `ml-0.5 mr-3` : `mr-0.5 ml-3`} cursor-pointer mt-0.5 p-1 transition-all duration-100 ease-linear ${multiSelect ? `${selectedVerseList.length > 0 ? `${colors[theme]["matching-text"]}` : `${colors[theme]["text"]}`}` : `${colors[theme]["passive-text"]}`}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 `}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                                        </svg>
                                    </div>
                                }
                            </div>
                            <div
                                lang={lang}
                                className={`text-sm md:text-base text-justify hyphens-auto w-full ${colors[theme]["text"]} ${loadedVerses.length > 0 ? "max-h-full" : "h-0"}`}>
                                <div className={`w-full flex flex-col space-y-1.5 ${versesVisible ? `pb-1.5` : ``}`}>
                                    {versesVisible &&
                                        (
                                            loadedVerses.map((result, index) => {
                                                const thekey = `${result.suraNumber}:${result.verseNumber}`;
                                                const pulsate = notify === `verse_${thekey}` ? `animate-pulse` : ``;
                                                const hasring = multiSelect ? selectedVerseSet.has(thekey) ? `ring-1 ${colors[theme]["matching-ring"]}` : `` : ``;
                                                return (
                                                    <div
                                                        ref={(node) => {
                                                            versesReferences.current[thekey] = node;
                                                            if (index === loadedVerses.length - 1) {
                                                                lastVerseElementRef(node);
                                                            }
                                                        }}
                                                        key={`verse-${thekey}-${index}`}
                                                        className={`p-1.5 rounded ${colors[theme]["text-background"]} cursor-pointer mx-1.5 md:mr-2 ${hasring} ${pulsate} whitespace-pre-line`}
                                                        onClick={handleConfirm(`${result.suraNumber}:${result.verseNumber}`, 'verse')}>
                                                        <span className="text-sky-500">{result.suraNumber}:{result.verseNumber}</span> {lightWords(result.verseText)}
                                                    </div>
                                                );
                                            })
                                        )
                                    }
                                </div>
                            </div>

                        </div>

                        <div className={`${loadedNotes.length > 0 ? notesVisible ? "flex-1 mx-1 lg:mx-0 ring-1" : "h-10 p-1 mx-1 lg:mx-0 ring-1" : "hidden"} ${loadedAppendices.length > 0 ? "" : "lg:col-span-2"} transition-all duration-100 ease-linear  overflow-auto rounded ${colors[theme]["ring"]} ${colors[theme]["base-background"]}`}>
                            <div
                                onClick={() => setNotesVisible(!notesVisible)}
                                className={`${loadedNotes.length > 0 ? "opacity-100" : "opacity-0 "} ${notesVisible ? `sticky top-0 text-base md:text-lg mb-1.5 p-2 justify-center rounded-t drop-shadow-md backdrop-blur-xl` : ` h-full justify-between px-2 text-xl md:text-2xl`} transition-all duration-100 ease-linear flex items-center text-center ${colors[theme]["page-text"]}`}>
                                <div className={`${notesVisible ? "" : "flex justify-between w-full"}`}>{translationApplication.notes}{` `}<span className={`${colors[theme]["matching-text"]}`}>{searchResultNotes.length}</span></div>
                            </div>
                            <div
                                lang={lang}
                                className={`text-sm md:text-base text-justify hyphens-auto w-full ${colors[theme]["text"]} transition-all duration-100 ease-linear ${loadedNotes.length > 0 ? "max-h-full" : "h-0"}`}>
                                <div className={`w-full flex flex-col space-y-1.5 ${notesVisible ? `pb-1.5` : ``}`}>
                                    {notesVisible &&
                                        (loadedNotes.map((result, index) => {
                                            const thekey = `${result.suraNumber}:${result.verseNumber}`;
                                            const pulsate = notify === `footnote_${thekey}` ? `animate-pulse` : ``;
                                            return (
                                                <div
                                                    ref={(node) => {
                                                        notesReferences.current[thekey] = node;
                                                        if (index === loadedNotes.length - 1) {
                                                            lastNoteElementRef(node);
                                                        }
                                                    }}
                                                    key={`footnote-${thekey}-${index}`}
                                                    className={` p-1.5 rounded  ${colors[theme]["notes-background"]} cursor-pointer mx-1.5 md:mr-2 ${pulsate}`}
                                                    onClick={handleConfirm(`${result.suraNumber}:${result.verseNumber}`, `footnote`)}>
                                                    {lightWords(result.note)}
                                                </div>
                                            );
                                        }))
                                    }
                                </div>
                            </div>

                        </div>

                        <div className={`${loadedAppendices.length > 0 ? appendicesVisible ? "flex-1 mx-1 lg:mx-0 ring-1" : "h-10 p-1 mx-1 lg:mx-0 ring-1" : "hidden"} ${loadedNotes.length > 0 ? "" : "lg:col-span-2"} transition-all duration-100 ease-linear  overflow-auto rounded ${colors[theme]["ring"]} ${colors[theme]["base-background"]}`}>
                            <div
                                onClick={() => setAppendicesVisible(!appendicesVisible)}
                                className={`${loadedAppendices.length > 0 ? "opacity-100" : "opacity-0 "} ${appendicesVisible ? `sticky top-0 text-base md:text-lg mb-1.5 p-2 justify-center rounded-t drop-shadow-md backdrop-blur-xl` : ` h-full justify-between px-2 text-xl md:text-2xl`} transition-all duration-100 ease-linear flex items-center text-center ${colors[theme]["page-text"]}`}>
                                <div className={`${appendicesVisible ? "" : "flex justify-between w-full"}`}>{translationApplication.appendices}{` `}<span className={`${colors[theme]["matching-text"]}`}>{searchResultAppendices.length}</span></div>
                            </div>
                            <div
                                lang={lang}
                                className={`text-sm md:text-base text-justify hyphens-auto w-full ${colors[theme]["text"]} transition-all duration-100 ease-linear ${loadedAppendices.length > 0 ? "max-h-full" : "h-0"}`}>
                                <div className={`w-full flex flex-col space-y-1.5 ${appendicesVisible ? "mb-10 pb-1.5" : ""}`}>
                                    {appendicesVisible &&
                                        loadedAppendices.map((result, index) => {
                                            const isIntro = result.appx === '0';
                                            const confirmKey = isIntro ? `intro:${result.key}` : `appx:${result.appx}-${result.key}`

                                            const pulsate = notify === `appendix_${confirmKey}` ? `animate-pulse` : ``;
                                            return (
                                                <div
                                                    ref={(node) => {
                                                        appendicesReferences.current[confirmKey] = node;
                                                        if (index === loadedAppendices.length - 1) {
                                                            lastAppendixElementRef(node);
                                                        }
                                                    }}
                                                    key={`appendix-${confirmKey}-${index}`}
                                                    className={`p-1.5 rounded ${colors[theme]["text-background"]} cursor-pointer mx-1.5 md:mr-2 ${pulsate}`}
                                                    onClick={handleConfirm(confirmKey, `appendix`)}
                                                >
                                                    {isIntro ? (
                                                        <>
                                                            <span className="text-sky-500">{translationApplication.intro}</span> {lightWords(result.introText)}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-sky-500">{translationApplication.appendix}-{result.appx}</span> {lightWords(result.appendixText)}
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            </div>

                        </div>
                    </div>
                }
                {searchTerm.length === 0 && (
                    <div dir={direction} className={`w-full h-full flex items-start justify-center px-5 pt-4 overflow-y-auto opacity-75`}>
                        <div className={`text-xs md:text-sm ${colors[theme]["page-text"]} space-y-2.5 max-w-2xl`}>
                            <div className="flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                                <span>{translationApplication?.searchHint1}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                                <span className="w-3 h-3 shrink-0 mx-0.5 flex items-center justify-center">•</span>
                                <span>{translationApplication?.searchHintExamples}</span>
                            </div>
                            <div className={`flex items-center gap-2.5 ${direction === 'rtl' ? 'pr-5' : 'pl-5'}`}>
                                <span className={`shrink-0 font-mono font-bold ${colors[theme]["matching-text"]}`}>{translationApplication?.searchHint2aEx}</span>
                                <span>{translationApplication?.searchHint2a}</span>
                            </div>
                            <div className={`flex items-center gap-2.5 ${direction === 'rtl' ? 'pr-5' : 'pl-5'}`}>
                                <span className={`shrink-0 font-mono font-bold ${colors[theme]["matching-text"]}`}>{translationApplication?.searchHint2bEx}</span>
                                <span>{translationApplication?.searchHint2b}</span>
                            </div>
                            <div className={`flex items-center gap-2.5 ${direction === 'rtl' ? 'pr-5' : 'pl-5'}`}>
                                <span className={`shrink-0 font-mono font-bold ${colors[theme]["matching-text"]}`}>2:255</span>
                                <span>{translationApplication?.searchHint3a}</span>
                            </div>
                            <div className={`flex items-center gap-2.5 ${direction === 'rtl' ? 'pr-5' : 'pl-5'}`}>
                                <span className={`shrink-0 font-mono font-bold ${colors[theme]["matching-text"]}`}>2:1-5</span>
                                <span>{translationApplication?.searchHint3b}</span>
                            </div>
                            <div className={`flex items-center gap-2.5 ${direction === 'rtl' ? 'pr-5' : 'pl-5'}`}>
                                <span className={`shrink-0 font-mono font-bold ${colors[theme]["matching-text"]}`}>2:</span>
                                <span>{translationApplication?.searchHint3c}</span>
                            </div>
                            <div className={`flex items-center gap-2.5 ${direction === 'rtl' ? 'pr-5' : 'pl-5'}`}>
                                <span className={`shrink-0 font-mono font-bold ${colors[theme]["matching-text"]}`}>:12</span>
                                <span>{translationApplication?.searchHint3d}</span>
                            </div>
                            <div className={`flex items-center gap-2.5 ${direction === 'rtl' ? 'pr-5' : 'pl-5'}`}>
                                <span>{translationApplication?.searchHint4a}</span>
                            </div>
                            <div className={`flex items-center gap-2.5 ${direction === 'rtl' ? 'pr-5' : 'pl-5'}`}>
                                <span className={`shrink-0 font-mono font-bold ${colors[theme]["matching-text"]}`}>2:255, :12</span>
                            </div>
                            <div className={`flex items-center gap-2.5 ${direction === 'rtl' ? 'pr-5' : 'pl-5'}`}>
                                <span className={`shrink-0 font-mono font-bold ${colors[theme]["matching-text"]}`}>2:1-5; :12</span>
                            </div>
                            <div className={`flex items-center gap-2.5 ${direction === 'rtl' ? 'pr-5' : 'pl-5'}`}>
                                <span className={`shrink-0 font-mono font-bold ${colors[theme]["matching-text"]}`}>2: 3:45 :7</span>
                            </div>
                            <div className={`flex items-center gap-2.5 ${direction === 'rtl' ? 'pr-5' : 'pl-5'}`}>
                                <span className="opacity-60">{translationApplication?.searchHint4b}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`shrink-0 font-mono font-bold text-lg ${colors[theme]["matching-text"]}`}>A</span>
                                <span>{translationApplication?.searchHint5}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                                <span>{direction === 'rtl' ? translationApplication?.exact : translationApplication?.searchHint6}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`shrink-0 font-mono font-bold ${colors[theme]["matching-text"]}`}>19</span>
                                <span>{translationApplication?.searchHint7}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.591" /></svg>
                                <span>{translationApplication?.searchHint8}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" /></svg>
                                <span>{translationApplication?.searchHint9}</span>
                            </div>
                            <div className={`flex items-center gap-2 ${direction === 'rtl' ? 'pr-6' : 'pl-6'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12" /></svg>
                                <span>{translationApplication?.searchHint10}</span>
                            </div>
                            <div className={`flex items-center gap-2 ${direction === 'rtl' ? 'pr-6' : 'pl-6'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" /></svg>
                                <span>{translationApplication?.copied?.replace('!', '')}</span>
                                <span className="opacity-40">|</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" /></svg>
                                <span>Link</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                                <span>{translationApplication?.searchHint11}</span>
                            </div>
                        </div>
                    </div>
                )}
                {(searchTerm.length === 1 && !/^\d$/.test(searchTerm)) &&
                    <div className={`w-full h-full px-1 z-0 overflow-y-scroll`}
                        style={{
                            marginBottom: `calc(env(safe-area-inset-bottom) * 0.57 + ${window.innerWidth >= 1024 ? '4.2rem' : '3.2rem'})`
                        }}>
                        <div className={`text-lg md:text-2xl w-full p-0.5 ${colors[theme]["text"]} transition-all duration-100 ease-linear `}>
                            <div className={` w-full flex flex-col space-y-1.5 transition-all duration-200 ease-linear `}>
                                {Object.entries(loadedMap).map(([exp, themeorref], index) => (
                                    <div
                                        key={index + exp}
                                        lang={lang}
                                        dir={direction}
                                        id={`theme-container-${index}-${searchTerm}`}
                                        className={`rounded ${colors[theme]["base-background"]} ${themeorref.length === 0 ? "brightness-75" : ""} `}>
                                        <div
                                            onClick={() => handleThemeClick(index + "-" + searchTerm)}
                                            className={`rounded p-2 ${colors[theme]["base-background"]} ${openTheme === (index + "-" + searchTerm) ? `sticky top-0 z-20` : ``}`}>
                                            {exp}
                                        </div>
                                        {openTheme === (index + "-" + searchTerm) && (
                                            <div className={`flex flex-col space-y-1.5 p-1`}>
                                                {typeof themeorref === 'object' ?
                                                    Object.entries(themeorref).map(([innerTheme, ref]) => {
                                                        if (innerTheme === '') {
                                                            innerTheme = exp;
                                                        }
                                                        return (
                                                            <div key={innerTheme} className={`p-1 ${colors[theme]["notes-background"]} rounded`}>
                                                                <div
                                                                    onClick={() => handleSubThemeClick(index + "-" + searchTerm, innerTheme)}
                                                                    className={`p-1 cursor-pointer ${colors[theme]["notes-background"]} ${openSubTheme[index + "-" + searchTerm]?.[innerTheme] ? "sticky top-11 " : ""}`}>
                                                                    {innerTheme}
                                                                </div>
                                                                {openSubTheme[index + "-" + searchTerm]?.[innerTheme] && (
                                                                    <div className={`p-0.5 rounded ${colors[theme]["base-background"]} flex flex-col space-y-1`}>{renderref(ref, openSubTheme, index + "-" + searchTerm)}</div>
                                                                )}
                                                            </div>
                                                        )
                                                    })
                                                    :
                                                    <div className={`rounded ${colors[theme]["base-background"]} flex flex-col space-y-1`}>{renderref(themeorref, openTheme, null)}</div>
                                                }
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                }
            </div>
            {optionsVisible && (
                <div dir={direction} className={`fixed left-1 right-1 ${colors[theme]["app-background"]} z-50 shadow-lg rounded px-1 py-1.5 border ${colors[theme]["border"]}`}
                    style={{ top: `calc(3.3rem + env(safe-area-inset-top) * 0.76)` }}>
                    <div className={`flex flex-col text-lg md:text-xl`}>
                        {direction !== 'rtl' && (
                        <label className={`flex items-center justify-between md:justify-end gap-2 p-3 border-b cursor-pointer ${colors[theme]["verse-border"]}`}>
                            <span className={`${caseSensitive ? colors[theme]["text"] : colors[theme]["page-text"]}`}>{translationApplication?.case}</span>
                            <div>
                                <label className='flex cursor-pointer select-none items-center'>
                                    <div className='relative'>
                                        <input
                                            type='checkbox'
                                            checked={caseSensitive}
                                            onChange={(e) => setCaseSensitive(e.target.checked)}
                                            className='sr-only'
                                        />
                                        <div className={`box block h-8 w-14 rounded-full ${caseSensitive ? colors[theme]["text-background"] : colors[theme]["base-background"]}`}></div>
                                        <div className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full ${caseSensitive ? colors[theme]["matching"] : colors[theme]["notes-background"]} transition ${caseSensitive ? 'translate-x-full' : ''}`}></div>
                                    </div>
                                </label>
                            </div>
                        </label>
                        )}
                        {direction !== 'rtl' && (
                        <label className={`flex items-center justify-between md:justify-end gap-2 p-3 border-b cursor-pointer ${colors[theme]["verse-border"]}`}>
                            <span className={`${normalize ? colors[theme]["text"] : colors[theme]["page-text"]}`}>{translationApplication?.norm}</span>
                            <div>
                                <label className='flex cursor-pointer select-none items-center'>
                                    <div className='relative'>
                                        <input
                                            type='checkbox'
                                            checked={normalize}
                                            onChange={(e) => setNormalize(e.target.checked)}
                                            className='sr-only'
                                        />
                                        <div className={`box block h-8 w-14 rounded-full ${normalize ? colors[theme]["text-background"] : colors[theme]["base-background"]}`}></div>
                                        <div className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full ${normalize ? colors[theme]["matching"] : colors[theme]["notes-background"]} transition ${normalize ? 'translate-x-full' : ''}`}></div>
                                    </div>
                                </label>
                            </div>
                        </label>
                        )}
                        <label className={`flex items-center justify-between md:justify-end gap-2 p-3 cursor-pointer`}>
                            <span className={`${exactMatch ? colors[theme]["text"] : colors[theme]["page-text"]}`}>{translationApplication?.exact || "Exact Match"}</span>
                            <div>
                                <label className='flex cursor-pointer select-none items-center'>
                                    <div className='relative'>
                                        <input
                                            type='checkbox'
                                            checked={exactMatch}
                                            onChange={(e) => setExactMatch(e.target.checked)}
                                            className='sr-only'
                                        />
                                        <div className={`box block h-8 w-14 rounded-full ${exactMatch ? colors[theme]["text-background"] : colors[theme]["base-background"]}`}></div>
                                        <div className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full ${exactMatch ? colors[theme]["matching"] : colors[theme]["notes-background"]} transition ${exactMatch ? 'translate-x-full' : ''}`}></div>
                                    </div>
                                </label>
                            </div>
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Magnify;
