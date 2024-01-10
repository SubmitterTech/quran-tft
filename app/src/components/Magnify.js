import React, { useState, useEffect, useCallback, useRef } from 'react';

const Magnify = ({ colors, theme, translationApplication, quran, map, onClose, onConfirm }) => {
    const lang = localStorage.getItem("lang")

    const [searchTerm, setSearchTerm] = useState("");
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
                    qm[sura] = {};
                }

                Object.entries(content.verses).forEach(([verse, text]) => {
                    qm[sura][verse] = text;
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

    const removeDiacritics = (text) => {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    const escapeRegExp = (text) => {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    const performSearchSingleLetter = useCallback((term) => {
        const normalizedTerm = removeDiacritics(term).toUpperCase();
        if (normalizedTerm.length === 1 && map[normalizedTerm]) {
            setLoadedMap(map[normalizedTerm]);
        }
    }, [map]);


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

        const titleResults = [];
        const verseResults = [];
        const notesResults = [];

        for (const page in quran) {
            const suras = quran[page].sura;
            const normalizedTerm = removeDiacritics(term).toLowerCase();

            for (const suraNumber in suras) {
                const verses = suras[suraNumber].verses;
                for (const verseNumber in verses) {
                    const verseText = verses[verseNumber];
                    const normalizedVerseText = removeDiacritics(verseText).toLowerCase();

                    if (normalizedVerseText.includes(normalizedTerm)) {
                        verseResults.push({ suraNumber, verseNumber, verseText });
                    }
                }
                const titles = suras[suraNumber].titles;
                for (const titleNumber in titles) {
                    const titleText = titles[titleNumber];
                    const normalizedTitleText = removeDiacritics(titleText).toLowerCase();

                    if (normalizedTitleText.includes(normalizedTerm)) {
                        titleResults.push({ suraNumber, titleNumber, titleText });
                    }
                }
                const notes = quran[page].notes.data;
                if (notes.length > 0) {
                    Object.values(notes).forEach((note) => {
                        const normalizedNote = removeDiacritics(note).toLowerCase();

                        if (normalizedNote.includes(normalizedTerm)) {
                            const match = note.match(/\*+\d+:\d+/g);
                            if (match && match.length > 0) {
                                const ref = match[0].split("*")[1].split(":");
                                notesResults.push({ suraNumber: ref[0], verseNumber: ref[1], note });
                            }
                        }
                    });
                }
            }
        }
        setSearchResultTitles(titleResults);
        setSearchResultVerses(verseResults);
        setSearchResultNotes(notesResults);
    }, [quran]);

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
        const normalizedTerm = removeDiacritics(term);
        const escapedTerm = escapeRegExp(normalizedTerm);
        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        const regtext = removeDiacritics(text);

        let lastIndex = 0;
        return regtext.split(regex).reduce((prev, current, index) => {
            const currentLength = current.length;
            const originalSegment = text.substr(lastIndex, currentLength);

            if (regex.test(current)) {
                prev.push(<span key={index} className={`font-bold  ${colors[theme]["matching-text"]}`}>{originalSegment}</span>);
            } else {
                prev.push(originalSegment);
            }

            lastIndex += currentLength;
            return prev;
        }, []);
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
                const [sura, verses] = refPart.split(":");
                if (verses) {
                    verses.split(",").forEach(verse => {
                        if (verse.includes("-")) {
                            // Range of verses
                            const [start, end] = verse.split("-").map(Number);
                            for (let i = start; i <= end; i++) {
                                const verseText = quranmap[sura]?.[i.toString()];
                                if (verseText) {
                                    verseResults.push({ suraNumber: sura, verseNumber: i.toString(), text: verseText });
                                }
                            }
                        } else {
                            // Single verse
                            const verseText = quranmap[sura]?.[verse];
                            if (verseText) {
                                verseResults.push({ suraNumber: sura, verseNumber: verse, text: verseText });
                            }
                        }
                    });
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
        <div className={`w-screen h-screen animated overflow-auto faster fixed left-0 top-0 flex flex-col items-center justify-start inset-0 z-10 outline-none focus:outline-none backdrop-blur-2xl`} id="jump-screen">
            <div className={`w-full flex p-2 sticky top-0 backdrop-blur-2xl`}>
                <div className={`w-full flex rounded shadow-md space-x-2`}>
                    <input
                        type="text"
                        ref={inputRef}
                        id="searchBar"
                        placeholder={translationApplication.search + "..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full p-2 rounded ${colors[theme]["app-background"]} ${colors[theme]["page-text"]} focus:outline-none focus:ring-2 ${colors[theme]["focus-ring"]} ${colors[theme]["focus-text"]}`}
                    />
                    <button className={`flex items-center justify-center ${colors[theme]["text"]}`} onClick={onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7`}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            {searchTerm.length > 1 &&
                <div className={`flex flex-col flex-1 space-y-1 w-full overflow-auto mb-10 `}>

                    <div className={`${loadedTitles.length > 0 ? "basis-2/12 p-1 mx-1 border" : "h-0 "}  overflow-auto rounded ${colors[theme]["verse-border"]} ${colors[theme]["text-background"]}`}>
                        <div className={`${loadedTitles.length > 0 ? "opacity-100" : "opacity-0 h-0"} sticky -top-1 text-sm md:text-base text-center rounded backdrop-blur-xl ${colors[theme]["page-text"]}`}>
                            {translationApplication.titles}
                        </div>
                        <div className={`text-sm md:text-base w-full ${colors[theme]["text"]}`}>
                            <div className={`w-full flex flex-col space-y-1.5`}>
                                {loadedTitles.map((result, index) => (
                                    <div
                                        ref={index === loadedTitles.length - 1 ? lastTitleElementRef : null}
                                        key={`${result.suraNumber}-${result.titleNumber}-${index}`}
                                        className={`p-2 rounded shadow-md ${colors[theme]["base-background"]} cursor-pointer ml-0.5 mr-0.5 md:mr-1.5`}
                                        onClick={() => handleConfirm(`${result.suraNumber}:${result.titleNumber}`)}>
                                        <span className="text-sky-500">{result.suraNumber}:{result.titleNumber}</span> {lightWords(result.titleText, searchTerm)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={`${loadedVerses.length > 0 ? "basis-7/12 p-1 mx-1 border" : "h-0 "}  overflow-auto rounded ${colors[theme]["verse-border"]} ${colors[theme]["base-background"]}`}>
                        <div className={`${loadedVerses.length > 0 ? "opacity-100" : "opacity-0 h-0"} sticky -top-1 text-sm md:text-base text-center rounded backdrop-blur-xl ${colors[theme]["page-text"]}`}>
                            {translationApplication.verses}
                        </div>
                        <div
                            lang={lang}
                            className={`text-sm md:text-base text-justify hyphens-auto w-full ${colors[theme]["text"]} transition-all duration-200 ease-linear ${loadedVerses.length > 0 ? "max-h-full" : "h-0 "}`}>
                            <div className={`w-full flex flex-col space-y-1.5`}>
                                {loadedVerses.map((result, index) => (
                                    <div
                                        ref={index === loadedVerses.length - 1 ? lastVerseElementRef : null}
                                        key={`${result.suraNumber}-${result.verseNumber}-${index}`}
                                        className={` p-1.5 rounded shadow-md ${colors[theme]["text-background"]} cursor-pointer ml-0.5 mr-0.5 md:mr-1.5`}
                                        onClick={() => handleConfirm(`${result.suraNumber}:${result.verseNumber}`)}>
                                        <span className="text-sky-500">{result.suraNumber}:{result.verseNumber}</span> {lightWords(result.verseText, searchTerm)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={`${loadedNotes.length > 0 ? "basis-3/12 p-1 mx-1 border" : "h-0 "} overflow-auto rounded ${colors[theme]["verse-border"]} ${colors[theme]["base-background"]}`}>
                        <div className={`${loadedNotes.length > 0 ? "opacity-100" : "opacity-0 "} sticky -top-1 text-sm md:text-base text-center rounded backdrop-blur-xl  ${colors[theme]["page-text"]}`}>
                            {translationApplication.notes}
                        </div>
                        <div
                            lang={lang}
                            className={`text-sm md:text-base text-justify hyphens-auto w-full mb-10 ${colors[theme]["text"]} transition-all duration-200 ease-linear ${loadedNotes.length > 0 ? "max-h-full" : "h-0 "}`}>
                            <div className={`w-full flex flex-col space-y-1.5`}>
                                {loadedNotes.map((result, index) => (
                                    <div
                                        ref={index === loadedNotes.length - 1 ? lastNoteElementRef : null}
                                        key={`${result.suraNumber}-${result.verseNumber}-${index}`}
                                        className={` p-1.5 rounded shadow-md ${colors[theme]["notes-background"]} cursor-pointer ml-0.5 mr-0.5 md:mr-1.5`}
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
                <div className={`w-full px-2 mb-10`}>
                    <div className={`text-sm md:text-base w-full p-1 ${colors[theme]["text"]} transition-all duration-200 ease-linear overflow-auto`}>
                        <div className={` w-full flex flex-col space-y-1.5 transition-all duration-200 ease-linear `}>
                            {Object.entries(loadedMap).map(([exp, themeorref]) => (
                                <div
                                    key={exp}

                                    className={`rounded shadow-md ${colors[theme]["base-background"]} ${themeorref.length === 0 ? "brightness-75" : ""}`}>
                                    <div
                                        onClick={() => handleThemeClick(exp)}
                                        className={`rounded p-2`}>
                                        {exp}
                                    </div>
                                    {openTheme === exp && (
                                        <div className={`flex flex-col space-y-1.5 mt-3 p-2`}>
                                            {typeof themeorref === 'object' ?
                                                Object.entries(themeorref).map(([innerTheme, ref]) => (
                                                    <div key={innerTheme} className={`p-2 ${colors[theme]["app-background"]} rounded shadow-md `}>
                                                        <div className={`p-1`}>{innerTheme}</div>
                                                        <div className={`p-2 rounded ${colors[theme]["base-background"]} flex flex-col space-y-1.5`}>{renderref(ref)}</div>
                                                    </div>
                                                ))
                                                :
                                                <div className={`p-2 rounded ${colors[theme]["base-background"]} flex flex-col space-y-1.5`}>{renderref(themeorref)}</div>
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
    );
}

export default Magnify;
