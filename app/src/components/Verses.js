import React, { useState, useEffect } from 'react';
import quranData from '../assets/structured_quran.json';

const Verses = ({ selectedPage }) => {
    const [pageData, setPageData] = useState(null);

    useEffect(() => {
        setPageData(quranData[selectedPage]);
    }, [selectedPage]);

    if (!pageData) return <div>Loading...</div>;

    return (
        <div className="flex w-full flex-1 flex-col text-neutral-200 text-xl overflow-auto">
            <h1>{pageData.page.join(" - ")}</h1>
            <h2>{pageData.sura.join(" - ")}</h2>
            <p>Cumulative frequency of the word GOD: {pageData.notes.cumulativefrequencyofthewordGOD}</p>
            <p>Cumulative sum of verses where GOD word occurs: {pageData.notes.cumulativesumofverseswhereGODwordoccurs}</p>
            <div className="flex flex-col space-y-4 mb-4">
                {Object.entries(pageData.verses).map(([verseNumber, verseText]) => (
                    <>
                        {pageData.titles[verseNumber] && <div className="bg-neutral-700 rounded shadow-xl m-4 p-4">{pageData.titles[verseNumber]}</div>}

                        <div className="flex rounded p-4 m-4 shadow-lg bg-sky-700" key={verseNumber}>
                            <strong className="shadow-inner">{verseNumber}:  </strong> {verseText}
                        </div>
                    </>
                ))}
            </div>
            <div className="bg-sky-600 m-4 rounded p-4 text-neutral-300">
                <h3>Notes:</h3>
                {pageData.notes.data.map((note, index) => <p key={index}>{note}</p>)}

            </div>
        </div>
    );
};

export default Verses;
