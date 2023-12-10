import React, { useState, useEffect } from 'react';

const Jump = ({ currentPage, quran, onClose, onConfirm }) => {
    const [suraNumber, setSuraNumber] = useState("1");
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
                if ( parseInt(value) === parseInt(currentPage)) {
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
        onConfirm(selectedPage, suraNumber, verseNumber);
        onClose();
    };

    return (
        <div className="w-screen h-screen animated fadeIn faster fixed left-0 top-0 flex flex-col-1 justify-center items-center inset-0 z-10 outline-none focus:outline-none backdrop-blur-lg" id="modal-id">
            <div className="flex flex-col items-center justify-center p-4 bg-sky-600 rounded-lg shadow-lg w-full mx-2">
                <div className=" w-full flex space-x-3 text-neutral-300">
                    <div className="w-full px-4 py-2 flex justify-end ">
                        Sura :
                    </div>
                    <div className="w-full py-2 flex items-center justify-start">
                        Verse
                    </div>

                </div>
                <div className=" w-full flex space-x-3 ">
                    <div className="w-full flex justify-end">
                        <select
                            id="sura"
                            name="sura"
                            onChange={handleSuraChange}
                            value={suraNumber}
                            className=" w-20 rounded px-4 py-2 shadow-lg text-neutral-200 bg-sky-700 placeholder:text-neutral-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 ">
                            {Object.keys(versesInSuras).map(sura => (
                                <option key={sura} value={sura}>{sura}</option>
                            ))}

                        </select>
                    </div>
                    <div className="w-full flex justify-start">
                        <select
                            id="verse"
                            name="verse"
                            onChange={handleVerseChange}
                            value={verseNumber}
                            className=" w-20 rounded px-4 py-2 shadow-lg text-neutral-200 bg-sky-700 placeholder:text-neutral-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 ">
                            {suraNumber && versesInSuras[suraNumber] ? versesInSuras[suraNumber].map(verse => (
                                <option key={verse} value={verse}>{verse}</option>
                            )) : null}
                        </select>
                    </div>
                </div>
                <div className="w-full p-1 py-2 flex flex-col justify-start text-neutral-300 mt-10 h-40">
                    <div className="flex w-full text-neutral-300 mb-4 text-sm">
                        Page {selectedPage}
                    </div>
                    {pageTitles[selectedPage] && pageTitles[selectedPage].map((title, index) => (
                        <h1 key={index}>{title}</h1>
                    ))}
                </div>
                <div className="flex w-full justify-between mt-10">
                    <button className="text-neutral-100 p-3" onClick={handleSubmit}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3V15" />
                        </svg>
                    </button>
                    <button className="p-3 text-neutral-100" onClick={onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>

                    </button>
                </div>
            </div>
        </div>
    );
}

export default Jump;
