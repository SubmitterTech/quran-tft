import React, { useState, useEffect } from 'react';

const Jump = ({ onChangeTheme, colors, theme, translationApplication, currentPage, quran, onClose, onConfirm }) => {
    const [suraNumber, setSuraNumber] = useState("0");
    const [verseNumber, setVerseNumber] = useState("1");
    const [selectedPage, setSelectedPage] = useState(currentPage);
    const [pageTitles, setPageTitles] = useState({});
    const [versesInSuras, setVersesInSuras] = useState({});
    const [pageForSuraVerse, setPageForSuraVerse] = useState({});

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

    const ThemePicker = ({ onChangeTheme }) => {
        const themes = {
            light: "#e5e5e5",
            dark: "#171717",
            sky: "#0284c7",
        };

        return (
            <div className="flex space-x-7 rounded bg-gray-300 p-3">
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
        <div className={`w-screen h-screen animated fadeIn faster fixed left-0 top-0 flex flex-col items-center inset-0 z-10 outline-none focus:outline-none backdrop-blur-lg`} id="jump-screen">
            <div className={`flex flex-col items-center justify-center w-full mb-20 p-2`}>
                <div className={`transition-colors duration-700 ease-linear flex flex-col items-center justify-center ${colors[theme]["text-background"]} ${colors[theme]["app-text"]} rounded shadow-md w-full p-3 mx-2`}>
                    <div className={`mb-2`}>
                        {translationApplication?.theme}
                    </div>
                    <div>
                        <ThemePicker onChangeTheme={onChangeTheme} />
                    </div>
                </div>

            </div>
            <div className={`w-full p-2`}>
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
                        <div className={`w-full flex justify-end`}>
                            <select
                                id="sura"
                                name="sura"
                                onChange={handleSuraChange}
                                value={suraNumber}
                                className={` w-18 rounded text-end px-4 py-2 shadow-md ${colors[theme]["text"]} ${colors[theme]["base-background"]} placeholder:text-sky-600 focus:ring-2 focus:ring-inset focus:ring-sky-600 `}>
                                <option key="0" value="0" disabled></option>
                                {Object.keys(versesInSuras).map(sura => (
                                    <option key={sura} value={sura}>{sura}</option>
                                ))}

                            </select>
                        </div>
                        <div className={`w-full flex justify-start`}>
                            <select
                                id="verse"
                                name="verse"
                                onChange={handleVerseChange}
                                value={verseNumber}
                                className={` w-20 rounded px-4 py-2 shadow-md ${colors[theme]["text"]} ${colors[theme]["base-background"]} placeholder:text-sky-600 focus:ring-2 focus:ring-inset focus:ring-sky-600 `}>
                                {suraNumber && versesInSuras[suraNumber] ? versesInSuras[suraNumber].map(verse => (
                                    <option key={verse} value={verse}>{verse}</option>
                                )) : null}
                            </select>
                        </div>
                    </div>
                    <div className={`w-full p-3 ${colors[theme]["app-text"]} flex-1 mt-7`}>
                        <div className={`w-full ${colors[theme]["app-background"]} p-3 shadow-md rounded`}>
                            <div className={`flex w-full ${colors[theme]["app-text"]} mb-4 text-sm`}>
                                {translationApplication?.page} {selectedPage}
                            </div>
                            {pageTitles[selectedPage] && pageTitles[selectedPage].map((title, index) => (
                                <h1 key={index}>{title}</h1>
                            ))}
                        </div>
                    </div>
                    <div className={`flex w-full justify-between items-center ${colors[theme]["text"]} mt-7`}>
                        <div className={`p-2 flex flex-col w-full items-center justify-between`}>
                            <button className={`flex justify-center`} onClick={handleSubmit}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3V15" />
                                </svg>
                            </button>
                            <div className={`flex ${colors[theme]["text"]}/50 text-sm items-center justify-center p-2`}>
                                {translationApplication?.open}
                            </div>
                        </div>
                        <div className={`p-2 flex flex-col w-full items-center justify-between`}>
                            <button className={`flex justify-center`} onClick={goIntro}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-7 h-7`}>
                                    <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm5.03 4.72a.75.75 0 010 1.06l-1.72 1.72h10.94a.75.75 0 010 1.5H10.81l1.72 1.72a.75.75 0 11-1.06 1.06l-3-3a.75.75 0 010-1.06l3-3a.75.75 0 011.06 0z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <div className={`flex ${colors[theme]["text"]}/50 text-sm items-center justify-center p-2`}>
                                {translationApplication?.intro}
                            </div>
                        </div>
                        <div className={`p-2 flex flex-col w-full items-center justify-between`}>

                            <button className={`flex justify-center`} onClick={goApps}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-7 h-7`}>
                                    <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <div className={`flex ${colors[theme]["text"]}/50 text-sm items-center justify-center p-2`}>
                                {translationApplication?.appendices}
                            </div>
                        </div>
                        <div className={`p-2 flex flex-col w-full items-center justify-between`}>
                            <button className={`flex justify-center`} onClick={onClose}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>

                            </button>
                            <div className={`flex ${colors[theme]["text"]}/50 text-sm items-center justify-center p-2`}>
                                {translationApplication?.cancel}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Jump;
