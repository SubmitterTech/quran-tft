import React, { useState, useEffect, useCallback, useRef } from 'react';

const Magnify = ({ colors, theme, translationApplication, quran, map, onClose, onConfirm, direction }) => {
    const lang = localStorage.getItem("lang")

    const [searchTerm, setSearchTerm] = useState("");
    //const [exactMatch, setExactMatch] = useState(false);
    const [caseSensitive, setCaseSensitive] = useState(() => {
        const saved = localStorage.getItem("case");
        return saved !== null ? JSON.parse(saved) : false;
    });
    const [normalize, setNormalize] = useState(() => {
        const saved = localStorage.getItem("norm");
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [optionsVisible, setOptionsVisible] = useState(false);

    const [searchResultTitles, setSearchResultTitles] = useState([]);
    const [searchResultVerses, setSearchResultVerses] = useState([]);
    const [searchResultNotes, setSearchResultNotes] = useState([]);

    const [loadedTitles, setLoadedTitles] = useState([]);
    const [loadedVerses, setLoadedVerses] = useState([]);
    const [loadedNotes, setLoadedNotes] = useState([]);
    const [loadedMap, setLoadedMap] = useState([]);

    const batchSize = 19;
    const observerTitles = useRef();
    const observerVerses = useRef();
    const observerNotes = useRef();

    const inputRef = useRef(null);

    const [openTheme, setOpenTheme] = useState(null);

    const [quranmap, setQuranmap] = useState({});

    useEffect(() => {
        let qm = {};
        Object.values(quran).forEach((value) => {
            Object.entries(value.sura).forEach(([sura, content]) => {
                // Initialize qm[sura] as an object if it doesn't exist
                if (!qm[sura]) {
                    qm[parseInt(sura)] = {};
                }

                Object.entries(content.verses).forEach(([verse, text]) => {
                    qm[parseInt(sura)][parseInt(verse.trim())] = text;
                });
            });
        });
        setQuranmap(qm);
    }, [quran]);


    const handleThemeClick = (theme) => {
        setOpenTheme(openTheme === theme ? null : theme);
    };

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    useEffect(() => {
        if (searchTerm !== "") {
            localStorage.setItem("st", searchTerm)
        }
    }, [searchTerm]);

    useEffect(() => {
        if (localStorage.getItem("st")) {
            setSearchTerm(localStorage.getItem("st"));
        }
    }, []);

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
            return;
        }

        // const keywords = normalizeText(term).toLowerCase().split(' ').filter(keyword => keyword.trim() !== '');
        let processedTerm = term;
        processedTerm = normalize ? normalizeText(processedTerm) : processedTerm;
        processedTerm = caseSensitive ? processedTerm : processedTerm.toLocaleUpperCase(lang);

        const keywords = processedTerm.split(' ').filter(keyword => keyword.trim() !== '');
        const titleResults = [];
        const verseResults = [];
        const notesResults = [];

        for (const page in quran) {
            const suras = quran[page].sura;

            for (const suraNumber in suras) {
                const verses = suras[suraNumber].verses;
                for (const verseNumber in verses) {
                    const verseText = verses[verseNumber];
                    // const processedVerseText = normalizeText(verseText).toLowerCase();
                    let processedVerseText = verseText;
                    processedVerseText = normalize ? normalizeText(processedVerseText) : processedVerseText;
                    processedVerseText = caseSensitive ? processedVerseText : processedVerseText.toLocaleUpperCase(lang);

                    if (keywords.every(keyword => processedVerseText.includes(keyword)) ||
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
                        })) {
                        verseResults.push({ suraNumber, verseNumber, verseText });
                    }
                }
                const titles = suras[suraNumber].titles;
                for (const titleNumber in titles) {
                    const titleText = titles[titleNumber];
                    // const processedTitleText = normalizeText(titleText).toLowerCase();
                    let processedTitleText = titleText;
                    processedTitleText = normalize ? normalizeText(processedTitleText) : processedTitleText;
                    processedTitleText = caseSensitive ? processedTitleText : processedTitleText.toLocaleUpperCase(lang);

                    if (keywords.every(keyword => processedTitleText.includes(keyword))) {
                        titleResults.push({ suraNumber, titleNumber, titleText });
                    }
                }
                const notes = quran[page].notes.data;
                if (notes.length > 0) {
                    Object.values(notes).forEach((note) => {
                        // const processedNote = normalizeText(note).toLowerCase();
                        let processedNote = note;
                        processedNote = normalize ? normalizeText(processedNote) : processedNote;
                        processedNote = caseSensitive ? processedNote : processedNote.toLocaleUpperCase(lang);

                        if (keywords.every(keyword => processedNote.includes(keyword))) {
                            const match = note.match(/\*+\d+:\d+/g);

                            if (match && match.length > 0) {
                                const cleanedRef = match[0].replace(/^\*+/, '');
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
        setSearchResultTitles(titleResults);
        setSearchResultVerses(verseResults);
        setSearchResultNotes(notesResults);
    }, [quran, caseSensitive, normalize, lang]);

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

    const lightWords = (text, term) => {
        const highlightText = (originalText, keyword) => {
            let processedText = originalText;
            processedText = normalize ? normalizeText(processedText) : processedText;
            processedText = caseSensitive ? processedText : processedText.toLocaleUpperCase(lang);
            const escapedKeyword = removePunctuations(keyword);
            const regex = new RegExp(escapedKeyword, 'gi');
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
        };

        let processedTerm = term;
        processedTerm = normalize ? normalizeText(processedTerm) : processedTerm;
        processedTerm = caseSensitive ? processedTerm : processedTerm.toLocaleUpperCase(lang);
        const keywords = processedTerm.split(' ').filter(keyword => keyword.trim() !== '');
        let highlightedText = [text];

        keywords.forEach(keyword => {
            highlightedText = highlightedText.flatMap(part => typeof part === 'string' ? highlightText(part, keyword) : part);
        });

        return highlightedText;
    };

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


    useEffect(() => {
        setLoadedTitles(searchResultTitles.slice(0, batchSize));
        setLoadedVerses(searchResultVerses.slice(0, batchSize));
        setLoadedNotes(searchResultNotes.slice(0, batchSize));

    }, [searchResultTitles, searchResultVerses, searchResultNotes]);

    const handleConfirm = (key) => {
        if (onConfirm) {
            onConfirm(key);
            onClose();
        }
    };

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
                                    const verseText = quranmap[parseInt(sura)]?.[i];
                                    if (verseText) {
                                        verseResults.push({ suraNumber: sura, verseNumber: i, text: verseText });
                                    }
                                }
                            } else {
                                // Single verse
                                const verseText = quranmap[parseInt(sura)]?.[parseInt(verse.trim())];
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
                                const verseText = quranmap[parseInt(sura)]?.[i];
                                if (verseText) {
                                    verseResults.push({ suraNumber: sura, verseNumber: i, text: verseText });
                                }
                            }
                        } else {
                            const verseText = quranmap[parseInt(sura)]?.[parseInt(verses.trim())];
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
                    onClick={() => handleConfirm(`${suraNumber}:${verseNumber}`)}>
                    <span className="text-sky-500">{suraNumber}:{verseNumber}</span> {text}
                </div>
            ));
        }
        return null;
    };

    return (
        <div className={` w-screen h-screen animated overflow-auto faster fixed  left-0 top-0 flex flex-col items-center justify-start inset-0 z-10 outline-none focus:outline-none backdrop-blur-2xl`} id="jump-screen"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) * 0.76)', paddingBottom: 'calc(env(safe-area-inset-bottom) * 0.57)' }}
        >
            <div className={`w-full flex p-1.5 sticky top-0 backdrop-blur-2xl`}>
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
                                localStorage.removeItem("st");
                                inputRef.current && inputRef.current.focus();
                            } else {
                                onClose();
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
                    className={`flex flex-col flex-1 space-y-1 w-full overflow-auto mb-12 md:mb-14 lg:mb-16`}>
                    <div className={`${loadedTitles.length > 0 ? (loadedVerses.length > 0 && loadedNotes.length > 0) ? "basis-2/12  p-1 mx-1 border" : "flex-1 p-1 mx-1 border" : "h-0 "} transition-all duration-200 ease-linear  overflow-auto rounded ${colors[theme]["verse-border"]} ${colors[theme]["text-background"]}`}>
                        <div className={`${loadedTitles.length > 0 ? "opacity-100" : "opacity-0 h-0"} sticky -top-1 text-sm md:text-base text-center rounded backdrop-blur-xl ${colors[theme]["page-text"]}`}>
                            {translationApplication.titles}{` `}<span className={`${colors[theme]["matching-text"]}`}>{searchResultTitles.length}</span>
                        </div>
                        <div className={`text-sm md:text-base w-full ${colors[theme]["text"]}`}>
                            <div className={`w-full flex flex-col space-y-1.5`}>
                                {loadedTitles.map((result, index) => (
                                    <div
                                        ref={index === loadedTitles.length - 1 ? lastTitleElementRef : null}
                                        key={`${result.suraNumber}-${result.titleNumber}-${index}`}
                                        className={`p-2 rounded  ${colors[theme]["base-background"]} cursor-pointer ml-0.5 mr-0.5 md:mr-1.5`}
                                        onClick={() => handleConfirm(`${result.suraNumber}:${result.titleNumber}`)}>
                                        <span className="text-sky-500">{result.suraNumber}:{result.titleNumber}</span> {lightWords(result.titleText, searchTerm)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={`${loadedVerses.length > 0 ? (loadedNotes.length > 0 && loadedTitles.length > 0) ? "basis-7/12  p-1 mx-1 border" : "flex-1 p-1 mx-1 border" : "h-0 "} transition-all duration-200 ease-linear overflow-auto rounded ${colors[theme]["verse-border"]} ${colors[theme]["base-background"]}`}>
                        <div className={`${loadedVerses.length > 0 ? "opacity-100" : "opacity-0 h-0"} sticky -top-1 text-sm md:text-base text-center rounded backdrop-blur-xl ${colors[theme]["page-text"]}`}>
                            {translationApplication.verses}{` `}<span className={`${colors[theme]["matching-text"]}`}>{searchResultVerses.length}</span>
                        </div>
                        <div
                            lang={lang}
                            className={`text-sm md:text-base text-justify hyphens-auto w-full ${colors[theme]["text"]} ${loadedVerses.length > 0 ? "max-h-full" : "h-0 "}`}>
                            <div className={`w-full flex flex-col space-y-1.5`}>
                                {loadedVerses.map((result, index) => (
                                    <div
                                        ref={index === loadedVerses.length - 1 ? lastVerseElementRef : null}
                                        key={`${result.suraNumber}-${result.verseNumber}-${index}`}
                                        className={` p-1.5 rounded  ${colors[theme]["text-background"]} cursor-pointer ml-0.5 mr-0.5 md:mr-1.5`}
                                        onClick={() => handleConfirm(`${result.suraNumber}:${result.verseNumber}`)}>
                                        <span className="text-sky-500">{result.suraNumber}:{result.verseNumber}</span> {lightWords(result.verseText, searchTerm)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={`${loadedNotes.length > 0 ? (loadedVerses.length > 0 && loadedTitles.length > 0) ? "basis-3/12  p-1 mx-1 border" : "flex-1 p-1 mx-1 border" : "h-0 "} transition-all duration-200 ease-linear  overflow-auto rounded ${colors[theme]["verse-border"]} ${colors[theme]["base-background"]}`}>
                        <div className={`${loadedNotes.length > 0 ? "opacity-100" : "opacity-0 "} sticky -top-1 text-sm md:text-base text-center rounded backdrop-blur-xl  ${colors[theme]["page-text"]}`}>
                            {translationApplication.notes}{` `}<span className={`${colors[theme]["matching-text"]}`}>{searchResultNotes.length}</span>
                        </div>
                        <div
                            lang={lang}
                            className={`text-sm md:text-base text-justify hyphens-auto w-full mb-10 ${colors[theme]["text"]} transition-all duration-200 ease-linear ${loadedNotes.length > 0 ? "max-h-full" : "h-0 "}`}>
                            <div className={`w-full flex flex-col space-y-1.5`}>
                                {loadedNotes.map((result, index) => (
                                    <div
                                        ref={index === loadedNotes.length - 1 ? lastNoteElementRef : null}
                                        key={`${result.suraNumber}-${result.verseNumber}-${index}`}
                                        className={` p-1.5 rounded  ${colors[theme]["notes-background"]} cursor-pointer ml-0.5 mr-0.5 md:mr-1.5`}
                                        onClick={() => handleConfirm(`${result.suraNumber}:${result.verseNumber}`)}>
                                        {lightWords(result.note, searchTerm)}
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

            }
            {searchTerm.length === 1 &&
                <div className={`w-full px-1 mb-12 lg:mb-14 xl:mb-16`}>
                    <div className={`text-lg md:text-base w-full p-0.5 ${colors[theme]["text"]} transition-all duration-200 ease-linear overflow-y-auto`}>
                        <div className={` w-full flex flex-col space-y-1.5 transition-all duration-200 ease-linear `}>
                            {Object.entries(loadedMap).map(([exp, themeorref]) => (
                                <div
                                    key={exp}

                                    className={`rounded  ${colors[theme]["base-background"]} ${themeorref.length === 0 ? "brightness-75" : ""}`}>
                                    <div
                                        onClick={() => handleThemeClick(exp)}
                                        className={`rounded p-2`}>
                                        {exp}
                                    </div>
                                    {openTheme === exp && (
                                        <div className={`flex flex-col space-y-1.5 mt-3 p-1 pl-1.5`}>
                                            {typeof themeorref === 'object' ?
                                                Object.entries(themeorref).map(([innerTheme, ref]) => (
                                                    <div key={innerTheme} className={`p-1 pl-1.5 ${colors[theme]["app-background"]} rounded  `}>
                                                        <div className={`p-1`}>{innerTheme}</div>
                                                        <div className={`p-1 rounded ${colors[theme]["base-background"]} flex flex-col space-y-1`}>{renderref(ref)}</div>
                                                    </div>
                                                ))
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

            {optionsVisible && (
                <div className={`absolute mt-12 left-1 right-1 top-1 ${colors[theme]["app-background"]} shadow-lg rounded px-1 py-1.5 border ${colors[theme]["verse-border"]}`}>
                    <div className={`flex flex-col space-y-1.5 text-lg md:text-xl`}>
                        <label className={`flex items-center justify-between md:justify-end space-x-2 py-2 px-4 rounded border ${caseSensitive && direction !== 'rtl' ? colors[theme]["matching-border"] : colors[theme]["border"]} cursor-pointer`}>
                            <span className={`${caseSensitive && direction !== 'rtl' ? colors[theme]["text"] : colors[theme]["page-text"]}`}>{translationApplication?.case}</span>
                            <input disabled={direction === 'rtl'} type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} className={`w-8 h-8 text-sky-600 focus:ring-sky-500 border-neutral-400 rounded`} />
                        </label>
                        {/* <label className={`flex items-center justify-between md:justify-end space-x-2 py-2 px-4 rounded ${colors[theme]["text-background"]} cursor-pointer`}>
                            <span>Exact Match</span>
                            <input type="checkbox" checked={exactMatch} onChange={(e) => setExactMatch(e.target.checked)} className="w-8 h-8 text-sky-600 focus:ring-sky-500 border-gray-300 rounded" />
                        </label> */}
                        <label className={`flex items-center justify-between md:justify-end space-x-2 py-2 px-4 rounded border ${normalize && direction !== 'rtl' ? colors[theme]["matching-border"] : colors[theme]["border"]} cursor-pointer`}>
                            <span className={`${normalize && direction !== 'rtl' ? colors[theme]["text"] : colors[theme]["page-text"]}`}>{translationApplication?.norm}</span>
                            <input disabled={direction === 'rtl'} type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} className={`w-8 h-8 text-sky-600 focus:ring-sky-500 border-neutral-400 rounded`} />
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Magnify;
