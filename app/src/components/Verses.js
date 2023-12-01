import React, { useState, useEffect } from 'react';
import quranData from '../assets/structured_quran.json';

const Verses = ({ selectedPage }) => {
    const [pageData, setPageData] = useState(null);
    const [showExplanation, setShowExplanation] = useState({ GODnameFrequency: false, GODnameSum: false });


    useEffect(() => {
        setPageData(quranData[selectedPage]);
    }, [selectedPage]);

    if (!pageData) return <div>Loading...</div>;

    const toggleExplanation = (key) => {
        setShowExplanation(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="flex w-full flex-1 flex-col text-neutral-200 text-xl overflow-auto">

            <div className="relative flex flex-col space-y-4 mb-2">
                <div className="sticky top-0 backdrop-blur-md p-2 rounded shadow-xl flex">
                    <div className="flex w-full justify-between text-sm md: text-md items-center">

                        <div className="">
                            <h1>{pageData.page.join(" - ")}</h1>
                        </div>
                        <div className="">

                            <h2>{pageData.sura.join(" - ")}</h2>
                        </div>
                    </div>
                    <div className=" flex flex-col text-end text-xs ">
                        <p className="cursor-pointer" onClick={() => toggleExplanation('GODnameFrequency')}>
                            {pageData.notes.cumulativefrequencyofthewordGOD}
                        </p>
                        {showExplanation.GODnameFrequency && (
                            <div className="transition duration-500 ease-in-out transform translate-x-2  p-1 bg-neutral-700 rounded">
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
                {Object.entries(pageData.verses).map(([verseNumber, verseText]) => (
                    <>
                        {pageData.titles[verseNumber] && <div className="bg-neutral-700 rounded shadow-xl m-4 p-4">{pageData.titles[verseNumber]}</div>}

                        <div className="flex rounded p-2 shadow-xl bg-sky-700" key={verseNumber}>
                            <strong className="text-neutral-300/70 text-sm mt-1">{verseNumber}.</strong>
                            <div className="">
                                {verseText}
                            </div>
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
