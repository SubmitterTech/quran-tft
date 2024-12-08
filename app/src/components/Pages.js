import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import Verse from '../components/Verse';

const formatHitCount = (count) => {
    const factor = 19;
    if (count % factor === 0) {
        return `${count} (${factor} x ${count / factor})`;
    }
    return count;
};

const parseNoteReferences = (notes) => {
    const noteRefsMap = {};
    let lastValidRef = null;
    const referencePattern = /\d+:\d+(-\d+)?(,\d+)?/g;
    notes.forEach((note, index) => {
        const matches = note.match(referencePattern);
        if (matches) {
            lastValidRef = matches[0];
            matches.forEach((match) => {
                const key = match.trim();
                if (!noteRefsMap[key]) {
                    noteRefsMap[key] = [];
                }
                if (!noteRefsMap[key].includes(index)) {
                    noteRefsMap[key].push(index);
                }
            });
        } else {
            if (lastValidRef) {
                noteRefsMap[lastValidRef].push(index);
            }
        }
    });
    return noteRefsMap;
};

const Pages = React.memo(({
    colors,
    theme,
    translationApplication,
    map,
    quranData,
    translation,
    actionType,
    from,
    parseReferences,
    selectedPage,
    selectedSura,
    selectedVerse,
    setSelectedSura,
    setSelectedVerse,
    handleClickReference,
    handleTogglePage,
    path,
    setRemainingTime,
    direction,
    upt
}) => {
    const lang = localStorage.getItem("lang")

    // Refs
    const verseRefs = useRef({});
    const topRef = useRef(null);
    const noteRefs = useRef({});
    const accumulatedCopiesRef = useRef({});
    const copyTimerRef = useRef();
    const notifyTimeoutRef = useRef();
    const notifyRange = useRef({});
    const stickyRef = useRef(null);
    const currentPageRef = useRef(selectedPage);
    const scrollTimeout = useRef(null);

    // State
    const [notify, setNotify] = useState(false);
    const [focusedNoteIndices, setFocusedNoteIndices] = useState(Array(10).fill(false));
    const [stickyHeight, setStickyHeight] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);
    const [showExplanation, setShowExplanation] = useState({
        GODnamefrequency: false,
        GODnamesum: false,
    });

    const pageData = useMemo(() => quranData[selectedPage], [quranData, selectedPage]);

    const notesData = useMemo(
        () => (translation ? translation[selectedPage].notes : quranData[selectedPage].notes),
        [translation, quranData, selectedPage]
    );

    const pageGWC = useMemo(
        () => ({
            '0:0': quranData[`${parseInt(selectedPage) - 1}`]?.notes
                ? parseInt(quranData[`${parseInt(selectedPage) - 1}`].notes.cumulativefrequencyofthewordGOD)
                : 0,
        }),
        [quranData, selectedPage]
    );

    const pageTitle = useMemo(() => {
        if (!quranData[selectedPage]) return [];
        const newPageTitles = [];
        const pageDataContent = translation ? translation[selectedPage].page : quranData[selectedPage].page;
        pageDataContent.forEach((pi) => {
            if (/\d+:\d+/.test(pi)) {
                if (pi.includes('&')) {
                    pi.split('&').forEach((part) => newPageTitles.push(part.trim()));
                } else {
                    newPageTitles.push(pi);
                }
            }
        });
        return newPageTitles;
    }, [quranData, selectedPage, translation]);

    const besmele = quranData["23"]["sura"]["1"]["encrypted"]["1"];

    const updateFocusedNoteIndices = (index, value) => {
        setFocusedNoteIndices(prev => {
            const newIndices = [...prev];
            newIndices[index] = value;
            return newIndices;
        });
    };

    const handleScroll = useCallback(() => {
        if (!isScrolling) setIsScrolling(true);

        clearTimeout(scrollTimeout.current);

        scrollTimeout.current = setTimeout(() => {
            setIsScrolling(false);
        }, 400);
    }, [isScrolling]);

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

    const forceScroll = useCallback((part) => {
        void upt;
        let key = part;
        let range;
        if (part.includes("-")) {
            let parts = part.split("-");
            key = parts[0];
            range = parts[1];

            let [sura, startVerse] = key.split(":");
            let endVerse = parseInt(range, 10);
            for (let i = parseInt(startVerse, 10); i <= endVerse; i++) {
                notifyRange.current[`${sura}:${i}`] = true;
            }
        } else {
            // If incoming part has the verse number 0 make it to 1 to properly notify
            let index = key.indexOf(':');
            if (index !== -1 && key[index + 1] === '0') {
                key = key.slice(0, index + 1) + '1';
            }
            notifyRange.current[key] = true;
        }

        if (verseRefs.current[key]) {
            setTimeout(() => {
                verseRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setNotify(true);
                clearTimeout(notifyTimeoutRef.current);
                notifyTimeoutRef.current = setTimeout(() => {
                    setNotify(false);
                    notifyRange.current = {};
                }, 4450);
                return () => clearTimeout(notifyTimeoutRef.current);
            }, 150);
        }
    }, [upt]);

    useEffect(() => {
        const verseKey = `${selectedSura}:${selectedVerse}`;
        if (selectedPage && selectedPage !== currentPageRef.current) {
            if (!selectedVerse) {
                if (from.current && from.current.includes('notes')) {
                    setTimeout(() => {
                        const index = from.current.split(':')[1];
                        updateFocusedNoteIndices(index, true);
                        noteRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 50);
                } else {
                    setTimeout(() => {
                        if (topRef.current) {
                            topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 78);
                }
            } else {
                setTimeout(() => {
                    forceScroll(verseKey);
                }, 50);
            }
            currentPageRef.current = selectedPage;
        } else {
            if (actionType === 'fromAppendix' || actionType === 'fromIntro' || actionType === 'navigate') {
                setTimeout(() => {
                    forceScroll(verseKey);
                }, 50);
            } else {
                if (from.current && from.current.includes('notes')) {
                    setTimeout(() => {
                        const index = from.current.split(':')[1];
                        updateFocusedNoteIndices(index, true);
                        noteRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 50);
                }
            }
        }
    }, [selectedPage, selectedSura, selectedVerse, actionType, from, forceScroll]);

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
        const regex = direction === 'ltr' ? new RegExp(`\\b(${gw})\\b`, 'g') : new RegExp(`(${gw})`, 'g');
        return (verse.match(regex) || []).length;
    };

    const calculatePageGWC = () => {
        const sortedVerses = parsePageVerses(pageData);
        let newPageGWC = {
            "0:0": {
                cumulative: quranData[(parseInt(selectedPage) - 1) + ""]?.notes ? parseInt(quranData[(parseInt(selectedPage) - 1) + ""].notes.cumulativefrequencyofthewordGOD) : 0,
                local: 0
            }
        };
        let lastCumulativeCount = newPageGWC["0:0"].cumulative;

        sortedVerses.forEach(({ suraNumber, verseNumber, verseText }) => {
            const count = countGODwords(verseText);
            const key = `${suraNumber}:${verseNumber}`;

            if (count > 0) {
                lastCumulativeCount += count;
                newPageGWC[key] = {
                    cumulative: lastCumulativeCount,
                    local: count
                };
            }
        });
        return newPageGWC;
    };

    const updatedPageGWC = calculatePageGWC();

    const clickReferenceController = (part, from = null) => {
        handleClickReference(part, from);
        forceScroll(part);
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
        const suraRef = parseInt(suraVerseRef.split(':')[0]);
        const verseRef = parseInt(suraVerseRef.split(':')[1]);

        // Initialize a variable to store the matching note index
        let matchingNoteIndex;

        // Iterate over the keys in noteReferencesMap to find a range match
        Object.keys(noteReferencesMap).forEach((key) => {
            const keySura = parseInt(key.split(':')[0]);
            const keyVerseRange = key.split(':')[1];
            const [rangeStart, rangeEnd] = keyVerseRange.includes('-') ? keyVerseRange.split('-').map(Number) : [parseInt(keyVerseRange), parseInt(keyVerseRange)];

            // Check if verseRef is within the range specified by the key, considering only verse numbers
            if (suraRef === keySura && (verseRef >= rangeStart && (!rangeEnd || verseRef <= rangeEnd))) {
                matchingNoteIndex = noteReferencesMap[key];
                Object.values(matchingNoteIndex).forEach((index) => {
                    if (noteRefs.current[index]) {
                        updateFocusedNoteIndices(index, true);
                    }
                });
            }
        });

        if (matchingNoteIndex !== undefined) {
            const jumpIndex = matchingNoteIndex.length > 3 ? 0 : matchingNoteIndex.length - 1;
            noteRefs.current[matchingNoteIndex[jumpIndex]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

    }, [noteReferencesMap]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setFocusedNoteIndices([false, false, false, false, false, false, false, false, false]);
        }, 6040);

        return () => clearTimeout(timer);
    }, [focusedNoteIndices]);

    useEffect(() => {
        if (showExplanation['GODnamefrequency']) {
            const timer = setTimeout(() => {
                setShowExplanation(prev => ({ ...prev, 'GODnamefrequency': false }));
            }, 7600);
            return () => clearTimeout(timer);
        }
    }, [showExplanation]);

    useEffect(() => {
        if (showExplanation['GODnamesum']) {
            const timer = setTimeout(() => {
                setShowExplanation(prev => ({ ...prev, 'GODnamesum': false }));
            }, 7600);
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

    const handleVerseClick = (hasAsterisk, key) => {
        if (hasAsterisk) {
            handleTitleClick(key);
        } else {
            const [sura, verse] = key.split(':');
            setSelectedSura(sura);
            setSelectedVerse(verse);
        }
    }
    const grapFocus = (sura, verse) => {
        const verseKey = `${parseInt(sura)}:${parseInt(verse)}`;
        setTimeout(() => {
            if (verseRefs.current[verseKey]) {
                verseRefs.current[verseKey].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 400)
    };

    return (
        <div
            onScroll={handleScroll}
            className={`flex relative w-full flex-1 flex-col ${colors[theme]["app-text"]} text-base overflow-y-auto overflow-x-hidden `}
            style={{ scrollPaddingTop: stickyHeight === 0 ? 79 : stickyHeight + 3 }}>
            <div
                ref={stickyRef}
                className={`sticky top-0 p-3 ${colors[theme]["app-background"]}  flex z-10`}>
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
                                    <div key={`title-matches-${index}`} className="flex justify-between w-full">
                                        <div className="w-full flex justify-between mr-2">
                                            <span className="text-left font-bold justify-self-center text-sky-500">{match[1]}</span>
                                            <span className="text-right ">{`(${match[2]})`}</span>
                                        </div>
                                        <span className="w-1/3 text-right">{direction === 'rtl' ? match[3].trim().split('-').reverse().join('-') : match[3]}</span>
                                    </div>
                                );
                            } else {
                                // If the title doesn't match the expected format, split and render
                                const lastSpaceIndex = title.lastIndexOf(" ");
                                const namePart = title.substring(0, lastSpaceIndex);
                                const pageInfoPart = title.substring(lastSpaceIndex + 1);

                                return (
                                    <div key={`title-not-matches-${index}`} className="flex justify-between w-full">
                                        <span className="text-left flex-1 font-bold text-sky-500">{namePart}</span>
                                        <span className="text-right flex-1">{direction === 'rtl' ? pageInfoPart.trim().split('-').reverse().join('-') : pageInfoPart}</span>
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
                    const hasTitleAsterisk = (title && title.includes('*'));
                    const verseClassName = `text-lg p-0.5 md:p-1 m-0.5 w-full md:text-xl lg:text-2xl flex flex-col cursor-pointer rounded  hyphens-auto text-justify `;
                    const titleClassName = `text-lg mx-1 my-0.5 md:text-xl lg:text-2xl italic font-semibold rounded  text-center whitespace-pre-wrap `;
                    const verseKey = `${suraNumber}:${verseNumber}`;
                    const noteReference = hasAsterisk ? verseKey : null;

                    pageGWC[verseKey] = countGODwords(verseText)

                    let notes = null;

                    Object.keys(noteReferencesMap).forEach((notesRefKey) => {
                        const refkeys = noteReferencesMap[notesRefKey];

                        Object.values(refkeys).forEach((refkey) => {
                            if (notesData && notesData.data && notesData.data[refkey]) {

                                const [suraPart, versePart] = notesRefKey.split(':');
                                if (versePart) {
                                    const verseKeyParts = verseKey.split(':');
                                    const verseKeySura = verseKeyParts[0];
                                    const verseKeyVerse = parseInt(verseKeyParts[1], 10);

                                    // Handle ranges if present
                                    if (versePart.includes('-')) {
                                        const [startVerse, endVerse] = versePart.split('-').map(Number);
                                        if (verseKeySura === suraPart && verseKeyVerse >= startVerse && verseKeyVerse <= endVerse) {
                                            if (notes === null) {
                                                notes = notesData.data[refkey];
                                            } else {
                                                if (notes !== notesData.data[refkey]) {
                                                    notes += '\n' + notesData.data[refkey];
                                                }
                                            }
                                        }
                                    } else {
                                        // Handle single verse
                                        const singleVerse = parseInt(versePart, 10);
                                        if (verseKeySura === suraPart && verseKeyVerse === singleVerse) {
                                            if (notes === null) {
                                                notes = notesData.data[refkey];
                                            } else {
                                                if (notes !== notesData.data[refkey]) {
                                                    notes += '\n' + notesData.data[refkey];
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                        });
                    });

                    return (
                        <div key={`section-${verseKey}`}>
                            {title && (
                                title.includes('♦')
                                    ? (
                                        <div className={`text-lg w-full flex flex-col space-y-1 `}>
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
                                                    <div
                                                        dir={direction}
                                                        className={`${titleClassName} flex flex-col space-y-1.5`}>
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
                                                            ref={(el) => verseRefs.current[`${suraNumber}:${0}`] = el}
                                                            dir={direction}
                                                            className={`mx-1 py-1 px-2 text-neutral-800 rounded bg-gradient-to-r ${direction === 'rtl' ? ` from-sky-500 to-cyan-300`: ` from-cyan-300 to-sky-500`} text-base md:text-lg lg:text-xl xl:text-2xl besmele`}>
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
                                            dir={direction}
                                            className={`${titleClassName} ${hasTitleAsterisk ? " cursor-pointer text-sky-500 border border-neutral-500/50 p-2 md:p-3" : "p-0.5 md:p-2"}`}
                                            onClick={() => hasTitleAsterisk && handleTitleClick(noteReference)}>
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
                                pulse={(notify && (notifyRange.current[`${suraNumber}:${verseNumber}`] ? notifyRange.current[`${suraNumber}:${verseNumber}`] : false)) ||
                                    (notify && (parseInt(selectedSura) === parseInt(suraNumber) && parseInt(selectedVerse) === parseInt(verseNumber)))}
                                grapFocus={grapFocus}
                                pageGWC={updatedPageGWC}
                                handleClickReference={clickReferenceController}
                                accumulatedCopiesRef={accumulatedCopiesRef}
                                copyTimerRef={copyTimerRef}
                                hasTitle={title}
                                hasNotes={notes}
                                path={path}
                                isScrolling={isScrolling}
                                setRemainingTime={setRemainingTime}
                                direction={direction}
                                parseReferences={parseReferences}
                            />
                        </div>
                    );
                })}

                <div className={`sticky -bottom-1 mt-3 flex`}>
                    <div className={`flex text-sm justify-between flex-1`}>
                        <div className={`py-2 px-3 ${colors[theme]["app-background"]} rounded-r`}>
                            <p
                                key={`cfotwG`}
                                className={`cursor-pointer `} onClick={() => openExplanation('GODnamefrequency')}>
                                {pageData.notes.cumulativefrequencyofthewordGOD}
                            </p>
                        </div>
                        {showExplanation.GODnamefrequency && (
                            <div dir={direction} className={`absolute w-36 left-1.5 -translate-y-28 text-start p-3 ${colors[theme]["base-background"]} rounded break-word`}>
                                {translationApplication?.wc1} = {formatHitCount(parseInt(pageData.notes.cumulativefrequencyofthewordGOD))}
                            </div>
                        )}
                        <div className={`py-2 px-3 ${colors[theme]["app-background"]} rounded-l`}>
                            <p
                                key={`csovwGwo`}
                                className={`cursor-pointer`} onClick={() => openExplanation('GODnamesum')}>
                                {pageData.notes.cumulativesumofverseswhereGODwordoccurs}
                            </p>
                        </div>
                        {showExplanation.GODnamesum && (
                            <div dir={direction} className={`absolute w-36 -translate-y-28 right-1.5 text-end  p-3 ${colors[theme]["base-background"]} rounded break-word`}>
                                {translationApplication?.wc2} = {formatHitCount(parseInt(pageData.notes.cumulativesumofverseswhereGODwordoccurs))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
            {
                notesData.data.length > 0 &&
                <div dir={direction} className={`${colors[theme]["base-background"]} mx-0.5 my-3 rounded p-1 text-lg lg:text-xl xl:text-2xl text-justify ${colors[theme]["app-text"]} flex flex-col space-y-1 whitespace-pre-line`}>
                    <h3 className={`p-1`}>{translationApplication?.notes}:</h3>

                    {notesData.data.map((note, index) => (
                        <div
                            className={`${colors[theme]["notes-background"]} hyphens-auto rounded p-2 ${colors[theme]["app-text"]} ${focusedNoteIndices[index] ? 'animate-pulse' : ''}`}
                            ref={(el) => noteRefs.current[index] = el}
                            key={"notes:" + index}
                            lang={lang}
                            dir={direction}>
                            {parseReferences(note, 'notes:' + index, clickReferenceController)}
                        </div>
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
});

export default Pages;
