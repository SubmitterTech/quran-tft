import React, { useState, useEffect, useCallback, useRef } from 'react';

const Magnify = ({ colors, theme, translationApplication, quran, onClose, onConfirm }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResultTitles, setSearchResultTitles] = useState([]);
    const [searchResultVerses, setSearchResultVerses] = useState([]);
    const [loadedTitles, setLoadedTitles] = useState([]);
    const [loadedVerses, setLoadedVerses] = useState([]);
    const batchSize = 19;
    const observerTitles = useRef();
    const observerVerses = useRef();

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
            return;
        }

        const titleResults = [];
        const verseResults = [];
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
            }
        }
        setSearchResultTitles(titleResults);
        setSearchResultVerses(verseResults);
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

    useEffect(() => {
        setLoadedTitles(searchResultTitles.slice(0, batchSize));
        setLoadedVerses(searchResultVerses.slice(0, batchSize));
    }, [searchResultTitles, searchResultVerses]);

    const handleConfirm = (key) => {
        if(onConfirm) {
            onConfirm(key);
            onClose();
        }
    };

    return (
        <div className={`w-screen h-screen animated faster fixed left-0 top-0 flex flex-col items-center justify-start inset-0 z-10 outline-none focus:outline-none backdrop-blur-lg`} id="jump-screen">
            <div className={`w-full flex p-2`}>
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
            <div className={`${loadedTitles.length > 0 ? "opacity-100" : "opacity-0" } text-sm ${colors[theme]["page-text"]}`}>
                {translationApplication.titles}
            </div>
            <div className={`text-sm md:text-base  w-full p-1 h-1/6 ${colors[theme]["text"]}`}>
                <div className={`${loadedTitles.length > 0 ? "opacity-100" : "opacity-0" }  transition-all duration-500 ease-linear w-full flex flex-col h-full shadow-md p-1 rounded overflow-auto border ${colors[theme]["border"]} `}>
                    {loadedTitles.map((result, index) => (
                        <div
                            ref={index === loadedTitles.length - 1 ? lastTitleElementRef : null}
                            key={`${result.suraNumber}-${result.titleNumber}-${index}`}
                            className={`mb-1 p-2 rounded shadow-md ${colors[theme]["base-background"]} cursor-pointer`}
                            onClick={() => handleConfirm(`${result.suraNumber}:${result.titleNumber}`)}>
                            <span className="text-sky-500">{result.suraNumber}:{result.titleNumber}</span> {lightWords(result.titleText, searchTerm)}
                        </div>
                    ))}
                </div>
            </div>
            <div className={`${loadedVerses.length > 0 ? "opacity-100" : "opacity-0" } text-sm ${colors[theme]["page-text"]}`}>
                {translationApplication.verses}
            </div>
            <div className={`text-sm md:text-base text-justify hyphens-auto w-full p-1 h-1/2  ${colors[theme]["text"]}`}>
                <div className={`${loadedVerses.length > 0 ? "opacity-100" : "opacity-0" } w-full h-full flex flex-col overflow-auto transition-all duration-1000 ease-linear shadow-md p-1 rounded border ${colors[theme]["border"]} `}>
                    {loadedVerses.map((result, index) => (
                        <div
                            ref={index === loadedVerses.length - 1 ? lastVerseElementRef : null}
                            key={`${result.suraNumber}-${result.verseNumber}-${index}`}
                            className={`mb-1 p-2 rounded shadow-md ${colors[theme]["text-background"]} cursor-pointer`}
                            onClick={() => handleConfirm(`${result.suraNumber}:${result.verseNumber}`)}>
                            <span className="text-sky-500">{result.suraNumber}:{result.verseNumber}</span> {lightWords(result.verseText, searchTerm)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Magnify;
