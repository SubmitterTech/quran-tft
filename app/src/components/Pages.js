import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import Verse from '../components/Verse';

const Pages = ({ colors, theme, translationApplication, map, quranData, translation, selectedPage, selectedSura, selectedVerse, handleClickReference, handleClickAppReference, handleTogglePage }) => {
    const lang = localStorage.getItem("lang")
    const [pageData, setPageData] = useState(null);
    const [notesData, setNotesData] = useState(null);
    const [showExplanation, setShowExplanation] = useState({ GODnamefrequency: false, GODnamesum: false });
    const [pageTitle, setPageTitle] = useState([]);
    const [pageGWC, setPageGWC] = useState({ "0:0": quranData[(parseInt(selectedPage) - 1) + ""]?.notes ? parseInt(quranData[(parseInt(selectedPage) - 1) + ""].notes.cumulativefrequencyofthewordGOD) : 0 });
    const verseRefs = useRef({});
    const topRef = useRef(null);
    const noteRefs = useRef({});

    const accumulatedCopiesRef = useRef({});
    const copyTimerRef = useRef();

    const [notify, setNotify] = useState(false);
    const [focusedNoteIndex, setFocusedNoteIndex] = useState(null);

    const stickyRef = useRef(null);
    const [stickyHeight, setStickyHeight] = useState(0);

    const besmele = quranData["23"]["sura"]["1"]["encrypted"]["1"];

    useLayoutEffect(() => {
        if (stickyRef.current) {
            const updateHeight = () => {
                setStickyHeight(stickyRef.current.offsetHeight);
            };

            updateHeight();

            const resizeObserver = new ResizeObserver(updateHeight);
            resizeObserver.observe(stickyRef.current);

            return () => resizeObserver.disconnect();
        }
    }, [stickyRef, selectedPage]);

    const forceScroll = useCallback(() => {
        const verseKey = `${parseInt(selectedSura)}:${parseInt(selectedVerse)}`;

        if (verseRefs.current[verseKey]) {
            verseRefs.current[verseKey].scrollIntoView({ behavior: 'smooth', block: 'center' });
            setNotify(true);
        }
    }, [selectedSura, selectedVerse]);

    useEffect(() => {
        setPageData(quranData[selectedPage]);
        setNotesData(translation ? translation[selectedPage].notes : quranData[selectedPage].notes)
        setPageGWC({ "0:0": quranData[(parseInt(selectedPage) - 1) + ""]?.notes ? parseInt(quranData[(parseInt(selectedPage) - 1) + ""].notes.cumulativefrequencyofthewordGOD) : 0 });
        if (quranData[selectedPage]) {
            const newPageTitles = [];
            const pageData = translation ? translation[selectedPage].page : quranData[selectedPage].page
            pageData.forEach((pi) => {
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
    }, [quranData, selectedPage, selectedSura, selectedVerse, translation, forceScroll]);


    const parsePageVerses = () => {
        let sortedVerses = [];
        if (pageData && pageData.sura) {
            const verseRegex = /(\d+:\d+(?:-\d*)?)/g;
            let pageNo = 0;
            Object.entries(pageData.page).forEach(([, content]) => {
                if (!content.match(verseRegex)) {
                    pageNo = parseInt(content) + 22
                }
            });
            Object.entries(pageData.sura).forEach(([suraNumber, suraInfo]) => {

                Object.entries(suraInfo.verses).forEach(([verseNumber]) => {
                    sortedVerses.push({
                        suraNumber: parseInt(suraNumber),
                        verseNumber: parseInt(verseNumber),
                        verseText: translation ? translation[pageNo].sura[suraNumber].verses[verseNumber] : suraInfo.verses[verseNumber],
                        encryptedText: suraInfo.encrypted[verseNumber],
                        title: translation ? translation[pageNo].sura[suraNumber].titles[verseNumber] : suraInfo.titles ? suraInfo.titles[verseNumber] : null
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
        const gw = translationApplication ? translationApplication.gw : "GOD";
        const regex = new RegExp(`\\b(${gw})\\b`, 'g');
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
        const verseRegex = /(\d+:\d+(?:-\d+)?)/g;
        const app = translation ? translationApplication.appendix : translationApplication.appendix + "?";
        const intro = translationApplication.intro;
        const appendixRegex = new RegExp(`${app}`, 'g');
        const introRegex = new RegExp(`${intro}`, 'gi');

        const replaceAppendixNumbers = (part) => {
            return part.split(/(\d+)/).map((segment, index) => {
                if (/\d+/.test(segment)) {
                    return (
                        <span key={index} className="cursor-pointer text-sky-500" onClick={() => handleClickAppReference(segment)}>
                            {segment}
                        </span>
                    );
                } else {
                    return segment;
                }
            });
        };

        const splitted = text.split(/(\S+\s*)/).filter(part => part.length > 0)

        let processingAppendix = false;

        const result = splitted.map((part, i) => {
            if (part.match(appendixRegex)) {
                processingAppendix = true;
                return part;
            }

            if (processingAppendix) {
                if (part.match(/\d+/)) {
                    if (part.includes('.')) {
                        processingAppendix = false;
                    }
                    return replaceAppendixNumbers(part);
                } else if (['&', translationApplication.and].includes(part.trim())) {
                    return part;
                } else {
                    processingAppendix = false;
                }
            }

            if (part.match(verseRegex)) {
                const matches = [...part.matchAll(verseRegex)];
                let lastIndex = 0;
                const elements = [];

                matches.forEach((match, index) => {
                    elements.push(part.slice(lastIndex, match.index));
                    const reference = (splitted[i - 2] && !splitted[i - 2].match(/\d+/) ? splitted[i - 2] : " ") + "" + splitted[i - 1]
                    let oldscripture = false
                    //TODO: give outer references for old oldscripture
                    if (reference && !reference.match(/\d+/)) {
                        if (reference.includes(translationApplication.acts) ||
                            reference.includes(translationApplication.isaiah) ||
                            reference.includes(translationApplication.john) ||
                            reference.includes(translationApplication.mark) ||
                            reference.includes(translationApplication.luke) ||
                            reference.includes(translationApplication.matthew) ||
                            reference.includes(translationApplication.romans) ||
                            reference.includes(translationApplication.malachi) ||
                            reference.includes(translationApplication.deuteronomy)) {

                            oldscripture = true;
                        } else if (reference.toLowerCase().includes(translationApplication.quran.toLocaleLowerCase(lang))) {
                            oldscripture = false;
                        }
                    }

                    if (oldscripture) {
                        elements.push(match[0]);
                    } else {
                        elements.push(
                            <span key={index} className="cursor-pointer text-sky-500" onClick={() => clickReferenceController(match[0])}>
                                {match[0]}
                            </span>
                        );
                    }


                    lastIndex = match.index + match[0].length;
                });

                elements.push(part.slice(lastIndex));
                return elements;
            }

            if (introRegex.test(part)) {
                const segments = part.split(introRegex);
                const elements = [];
                segments.forEach((segment, index) => {
                    elements.push(segment);

                    if (index < segments.length - 1) {
                        elements.push(
                            <span key={index} className={`cursor-pointer text-sky-500`} onClick={() => clickReferenceController("Introduction")}>
                                {translationApplication?.intro}
                            </span>
                        );
                    }
                });

                return elements;
            } else {
                return part;
            }
        });

        return result;
    };

    const parseNoteReferences = (notes) => {
        const noteRefsMap = {};
        let emptyMatch = false;
        notes.forEach((note, index) => {
            // Extract references like "2:1", "2:1-5", or "2:1,3"
            const referencePattern = /\d+:\d+(-\d+)?(,\d+)?/g;
            let ref = note.split(" ")[0]
            if (ref === "*" || ref === "**") {
                ref = note.split(" ")[1]
            }
            const match = ref.match(referencePattern);
            if (match) {
                if (emptyMatch) {
                    noteRefsMap[match] = index - 1;
                } else {
                    noteRefsMap[match] = index;
                }
                emptyMatch = false;
            } else {
                emptyMatch = true;
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
            setFocusedNoteIndex(matchingNoteIndex);
        }

    }, [noteReferencesMap]);

    useEffect(() => {
        if (notify) {
            setTimeout(() => {
                setNotify(false);
            }, 4450);
        }
    }, [notify]);

    useEffect(() => {
        if (focusedNoteIndex !== null) {
            const timer = setTimeout(() => {
                setFocusedNoteIndex(null);
            }, 4000);

            return () => clearTimeout(timer);
        }
    }, [focusedNoteIndex]);

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


    if (!pageData) return <div className={`${colors[theme]["text"]} flex flex-1 items-center justify-center w-full `}>Loading...</div>;

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
            <table className={`table-auto border-collapse border-2 border-sky-500 text-right`}>
                <thead>
                    <tr>
                        {tableData.title.map((header, index) => (
                            <th key={index} className={`border-2 border-sky-500 p-2 `}>{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className={`border-2 border-sky-500 p-2`}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    const handlePageTitleClicked = () => {
        handleTogglePage();
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
            verseRefs.current[verseKey].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div
            className={`flex relative w-full flex-1 flex-col ${colors[theme]["app-text"]} text-base overflow-auto `}
            style={{ scrollPaddingTop: stickyHeight === 0 ? 79 : stickyHeight + 3 }}>
            <div
                ref={stickyRef}
                className={`sticky top-0 p-3 ${colors[theme]["app-background"]} shadow-md flex z-10`}>
                <div
                    onClick={() => handlePageTitleClicked()}
                    className={`flex w-full text-sm lg:text-lg flex-1`}>
                    <div className={`flex flex-col space-y-2 w-full`}>
                        {pageTitle.map((title, index) => {
                            // Use a regex to match the three groups: name, Latin pronunciation, and page info
                            const titleRegex = /^(.*?)\s+\((.*?)\)\s+(.*)$/;
                            const match = title.match(titleRegex);

                            // If the title matches the expected format, render the groups
                            if (match) {
                                return (
                                    <div key={index} className="flex justify-between w-full">
                                        <div className="w-full flex justify-between mr-2">
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
                                        <span className="text-left flex-1 font-bold text-sky-500">{namePart}</span>
                                        <span className="text-right flex-1">{pageInfoPart}</span>
                                    </div>
                                );
                            }
                        })}
                    </div>
                </div>
            </div>
            <div ref={topRef} className={`flex flex-col `}>
                {sortedVerses.map(({ suraNumber, verseNumber, verseText, encryptedText, title }) => {
                    const hasAsterisk = verseText.includes('*') || (title && title.includes('*'));
                    const verseClassName = "text-lg mx-2 my-1 p-0.5 md:p-1.5 md:text-xl lg:text-2xl transition-colors duration-700 ease-linear flex flex-col cursor-pointer rounded shadow-md hyphens-auto text-justify ";
                    const titleClassName = `text-lg mx-2 mt-1.5 mb-0.5 p-1.5 md:text-xl lg:text-2xl italic font-semibold rounded shadow-md text-center whitespace-pre-wrap ${colors[theme]["base-background"]}`;
                    const verseKey = `${suraNumber}:${verseNumber}`;
                    const noteReference = hasAsterisk ? verseKey : null;

                    pageGWC[verseKey] = countGODwords(verseText)

                    let notes = null;

                    Object.values(noteReferencesMap).forEach((refkey) => {
                        if (notesData && notesData.data && notesData.data[refkey] && notesData.data[refkey].includes(verseKey)) {
                            notes = notesData.data[refkey];
                        }
                    });

                    return (

                        <React.Fragment key={verseKey}>
                            {title && (
                                title.includes('♦')
                                    ? (
                                        <div className={`text-lg w-full flex flex-col space-y-1 mb-1`}>
                                            {(() => {
                                                const gw = translationApplication.gw.toLocaleLowerCase(lang);
                                                let parts = title.split('\n').slice(1, -1);
                                                if (title.toLowerCase().search(gw) === -1) {
                                                    parts = title.split('\n').slice(1)
                                                }

                                                const concatenated = parts.join(' ');
                                                const finalParts = concatenated.split(':');
                                                const surano = finalParts[0].trim();
                                                const suranames = finalParts[1].trim();
                                                return (
                                                    <div className={`${titleClassName} flex flex-col space-y-1.5`}>
                                                        <div className={`w-full flex justify-center not-italic text-sky-500`}>{surano}</div>
                                                        <div className={`w-full flex justify-center`}>
                                                            {suranames}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                            {(() => {
                                                // THE FIRST SENTENCE OF FIRST SURA : BISMILLAHIRRAHMANIRRAHIM
                                                const hasGODinit = title.split('\n').pop();
                                                const gw = translationApplication.gw.toLocaleLowerCase(lang);
                                                if (hasGODinit.toLowerCase().search(gw) !== -1) {
                                                    return (
                                                        <div
                                                            key={`last-title-${suraNumber}-${verseNumber}`}
                                                            className={` py-1 px-2.5 text-neutral-800 rounded shadow-md mx-2 bg-gradient-to-r from-cyan-300 to-sky-500 besmele`}>
                                                            {hasGODinit}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    )
                                    : (
                                        <div
                                            key={`${"title:" + suraNumber + ":" + verseNumber}`}
                                            className={`${titleClassName} ${hasAsterisk ? " cursor-pointer text-sky-500 mt-2 " : ""}`}
                                            onClick={() => hasAsterisk && handleTitleClick(noteReference)}>
                                            {title}
                                        </div>
                                    )
                            )}
                            <Verse
                                besmele={besmele}
                                colors={colors}
                                theme={theme}
                                translationApplication={translationApplication}
                                relationalData={map}
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
                                accumulatedCopiesRef={accumulatedCopiesRef}
                                copyTimerRef={copyTimerRef}
                                hasTitle={title}
                                hasNotes={notes}
                            />
                        </React.Fragment>
                    );
                })}

                <div className={`sticky -bottom-1 mt-3 py-2 px-3 ${colors[theme]["app-background"]} flex`}>
                    <div className={`flex text-sm justify-between flex-1`}>
                        <p
                            key={`cfotwG`}
                            className={`cursor-pointer`} onClick={() => openExplanation('GODnamefrequency')}>
                            {pageData.notes.cumulativefrequencyofthewordGOD}
                        </p>
                        {showExplanation.GODnamefrequency && (
                            <div className={`absolute w-36 left-1.5 -translate-y-28 text-start shadow-md p-3 ${colors[theme]["base-background"]} rounded break-word`}>
                                {translationApplication?.wc1} = {formatHitCount(parseInt(pageData.notes.cumulativefrequencyofthewordGOD))}
                            </div>
                        )}
                        <p
                            key={`csovwGwo`}
                            className={`cursor-pointer`} onClick={() => openExplanation('GODnamesum')}>
                            {pageData.notes.cumulativesumofverseswhereGODwordoccurs}
                        </p>
                        {showExplanation.GODnamesum && (
                            <div className={`absolute w-36 -translate-y-28 right-1.5 text-end shadow-md p-3 ${colors[theme]["base-background"]} rounded break-word`}>
                                {translationApplication?.wc2} = {formatHitCount(parseInt(pageData.notes.cumulativesumofverseswhereGODwordoccurs))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
            {
                notesData.data.length > 0 &&
                <div className={`${colors[theme]["base-background"]} m-1.5 mt-3 rounded p-2 text-lg md:text-xl lg:text-2xl xl:text-3xl text-justify ${colors[theme]["app-text"]} flex flex-col space-y-4 whitespace-pre-line`}>
                    <h3>{translationApplication?.notes}:</h3>

                    {notesData.data.map((note, index) => (
                        <p
                            className={`${colors[theme]["notes-background"]} hyphens-auto rounded shadow-md px-2 py-1 ${colors[theme]["app-text"]} ${index === focusedNoteIndex ? 'animate-pulse' : ''}`}
                            ref={(el) => noteRefs.current[index] = el}
                            key={"notes:" + index}
                            lang={lang}
                        >
                            {parseReferences(note)}
                        </p>
                    ))}
                    {notesData.tables && notesData.tables.map((table, index) => (
                        <div className={`flex justify-center`}
                            key={index + ":" + table.title[0]} >
                            {renderTable(table)}
                        </div>
                    ))}
                </div>
            }
        </div>
    );
};

export default Pages;
