import React, { useState, useEffect, useCallback, useRef } from 'react';
import { mapAppendices, mapQuran } from '../utils/Mapper';

const Magnify = ({ colors, theme, translationApplication, quran, map, appendices, introduction, onClose, onConfirm, direction, multiSelect, setMultiSelect, selectedVerseList, setSelectedVerseList }) => {
    const lang = localStorage.getItem("lang");

    const [searchTerm, setSearchTerm] = useState(localStorage.getItem("qurantft-magnify-st") || "");
    //const [exactMatch, setExactMatch] = useState(false);
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

    const [titlesVisible, setTitlesVisible] = useState(false);
    const [versesVisible, setVersesVisible] = useState(true);
    const [notesVisible, setNotesVisible] = useState(false);
    const [appendicesVisible, setAppendicesVisible] = useState(false);

    const [searchResultTitles, setSearchResultTitles] = useState([]);
    const [searchResultVerses, setSearchResultVerses] = useState([]);
    const [searchResultNotes, setSearchResultNotes] = useState([]);
    const [searchResultAppendices, setSearchResultAppendices] = useState([]);

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

    const normalizeText = (text) => {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    const removePunctuations = (text) => {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    const performSearch = useCallback((term) => {
        if (!term) {
            return;
        }
        if (term.length < 2) {
            setSearchResultTitles([]);
            setSearchResultVerses([]);
            setSearchResultNotes([]);
            setSearchResultAppendices([]);
            return;
        }

        let processedTerm = normalize ? normalizeText(term) : term;
        processedTerm = caseSensitive ? processedTerm : processedTerm.toLocaleUpperCase(lang);

        // Split the search term by '|' to get OR terms
        const orTerms = processedTerm.split('|').map(term => term.trim()).filter(term => term !== '');

        const keywordGroups = orTerms.map(term => {
            return term.split(/\s+/)
                .map(keyword => /\d+/.test(keyword) ? keyword.replace(/[;,]+/g, '') : keyword)
                .filter(keyword => keyword.trim() !== '');
        });
        const titleResults = [];
        const verseResults = [];
        const notesResults = [];
        const appendicesResults = [];

        for (const page in quran) {
            const suras = quran[page].sura;
            for (const suraNumber in suras) {
                const verses = suras[suraNumber].verses;
                for (const verseNumber in verses) {
                    const verseText = verses[verseNumber];
                    let processedVerseText = normalize ? normalizeText(verseText) : verseText;
                    processedVerseText = caseSensitive ? processedVerseText : processedVerseText.toLocaleUpperCase(lang);

                    if (keywordGroups.some(keywords => {
                        return keywords.every(keyword => processedVerseText.includes(keyword)) ||
                            keywords.some(keyword => {
                                if (/\d+/.test(keyword) && (keyword.includes(':') || keyword.includes('-'))) {
                                    if (keyword.includes(':')) {
                                        const [keywordSura, keywordVerse] = keyword.split(':');
                                        if (keywordVerse.includes('-')) {
                                            const [startVerse, endVerse] = keywordVerse.split('-').map(Number);
                                            const verseNum = Number(verseNumber);
                                            return keywordSura === suraNumber && verseNum >= startVerse && verseNum <= endVerse;
                                        } else {
                                            return (keywordSura === suraNumber && keywordVerse === verseNumber) ||
                                                (keywordSura === suraNumber && keywordVerse === '') ||
                                                (keywordSura === '' && keywordVerse === verseNumber);
                                        }
                                    } else {
                                        return keyword === suraNumber || keyword === verseNumber;
                                    }
                                }
                                return false; // Ensure that non-numeric keywords do not trigger numeric checks
                            });
                    })) {
                        verseResults.push({ suraNumber, verseNumber, verseText });
                    }
                }
                const titles = suras[suraNumber].titles;
                for (const titleNumber in titles) {
                    const titleText = titles[titleNumber];
                    let processedTitleText = normalize ? normalizeText(titleText) : titleText;
                    processedTitleText = caseSensitive ? processedTitleText : processedTitleText.toLocaleUpperCase(lang);

                    if (keywordGroups.some(keywords => keywords.every(keyword => processedTitleText.includes(keyword)))) {
                        titleResults.push({ suraNumber, titleNumber, titleText });
                    }
                }
                const notes = quran[page].notes.data;
                if (notes.length > 0) {
                    Object.values(notes).forEach((note) => {
                        let processedNote = normalize ? normalizeText(note) : note;
                        processedNote = caseSensitive ? processedNote : processedNote.toLocaleUpperCase(lang);

                        if (keywordGroups.some(keywords => keywords.every(keyword => processedNote.includes(keyword)))) {
                            const match = note.match(/\*+\d+:\d+/g);

                            if (match && match.length > 0) {
                                let cleanedRef = match[0].replace(/^\*+/, '');
                                if (match[1] && match[1] === '*9:127') {
                                    cleanedRef = match[1].replace(/^\*+/, '');
                                }
                                const ref = cleanedRef.split(":");
                                const suraNumberRef = ref[0];
                                const verseNumberRef = ref[1];

                                if (!notesResults.some(result =>
                                    result.suraNumber === suraNumberRef &&
                                    result.verseNumber === verseNumberRef &&
                                    result.note.replace(/^\*+/, '') === note.replace(/^\*+/, ''))) {
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
                Object.entries(introContent)
                    .forEach(([type, content]) => {
                        page = type === "page" ? content : page;
                        Object.entries(content).forEach(([order, value]) => {
                            const appx = '0';
                            const introText = value.toString();
                            const key = page + "-" + type + "-" + order;
                            let processedIntroText = normalize ? normalizeText(introText) : introText;
                            processedIntroText = caseSensitive ? processedIntroText : processedIntroText.toLocaleUpperCase(lang);

                            if (keywordGroups.some(keywords => keywords.every(keyword => processedIntroText.includes(keyword)))) {
                                appendicesResults.push({ appx, key, introText });
                            }
                        });
                    });
            }
        }

        for (const appx in appsmap) {
            const appxContent = appsmap[appx].content;
            Object.values(appxContent)
                .filter(element => (element.type === "text" || element.type === "title"))
                .forEach(element => {
                    const appendixText = element.content.toString();
                    const key = element.type + "-" + element.key + "-" + element.order;
                    let processedAppendixText = normalize ? normalizeText(appendixText) : appendixText;
                    processedAppendixText = caseSensitive ? processedAppendixText : processedAppendixText.toLocaleUpperCase(lang);

                    if (keywordGroups.some(keywords => keywords.every(keyword => processedAppendixText.includes(keyword)))) {
                        appendicesResults.push({ appx, key, appendixText });
                    }
                });
        }

        setSearchResultTitles(titleResults);
        setSearchResultVerses(verseResults);
        setSearchResultNotes(notesResults);
        setSearchResultAppendices(appendicesResults);

    }, [quran, introduction, appsmap, caseSensitive, normalize, lang]);

    const performSearchSingleLetter = useCallback((term) => {
        const capitalizedTerm = term.toLocaleUpperCase(lang);
        if (capitalizedTerm.length === 1 && map[capitalizedTerm]) {
            setLoadedMap(map[capitalizedTerm]);
        }
    }, [map, lang]);

    useEffect(() => {
        if (searchTerm) {
            if (searchTerm.length > 1) {
                performSearch(searchTerm);
            } else if (searchTerm.length === 1) {
                performSearchSingleLetter(searchTerm);
            }
        }
    }, [searchTerm, performSearch, performSearchSingleLetter]);

    const highlightText = useCallback((originalText, keyword) => {
        let processedText = originalText;
        processedText = normalize ? normalizeText(processedText) : processedText;
        processedText = caseSensitive ? processedText : processedText.toLocaleUpperCase(lang);
        const escapedKeyword = removePunctuations(keyword);
        const regex = new RegExp(escapedKeyword, caseSensitive ? 'g' : 'gi');
        let match;
        const parts = [];
        let currentIndex = 0;

        while ((match = regex.exec(processedText)) !== null) {
            const matchIndex = match.index;
            const matchText = originalText.substr(matchIndex, match[0].length);

            if (matchIndex > currentIndex) {
                parts.push(originalText.substring(currentIndex, matchIndex));
            }
            parts.push(<span className={`font-bold ${colors[theme]["matching-text"]}`}>{matchText}</span>);
            currentIndex = matchIndex + matchText.length;
        }

        if (currentIndex < originalText.length) {
            parts.push(originalText.substring(currentIndex));
        }

        return parts;
    }, [caseSensitive, normalize, lang, colors, theme]);

    const lightWords = useCallback((text) => {
        let processedTerm = searchTerm;
        processedTerm = normalize ? normalizeText(processedTerm) : processedTerm;
        processedTerm = caseSensitive ? processedTerm : processedTerm.toLocaleUpperCase(lang);
        const keywords = processedTerm.split(' ').filter(keyword => (keyword.trim() !== '' && keyword.trim() !== '|'));
        let highlightedText = [text];

        keywords.forEach((keyword) => {
            highlightedText = highlightedText.flatMap(part => typeof part === 'string' ? highlightText(part, keyword) : part);
        });

        return highlightedText;
    }, [searchTerm, caseSensitive, lang, normalize, highlightText]);

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
                    return;
            }

            if (!hasConsumedLastSelection.current && searchResultData.length > 0) {
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
                    }, 190);

                    lastSelection.current = "";
                    hasConsumedLastSelection.current = true;
                    loadingElementsTimer.current = null;
                }, 19);
            }
        }

    }, [searchResultTitles, searchResultVerses, searchResultNotes, searchResultAppendices]);

    useEffect(() => {
        return () => {
            if (hasConsumedLastSelection.current && !saveLastSelection.current) {
                localStorage.removeItem("qurantft-magnify-ls");
            }
        }
    }, []);

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

    const renderref = (ref) => {
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

            return verseResults.map(({ suraNumber, verseNumber, text }, index) => (
                <div
                    key={index}
                    className={`rounded p-2  ${colors[theme]["text-background"]}`}
                    onClick={handleConfirm(`${suraNumber}:${verseNumber}`)}>
                    <span className={`text-sky-500 ${direction === 'rtl' ? "ml-1" : "mr-1"}`}>{suraNumber}:{verseNumber}</span>{text}
                </div>
            ));
        }
        return null;
    };

    return (
        <div className={` w-screen h-screen fixed z-10 left-0 top-0 backdrop-blur-2xl`} id="jump-screen"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) * 0.57)' }}
        >
            <div className={`fixed flex flex-col items-center justify-start faster inset-0 outline-none focus:outline-none overflow-auto `}>
                <div className={`w-full flex p-1.5 sticky top-0 backdrop-blur-2xl z-20`} style={{ paddingTop: 'calc((env(safe-area-inset-top) * 0.76) + 0.3rem)' }}>
                    <div className={`relative w-full flex rounded  space-x-2`}>
                        <input
                            type="text"
                            dir={direction}
                            ref={inputRef}
                            id="searchBar"
                            placeholder={translationApplication.search + "..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => { setOptionsVisible(false) }}
                            className={`w-full p-2 rounded ${colors[theme]["app-background"]} ${colors[theme]["page-text"]} focus:outline-none focus:ring-2 ${colors[theme]["focus-ring"]} ${colors[theme]["focus-text"]}`}
                        />
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
                {searchTerm.length > 1 &&
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
                                <div
                                    onClick={() => setVersesVisible(!versesVisible)}
                                    className={`${versesVisible ? `${direction === 'rtl' ? `pr-14` : `pl-10`}` : ``} flex items-center w-full p-3 h-10`}>
                                    <div dir={direction} className={`w-full flex items-center ${versesVisible ? `justify-center space-x-2` : `justify-between`}`}>
                                        <div className={`${direction === 'rtl' ? `pl-5` : ``}`}>{translationApplication.verses}{` `}</div>
                                        <div className={`${colors[theme]["matching-text"]}`}>{searchResultVerses.length}</div>
                                    </div>
                                </div>
                                {versesVisible &&
                                    <div
                                        onClick={() => setMultiSelect(!multiSelect)}
                                        style={{ animation: 'animate-scale 0.3s ease-in-out' }}
                                        className={` ${direction === 'rtl' ? `mr-3` : `ml-3`} cursor-pointer right-1 top-0 p-1 transition-all duration-100 ease-linear ${multiSelect ? `${selectedVerseList.length > 0 ? `${colors[theme]["matching-text"]}` : `${colors[theme]["text"]}`}` : `${colors[theme]["passive-text"]}`}`}>
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
                                                        key={`verse-${thekey}-index`}
                                                        className={`p-1.5 rounded ${colors[theme]["text-background"]} cursor-pointer mx-1.5 md:mr-2 ${hasring} ${pulsate}`}
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
                {searchTerm.length === 1 &&
                    <div className={`w-full h-full px-1 z-0 overflow-y-scroll`}
                        style={{
                            marginBottom: `calc(env(safe-area-inset-bottom) * 0.57 + ${window.innerWidth >= 1024 ? '4.2rem' : '3.2rem'})`
                        }}>
                        <div className={`text-lg md:text-2xl w-full p-0.5 ${colors[theme]["text"]} transition-all duration-100 ease-linear overflow-y-auto`}>
                            <div className={` w-full flex flex-col space-y-1.5 transition-all duration-200 ease-linear `}>
                                {Object.entries(loadedMap).map(([exp, themeorref], index) => (
                                    <div
                                        key={index + exp}
                                        lang={lang}
                                        dir={direction}
                                        id={`theme-container-${index}-${searchTerm}`}
                                        className={`rounded ${colors[theme]["base-background"]} ${themeorref.length === 0 ? "brightness-75" : ""}`}>
                                        <div
                                            onClick={() => handleThemeClick(index + "-" + searchTerm)}
                                            className={`rounded p-2`}>
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
                                                                    className={`p-1 cursor-pointer`}>
                                                                    {innerTheme}
                                                                </div>
                                                                {openSubTheme[index + "-" + searchTerm]?.[innerTheme] && (
                                                                    <div className={`p-0.5 rounded ${colors[theme]["base-background"]} flex flex-col space-y-1`}>{renderref(ref)}</div>
                                                                )}
                                                            </div>
                                                        )
                                                    })
                                                    :
                                                    <div className={`rounded ${colors[theme]["base-background"]} flex flex-col space-y-1`}>{renderref(themeorref)}</div>
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
                <div className={`fixed left-1 right-1 ${colors[theme]["app-background"]} z-50 shadow-lg rounded px-1 py-1.5 border ${colors[theme]["border"]}`}
                    style={{ top: `calc(3.3rem + env(safe-area-inset-top) * 0.76)` }}>
                    <div className={`flex flex-col text-lg md:text-xl`}>
                        <label className={`flex items-center justify-between md:justify-end space-x-2 p-3 border-b cursor-pointer ${colors[theme]["verse-border"]}`}>
                            <span className={`${caseSensitive && direction !== 'rtl' ? colors[theme]["text"] : colors[theme]["page-text"]}`}>{translationApplication?.case}</span>
                            <div>
                                <label className='flex cursor-pointer select-none items-center'>
                                    <div className='relative'>
                                        <input
                                            type='checkbox'
                                            checked={caseSensitive}
                                            disabled={direction === 'rtl'}
                                            onChange={(e) => setCaseSensitive(e.target.checked)}
                                            className='sr-only'
                                        />
                                        <div className={`box block h-8 w-14 rounded-full ${caseSensitive ? colors[theme]["text-background"] : colors[theme]["base-background"]}`}></div>
                                        <div className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full ${caseSensitive ? colors[theme]["matching"] : colors[theme]["notes-background"]} transition ${caseSensitive ? 'translate-x-full' : ''}`}></div>
                                    </div>
                                </label>
                            </div>
                        </label>
                        <label className={`flex items-center justify-between md:justify-end space-x-2 p-3 cursor-pointer `}>
                            <span className={`${normalize && direction !== 'rtl' ? colors[theme]["text"] : colors[theme]["page-text"]}`}>{translationApplication?.norm}</span>
                            <div>
                                <label className='flex cursor-pointer select-none items-center'>
                                    <div className='relative'>
                                        <input
                                            type='checkbox'
                                            checked={normalize}
                                            disabled={direction === 'rtl'}
                                            onChange={(e) => setNormalize(e.target.checked)}
                                            className='sr-only'
                                        />
                                        <div className={`box block h-8 w-14 rounded-full ${normalize ? colors[theme]["text-background"] : colors[theme]["base-background"]}`}></div>
                                        <div className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full ${normalize ? colors[theme]["matching"] : colors[theme]["notes-background"]} transition ${normalize ? 'translate-x-full' : ''}`}></div>
                                    </div>
                                </label>
                            </div>
                        </label>
                        {/* <label className={`flex items-center justify-between md:justify-end space-x-2 py-2 px-4 rounded ${colors[theme]["text-background"]} cursor-pointer`}>
                            <span>Exact Match</span>
                            <input type="checkbox" checked={exactMatch} onChange={(e) => setExactMatch(e.target.checked)} className="w-8 h-8 text-sky-600 focus:ring-sky-500 border-gray-300 rounded" />
                        </label> */}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Magnify;
