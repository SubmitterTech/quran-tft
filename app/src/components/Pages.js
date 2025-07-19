import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import Verse from '../components/Verse';

const formatHitCount = (count) => {
    const factor = 19;
    if (count % factor === 0) {
        return (
            <span dir="ltr">
                {count} (
                <span className="text-nowrap">
                    {factor} x {count / factor}
                </span>
                )
            </span>
        );
    }
    return <span dir="ltr">{count}</span>;
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
    handleToggleJump,
    path,
    startCopyTimer,
    direction,
    upt,
    kvdo
}) => {
    const lang = localStorage.getItem("lang");

    // Refs
    const verseRefs = useRef({});
    const topRef = useRef(null);
    const noteRefs = useRef({});
    const notifyTimeoutRef = useRef();
    const notifyRange = useRef({});
    const stickyRef = useRef(null);
    const currentPageRef = useRef(selectedPage);
    const scrollTimeout = useRef(null);

    // State
    const [kvdoPerVerse, setkvdoPerVerse] = useState(kvdo);

    const [notify, setNotify] = useState(false);
    const [focusedNoteIndices, setFocusedNoteIndices] = useState(Array(10).fill(false));
    const [stickyHeight, setStickyHeight] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);
    const [besmeleClicked, setBesmeleClicked] = useState(false);
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

    const [deleteConfirmResolver, setDeleteConfirmResolver] = useState(null);
    const resolverRef = useRef(null);

    const handleBesmeleClick = useCallback(() => {
        setBesmeleClicked(b => !b);
    }, []);

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

        setkvdoPerVerse(kvdo && path.current[key] !== undefined);
        if (verseRefs.current[key]) {
            setTimeout(() => {
                verseRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: (kvdo && path.current[key] !== undefined) ? 'start' : 'center' });
                setNotify(true);
                clearTimeout(notifyTimeoutRef.current);
                notifyTimeoutRef.current = setTimeout(() => {
                    setNotify(false);
                    notifyRange.current = {};
                }, 4450);
                return () => clearTimeout(notifyTimeoutRef.current);
            }, 190);
        }
    }, [upt, kvdo, path]);

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

    useEffect(() => {
        resolverRef.current = deleteConfirmResolver;
    }, [deleteConfirmResolver]);

    useEffect(() => {
        const handleDeleteConfirmRequest = (event) => {
            setDeleteConfirmResolver({
                resolve: event.detail.resolve,
                data: event.detail.data
            });
        };

        const handleNavigationClick = () => {
            if (resolverRef.current) {
                resolverRef.current.resolve(false);
                setDeleteConfirmResolver(null);
            }
        };

        window.addEventListener('bookmarks:confirm-delete', handleDeleteConfirmRequest);
        window.addEventListener('navigation:click', handleNavigationClick);

        return () => {
            window.removeEventListener('bookmarks:confirm-delete', handleDeleteConfirmRequest);
            window.removeEventListener('navigation:click', handleNavigationClick);
        };
    }, []);

    if (!pageData) return <div className={`${colors[theme]["text"]} flex flex-1 items-center justify-center w-full `}>{translationApplication?.loading}</div>;

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
        handleToggleJump();
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

    const handleConfirm = () => {
        if (deleteConfirmResolver) {
            deleteConfirmResolver.resolve(true);
            setDeleteConfirmResolver(null);
        }
    };

    const handleCancel = () => {
        if (deleteConfirmResolver) {
            deleteConfirmResolver.resolve(false);
            setDeleteConfirmResolver(null);
        }
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
                    const verseTextTheme = direction === 'rtl' ? `text-2xl md:text-3xl lg:text-4xl ` : `text-lg md:text-xl lg:text-2xl `;
                    const titleTextTheme = direction === 'rtl' ? `text-xl md:text-2xl lg:text-3xl ` : `text-lg md:text-xl lg:text-2xl font-semibold `;
                    const verseClassName = `${verseTextTheme} p-0.5 md:p-1 m-0.5 w-full flex flex-col cursor-pointer rounded  hyphens-auto text-justify `;
                    const titleClassName = `${titleTextTheme} mx-1 my-0.5 italic rounded  text-center whitespace-pre-wrap `;
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
                                                const surano = finalParts[0]?.trim();
                                                let suranames = finalParts[1]?.trim();
                                                if (parseInt(suraNumber) === 9) {
                                                    const names = suranames?.split(' ');
                                                    const sn = names?.slice(0, 2).join(' ');
                                                    const nobes = names?.slice(2).join(' ');
                                                    suranames = sn + '\n' + nobes;
                                                }
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
                                                const textTheme = direction === 'rtl' ? `text-xl md:text-2xl lg:text-3xl xl:text-4xl` : `text-base md:text-lg lg:text-xl xl:text-2xl `;
                                                if (hasGODinit.toLowerCase().search(gw) !== -1) {
                                                    return (
                                                        <div key={`last-title-${suraNumber}-${verseNumber}`}
                                                            ref={(el) => verseRefs.current[`${suraNumber}:${0}`] = el}
                                                            dir={direction}
                                                            className={`cursor-pointer`}
                                                            onClick={handleBesmeleClick}>
                                                            <div
                                                                className={`mx-1 py-1 px-2 text-neutral-800 rounded bg-gradient-to-r ${besmeleClicked ? ` font-semibold transition-all duration-200` : ``} ${direction === 'rtl' ? ` from-sky-500 to-cyan-300` : ` from-cyan-300 to-sky-500`} ${textTheme} besmele`}>
                                                                {besmeleClicked ? '0. ' + hasGODinit : hasGODinit}
                                                            </div>
                                                            <div className={`flex items-center justify-center transition-all duration-200 ${besmeleClicked ? `py-1 px-2 mx-1` : `h-0`}`}>
                                                                <div className={`transition-all duration-500 font-arabic text-2xl md:text-2xl lg:text-3xl xl:text-4xl ${besmeleClicked ? `opacity-100` : ` opacity-0`}`}>
                                                                    {besmeleClicked ? besmele : null}
                                                                </div>
                                                            </div>
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
                                hasTitle={title}
                                hasNotes={notes}
                                path={path}
                                isScrolling={isScrolling}
                                direction={direction}
                                parseReferences={parseReferences}
                                startCopyTimer={startCopyTimer}
                                kvdo={(kvdoPerVerse && (parseInt(selectedSura) === parseInt(suraNumber) && parseInt(selectedVerse) === parseInt(verseNumber)))}
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
                (() => {
                    const textTheme = direction === 'rtl' ? `text-xl md:text-2xl lg:text-3xl ` : `text-lg lg:text-xl xl:text-2xl `;

                    return (
                        notesData.data.length > 0 &&
                        <div dir={direction} className={`${colors[theme]["base-background"]} mx-0.5 my-3 rounded p-1 ${textTheme} text-justify ${colors[theme]["app-text"]} flex flex-col space-y-1 whitespace-pre-line break-words`}>
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
                    );
                })()
            }
            {deleteConfirmResolver && (
                <div className="fixed inset-0 z-40 flex items-center justify-center backdrop-blur">
                    <div
                        onClick={handleCancel}
                        className={` w-full h-full absolute left-0 top-0`}></div>
                    <div
                        style={{ animation: 'animate-scale 0.2s ease-in-out' }}
                        className={`z-50 mx-4 ${colors[theme]["app-background"]} ${colors[theme]["app-text"]} rounded shadow-lg`}>
                        <div className={`p-2 flex flex-col w-full h-full space-y-2`}>

                            <div className={`w-full p-1 rounded ${colors[theme]["verse-detail-background"]} flex flex-col space-y-2`}>
                                <div className={`p-3 text-lg md:text-xl w-full text-center font-semibold`}>
                                    {translationApplication?.bmdd}
                                </div>
                                <div className={`text-lg md:text-xl w-full overflow-y-auto max-h-96`}>
                                    <div className={`px-0.5 pt-1 -pb-1 ${direction === "rtl" ? "float-right" : "float-left"}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-7 opacity-50`} >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75h1.5m9 0h-9" />
                                        </svg>
                                    </div>
                                    <div className={`w-full text-lg rounded p-1 text-start ${colors[theme]["matching-text"]} ${colors[theme]["encrypted-background"]}`}>
                                        {`${deleteConfirmResolver.data.value}`}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between space-x-2">
                                <button
                                    onClick={handleConfirm}
                                    className={`flex flex-col w-full max-w-24 items-center justify-between pt-2 rounded  ${colors[theme]["text-background"]}`}>
                                    <div className={`flex justify-center`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 1.664 1.664M21 21l-1.5-1.5m-5.485-1.242L12 17.25 4.5 21V8.742m.164-4.078a2.15 2.15 0 0 1 1.743-1.342 48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185V19.5M4.664 4.664 19.5 19.5" />
                                        </svg>
                                    </div>
                                    <div className={`flex ${colors[theme]["page-text"]} text-xs items-center justify-center pb-1`}>
                                        {translationApplication?.delete}
                                    </div>
                                </button>
                                <div className={` opacity-70 ${colors[theme]["page-text"]} h-20 w-full text-lg md:text-xl flex items-center justify-center text-center `}>
                                    {`${deleteConfirmResolver.data.key}`}
                                </div>
                                <button
                                    onClick={handleCancel}
                                    className={`flex flex-col w-full max-w-24 items-center justify-between pt-1 rounded  ${colors[theme]["text-background"]}`}>
                                    <div className={`flex justify-center`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-14 h-14`} >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75h1.5m9 0h-9" />
                                        </svg>
                                    </div>
                                    <div className={`flex ${colors[theme]["page-text"]} text-xs items-center justify-center pb-1`}>
                                        {translationApplication?.keep}
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default Pages;
