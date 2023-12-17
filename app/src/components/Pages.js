import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Verse from '../components/Verse';
import quranData from '../assets/qurantft.json';

const Pages = ({ selectedPage, selectedSura, selectedVerse, handleClickReference, handleClickAppReference }) => {
    const [pageData, setPageData] = useState(null);
    const [showExplanation, setShowExplanation] = useState({ GODnamefrequency: false, GODnamesum: false });
    const [pageTitle, setPageTitle] = useState([]);
    const [pageGWC, setPageGWC] = useState({ "0:0": quranData[(parseInt(selectedPage) - 1) + ""]?.notes ? parseInt(quranData[(parseInt(selectedPage) - 1) + ""].notes.cumulativefrequencyofthewordGOD) : 0 });
    const verseRefs = useRef({});
    const topRef = useRef(null);
    const noteRefs = useRef({});

    const [notify, setNotify] = useState(false);

    const forceScroll = useCallback(() => {
        const verseKey = `${parseInt(selectedSura)}:${parseInt(selectedVerse)}`;

        if (verseRefs.current[verseKey]) {
            verseRefs.current[verseKey].scrollIntoView({ behavior: 'smooth', block: 'center' });
            setNotify(true);
        }
    }, [selectedSura, selectedVerse]);

    useEffect(() => {
        setPageData(quranData[selectedPage]);
        setPageGWC({ "0:0": quranData[(parseInt(selectedPage) - 1) + ""]?.notes ? parseInt(quranData[(parseInt(selectedPage) - 1) + ""].notes.cumulativefrequencyofthewordGOD) : 0 });
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
    }, [selectedPage, selectedSura, selectedVerse, forceScroll]);


    const parsePageVerses = () => {
        let sortedVerses = [];
        if (pageData && pageData.sura) {
            Object.entries(pageData.sura).forEach(([suraNumber, suraInfo]) => {
                Object.entries(suraInfo.verses).forEach(([verseNumber, verseText]) => {
                    sortedVerses.push({
                        suraNumber: parseInt(suraNumber),
                        verseNumber: parseInt(verseNumber),
                        verseText,
                        encryptedText: suraInfo.encrypted[verseNumber],
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

    const countGODwords = (verse) => {
        const regex = /\b(GOD)\b/g;
        return (verse.match(regex) || []).length;
    };

    const calculatePageGWC = () => {
        const sortedVerses = parsePageVerses(pageData);
        let newPageGWC = { "0:0": quranData[(parseInt(selectedPage) - 1) + ""]?.notes ? parseInt(quranData[(parseInt(selectedPage) - 1) + ""].notes.cumulativefrequencyofthewordGOD) : 0 };

        sortedVerses.forEach(({ suraNumber, verseNumber, verseText }) => {
            const count = countGODwords(verseText);
            const key = `${suraNumber}:${verseNumber}`;
            const previousKey = Object.keys(newPageGWC).filter(k => k.startsWith(`${suraNumber}:`)).pop() || "0:0";

            if (count > 0) {
                newPageGWC[key] = (newPageGWC[previousKey] || 0) + count;
            }
        });

        return newPageGWC;
    };


    // Call this function before rendering Verse components
    const updatedPageGWC = calculatePageGWC();

    const clickReferenceController = (part) => {
        if (parseInt(selectedSura) === parseInt(part.split(":")[0]) && parseInt(selectedVerse) === parseInt(part.split(":")[1])) {
            forceScroll();
        } else {
            handleClickReference(part);
        }
    };

    const parseReferences = (text) => {
        // Define the regular expressions
        const verseRegex = /(\d+:\d+(?:-\d+)?)/g;
        const appendixRegex = /Appendix?/g;
        const introRegex = /introduction/gi;


        const replaceAppendixNumbers = (appendixPart) => {
            const startIndex = appendixPart.search(appendixRegex);
            let endIndex = startIndex;
            let isNumberStarted = false;

            for (let i = startIndex; i < appendixPart.length; i++) {
                const char = appendixPart[i];
                if (/\d/.test(char)) {
                    isNumberStarted = true;
                    endIndex = i;
                } else if (isNumberStarted && !(/[,&\s]|and/.test(char))) {
                    break;
                }
            }

            const appendixReference = appendixPart.substring(startIndex, endIndex + 1);
            const parts = appendixReference.split(/(\d+|\s+|,|&|and)/gi);

            return (
                <>
                    {appendixPart.substring(0, startIndex)}
                    {parts.map((segment, index) => {
                        if (segment.match(/^\d+$/) && parseInt(segment) >= 1 && parseInt(segment) <= 39) {
                            return (
                                <span key={index} className="cursor-pointer text-sky-600" onClick={() => handleClickAppReference(segment)}>
                                    {segment}
                                </span>
                            );
                        } else {
                            return segment;
                        }
                    })}
                    {appendixPart.substring(endIndex + 1)}
                </>
            );
        };


        // Split the text into parts and process each part
        return text.split(verseRegex).map((part, index) => {
            if (part.match(appendixRegex)) {
                // Split the part into pieces with "."
                const pieces = part.split('.');

                // Create an array to hold JSX elements and strings
                const elements = [];

                // Re-iterate over the pieces to find which piece is matching
                for (let i = 0; i < pieces.length; i++) {
                    if (appendixRegex.test(pieces[i])) {
                        // Process the matching piece and add it to the elements array
                        elements.push(replaceAppendixNumbers(pieces[i]));
                    } else {
                        // If the piece does not match, add it as a string
                        elements.push(pieces[i]);
                    }

                    // Add the period back as a string, except for the last piece
                    if (i < pieces.length - 1) {
                        elements.push('.');
                    }
                }

                // Return the array of JSX elements and strings
                return elements;
            } else if (part.match(verseRegex)) {
                // If the part matches a verse reference, we can return a clickable element
                return (
                    <span key={index} className="cursor-pointer text-sky-600" onClick={() => clickReferenceController(part)}>
                        {part}
                    </span>
                );
            } else if (introRegex.test(part)) {
                // Split the part into segments around introRegex matches
                const segments = part.split(introRegex);

                // Create an array to hold JSX elements and strings
                const elements = [];

                // Iterate over the segments
                segments.forEach((segment, index) => {
                    // Push the regular segment as plain text
                    elements.push(segment);

                    // If this is not the last segment, add the intro match as a clickable span
                    if (index < segments.length - 1) {
                        elements.push(
                            <span key={index} className="cursor-pointer text-sky-600" onClick={() => clickReferenceController("Introduction")}>
                                Introduction
                            </span>
                        );
                    }
                });

                // Return the array of JSX elements and strings
                return elements;
            } else {
                // If it doesn't match anything, return the part as plain text
                return part;
            }
        });
    };


    const parseNoteReferences = (notes) => {
        const noteRefsMap = {};
        notes.forEach((note, index) => {
            // Extract references like "2:1", "2:1-5", or "2:1,3"
            const referencePattern = /\d+:\d+(-\d+)?(,\d+)?/g;
            let ref = note.split(" ")[0]
            if (ref === "*" || ref === "**") {
                ref = note.split(" ")[1]
            }
            const match = ref.match(referencePattern);

            if (match) {
                noteRefsMap[match] = index;
            }

        });
        return noteRefsMap;

    };

    const noteReferencesMap = useMemo(() => {
        // Here we handle the case when pageData or pageData.notes or pageData.notes.data is null or undefined
        if (!pageData || !pageData.notes || !pageData.notes.data) {
            return {};
        }
        return parseNoteReferences(pageData.notes.data);
    }, [pageData]);

    const handleTitleClick = useCallback((suraVerseRef) => {
        // Extract the numeric value of the verse from suraVerseRef
        const verseRef = parseInt(suraVerseRef.split(':')[1]);

        // Initialize a variable to store the matching note index
        let matchingNoteIndex;

        // Iterate over the keys in noteReferencesMap to find a range match
        Object.keys(noteReferencesMap).forEach((key) => {
            // Split the key into sura and verse parts, and then check for verse range
            const keyVerseRange = key.split(':')[1];
            const [rangeStart, rangeEnd] = keyVerseRange.includes('-') ? keyVerseRange.split('-').map(Number) : [parseInt(keyVerseRange), parseInt(keyVerseRange)];

            // Check if verseRef is within the range specified by the key, considering only verse numbers
            if (verseRef >= rangeStart && (!rangeEnd || verseRef <= rangeEnd)) {
                matchingNoteIndex = noteReferencesMap[key];
            }
        });

        // If a matching note index is found, scroll to the note
        if (matchingNoteIndex !== undefined && noteRefs.current[matchingNoteIndex]) {
            noteRefs.current[matchingNoteIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [noteReferencesMap]);

    useEffect(() => {
        if (notify) {
            setTimeout(() => {
                setNotify(false);
            }, 4000);
        }
    }, [notify]);

    useEffect(() => {
        if (showExplanation['GODnamefrequency']) {
            const timer = setTimeout(() => {
                setShowExplanation(prev => ({ ...prev, 'GODnamefrequency': false }));
            }, 7000);
            return () => clearTimeout(timer);
        }
    }, [showExplanation]);

    useEffect(() => {
        if (showExplanation['GODnamesum']) {
            const timer = setTimeout(() => {
                setShowExplanation(prev => ({ ...prev, 'GODnamesum': false }));
            }, 7000);
            return () => clearTimeout(timer);
        }
    }, [showExplanation]);


    if (!pageData) return <div className="text-neutral-900/80 flex flex-1 items-center justify-center w-full ">Loading...</div>;

    const openExplanation = (key) => {
        setShowExplanation(prev => ({ ...prev, [key]: true }));
    };

    const renderTable = (tableData) => {
        const columnCount = tableData.title.length;
        const rows = [];

        for (let i = 0; i < tableData.values.length; i += columnCount) {
            rows.push(tableData.values.slice(i, i + columnCount));
        }

        return (
            <table className="table-auto border-collapse border-2 border-sky-600 text-right">
                <thead>
                    <tr>
                        {tableData.title.map((header, index) => (
                            <th key={index} className="border-2 border-sky-600 p-2 ">{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="border-2 border-sky-600 p-2">{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    const handlePageTitleClicked = () => {
        console.log(pageTitle)
    };

    const formatHitCount = (count) => {
        const factor = 19;
        if (count % factor === 0) {
            return `${count} (${factor} x ${count / factor})`;
        }
        return count;
    };

    const handleVerseClick = (hasAsterisk, key) => {
        if (hasAsterisk) {
            handleTitleClick(key);
        } else {
            console.log("Unknown action from verse to page")
        };
    }
    const grapFocus = (sura, verse) => {
        const verseKey = `${parseInt(sura)}:${parseInt(verse)}`;
        if (verseRefs.current[verseKey]) {
            verseRefs.current[verseKey].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    return (
        <div className="flex relative w-full flex-1 flex-col text-neutral-800 text-base overflow-auto">
            <div ref={topRef} className="relative flex flex-col">
                <div className="sticky top-0 py-2 px-3 bg-neutral-200 shadow-md flex">
                    <div
                        onClick={() => handlePageTitleClicked()}
                        className="flex w-full text-sm lg:text-lg flex-1 mx-2">
                        <div className="flex flex-col font-bold space-y-2">
                            {pageTitle.map((title, index) => (
                                <h1 key={index}>{title}</h1>
                            ))}
                        </div>
                    </div>


                </div>
                {sortedVerses.map(({ suraNumber, verseNumber, verseText, encryptedText, title }) => {
                    const hasAsterisk = verseText.includes('*') || (title && title.includes('*'));
                    const verseClassName = `transition-colors duration-1000 ease-linear flex cursor-pointer rounded mx-2 my-1 p-2 shadow-md text-justify text-base md:text-lg xl:text-xl`;
                    const titleClassName = `bg-neutral-100 italic font-semibold rounded shadow-md mx-2 mt-1.5 mb-0.5 p-3 text-base md:text-md lg:text-lg text-center break-words whitespace-pre-wrap ${hasAsterisk ? "ring-1 ring-neutral-800/80 mt-2" : ""}`;
                    const verseKey = `${suraNumber}:${verseNumber}`;
                    const noteReference = hasAsterisk ? verseKey : null;

                    const countGODwords = (verse) => {
                        const regex = /\b(GOD)\b/g;
                        let count = 0;

                        verse.split(regex).forEach((part, index) => {
                            if (index % 2 !== 0) {
                                ++count;
                            }
                        });

                        return count;
                    };

                    pageGWC[verseKey] = countGODwords(verseText)

                    return (
                        <React.Fragment key={verseNumber + ":" + suraNumber}>
                            {title &&
                                <div className={`${titleClassName} ${hasAsterisk ? "cursor-pointer" : ""}`}
                                    onClick={() => hasAsterisk && handleTitleClick(noteReference)}>
                                    {title}
                                </div>
                            }
                            <Verse
                                verseClassName={verseClassName}
                                hasAsterisk={hasAsterisk}
                                suraNumber={suraNumber}
                                verseNumber={verseNumber}
                                verseText={verseText}
                                encryptedText={encryptedText}
                                verseRefs={verseRefs}
                                verseKey={verseKey}
                                handleVerseClick={handleVerseClick}
                                pulse={notify && (parseInt(selectedSura) === parseInt(suraNumber) && parseInt(selectedVerse) === parseInt(verseNumber))}
                                grapFocus={grapFocus}
                                pageGWC={updatedPageGWC}
                                handleClickReference={handleClickReference}
                            />
                        </React.Fragment>
                    );
                })}

                <div className="sticky bottom-0 mt-3 py-2 px-3 bg-neutral-200 flex">
                    <div className="flex text-sm justify-between flex-1">
                        <p className="cursor-pointer" onClick={() => openExplanation('GODnamefrequency')}>
                            {pageData.notes.cumulativefrequencyofthewordGOD}
                        </p>
                        {showExplanation.GODnamefrequency && (
                            <div className="absolute w-36 left-1.5 -translate-y-24 text-start shadow-md p-3 bg-neutral-100 rounded break-word">
                                Cumulative frequency of the word GOD = {formatHitCount(parseInt(pageData.notes.cumulativefrequencyofthewordGOD))}
                            </div>
                        )}
                        <p className="cursor-pointer" onClick={() => openExplanation('GODnamesum')}>
                            {pageData.notes.cumulativesumofverseswhereGODwordoccurs}
                        </p>
                        {showExplanation.GODnamesum && (
                            <div className="absolute w-36 -translate-y-28 right-1.5 text-end shadow-md p-3 bg-neutral-100 rounded break-word">
                                Cumulative sum of verses where GOD word occurs = {formatHitCount(parseInt(pageData.notes.cumulativesumofverseswhereGODwordoccurs))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
            {
                pageData.notes.data.length > 0 &&
                <div className="bg-neutral-100 m-1.5 mt-3 rounded p-2 text-sm md:text-md lg:text-lg text-justify text-neutral-800 flex flex-col space-y-4 whitespace-pre-line">
                    <h3>Notes:</h3>
                    {pageData.notes.data.map((note, index) =>
                        <p
                            className="bg-neutral-200 rounded shadow-md px-2 py-3 text-neutral-800"
                            ref={(el) => noteRefs.current[index] = el}
                            key={index}>
                            {parseReferences(note)}
                        </p>)}
                    {pageData.notes.tables && pageData.notes.tables.map((table, index) => (
                        <div className="flex justify-center"
                            key={index} >
                            {renderTable(table)}
                        </div>
                    ))}
                </div>
            }
        </div>
    );
};

export default Pages;
