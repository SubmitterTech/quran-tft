import React, { useState, useEffect } from 'react';

const Jump = ({ suraNames, onChangeTheme, colors, theme, translationApplication, currentPage, quran, onClose, onConfirm, onMagnify }) => {
    const [suraNumber, setSuraNumber] = useState("0");
    const [verseNumber, setVerseNumber] = useState("1");
    const [selectedPage, setSelectedPage] = useState(currentPage);
    const [pageTitles, setPageTitles] = useState({});
    const [versesInSuras, setVersesInSuras] = useState({});
    const [pageForSuraVerse, setPageForSuraVerse] = useState({});
    const [showThemes, setShowThemes] = useState(false);

    const [suraNameMap, setSuraNameMap] = useState({});

    useEffect(() => {
        let themap = {}
        if (suraNames) {
            Object.entries(suraNames).forEach(([key, value]) => {
                if (key > 0) {
                    const vals = value.split(".").filter(e => e.trim())
                    if (vals.length > 5) {
                        themap[key] = vals[1].trim() + "." + vals[2] + ". (" + vals[3].trim() + ")"
                    } else {
                        themap[key] = vals[1].trim() + " (" + vals[2].trim() + ")"
                    }
                }
            });
        }
        setSuraNameMap(themap);
    }, [suraNames]);


    useEffect(() => {
        const surasInPagesMap = {};
        const versesInSurasMap = {};
        const pageForSuraVerseMap = {};
        const newPageTitles = {};

        Object.entries(quran).forEach(([page, data]) => {
            surasInPagesMap[page] = Object.keys(data.sura);
            data.page.forEach((info) => {
                if (info.includes(":")) {
                    newPageTitles[page] = info.split("&");
                }
            });

            Object.entries(data.sura).forEach(([sura, suraData]) => {
                versesInSurasMap[sura] = versesInSurasMap[sura] || [];
                pageForSuraVerseMap[sura] = pageForSuraVerseMap[sura] || {};

                Object.keys(suraData.verses).forEach(verse => {
                    if (!versesInSurasMap[sura].includes(verse)) {
                        versesInSurasMap[sura].push(verse);
                    }
                    pageForSuraVerseMap[sura][verse] = page;
                });
            });
        });

        setPageTitles(newPageTitles);
        setVersesInSuras(versesInSurasMap);
        setPageForSuraVerse(pageForSuraVerseMap);
        setSelectedPage(currentPage);

        if (surasInPagesMap[currentPage] && pageForSuraVerseMap) {
            setSuraNumber(surasInPagesMap[currentPage][0]);

            for (const [key, value] of Object.entries(pageForSuraVerseMap[surasInPagesMap[currentPage][0]])) {
                if (parseInt(value) === parseInt(currentPage)) {
                    setVerseNumber(key)
                    return;
                }

            }
        }

    }, [currentPage, quran]);

    const handleSuraChange = (e) => {
        const newSuraNumber = e.target.value;
        setSuraNumber(newSuraNumber);

        const firstVerseOfSura = versesInSuras[newSuraNumber][0];
        if (firstVerseOfSura && pageForSuraVerse[newSuraNumber][firstVerseOfSura]) {
            setSelectedPage(pageForSuraVerse[newSuraNumber][firstVerseOfSura]);
        }
    };

    const handleVerseChange = (e) => {
        const newVerseNumber = e.target.value;
        setVerseNumber(newVerseNumber);

        if (pageForSuraVerse[suraNumber] && pageForSuraVerse[suraNumber][newVerseNumber]) {
            setSelectedPage(pageForSuraVerse[suraNumber][newVerseNumber]);
        }
    };

    const handleSubmit = () => {
        onConfirm(selectedPage, suraNumber, verseNumber ? verseNumber : "1");
        onClose();
    };

    const goIntro = () => {
        onConfirm("13");
        onClose();
    };

    const goApps = () => {
        onConfirm("395");
        onClose();
    };

    const toggleThemeView = () => {
        setShowThemes(!showThemes);
    };

    const ThemePicker = ({ onChangeTheme }) => {
        const themes = {
            light: "#e5e5e5",
            dark: "#171717",
            violet: "#8b5cf6",
            green: "#14b8a6",
            sky: "#0ea5e9",
        };

        return (
            <div className="flex space-x-7 ">
                {Object.entries(themes).map(([theme, color]) => (
                    <label key={theme} className="cursor-pointer">
                        <input
                            type="radio"
                            name="theme"
                            value={theme}
                            onChange={(e) => onChangeTheme(e.target.value)}
                            className="hidden"
                        />
                        <span
                            className={`h-10 w-10 block rounded border border-gray-500`}
                            style={{ backgroundColor: color }}
                        ></span>
                    </label>
                ))}
            </div>
        );
    };


    return (
        <div className={`w-screen h-screen animated faster fixed left-0 top-0 flex flex-col items-center justify-center inset-0 z-10 outline-none focus:outline-none backdrop-blur-lg`} id="jump-screen">

            <div className={`w-full p-2 flex flex-col transition-all duration-700 ease-linear mb-12`}>

                <div className={`w-full flex justify-between ${colors[theme]["text"]} mb-2`}>
                    <div className={`w-full flex justify-start ml-2`}>
                        <button className={`flex justify-center`} onClick={onMagnify}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-11 h-11`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                        </button>
                    </div>
                    <div className={`w-full flex justify-end place-self-end`}>
                        <button className={`flex justify-center`} onClick={onClose}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>

                        </button>
                    </div>
                </div>
                <div className={`transition-colors duration-700 ease-linear flex flex-col items-center justify-center ${colors[theme]["text-background"]} rounded shadow-md w-full `}>
                    <div className={` w-full flex space-x-3 ${colors[theme]["app-text"]} mt-3`}>
                        <div className={`w-full px-4 py-2 flex justify-end `}>
                            {translationApplication?.sura} :
                        </div>
                        <div className={`w-full py-2 flex items-center justify-start`}>
                            {translationApplication?.verse}
                        </div>
                    </div>
                    <div className={` w-full flex space-x-3 `}>
                        <div className={`relative w-full flex justify-end`}>
                            <select
                                id="sura"
                                name="sura"
                                onChange={handleSuraChange}
                                value={suraNumber}
                                className={`w-20 whitespace-pre-line text-justify rounded px-4 py-2 shadow-md ${colors[theme]["text"]} ${colors[theme]["base-background"]} placeholder:text-sky-500 focus:ring-2 focus:ring-inset focus:ring-sky-500 `}>
                                <option key="0" value="0" disabled></option>
                                {Object.entries(suraNameMap).map(([sura, sname]) => (
                                    <option key={sura} value={sura}>{sura}{`\t`}{sname}</option>
                                ))}

                            </select>
                            
                        </div>
                        <div className={`w-full flex justify-start`}>
                            <select
                                id="verse"
                                name="verse"
                                onChange={handleVerseChange}
                                value={verseNumber}
                                className={` w-20 rounded px-4 py-2 shadow-md ${colors[theme]["text"]} ${colors[theme]["base-background"]} placeholder:text-sky-500 focus:ring-2 focus:ring-inset focus:ring-sky-500 `}>
                                {suraNumber && versesInSuras[suraNumber] ? versesInSuras[suraNumber].map(verse => (
                                    <option key={verse} value={verse}>{verse}</option>
                                )) : null}
                            </select>
                        </div>
                    </div>
                    <div className={`w-full p-3 ${colors[theme]["app-text"]} flex-1 mt-3`}>
                        <div className={`w-full ${colors[theme]["app-background"]} p-3 shadow-md rounded`}>
                            <div className={`flex w-full ${colors[theme]["app-text"]} mb-4 text-sm`}>
                                {translationApplication?.page} {selectedPage}
                            </div>
                            {pageTitles[selectedPage] && pageTitles[selectedPage].map((title, index) => {
                                // Use a regex to match the three groups: name, Latin pronunciation, and page info
                                const titleRegex = /^(.*?)\s+\((.*?)\)\s+(.*)$/;
                                const match = title.match(titleRegex);

                                // If the title matches the expected format, render the groups
                                if (match) {
                                    return (
                                        <div key={index} className="flex justify-between w-full mt-1">
                                            <div className="w-full flex justify-between mr-0.5">
                                                <span className="text-left font-bold justify-self-center text-sky-500">{match[1]}</span>
                                                <span className="text-right ">{`(${match[2]})`}</span>
                                            </div>
                                            <span className="w-1/3 text-right">{match[3]}</span>
                                        </div>
                                    );
                                } else {
                                    // If the title doesn't match the expected format, split and render
                                    const lastSpaceIndex = title.lastIndexOf(" ");
                                    const namePart = title.substring(0, lastSpaceIndex);
                                    const pageInfoPart = title.substring(lastSpaceIndex + 1);

                                    return (
                                        <div key={index} className="flex justify-between w-full">
                                            <span className="text-left flex-1">{namePart}</span>
                                            <span className="text-right flex-1">{pageInfoPart}</span>
                                        </div>
                                    );
                                }
                            })}
                        </div>
                    </div>
                    <div className={`flex w-full justify-between items-center ${colors[theme]["text"]} mt-3`}>
                        <div className={`p-2 flex flex-col w-full items-center justify-between`}>
                            <button className={`flex justify-center`} onClick={handleSubmit}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3V15" />
                                </svg>
                            </button>
                            <div className={`flex ${colors[theme]["page-text"]} text-sm items-center justify-center p-2`}>
                                {translationApplication?.open}
                            </div>
                        </div>
                        <div className={`p-2 flex flex-col w-full items-center justify-between`}>
                            <button className={`flex justify-center`} onClick={goIntro}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-7 h-7`}>
                                    <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm5.03 4.72a.75.75 0 010 1.06l-1.72 1.72h10.94a.75.75 0 010 1.5H10.81l1.72 1.72a.75.75 0 11-1.06 1.06l-3-3a.75.75 0 010-1.06l3-3a.75.75 0 011.06 0z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <div className={`flex ${colors[theme]["page-text"]} text-sm items-center justify-center p-2`}>
                                {translationApplication?.intro}
                            </div>
                        </div>
                        <div className={`p-2 flex flex-col w-full items-center justify-between`}>

                            <button className={`flex justify-center`} onClick={goApps}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-7 h-7`}>
                                    <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <div className={`flex ${colors[theme]["page-text"]} text-sm items-center justify-center p-2`}>
                                {translationApplication?.appendices}
                            </div>
                        </div>
                        <div className={`p-2 flex flex-col w-full items-center justify-between`}>
                            <button className={`flex justify-center`} onClick={toggleThemeView}>
                                {showThemes ?
                                    (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-7 h-7`}>
                                        <path d="M17.004 10.407c.138.435-.216.842-.672.842h-3.465a.75.75 0 01-.65-.375l-1.732-3c-.229-.396-.053-.907.393-1.004a5.252 5.252 0 016.126 3.537zM8.12 8.464c.307-.338.838-.235 1.066.16l1.732 3a.75.75 0 010 .75l-1.732 3.001c-.229.396-.76.498-1.067.16A5.231 5.231 0 016.75 12c0-1.362.519-2.603 1.37-3.536zM10.878 17.13c-.447-.097-.623-.608-.394-1.003l1.733-3.003a.75.75 0 01.65-.375h3.465c.457 0 .81.408.672.843a5.252 5.252 0 01-6.126 3.538z" />
                                        <path fillRule="evenodd" d="M21 12.75a.75.75 0 000-1.5h-.783a8.22 8.22 0 00-.237-1.357l.734-.267a.75.75 0 10-.513-1.41l-.735.268a8.24 8.24 0 00-.689-1.191l.6-.504a.75.75 0 10-.964-1.149l-.6.504a8.3 8.3 0 00-1.054-.885l.391-.678a.75.75 0 10-1.299-.75l-.39.677a8.188 8.188 0 00-1.295-.471l.136-.77a.75.75 0 00-1.477-.26l-.136.77a8.364 8.364 0 00-1.377 0l-.136-.77a.75.75 0 10-1.477.26l.136.77c-.448.121-.88.28-1.294.47l-.39-.676a.75.75 0 00-1.3.75l.392.678a8.29 8.29 0 00-1.054.885l-.6-.504a.75.75 0 00-.965 1.149l.6.503a8.243 8.243 0 00-.689 1.192L3.8 8.217a.75.75 0 10-.513 1.41l.735.267a8.222 8.222 0 00-.238 1.355h-.783a.75.75 0 000 1.5h.783c.042.464.122.917.238 1.356l-.735.268a.75.75 0 10.513 1.41l.735-.268c.197.417.428.816.69 1.192l-.6.504a.75.75 0 10.963 1.149l.601-.505c.326.323.679.62 1.054.885l-.392.68a.75.75 0 101.3.75l.39-.679c.414.192.847.35 1.294.471l-.136.771a.75.75 0 101.477.26l.137-.772a8.376 8.376 0 001.376 0l.136.773a.75.75 0 101.477-.26l-.136-.772a8.19 8.19 0 001.294-.47l.391.677a.75.75 0 101.3-.75l-.393-.679a8.282 8.282 0 001.054-.885l.601.504a.75.75 0 10.964-1.15l-.6-.503a8.24 8.24 0 00.69-1.191l.735.268a.75.75 0 10.512-1.41l-.734-.268c.115-.438.195-.892.237-1.356h.784zm-2.657-3.06a6.744 6.744 0 00-1.19-2.053 6.784 6.784 0 00-1.82-1.51A6.704 6.704 0 0012 5.25a6.801 6.801 0 00-1.225.111 6.7 6.7 0 00-2.15.792 6.784 6.784 0 00-2.952 3.489.758.758 0 01-.036.099A6.74 6.74 0 005.251 12a6.739 6.739 0 003.355 5.835l.01.006.01.005a6.706 6.706 0 002.203.802c.007 0 .014.002.021.004a6.792 6.792 0 002.301 0l.022-.004a6.707 6.707 0 002.228-.816 6.781 6.781 0 001.762-1.483l.009-.01.009-.012a6.744 6.744 0 001.18-2.064c.253-.708.39-1.47.39-2.264a6.74 6.74 0 00-.408-2.308z" clipRule="evenodd" />
                                    </svg>) :
                                    (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7`}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L12 12m6.894 5.785l-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864l-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495" />
                                    </svg>
                                    )}

                            </button>
                            <div className={`flex ${colors[theme]["page-text"]} text-sm items-center justify-center p-2`}>
                                {translationApplication?.color}
                            </div>
                        </div>
                    </div>
                    {showThemes &&
                        <div className={`flex flex-col items-center justify-center w-full p-2`}>
                            <div className={`transition-colors duration-700 ease-linear flex flex-col items-center justify-center ${colors[theme]["app-background"]} rounded shadow-md w-full p-3 mx-2`}>
                                <div>
                                    <ThemePicker onChangeTheme={onChangeTheme} />
                                </div>
                            </div>
                        </div>}
                </div>

            </div>
        </div>
    );
}

export default Jump;
