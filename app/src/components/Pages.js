import React, { useState, useEffect } from 'react';
import quranData from '../assets/structured_quran.json';

const Pages = ({ selectedPage }) => {
    const [pageData, setPageData] = useState(null);
    const [showExplanation, setShowExplanation] = useState({ GODnameFrequency: false, GODnameSum: false });
    const [pageTitle, setPageTitle] = useState([]);

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
    }, [selectedPage]);

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


    return (
        <div className="flex w-full flex-1 flex-col text-neutral-200 text-xl overflow-auto">
            <div className="relative flex flex-col space-y-4 mb-2">
                <div className="sticky top-0 py-2 px-3 bg-sky-800 shadow-lg flex">
                    <div className="flex w-full justify-between text-sm lg:text-lg items-center">
                        <div className="flex flex-col">
                            {pageTitle.map((title, index) => (
                                <h1 key={index}>{title}</h1>
                            ))}
                        </div>
                    </div>

                    <div className=" flex flex-col text-end text-sm space-y-2">
                        <p className="cursor-pointer" onClick={() => toggleExplanation('GODnameFrequency')}>
                            {pageData.notes.cumulativefrequencyofthewordGOD}
                        </p>
                        {showExplanation.GODnameFrequency && (
                            <div className="transition duration-500 ease-in-out transform translate-x-2 p-1 bg-neutral-700 rounded">
                                Cumulative frequency of the word GOD
                            </div>
                        )}

                        <p className="cursor-pointer" onClick={() => toggleExplanation('GODnameSum')}>
                            {pageData.notes.cumulativesumofverseswhereGODwordoccurs}
                        </p>
                        {showExplanation.GODnameSum && (
                            <div className="transition duration-500 ease-in-out transform translate-x-2 p-1 bg-neutral-700 rounded">
                                Cumulative sum of verses where GOD word occurs
                            </div>
                        )}
                    </div>

                </div>
                {sortedVerses.map(({ suraNumber, verseNumber, verseText, title }) => (
                    <React.Fragment key={suraNumber + ":" + verseNumber}>
                        {title &&
                            <div className="bg-neutral-700 italic rounded shadow-xl m-2 p-4 text-sm md:text-md lg:text-lg text-center break-words whitespace-pre-wrap">
                                {title}
                            </div>}

                        <div className="flex rounded m-2 p-2 shadow-xl bg-sky-700 text-justify text-base md:text-lg xl:text-xl">
                            <p className="p-1">
                                <span className="text-neutral-300/50 font-bold ">{`${verseNumber}. `}</span>
                                <span className="text-neutral-200 ">
                                    {verseText}
                                </span>
                            </p>
                        </div>
                    </React.Fragment>
                ))}
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
