import React, { useState, useEffect } from 'react';
import quranData from '../assets/structured_quran.json';

const Pages = ({ selectedPage }) => {
    const [pageData, setPageData] = useState(null);
    const [showExplanation, setShowExplanation] = useState({ GODnameFrequency: false, GODnameSum: false });


    useEffect(() => {
        setPageData(quranData[selectedPage]);
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
        let suraVerseRanges = [];

        pageData.page.forEach(pageItem => {
            const suraVerseInfo = pageItem.match(/\d+:\d+-?\d*/g);
            if (suraVerseInfo) {
                suraVerseInfo.forEach(range => {
                    const [sura, verses] = range.split(':');
                    const [start, end] = verses.split('-').map(Number);
                    suraVerseRanges.push({ sura: parseInt(sura), start, end });
                });
            }
        });

        // Sort and map the verses based on the sura and verse range information
        const sortedVerses = [];
        suraVerseRanges.forEach(({ sura, start, end }) => {

            for (let i = start; i <= (end ? end : 1); i++) {
                if (pageData.verses[i]) {
                    sortedVerses.push([i, pageData.verses[i]]);
                }
            }
        });

        return sortedVerses;
    };

    const sortedVerses = parsePageVerses();

    return (
        <div className="flex w-full flex-1 flex-col text-neutral-200 text-xl overflow-auto">

            <div className="relative flex flex-col space-y-4 mb-2">
                <div className="sticky top-0 backdrop-blur-md p-2 rounded shadow-xl flex">
                    <div className="flex w-full justify-between text-sm lg:text-lg items-center">

                        <div className="">
                            <h1>{pageData.page.join(" - ")}</h1>
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
                {sortedVerses.map(([verseNumber, verseText]) => (
                    <>
                        {pageData.titles[verseNumber] &&
                            <div className="bg-neutral-700 italic rounded shadow-xl m-2 p-4 text-sm md:text-md lg:text-lg text-center break-words whitespace-pre-wrap">
                                {pageData.titles[verseNumber]}
                            </div>}

                        <div className="flex rounded m-2 p-2 shadow-xl bg-sky-700 text-justify text-base md:text-lg xl:text-xl" key={verseNumber}>
                            <p className="p-1">
                                <span className="text-neutral-300/50 font-bold ">{`${verseNumber}. `}</span>
                                <span className="text-neutral-200 ">
                                    {verseText}
                                </span>
                            </p>
                        </div>
                    </>
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
