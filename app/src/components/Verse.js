import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
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
    isScrolling,
    setRemainingTime,
    direction
}) => {
    const currentVerseKey = `${suraNumber}:${verseNumber}`;
    const tooltipRef = useRef();
    const [mode, setMode] = useState("idle");
    const [cn, setCn] = useState(verseClassName);
    const [text, setText] = useState(verseText);
    const [relatedVerses, setRelatedVerses] = useState([]);
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, keys: [] });
    const lang = localStorage.getItem("lang");
    const [isMarked, setMarked] = useState(false);
    const [swipeDistance, setSwipeDistance] = useState(0);
    const timerRef = useRef();

    const [{ x }, api] = useSpring(() => ({ x: 0 }));

    useEffect(() => {
        setMarked(localStorage.getItem("bookmarks") ? (JSON.parse(localStorage.getItem("bookmarks")))[currentVerseKey] : false)
        if (hasAsterisk) {
            setMode("light");
        } else {
            setMode("idle");
        };
    }, [currentVerseKey, hasAsterisk]);

    const copyToClipboard = (key, x, y) => {
        const verseKey = `${key} ${verseText}`;
        let accumulatedText = verseKey;
        if (hasTitle && parseInt(key.split(":")[1]) !== 1) {
            accumulatedText = `${hasTitle}\n${accumulatedText}`;
        }

        function normalizeText(text) {
            // Remove all non-ASCII characters
            text = text.replace(/[^\u0020-\u007E]/g, '');
            // Convert to lowercase
            text = text.toLowerCase();
            // Normalize to remove diacritics
            text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, '');
            // Remove all characters except for a-z and 0-9
            text = text.replace(/[^a-z0-9]/g, '');
            return text;
        }

        // Update the current verse copy before checking for notes
        accumulatedCopiesRef.current = {
            ...accumulatedCopiesRef.current,
            [key]: accumulatedText
        };

        if (hasNotes) {
            // Normalize and check the whole current text for notes
            let currentText = Object.values(accumulatedCopiesRef.current).join("\n\n");
            let sourcetext = normalizeText(currentText);
            let notestext = normalizeText(hasNotes);

            if (!sourcetext.includes(notestext)) {
                accumulatedCopiesRef.current[key] += `\n\n${hasNotes}`;
            }
        }

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
                setTimeout(() => setTooltip({ ...tooltip, visible: false }), 2400);
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

    const handleCopy = () => {
        const clip = `[${currentVerseKey}]`;
        copyToClipboard(clip);
        if (copyTimerRef.current) {
            clearTimeout(copyTimerRef.current);
        }
        copyTimerRef.current = setTimeout(() => {
            accumulatedCopiesRef.current = {};
            setRemainingTime(0);
        }, 19000);

        let startTime = Date.now();
        let endTime = startTime + 19000;

        // Clear the previous animation frame
        if (timerRef.current) {
            cancelAnimationFrame(timerRef.current);
        }

        const updateRemainingTime = () => {
            let now = Date.now();
            let remaining = Math.max(endTime - now, 0);
            setRemainingTime(remaining);
            if (remaining > 0) {
                timerRef.current = requestAnimationFrame(updateRemainingTime);
            }
        };
        updateRemainingTime();
    };


    const handleActions = () => {
        if (!isScrolling && Math.abs(swipeDistance) > 100) {
            if (swipeDistance > 100) {
                handleBookmark(currentVerseKey);
            } else if (swipeDistance < -100) {
                handleCopy();
            }
        }
    };

    const bindDrag = useDrag(({ down, movement: [mx], memo, event }) => {
        if (mode === 'reading' || event.pointerType === 'mouse') {
            return;
        }
        if (!memo) {
            const initialX = mx;
            return initialX;
        }
        const deltaX = mx - memo;
        setSwipeDistance(mx - memo);
        if (!down) {
            if (Math.abs(deltaX) > 100) {
                if (deltaX > 0) {
                    handleBookmark(currentVerseKey);
                } else {
                    handleCopy();
                }
                api.start({ x: 0, config: { tension: 190, friction: 38 } });
            } else {
                api.start({ x: 0, config: { tension: 190, friction: 38 } });
            }
        } else {
            api.start({ x: deltaX, immediate: true });
        }

        return memo;
    }, {
        axis: 'x',
        pointer: { touch: true }
    });

    const handleMouseEnter = (side) => {
        if (mode !== 'reading') {
            if (side === 'right') {
                api.start({ x: -110 });
                setSwipeDistance(-110);
            } else if (side === 'left') {
                api.start({ x: 110 });
                setSwipeDistance(110);
            }
        }
    };

    const handleMouseLeave = () => {
        setSwipeDistance(0);
        api.start({ x: 0 });
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
                    verses.split(',').forEach(verseRange => {
                        if (verseRange) {
                            const individualKey = `${sura}:${verseRange.trim()}`;
                            if (individualKey !== currentVerseKey) {
                                const themeRelated = related.get(theme) || [];
                                if (!themeRelated.includes(individualKey)) {
                                    themeRelated.push(individualKey);
                                    related.set(theme, themeRelated);
                                }
                            }
                        }
                    });
                } else if (verses && verses.includes('-')) {
                    const [start, end] = verses.split('-');
                    for (let verse = parseInt(start.trim()); verse <= parseInt(end.trim()); verse++) {
                        const individualKey = `${sura}:${verse}`;
                        if (individualKey !== currentVerseKey) {
                            const themeRelated = related.get(theme) || [];
                            if (!themeRelated.includes(individualKey)) {
                                themeRelated.push(individualKey);
                                related.set(theme, themeRelated);
                            }
                        }
                    }
                } else if (verses) {
                    const individualKey = `${sura}:${verses.trim()}`;
                    if (individualKey !== currentVerseKey) {
                        const themeRelated = related.get(theme) || [];
                        if (!themeRelated.includes(individualKey)) {
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
                const [sura, versesPart] = refGroup.trim().split(':').map(part => part.trim());;
                // Handle different formats within the verses part
                if (versesPart) {
                    if (versesPart.trim().includes(',')) {
                        versesPart.split(',').map(vp => vp.trim()).forEach(vp => {

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
                    } else {
                        const verse = versesPart.trim();
                        if (verse.includes('-')) {
                            // Handle range of verses
                            const [start, end] = verse.split('-').filter(e => e.trim()).map(Number);

                            for (let v = start; v <= end; v++) {
                                const individualKey = `${sura}:${v}`;
                                if (individualKey === currentVerseKey) {
                                    addReferences(theme, references);
                                }
                            }
                        } else {
                            // Handle single verse
                            const singleKey = `${sura}:${verse}`;
                            if (singleKey === currentVerseKey) {
                                addReferences(theme, references);
                            }
                        }
                    }
                }
            });
        };

        // Navigate through the JSON structure to find the current verse's references
        Object.entries(relationalData).forEach(([_, word]) => {
            Object.entries(word).forEach(([theme, themeorref]) => {
                if (themeorref) {
                    if (typeof themeorref === 'object') {
                        Object.entries(themeorref).forEach(([t, ref]) => {
                            processTheme(theme + "\n· " + t, ref)
                        });
                    } else {
                        processTheme(theme, themeorref)
                    }
                }
            });
        });

        return related;
    }, [currentVerseKey, relationalData]);

    useEffect(() => {
        if (mode === "reading") {
            const foundRelatedVerses = findRelatedVerses();
            setRelatedVerses(foundRelatedVerses);
        }
    }, [mode, currentVerseKey, findRelatedVerses]);

    const lightGODwords = useCallback((verse, paint = false) => {
        const gw = translationApplication ? translationApplication.gw : "GOD";

        if (direction === 'rtl') {
            // Function to check regex support
            const supportsUnicodeRegex = () => {
                try {
                    new RegExp("\\p{L}", "u");
                    return true;
                } catch (e) {
                    return false;
                }
            };

            try {
                const regex = supportsUnicodeRegex()
                    ? new RegExp(`(?<!\\p{L})(${gw})(?!\\p{L})`, 'gu') // Enhanced with Unicode properties for RTL
                    : new RegExp(`(^|(?<=[^\u0600-\u06FF]))${gw}(?=[^\u0600-\u06FF]|$)`, 'g'); // Fallback regex for environments without Unicode support

                const elements = [];
                let lastIndex = 0;

                const matches = [...verse.matchAll(regex)];

                matches.forEach(match => {
                    elements.push(verse.substring(lastIndex, match.index));
                    elements.push(<span key={match.index} dir={direction} className={`font-bold ${paint ? 'text-sky-500' : ''}`}>{match[0]}</span>);
                    lastIndex = match.index + match[0].length;
                });

                if (lastIndex < verse.length) {
                    elements.push(verse.substring(lastIndex));
                }
                return elements;
            } catch (error) {
                console.error("Error processing regex: ", error);
                // Fallback behavior in case of regex failure
                return [<span key="fallback" dir={direction}>{verse}</span>];
            }
        } else {
            try {
                const regex = new RegExp(`\\b(${gw})\\b`, 'g');

                return verse.split(regex).reduce((prev, current, index) => {
                    if (index % 2 === 0) {
                        return [...prev, current];
                    } else {
                        return [...prev, <span key={index} dir={direction} className={`font-bold ${paint ? 'text-sky-500' : ''}`}>{gw}</span>];
                    }
                }, []);
            } catch (error) {
                console.error("Error processing regex for LTR: ", error);
                // Fallback behavior in case of regex failure
                return [<span key="fallback" dir={direction}>{verse}</span>];
            }
        }
    }, [translationApplication, direction]);


    const formatHitCount = (count) => {
        const factor = 19;
        if (count % factor === 0) {
            return `${count} (${factor} x ${count / factor})`;
        }
        return count;
    };

    const lightAllahwords = (text) => {
        if (pageGWC[currentVerseKey]) {

            let regex;
            try {
                const namesofGOD = "(?<![\\u0600-\\u06FF])(الله|لله|ولله|والله|بالله)(?![\\u0600-\\u06FF])";
                regex = new RegExp(namesofGOD, 'g');
                regex.test("");
            } catch (e) {
                console.error("Regex not supported in this environment: ", e.message);
                const namesofGOD = "(الله|لله|ولله|والله|بالله)";
                regex = new RegExp(namesofGOD, 'g');
            }

            let parts = [];
            const matches = [...text.matchAll(regex)];
            let cursor = 0;

            let startIndex = pageGWC[currentVerseKey].cumulative - pageGWC[currentVerseKey].local + 1;

            matches.forEach((match, index) => {
                parts.push(
                    <span key={`${currentVerseKey}-text-${cursor}`} dir="rtl">
                        {text.slice(cursor, match.index)}
                    </span>
                );

                let currentCount = startIndex + index;

                parts.push(
                    <span key={`${currentVerseKey}-match-${index}`} className="text-sky-500" dir="rtl">
                        {match[0]}<sub dir="ltr" className={`text-xs md:text-sm whitespace-nowrap`} > {formatHitCount(currentCount)} </sub>
                    </span>
                );

                cursor = match.index + match[0].length;
            });

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
        setText(lightGODwords(verseText));
        let highlighted = lightGODwords(verseText, true);
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
        if (mode === "light") {
            setMode("idle");
            handleVerseClick(true, currentVerseKey);
        } else if (mode === "idle") {
            handleVerseClick(false, currentVerseKey);
            setMode("reading");
            grapFocus(suraNumber, verseNumber);
        } else if (mode === "reading") {
            if (hasAsterisk) {
                setMode("light");
            } else {
                setMode("idle");
            };
        } else {
            console.error("Unknown state action");
        }
    };

    const totalVerseKeysCount = relatedVerses.size > 0 ? Array.from(relatedVerses.values()).reduce((total, verseKeys) => total + verseKeys.length, 0) : 0;
    const heightClass = totalVerseKeysCount <= 19 ? "h-52" : "h-96";

    return (
        <div className={`relative`}>
            <div className={`absolute w-full flex h-full justify-between px-2.5`}>
                <div className={`flex h-full w-full px-2 justify-start items-start ${isMarked ? `${colors[theme]["matching-text"]}` : `${colors[theme]["text"]}`}`}>
                    {isMarked ? (<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className={`w-8 h-8 transition-colors duration-500`} style={{ opacity: Math.abs(swipeDistance) / 120 }}>
                        <path fillRule="evenodd" d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6Zm1.5 1.5a.75.75 0 0 0-.75.75V16.5a.75.75 0 0 0 1.085.67L12 15.089l4.165 2.083a.75.75 0 0 0 1.085-.671V5.25a.75.75 0 0 0-.75-.75h-9Z" clipRule="evenodd" />
                    </svg>

                    ) : (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 transition-colors duration-500`} style={{ opacity: Math.abs(swipeDistance) / 120 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75h1.5m9 0h-9" />
                    </svg>)}
                </div>
                <div className={`flex h-full w-full justify-end items-start px-2 ${Math.abs(swipeDistance) > 100 ? `${colors[theme]["matching-text"]}` : `${colors[theme]["page-text"]}`}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 transition-colors duration-300`} style={{ opacity: Math.abs(swipeDistance) / 140 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                    </svg>

                </div>

            </div>
            <div className={`relative rounded-md flex mx-0.5 items-center overflow-hidden`}>
                {(pulse && mode !== "reading") && <div className={`absolute inset-0 animate-rotate ${colors[theme]["matching-conic"]} `}></div>}
                <animated.div
                    ref={(el) => verseRefs.current[currentVerseKey] = el}
                    lang={lang}
                    dir={direction}
                    key={"verse:" + currentVerseKey}
                    {...bindDrag()}
                    onTouchEnd={() => api.start({ x: 0 })}
                    style={{
                        transform: x.to(x => `translateX(${x}px)`),
                    }}
                    className={`${cn} relative`}>
                    <div onClick={() => handleClick()} className={`px-1 w-full`}>
                        {text.includes('\n') ? (
                            text.split('\n').map((line, index, array) => {
                                const middleIndex = Math.floor(array.length / 2);
                                const isTitle = index === middleIndex;
                                return (
                                    <React.Fragment key={index}>
                                        {index === 0 && (
                                            <span className={mode === "light" ? encryptedText.includes(besmele) ? `text-rose-500 font-semibold ` : `${colors[theme]["matching-text"]} font-semibold ` : ` brightness-150`}>
                                                {`${verseNumber}. `}
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
                        <div className={`${mode === "reading" ? " select-text ease-linear mb-2 duration-300" : "h-0 "} w-full transition-all  rounded ${colors[theme]["encrypted-background"]} `} >
                            <p className={` p-2 text-start `} dir="rtl" >
                                {mode === "reading" && lightAllahwords(encryptedText)}
                            </p>
                        </div>
                        <div className={`${(mode === "reading" && relatedVerses.size > 0) ? "overflow-auto p-2 delay-75 duration-200 ease-in-out " + heightClass : " h-0"}  transition-all w-full rounded ${colors[theme]["relation-background"]}`}>
                            {(mode === "reading" && relatedVerses.size > 0) && Array.from(relatedVerses.entries()).map(([themeKey, verseKeys]) => (
                                <div key={themeKey}>
                                    <h3 className={`text-lg text-wrap whitespace-pre ${colors[theme]["matching-text"]}`}>{themeKey}</h3>
                                    <div>
                                        {verseKeys.map(verseKey => (
                                            <button
                                                className={` p-2 rounded my-1 mr-2  text-sky-500 ${(path.current && path.current[currentVerseKey] && path.current[currentVerseKey][verseKey]) ? `${colors[theme]["relation-background"]} brightness-75` : `${colors[theme]["base-background"]} shadow-lg`}`}
                                                key={Date.now() + '_' + themeKey.replace(' ', '') + '_' + verseKey}
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
                            className={`fixed px-3 py-1.5 md:py-2 md:px-4 rounded ${colors[theme]["base-background"]} ${colors[theme]["matching-text"]} text-base shadow-xl`}
                            style={{ right: 0, top: 0 }}
                        >
                            {tooltip.keys}{` `}{translationApplication.copied}
                        </div>
                    )}
                </animated.div>
            </div>
            {mode !== "reading" && <div
                onClick={() => handleActions()}
                className={`absolute left-0 top-0 h-full cursor-pointer w-0 sm:w-1/12`}
                onMouseEnter={() => handleMouseEnter('left')}
                onMouseLeave={handleMouseLeave}
            />
            }
            {mode !== "reading" &&
                <div
                    onClick={() => handleActions()}
                    className={`absolute right-0 top-0 h-full cursor-pointer w-0 sm:w-1/12`}
                    onMouseEnter={() => handleMouseEnter('right')}
                    onMouseLeave={handleMouseLeave}
                />}
        </div>
    );
};

export default Verse;