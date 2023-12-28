import React, { useState, useEffect, useCallback, useRef } from 'react';

const Magnify = ({ colors, theme, translationApplication, quran, onClose, onConfirm }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResultTitles, setSearchResultTitles] = useState([]);
    const [searchResultVerses, setSearchResultVerses] = useState([]);
    const [searchResultNotes, setSearchResultNotes] = useState([]);
    const [loadedTitles, setLoadedTitles] = useState([]);
    const [loadedVerses, setLoadedVerses] = useState([]);
    const [loadedNotes, setLoadedNotes] = useState([]);

    const batchSize = 19;
    const observerTitles = useRef();
    const observerVerses = useRef();
    const observerNotes = useRef();

    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const performSearch = useCallback((term) => {
        if (!term || term.length < 2) {
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
            for (const suraNumber in suras) {
                const verses = suras[suraNumber].verses;
                for (const verseNumber in verses) {
                    const verseText = verses[verseNumber];
                    if (verseText.toLowerCase().includes(term.toLowerCase())) {
                        verseResults.push({ suraNumber, verseNumber, verseText });
                    }
                }
                const titles = suras[suraNumber].titles;
                for (const titleNumber in titles) {
                    const titleText = titles[titleNumber];
                    if (titleText.toLowerCase().includes(term.toLowerCase())) {
                        titleResults.push({ suraNumber, titleNumber, titleText });
                    }
                }

                const notes = quran[page].notes.data;
                if (notes.length > 0) {
                    Object.values(notes).forEach((note) => {
                        if (note.toLowerCase().includes(term.toLowerCase())) {
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
        performSearch(searchTerm);
    }, [searchTerm, performSearch]);

    const lightWords = (text, term) => {
        const regex = new RegExp(`(${term})`, 'gi');
        return text.split(regex).reduce((prev, current, index) => {
            if (regex.test(current)) {
                return [...prev, <span key={index} className={`font-bold text-rose-400`}>{current}</span>];
            } else {
                return [...prev, current];
            }
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
            <div className={`${loadedTitles.length > 0 ? "opacity-100" : "opacity-0"} text-sm ${colors[theme]["page-text"]}`}>
                {translationApplication.titles}
            </div>
            <div className={`text-sm md:text-base  w-full p-1 ${colors[theme]["text"]} transition-all duration-200 ease-linear ${loadedTitles.length > 0 ? "max-h-36 md:h-1/6 md:max-h-fit" : "h-0 "} `}>
                <div className={`${loadedTitles.length > 0 ? "opacity-100" : "opacity-0 "} space-y-1.5  ${colors[theme]["text-background"]} transition-all duration-200 ease-linear w-full flex flex-col h-full shadow-md p-1 rounded overflow-auto border ${colors[theme]["border"]} `}>
                    {loadedTitles.map((result, index) => (
                        <div
                            ref={index === loadedTitles.length - 1 ? lastTitleElementRef : null}
                            key={`${result.suraNumber}-${result.titleNumber}-${index}`}
                            className={` p-2 rounded shadow-md ${colors[theme]["base-background"]} cursor-pointer`}
                            onClick={() => handleConfirm(`${result.suraNumber}:${result.titleNumber}`)}>
                            <span className="text-sky-500">{result.suraNumber}:{result.titleNumber}</span> {lightWords(result.titleText, searchTerm)}
                        </div>
                    ))}
                </div>
            </div>
            <div className={`${loadedVerses.length > 0 ? "opacity-100" : "opacity-0"} text-sm ${colors[theme]["page-text"]}`}>
                {translationApplication.verses}
            </div>
            <div className={`text-sm md:text-base text-justify hyphens-auto w-full p-1  ${colors[theme]["text"]} transition-all duration-200 ease-linear ${loadedVerses.length > 0 ? "max-h-96 md:h-1/3 md:max-h-fit" : "h-0 "}`}>
                <div className={`${loadedVerses.length > 0 ? "opacity-100" : "opacity-0"} w-full h-full space-y-1.5 flex flex-col overflow-auto transition-all duration-200 ease-linear shadow-md p-1.5 rounded border ${colors[theme]["border"]} ${colors[theme]["base-background"]}`}>
                    {loadedVerses.map((result, index) => (
                        <div
                            ref={index === loadedVerses.length - 1 ? lastVerseElementRef : null}
                            key={`${result.suraNumber}-${result.verseNumber}-${index}`}
                            className={` p-2 rounded shadow-md ${colors[theme]["text-background"]} cursor-pointer`}
                            onClick={() => handleConfirm(`${result.suraNumber}:${result.verseNumber}`)}>
                            <span className="text-sky-500">{result.suraNumber}:{result.verseNumber}</span> {lightWords(result.verseText, searchTerm)}
                        </div>
                    ))}
                </div>
            </div>
            <div className={`${loadedNotes.length > 0 ? "opacity-100" : "opacity-0 "} text-sm ${colors[theme]["page-text"]}`}>
                {translationApplication.notes}
            </div>
            <div className={`text-sm md:text-base text-justify hyphens-auto w-full p-1  ${colors[theme]["text"]} transition-all duration-200 ease-linear ${loadedNotes.length > 0 ? "max-h-40 md:h-1/4 md:max-h-fit" : "h-0 "} mb-10`}>
                <div className={`${loadedNotes.length > 0 ? "opacity-100" : "opacity-0"} w-full h-full space-y-1.5 flex flex-col overflow-auto transition-all duration-200 ease-linear shadow-md p-1.5 rounded border ${colors[theme]["border"]} ${colors[theme]["base-background"]}`}>
                    {loadedNotes.map((result, index) => (
                        <div
                            ref={index === loadedNotes.length - 1 ? lastNoteElementRef : null}
                            key={`${result.suraNumber}-${result.verseNumber}-${index}`}
                            className={` p-2 rounded shadow-md ${colors[theme]["text-background"]} cursor-pointer`}
                            onClick={() => handleConfirm(`${result.suraNumber}:${result.verseNumber}`)}>
                            {lightWords(result.note, searchTerm)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Magnify;
