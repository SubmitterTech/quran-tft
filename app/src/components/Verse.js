import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Clipboard } from '@capacitor/clipboard';

const Verse = ({ besmele,
    colors,
    theme,
    translationApplication,
    relationalData,
    verseClassName,
    hasAsterisk,
    suraNumber,
    verseNumber,
    verseText,
    encryptedText,
    verseRefs,
    handleVerseClick,
    pulse,
    grapFocus,
    pageGWC,
    handleClickReference,
    accumulatedCopiesRef,
    copyTimerRef,
    hasTitle,
    hasNotes,
    path,
    isScrolling
}) => {
    const [mode, setMode] = useState("idle");
    const [cn, setCn] = useState(verseClassName);
    const [text, setText] = useState(verseText);
    const currentVerseKey = `${suraNumber}:${verseNumber}`;
    const [relatedVerses, setRelatedVerses] = useState([]);
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, keys: [] });
    const tooltipRef = useRef();

    const isSwiping = useRef(false);

    const [pulseNumber, setPulseNumber] = useState("");

    const lang = localStorage.getItem("lang");
    const [isMarked, setMarked] = useState(false);
    const [swipeStartX, setSwipeStartX] = useState(0);
    const [swipeEndX, setSwipeEndX] = useState(0);
    const [swipeDistance, setSwipeDistance] = useState(0);

    useEffect(() => {
        setMarked(localStorage.getItem("bookmarks") ? (JSON.parse(localStorage.getItem("bookmarks")))[currentVerseKey] : false)
    }, [currentVerseKey]);

    const copyToClipboard = (key, x, y) => {

        const verseKey = `${key} ${verseText}`;
        let accumulatedText = verseKey;

        if (hasTitle && parseInt(key.split(":")[1]) !== 1) {
            accumulatedText = `${hasTitle}\n${accumulatedText}`;
        }

        if (hasNotes) {
            accumulatedText += `\n\n[${hasNotes}]`;
        }

        accumulatedCopiesRef.current = {
            ...accumulatedCopiesRef.current,
            [key]: accumulatedText
        };

        let textToCopy = "";
        Object.values(accumulatedCopiesRef.current).forEach((txt) => {
            textToCopy += txt + "\n\n";
        });

        const writeToClipboard = async () => {
            try {
                await Clipboard.write({
                    string: textToCopy
                });
                let keys = Object.keys(accumulatedCopiesRef.current).join(", ");
                setTooltip({ visible: true, x, y, keys: keys });
                setTimeout(() => setTooltip({ ...tooltip, visible: false }), 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
            }
        };

        writeToClipboard();

    };

    const handleBookmark = (verseKey) => {
        let bms = {};
        if (isMarked) {
            bms = localStorage.getItem("bookmarks") ? JSON.parse(localStorage.getItem("bookmarks")) : {};
            delete bms[verseKey];
            localStorage.setItem("bookmarks", JSON.stringify(bms));
        } else {
            bms = localStorage.getItem("bookmarks") ? JSON.parse(localStorage.getItem("bookmarks")) : {};
            bms[verseKey] = Date.now();
            localStorage.setItem("bookmarks", JSON.stringify(bms));
        }
        setMarked(!isMarked);
    };

    const handleSwipeStart = (e) => {
        if (!isScrolling && mode !== 'reading') {
            setSwipeStartX(e.touches[0].clientX);
        }
    };

    const handleSwipeMove = (e) => {
        if (!isScrolling && mode !== 'reading') {
            isSwiping.current = true;
            const currentX = e.touches[0].clientX;
            const deltaX = swipeStartX - currentX;
            setSwipeEndX(deltaX);
            if (Math.abs(deltaX) > 9 && Math.abs(deltaX) < 266) {
                setSwipeDistance(deltaX);
            }
        } else {
            setSwipeDistance(0);
            setSwipeEndX(0);
        }
    };

    const handleSwipeEnd = () => {
        if (!isScrolling && Math.abs(swipeDistance) > 100) {
            if (swipeDistance > 100) { // Swipe left
                const clip = "[" + currentVerseKey + "]";
                copyToClipboard(clip, 0, 0);
                isSwiping.current = false;
                // Start a 60-second timer
                if (copyTimerRef.current) {

                    clearTimeout(copyTimerRef.current);
                }
                copyTimerRef.current = setTimeout(() => {
                    // Clear accumulatedCopies after 60 seconds
                    accumulatedCopiesRef.current = ({});

                }, 19000); // 19 seconds
            } else if (swipeDistance < -100) { // Swipe right
                handleBookmark(currentVerseKey);
            }
        }
        setSwipeDistance(0);
        isSwiping.current = false;
    };

    const handleMouseEnter = (side) => {
        if (mode !== 'reading') {
            if (side === 'right') {
                setSwipeDistance(110);
                setSwipeEndX(110);
            } else if (side === 'left') {
                setSwipeDistance(-110);
                setSwipeEndX(-110);
            }
        }
    };

    const handleMouseLeave = () => {

        setSwipeDistance(0);
        setSwipeEndX(0);
    };

    const onRelatedVerseClick = (verseKey) => {
        if (!path.current[currentVerseKey]) { path.current[currentVerseKey] = {} }
        path.current[currentVerseKey][verseKey] = true;
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
                            const individualKey = `${sura}:${verseRange.trim()}`;
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
        if (pageGWC[currentVerseKey]) {
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
        } else {
            return text;
        }
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
            if (!pulseNumber.includes("animate-ping")) {
                setPulseNumber("animate-ping");
            }
        } else {
            setPulseNumber("");
        };
    }, [pulse, pulseNumber]);


    useEffect(() => {
        setText(verseText);
        let highlighted = lightGODwords(verseText);
        if (mode === "reading") {
            setCn(verseClassName + " " + colors[theme]["verse-detail-background"] + " flex-col ring-1 " + colors[theme]["ring"]);
            setText(highlighted);
        } else if (mode === "light") {
            let bcn = `${colors[theme]["text-background"]} ${isMarked ? `border-l-2 ${colors[theme]["matching-border"]}` : ''}`;
            if (encryptedText.includes(besmele)) {
                bcn = `bg-gradient-to-r from-cyan-300 to-sky-500 text-neutral-800 ${isMarked ? `border-l-2 ${colors[theme]["matching-border"]}` : ''}`
            }
            setCn(verseClassName + " " + bcn);
        } else if (mode === "idle") {
            let bcn = `${colors[theme]["text-background"]} ${isMarked ? `border-l-2 ${colors[theme]["matching-border"]}` : ''}`;
            if (encryptedText.includes(besmele)) {
                bcn = `bg-gradient-to-r from-cyan-300 to-sky-500 text-neutral-800 ${isMarked ? `border-l-2 ${colors[theme]["matching-border"]}` : ''}`
            }
            setCn(verseClassName + " " + bcn);
        }
    }, [mode, verseClassName, verseText, lightGODwords, colors, theme, encryptedText, besmele, isMarked]);


    const handleClick = () => {
        if (isSwiping.current) {
            isSwiping.current = false;
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

    const totalVerseKeysCount = relatedVerses.size > 0 ? Array.from(relatedVerses.values()).reduce((total, verseKeys) => total + verseKeys.length, 0) : 0;
    const heightClass = totalVerseKeysCount <= 19 ? "h-52" : "h-96";

    return (
        <div className={`relative `}>
            <div className={`absolute w-full flex h-full justify-between px-2.5`}>
                <div className={`flex h-full w-full px-2 justify-start items-start ${isMarked ? `${colors[theme]["matching-text"]}` : `${colors[theme]["text"]}`}`}>
                    {isMarked ? (<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className={`w-8 h-8 transition-colors duration-500`} style={{ opacity: Math.abs(swipeEndX) / 120 }}>
                        <path fillRule="evenodd" d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6Zm1.5 1.5a.75.75 0 0 0-.75.75V16.5a.75.75 0 0 0 1.085.67L12 15.089l4.165 2.083a.75.75 0 0 0 1.085-.671V5.25a.75.75 0 0 0-.75-.75h-9Z" clipRule="evenodd" />
                    </svg>

                    ) : (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 transition-colors duration-500`} style={{ opacity: Math.abs(swipeEndX) / 120 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75h1.5m9 0h-9" />
                    </svg>)}
                </div>
                <div className={`flex h-full w-full justify-end items-start px-2 ${Math.abs(swipeEndX) > 100 ? `${colors[theme]["matching-text"]}` : `${colors[theme]["page-text"]}`}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 transition-colors duration-300`} style={{ opacity: Math.abs(swipeEndX) / 140 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                    </svg>

                </div>

            </div>
            <div
                ref={(el) => verseRefs.current[currentVerseKey] = el}
                lang={lang}
                key={"verse:" + currentVerseKey}
                onTouchStart={handleSwipeStart}
                onTouchMove={handleSwipeMove}
                onTouchEnd={handleSwipeEnd}
                style={{
                    transform: `translateX(${-swipeDistance}px)`,
                    transition: isSwiping.current ? 'none' : 'transform 0.7s ease',
                }}
                className={`${cn} relative `}>
                <div onClick={() => handleClick()} className={`px-1 w-full`}>
                    {text.includes('\n') ? (
                        text.split('\n').map((line, index, array) => {
                            const middleIndex = Math.floor(array.length / 2);
                            const isTitle = index === middleIndex;
                            return (
                                <React.Fragment key={index}>
                                    {index === 0 && (
                                        <span className={`relative`}>
                                            <span className={mode === "light" ? encryptedText.includes(besmele) ? `text-rose-500 font-semibold absolute brightness-150 ${pulseNumber}` : `${colors[theme]["matching-text"]} font-semibold absolute brightness-150 ${pulseNumber}` : `absolute brightness-150 ${pulseNumber}`}>
                                                {`${verseNumber}. `}
                                            </span>
                                            <span className={mode === "light" ? encryptedText.includes(besmele) ? `text-rose-500 font-semibold relative` : `${colors[theme]["matching-text"]} font-semibold relative` : `relative brightness-150`}>
                                                {`${verseNumber}. `}
                                            </span>
                                        </span>
                                    )}
                                    <span className={isTitle ? `text-center w-full ${colors[theme]["app-background"]} block py-1.5 md:py-2 transform italic font-semibold ${index === middleIndex ? 'scale-x-[1.04]' : ''} ` : ``}>
                                        {line}
                                    </span>
                                </React.Fragment>
                            );
                        })
                    ) : (
                        <span className={`relative`}>
                            <span className={mode === "light" ? encryptedText.includes(besmele) ? `text-rose-500 font-semibold absolute brightness-150 ${pulseNumber}` : `${colors[theme]["matching-text"]} font-semibold absolute brightness-150 ${pulseNumber}` : `absolute brightness-150 ${pulseNumber}`}>
                                {`${verseNumber}. `}
                            </span>
                            <span className={mode === "light" ? encryptedText.includes(besmele) ? `text-rose-500 font-semibold relative` : `${colors[theme]["matching-text"]} font-semibold relative` : `relative brightness-150`}>
                                {`${verseNumber}. `}
                            </span>
                            <span>
                                {text}
                            </span>
                        </span>
                    )}
                </div>

                <div className={`w-full flex flex-col flex-1  ${mode === "reading" ? "p-0.5 mt-2" : "h-0"} `}>
                    <div className={`${mode === "reading" ? " select-text ease-in mb-2 duration-200" : "h-0 ease-linear duration-75"} w-full transition-all  rounded ${colors[theme]["encrypted-background"]} `} >
                        <p className={` p-2 text-start `} dir="rtl" >
                            {mode === "reading" && lightAllahwords(encryptedText)}
                        </p>
                    </div>
                    <div className={`${(mode === "reading" && relatedVerses.size > 0) ? "overflow-auto p-2 delay-500 duration-200 ease-in-out " + heightClass : "duration-75 ease-linear h-0"}  transition-all w-full rounded ${colors[theme]["relation-background"]}`}>
                        {(mode === "reading" && relatedVerses.size > 0) && Array.from(relatedVerses.entries()).map(([themeKey, verseKeys]) => (
                            <div key={themeKey}>
                                <h3 className={`text-lg text-left ${colors[theme]["matching-text"]}`}>{themeKey}</h3>
                                <div>
                                    {verseKeys.map(verseKey => (
                                        <button
                                            className={` p-2 rounded my-1 mr-2  text-sky-500 ${(path.current && path.current[currentVerseKey] && path.current[currentVerseKey][verseKey]) ? `${colors[theme]["relation-background"]} brightness-75` : `${colors[theme]["base-background"]} shadow-lg`}`}
                                            key={Date.now() + verseKey}
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
                        className={`fixed px-4 py-2 rounded ${colors[theme]["base-background"]} ${colors[theme]["matching-text"]} text-base shadow-xl`}
                        style={{ right: 0, top: 0 }}
                    >
                        {tooltip.keys}{` `}{translationApplication.copied}
                    </div>
                )}
            </div>
            { mode !== "reading" && <div
                onClick={() => handleSwipeEnd()}
                className={`absolute left-0 top-0 h-full cursor-pointer w-0 md:w-1/12`}
                onMouseEnter={() => handleMouseEnter('left')}
                onMouseLeave={handleMouseLeave}
            />
            }
            { mode !== "reading" &&
            <div
                onClick={() => handleSwipeEnd()}
                className={`absolute right-0 top-0 h-full cursor-pointer w-0 md:w-1/12`}
                onMouseEnter={() => handleMouseEnter('right')}
                onMouseLeave={handleMouseLeave}
            />}
        </div>
    );
};

export default Verse;