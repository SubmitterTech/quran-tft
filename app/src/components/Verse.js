import React, { useCallback, useEffect, useState, useRef } from 'react';

const Verse = ({ colors, theme, translationApplication, relationalData, verseClassName, hasAsterisk, suraNumber, verseNumber, verseText, encryptedText, verseRefs, handleVerseClick, pulse, grapFocus, pageGWC, handleClickReference, accumulatedCopiesRef, copyTimerRef }) => {
    const [mode, setMode] = useState("idle");
    const [cn, setCn] = useState(verseClassName);
    const [text, setText] = useState(verseText);
    const currentVerseKey = `${suraNumber}:${verseNumber}`;
    const [relatedVerses, setRelatedVerses] = useState([]);
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, keys: [] });
    const tooltipRef = useRef();
    const longPressTimerRef = useRef();
    const hasMovedRef = useRef(false);
    const hasLongPressedRef = useRef(false);

    const lang = localStorage.getItem("lang")

    const handleTouchMove = () => {
        hasMovedRef.current = true;
        clearTimeout(longPressTimerRef.current); // Clear the timer as soon as the user moves
    };


    const copyToClipboard = (key, text, x, y) => {
        accumulatedCopiesRef.current = {
            ...accumulatedCopiesRef.current,
            [key]: text
        };
        let textToCopy = "";
        Object.entries(accumulatedCopiesRef.current).forEach(([ref, txt]) => {
            textToCopy += ref + " " + txt + "\n\n";
        });

        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                let keys = Object.keys(accumulatedCopiesRef.current).join(", ");
                setTooltip({ visible: true, x, y, keys: keys });
                setTimeout(() => setTooltip({ ...tooltip, visible: false }), 2000);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
            });
    };

    const handleLongPressStart = (e, key, text) => {
        if (e.cancelable) {
            e.preventDefault();
        }
        hasLongPressedRef.current = false;
        const x = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const y = e.clientY || (e.touches ? e.touches[0].clientY : 0);

        const clip = "[" + key + "]";
        longPressTimerRef.current = setTimeout(() => {
            // Check the ref to see if the user has moved
            if (!hasMovedRef.current) {
                copyToClipboard(clip, text, x, y);
                hasLongPressedRef.current = true;
                // Start a 60-second timer
                if (copyTimerRef.current) {

                    clearTimeout(copyTimerRef.current);
                }
                copyTimerRef.current = setTimeout(() => {
                    // Clear accumulatedCopies after 60 seconds
                    accumulatedCopiesRef.current = ({});

                }, 19000); // 19 seconds
            }
        }, 500);
    };

    const handleLongPressEnd = () => {
        clearTimeout(longPressTimerRef.current);
        hasMovedRef.current = false;
    };

    const onRelatedVerseClick = (verseKey) => {
        handleClickReference(verseKey);
    };

    const findRelatedVerses = useCallback(() => {
        const related = new Map();

        const addReferences = (theme, referenceString) => {
            referenceString.split(';').forEach(refGroup => {
                const [sura, verses] = refGroup.trim().split(':');
                if (verses && verses.includes(',')) {
                    verses?.split(',').forEach(verseRange => {
                        if (verseRange) {
                            const individualKey = `${sura}:${verseRange}`;
                            if (individualKey !== currentVerseKey) {
                                const themeRelated = related.get(theme) || [];
                                themeRelated.push(individualKey);
                                related.set(theme, themeRelated);
                            }
                        }
                    });
                } else if (verses && verses.includes('-')) {
                    const [start, end] = verses.split('-');
                    for (let verse = parseInt(start.trim()); verse <= parseInt(end.trim()); verse++) {
                        const individualKey = `${sura}:${verse}`;
                        if (individualKey !== currentVerseKey) {
                            const themeRelated = related.get(theme) || [];
                            themeRelated.push(individualKey);
                            related.set(theme, themeRelated);
                        }
                    }
                }
            });
        };


        const processTheme = (theme, references) => {
            // Split the references string by ';' to separate different references
            references.split(';').forEach(refGroup => {
                const [sura, versesPart] = refGroup.trim().split(':');

                // Handle different formats within the verses part
                versesPart?.split(',').forEach(vp => {

                    if (vp.includes('-')) {
                        // Handle range of verses
                        const [start, end] = vp.split('-').filter(e => e.trim()).map(Number);

                        for (let verse = start; verse <= end; verse++) {
                            const individualKey = `${sura}:${verse}`;
                            if (individualKey === currentVerseKey) {
                                addReferences(theme, references);
                            }
                        }
                    } else {
                        // Handle single verse
                        const individualKey = `${sura}:${vp}`;
                        if (individualKey === currentVerseKey) {
                            addReferences(theme, references);
                        }
                    }
                });
            });
        };

        // Navigate through the JSON structure to find the current verse's references
        Object.entries(relationalData).forEach(([_, word]) => {
            Object.entries(word).forEach(([theme, themeorref]) => {
                if (themeorref) {
                    if (typeof themeorref === 'object') {
                        Object.entries(themeorref).forEach(([t, ref]) => {
                            if (lang === "en") {
                                processTheme(t + " " + theme, ref)
                            } else {
                                processTheme(theme + " " + t, ref)
                            }
                        });
                    } else {
                        processTheme(theme, themeorref)
                    }


                }
            });
        });

        return related;
    }, [currentVerseKey, relationalData, lang]);



    useEffect(() => {
        if (mode === "reading") {
            const foundRelatedVerses = findRelatedVerses();
            setRelatedVerses(foundRelatedVerses);
        }
    }, [mode, currentVerseKey, findRelatedVerses]);


    const lightGODwords = useCallback((verse) => {
        const gw = translationApplication ? translationApplication.gw : "GOD";
        const regex = new RegExp(`\\b(${gw})\\b`, 'g');

        return verse.split(regex).reduce((prev, current, index) => {
            if (index % 2 === 0) {
                return [...prev, current];
            } else {
                return [...prev, <span key={index} className={`font-bold text-sky-500`}>{gw}</span>];
            }
        }, []);
    }, [translationApplication]);


    const lightAllahwords = (text) => {
        const namesofGOD = "(?<![\\u0600-\\u06FF])(الله|لله|والله|بالله)(?![\\u0600-\\u06FF])";
        const regex = new RegExp(namesofGOD, 'g');

        let parts = [];
        let localCount = 0;
        const matches = [...text.matchAll(regex)];

        let cursor = 0; // Keep track of the cursor position in the original text

        matches.forEach((match, index) => {
            // Add the text before the match
            parts.push(
                <span key={`${currentVerseKey}-text-${cursor}`} dir="rtl">
                    {text.slice(cursor, match.index)}
                </span>
            );

            // Add the matched part
            localCount++;
            parts.push(
                <span key={`${currentVerseKey}-match-${index}`} className="text-sky-500" dir="rtl">
                    {match[0]}<sub> {pageGWC[currentVerseKey] - localCount + 1} </sub>
                </span>
            );

            cursor = match.index + match[0].length;
        });

        // Add any remaining text after the last match
        parts.push(
            <span key={`${currentVerseKey}-remaining-${cursor}`} dir="rtl">
                {text.slice(cursor)}
            </span>
        );

        return parts;
    };


    useEffect(() => {
        if (hasAsterisk) {
            setMode("light");
        } else {
            setMode("idle");
        };
    }, [hasAsterisk, verseClassName]);

    useEffect(() => {
        if (pulse) {
            if (!cn.includes("animate-pulse")) {
                setCn(cn + " animate-pulse");
            }
        } else {
            const updatedCn = cn.replace(/animate-pulse/g, '').trim();
            setCn(updatedCn);
        };
    }, [pulse, cn]);


    useEffect(() => {
        setText(verseText);
        let highlighted = lightGODwords(verseText);
        if (mode === "reading") {
            setCn(verseClassName + " " + colors[theme]["verse-detail-background"] + " flex-col ring-1 " + colors[theme]["ring"]);
            setText(highlighted);
        } else if (mode === "light") {
            setCn(verseClassName + " " + colors[theme]["text-background"]);
        } else if (mode === "idle") {
            setCn(verseClassName + " " + colors[theme]["text-background"]);
        }
    }, [mode, verseClassName, verseText, lightGODwords, colors, theme]);



    const handleClick = () => {
        if (hasLongPressedRef.current) {
            hasLongPressedRef.current = false;
            return;
        }
        if (mode === "light") {
            handleVerseClick(hasAsterisk, currentVerseKey)
            setMode("idle");
        } else if (mode === "idle") {
            setMode("reading");
            grapFocus(suraNumber, verseNumber);
        } else if (mode === "reading") {
            if (hasAsterisk) {
                setMode("light");
            } else {
                setMode("idle");
            };
        } else {
            console.log("Unknown state action");
        }
    };

    return (
        <div
            ref={(el) => verseRefs.current[currentVerseKey] = el}
            lang={lang}
            key={"verse:" + currentVerseKey}
            className={`${cn}`}>
            <div
                onMouseDown={(e) => handleLongPressStart(e, currentVerseKey, text)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                onTouchMove={handleTouchMove}
                onTouchStart={(e) => handleLongPressStart(e, currentVerseKey, text)}
                onTouchEnd={handleLongPressEnd}
                onClick={() => handleClick()}
                className={`px-1 w-full`}
            >
                <span className={mode === "light" ? `${colors[theme]["matching-text"]} font-semibold` : `text-sky-500 `}>{`${verseNumber}. `}</span>
                <span className={`${colors[theme]["app-text"]}`}>
                    {text}
                </span>
            </div>

            <div className={`w-full flex flex-col flex-1 p-0.5 transition-all duration-300 ease-linear ${mode === "reading" ? "mt-2" : "h-0"} `}>
                <p className={`${mode === "reading" ? "mb-2 p-2 select-text ease-in duration-300 w-full" : "h-0 ease-linear duration-100"}  transition-all  rounded ${colors[theme]["encrypted-background"]} text-start shadow-md`} dir="rtl" >
                    {mode === "reading" && lightAllahwords(encryptedText)}
                </p>
                <div className={`${mode === "reading" ? "h-96 overflow-auto p-2 duration-300 ease-in-out delay-300" : "duration-200 ease-linear h-0"}  transition-all w-full rounded ${colors[theme]["relation-background"]}`}>
                    {(mode === "reading" && relatedVerses.size > 0) && Array.from(relatedVerses.entries()).map(([themeKey, verseKeys]) => (
                        <div key={themeKey}>
                            <h3 className={`text-base text-left ${colors[theme]["matching-text"]}`}>{themeKey}</h3>
                            <div>
                                {verseKeys.map(verseKey => (
                                    <button
                                        className={`${colors[theme]["base-background"]} p-2 rounded m-1 shadow-md text-sky-500`}
                                        key={verseKey}
                                        onClick={() => onRelatedVerseClick(verseKey)}
                                    >
                                        {verseKey}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>


            {tooltip.visible && (
                <div
                    ref={tooltipRef}
                    className={`fixed px-4 py-2 shadow-md rounded ${colors[theme]["base-background"]} ${colors[theme]["app-text"]}`}
                    style={{ left: tooltip.x - 30, top: tooltip.y - 30, transform: 'translate(-50%, -50%)' }}
                >
                    {tooltip.keys}{` `}{translationApplication.copied}
                </div>
            )}
        </div>
    );
};

export default Verse;