import React, { useState, useEffect, useRef } from 'react';
import quranData from '../assets/structured_quran.json';

const Pages = ({ selectedPage, selectedSura, selectedVerse }) => {
    const [pageData, setPageData] = useState(null);
    const [showExplanation, setShowExplanation] = useState({ GODnamefrequency: false, GODnamesum: false });
    const [pageTitle, setPageTitle] = useState([]);
    const verseRefs = useRef({});
    const topRef = useRef(null);

    const [notify, setNotify] = useState(false);

    useEffect(() => {
        if (notify) {
            setTimeout(() => {
                setNotify(false);
            }, 4000);
        }
    }, [notify]);

    const forceScroll = () => {
        const verseKey = `${parseInt(selectedSura)}:${parseInt(selectedVerse)}`;

        if (verseRefs.current[verseKey]) {
            verseRefs.current[verseKey].scrollIntoView({ behavior: 'smooth', block: 'center' });
            setNotify(true);
        }
    };

    useEffect(() => {
        setPageData(quranData[selectedPage]);

        if (quranData[selectedPage]) {
            const newPageTitles = [];
            quranData[selectedPage].page.forEach((pi) => {
                if (/\d+:\d+/.test(pi)) {
                    if (pi.includes("&")) {
                        pi.split("&").forEach(part => newPageTitles.push(part.trim()));
                    } else {
                        newPageTitles.push(pi);
                    }
                }
            });
            setPageTitle(newPageTitles);
        }

        if (!selectedVerse && topRef.current) {
            topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            setTimeout(() => {
                forceScroll();
            }, 200);
            forceScroll();
        }
    }, [selectedPage, selectedSura, selectedVerse]);

    useEffect(() => {
        if (selectedVerse) {
            forceScroll();
        }
    }, [selectedSura, selectedVerse]);


    if (!pageData) return <div className="text-neutral-200/80 flex flex-1 items-center justify-center w-full ">Loading...</div>;

    const toggleExplanation = (key) => {
        setShowExplanation(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const renderTable = (tableData) => {
        const columnCount = tableData.title.length;
        const rows = [];

        for (let i = 0; i < tableData.values.length; i += columnCount) {
            rows.push(tableData.values.slice(i, i + columnCount));
        }

        return (
            <table className="table-auto border-collapse border-2 border-sky-500 text-right">
                <thead>
                    <tr>
                        {tableData.title.map((header, index) => (
                            <th key={index} className="border-2 border-sky-500 p-2 ">{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="border-2 border-sky-500 p-2">{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    const parsePageVerses = () => {
        let sortedVerses = [];
        if (pageData.sura) {
            Object.entries(pageData.sura).forEach(([suraNumber, suraInfo]) => {
                Object.entries(suraInfo.verses).forEach(([verseNumber, verseText]) => {
                    sortedVerses.push({
                        suraNumber: parseInt(suraNumber),
                        verseNumber: parseInt(verseNumber),
                        verseText,
                        title: suraInfo.titles ? suraInfo.titles[verseNumber] : null
                    });
                });
            });

            // Sort first by sura number, then by verse number if sura numbers are the same
            sortedVerses.sort((a, b) => {
                if (a.suraNumber !== b.suraNumber) {
                    return a.suraNumber - b.suraNumber;
                }
                return a.verseNumber - b.verseNumber;
            });
        }
        return sortedVerses;
    };

    const sortedVerses = parsePageVerses();

    const handlePageTitleClicked = () => {
        console.log(pageTitle)
    };

    return (
        <div className="flex w-full flex-1 flex-col text-neutral-200 text-xl overflow-auto">
            <div ref={topRef} className="relative flex flex-col space-y-4 mb-2">
                <div className="sticky top-0 py-2 px-3 bg-sky-800 shadow-lg flex">
                    <div
                        onClick={() => handlePageTitleClicked()}
                        className="flex w-full justify-between text-sm lg:text-lg items-center mr-2">
                        <div className="flex flex-col font-bold space-y-2">
                            {pageTitle.map((title, index) => (
                                <h1 key={index}>{title}</h1>
                            ))}
                        </div>
                    </div>

                    <div className=" flex flex-col text-end text-sm space-y-2">
                        <p className="cursor-pointer" onClick={() => toggleExplanation('GODnamefrequency')}>
                            {pageData.notes.cumulativefrequencyofthewordGOD}
                        </p>
                        {showExplanation.GODnamefrequency && (
                            <div className="transition duration-500 ease-in-out transform translate-x-2 p-1 bg-neutral-700 rounded">
                                Cumulative frequency of the word GOD
                            </div>
                        )}

                        <p className="cursor-pointer" onClick={() => toggleExplanation('GODnamesum')}>
                            {pageData.notes.cumulativesumofverseswhereGODwordoccurs}
                        </p>
                        {showExplanation.GODnamesum && (
                            <div className="transition duration-500 ease-in-out transform translate-x-2 p-1 bg-neutral-700 rounded">
                                Cumulative sum of verses where GOD word occurs
                            </div>
                        )}
                    </div>

                </div>
                {sortedVerses.map(({ suraNumber, verseNumber, verseText, title }) => {
                    return (
                        <React.Fragment key={verseNumber + ":" + suraNumber}>
                            {title &&
                                <div className="bg-neutral-600 italic rounded shadow-xl m-2 p-4 text-sm md:text-md lg:text-lg text-center break-words whitespace-pre-wrap">
                                    {title}
                                </div>
                            }
                            
                            <div
                                ref={(el) => verseRefs.current[`${suraNumber}:${verseNumber}`] = el}
                                className={`flex rounded m-2 p-2 shadow-xl text-justify text-base md:text-lg xl:text-xl bg-sky-700 ${notify && (parseInt(selectedSura) === parseInt(suraNumber) && parseInt(selectedVerse) === parseInt(verseNumber)) ? "animate-pulse" : "animate-none"}`}>
                                <p className="p-1">
                                    <span className="text-neutral-300/50 font-bold ">{`${verseNumber}. `}</span>
                                    <span className="text-neutral-200 ">
                                        {verseText}
                                    </span>
                                </p>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
            {pageData.notes.data.length > 0 &&
                <div className="bg-neutral-700 m-2 rounded p-2 text-sm md:text-md lg:text-lg text-justify text-neutral-300 flex flex-col space-y-4 whitespace-pre-line">
                    <h3>Notes:</h3>
                    {pageData.notes.data.map((note, index) => <p className="bg-neutral-600 rounded shadow-md px-2 py-3 text-neutral-200" key={index}>{note}</p>)}
                    {pageData.notes.tables && pageData.notes.tables.map((table, index) => (
                        <div key={index}>
                            {renderTable(table)}
                        </div>
                    ))}
                </div>
            }
        </div>
    );
};

export default Pages;
