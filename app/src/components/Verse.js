import React, { useCallback, useEffect, useState, useRef } from 'react';
import relationalData from '../assets/map.json'; // Import relational data

const Verse = ({ colors, theme, translationApplication, verseClassName, hasAsterisk, suraNumber, verseNumber, verseText, encryptedText, verseRefs, handleVerseClick, pulse, grapFocus, pageGWC, handleClickReference }) => {
    const [mode, setMode] = useState("idle");
    const [cn, setCn] = useState(verseClassName);
    const [text, setText] = useState(verseText);
    const currentVerseKey = `${suraNumber}:${verseNumber}`;
    const [relatedVerses, setRelatedVerses] = useState([]);
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0 });
    const tooltipRef = useRef();
    const longPressTimerRef = useRef();
    const hasMovedRef = useRef(false);


    const handleTouchMove = () => {
        hasMovedRef.current = true;
        clearTimeout(longPressTimerRef.current); // Clear the timer as soon as the user moves
    };
    

    const copyToClipboard = (textToCopy, x, y) => {
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                setTooltip({ visible: true, x, y }); // Set the tooltip's position and make it visible
                setTimeout(() => setTooltip({ ...tooltip, visible: false }), 2000); // Hide tooltip after 2 seconds
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
            });
    };

    const handleLongPressStart = (e, key, text) => {
        if (e.cancelable) {
            e.preventDefault();
        }
        const x = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const y = e.clientY || (e.touches ? e.touches[0].clientY : 0);

        const clip = "[" + key + "] " + text;
        longPressTimerRef.current = setTimeout(() => {
            // Check the ref to see if the user has moved
            if (!hasMovedRef.current) {
                copyToClipboard(clip, x, y);
            }
        }, 600);
    };

    // Function to handle the long press end
    const handleLongPressEnd = () => {
        clearTimeout(longPressTimerRef.current);
        hasMovedRef.current = false; // Reset the flag on touch end
    };

    const onRelatedVerseClick = (verseKey) => {
        handleClickReference(verseKey);
    };

    const findRelatedVerses = useCallback(() => {
        const related = [];


        const addReferences = (referenceString) => {
            referenceString.split(';').forEach(refGroup => {
                const [sura, verses] = refGroup.trim().split(':');
                if (verses && verses.includes(',')) {
                    verses?.split(',').forEach(verseRange => {
                        if (verseRange) {
                            const individualKey = `${sura}:${verseRange}`;
                            if (individualKey !== currentVerseKey) {
                                related.push(individualKey);
                            }
                        }
                    });
                }
            });
        };


        const processTheme = (theme) => {
            if (theme !== '') {
                if (typeof theme === 'string') {
                    // Split the theme string by ';' to separate different references
                    theme.split(';').forEach(refGroup => {
                        const [sura, versesPart] = refGroup.trim().split(':');
                        // Handle different formats within the verses part
                        versesPart?.split(',').forEach(versePart => {
                            if (versePart.includes('-')) {
                                // Handle range of verses
                                const [start, end] = versePart.split('-').map(Number);
                                for (let verse = start; verse <= end; verse++) {
                                    const individualKey = `${sura}:${verse}`;
                                    if (individualKey === currentVerseKey) {
                                        addReferences(theme);
                                    }
                                }
                            } else {
                                // Handle single verse
                                const individualKey = `${sura}:${versePart}`;
                                if (individualKey === currentVerseKey) {
                                    addReferences(theme);
                                }
                            }
                        });
                    });
                } else if (typeof theme === 'object' && theme !== null) {
                    // If it's an object, recursively process each sub-theme
                    Object.values(theme).forEach(subTheme => processTheme(subTheme));
                }
            }
        };

        // Navigate through the JSON structure to find the current verse's references
        Object.values(relationalData).forEach(content => {
            Object.values(content).forEach(theme => {
                if (theme) { processTheme(theme) }
            });
        });

        return [...new Set(related)]; // Remove duplicates
    }, [currentVerseKey]);



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
            setCn(verseClassName + " " + colors[theme]["text-background"] + " border " + colors[theme]["verse-border"]);
        } else if (mode === "idle") {
            setCn(verseClassName + " " + colors[theme]["text-background"]);
        }
    }, [mode, verseClassName, verseText, lightGODwords, colors, theme]);



    const handleClick = () => {
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
                <span className={`text-sky-500`}>{`${verseNumber}. `}</span>
                <span className={`${colors[theme]["app-text"]}`}>
                    {text}
                </span>
            </div>
            {mode === "reading" &&
                <div className={`w-full flex flex-col mt-2`}>
                    <p className={`select-text w-full rounded ${colors[theme]["encrypted-background"]} p-2 mb-2 text-start shadow-inner`} dir="rtl" >
                        {lightAllahwords(encryptedText)}
                    </p>
                    {relatedVerses.length > 0 &&
                        <div className={` w-full rounded ${colors[theme]["relation-background"]} p-2 `}>
                            <div>
                                {relatedVerses.map(verseKey => (
                                    <button className={`${colors[theme]["base-background"]} p-2 rounded m-1 shadow-md text-sky-500`} key={verseKey} onClick={() => onRelatedVerseClick(verseKey)}>
                                        {verseKey}
                                    </button>
                                ))}
                            </div>
                        </div>}
                </div>
            }

            {tooltip.visible && (
                <div
                    ref={tooltipRef}
                    className={`fixed px-4 py-2 shadow-md rounded bg-neutral-900 text-neutral`}
                    style={{ left: tooltip.x - 30, top: tooltip.y - 30, transform: 'translate(-50%, -50%)' }}
                >
                   {translationApplication.copied}
                </div>
            )}
        </div>
    );
};

export default Verse;