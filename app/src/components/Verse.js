import React, { useCallback, useEffect, useState } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { supportsUnicodeRegex, supportsLookAhead } from '../utils/Device';
import Bookmarks from '../utils/Bookmarks';

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
    hasTitle,
    hasNotes,
    path,
    isScrolling,
    direction,
    parseReferences,
    startCopyTimer,
    kvdo
}) => {
    const currentVerseKey = `${suraNumber}:${verseNumber}`;
    const [mode, setMode] = useState((hasAsterisk && path.current[currentVerseKey] === undefined) ? 'light' : 'idle');
    const [cn, setCn] = useState(verseClassName);
    const [text, setText] = useState(verseText);
    const [relatedVerses, setRelatedVerses] = useState([]);
    const lang = localStorage.getItem("lang");
    const [bookmark, setBookmark] = useState(null);
    const [swipeDistance, setSwipeDistance] = useState(0);
    const hasBesmele = encryptedText.includes(besmele);
    const [{ x }, api] = useSpring(() => ({ x: 0 }));

    useEffect(() => {
        if (kvdo) {
            setMode("reading");
        }
    }, [kvdo]);

    useEffect(() => {
        setBookmark(Bookmarks.get(currentVerseKey));

        const handleBookmarkChange = (nbm) => {
            setBookmark(nbm ? nbm.value !== null ? nbm.value : nbm.timestamp : null);
        };

        Bookmarks.subscribe(currentVerseKey, handleBookmarkChange);
        return () => {
            Bookmarks.unsubscribe(currentVerseKey, handleBookmarkChange);
        };
    }, [currentVerseKey]);

    const handleBookmark = useCallback(async () => {
        if (bookmark) {
            await Bookmarks.remove(currentVerseKey);
        } else {
            Bookmarks.set(currentVerseKey, null);
        }
    }, [bookmark, currentVerseKey]);

    const handleCopy = async () => {
        startCopyTimer(currentVerseKey, verseText, hasTitle, hasNotes, translationApplication);
    };

    const handleActions = () => {
        if (!isScrolling && Math.abs(swipeDistance) > 100) {
            if (swipeDistance > 100) {
                handleBookmark();
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
                    handleBookmark();
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

    const onRelatedVerseClick = (verseKey, from = null) => {
        if (!path.current[currentVerseKey]) { path.current[currentVerseKey] = {} }
        path.current[currentVerseKey][verseKey] = true;
        handleClickReference(verseKey, from);
    };

    const findRelatedVerses = useCallback(() => {
        const related = new Map();

        const addReferences = (theme, referenceString) => {
            referenceString.split(';').forEach(refGroup => {
                const [sura, verses] = refGroup.trim().split(':');
                if (verses && verses.includes(',')) {
                    verses.split(',').forEach(verseRange => {
                        if (verseRange) {
                            if (verseRange.includes('-')) {
                                const [start, end] = verseRange.split('-');
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
                            } else {
                                const individualKey = `${sura}:${verseRange.trim()}`;
                                if (individualKey !== currentVerseKey) {
                                    const themeRelated = related.get(theme) || [];
                                    if (!themeRelated.includes(individualKey)) {
                                        themeRelated.push(individualKey);
                                        related.set(theme, themeRelated);
                                    }
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
                            const subt = t === "" ? "" : "\n· " + t;
                            processTheme(theme + subt, ref)
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
        if (!pageGWC[currentVerseKey]) return text;

        const isMark = (ch) => /[\p{M}\u0640\u200D]/u.test(ch);
        const isArabicBaseOrDigit = (ch) =>
            /[\p{Script=Arabic}\u0660-\u0669\u06F0-\u06F9]/u.test(ch);

        const MARK = '[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]*';

        const RAW = [
            'تالله', 'الله', 'لله', 'ولله', 'والله',
            'بالله', 'فلله', 'فالله', 'ابالله', 'وتالله',
        ];

        const withMarks = (s) =>
            s.split('').map((ch) => (ch === 'ا' ? '[اٱ]' : ch) + MARK).join('');

        const core = RAW.map(withMarks).join('|');

        let regex;
        try {
            regex = new RegExp(core, 'gu');
            regex.test(''); // feature test
        } catch {
            regex = new RegExp(core, 'g'); // very old engines
        }

        // Boundary check that skips trailing/leading marks and joiners
        const isStandaloneAt = (str, start, end) => {
            // Move left over marks/joiners
            let li = start - 1;
            while (li >= 0 && isMark(str[li])) li--;
            if (li >= 0 && isArabicBaseOrDigit(str[li])) return false;

            // Move right over marks/joiners
            let ri = end;
            while (ri < str.length && isMark(str[ri])) ri++;
            if (ri < str.length && isArabicBaseOrDigit(str[ri])) return false;

            return true;
        };

        const matches = [...text.matchAll(regex)];
        const filtered = [];
        for (const m of matches) {
            const s = m.index;
            const e = s + m[0].length;
            if (isStandaloneAt(text, s, e)) filtered.push(m);
        }

        if (filtered.length === 0) return text;

        const parts = [];
        let cursor = 0;
        const startCount =
            pageGWC[currentVerseKey].cumulative - pageGWC[currentVerseKey].local + 1;

        filtered.forEach((m, i) => {
            parts.push(
                <span key={`${currentVerseKey}-t-${cursor}`} dir="rtl">
                    {text.slice(cursor, m.index)}
                </span>
            );
            parts.push(
                <span key={`${currentVerseKey}-h-${i}`} className="text-sky-500" dir="rtl">
                    {m[0]}
                    <sub dir="ltr" className="text-sm md:text-base lg:text-lg whitespace-nowrap">
                        {formatHitCount(startCount + i)}
                    </sub>
                </span>
            );
            cursor = m.index + m[0].length;
        });

        parts.push(
            <span key={`${currentVerseKey}-r-${cursor}`} dir="rtl">
                {text.slice(cursor)}
            </span>
        );

        return parts;
    };

    useEffect(() => {
        setText(lightGODwords(verseText));
        let highlighted = lightGODwords(verseText, true);
        if (mode === "reading") {
            setCn(verseClassName + " " + colors[theme]["verse-detail-background"] + " flex-col ring-1 " + colors[theme]["ring"]);
            setText(highlighted);
        } else if (mode === "light") {
            let bcn = `${colors[theme]["text-background"]} ${bookmark ? `border-l-2 ${colors[theme]["matching-border"]}` : ''}`;
            if (hasBesmele) {
                bcn = `bg-gradient-to-r ${direction === 'rtl' ? ` from-sky-500 to-cyan-300` : ` from-cyan-300 to-sky-500`} text-neutral-800 ${bookmark ? `border-l-2 ${colors[theme]["matching-border"]}` : ''}`
            }
            setCn(verseClassName + " " + bcn);
        } else if (mode === "idle") {
            let bcn = `${colors[theme]["text-background"]} ${bookmark ? `border-l-2 ${colors[theme]["matching-border"]}` : ''}`;
            if (hasBesmele) {
                bcn = `bg-gradient-to-r ${direction === 'rtl' ? ` from-sky-500 to-cyan-300` : ` from-cyan-300 to-sky-500`} text-neutral-800 ${bookmark ? `border-l-2 ${colors[theme]["matching-border"]}` : ''}`
            }
            setCn(verseClassName + " " + bcn);
        }
    }, [mode, verseClassName, verseText, lightGODwords, colors, theme, encryptedText, hasBesmele, bookmark, direction]);


    const handleClick = () => {
        if (mode === "light") {
            setMode("idle");
            handleVerseClick(true, currentVerseKey);
        } else if (mode === "idle") {
            handleVerseClick(false, currentVerseKey);
            setMode("reading");
            grapFocus(suraNumber, verseNumber);
        } else if (mode === "reading") {
            if (hasAsterisk && path.current[currentVerseKey] === undefined) {
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
                <div className={`flex h-full w-full px-2 justify-start items-start ${bookmark ? `${colors[theme]["matching-text"]}` : `${colors[theme]["text"]}`}`}>
                    {bookmark ?
                        (<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} className={`w-8 h-8 transition-colors duration-500`} style={{ opacity: Math.abs(swipeDistance) / 120 }}>
                            <path fillRule="evenodd" d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6Zm1.5 1.5a.75.75 0 0 0-.75.75V16.5a.75.75 0 0 0 1.085.67L12 15.089l4.165 2.083a.75.75 0 0 0 1.085-.671V5.25a.75.75 0 0 0-.75-.75h-9Z" clipRule="evenodd" />
                        </svg>

                        ) :
                        (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 transition-colors duration-500`} style={{ opacity: Math.abs(swipeDistance) / 120 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75h1.5m9 0h-9" />
                        </svg>
                        )}
                </div>
                <div className={`flex h-full w-full justify-end items-start px-2 ${Math.abs(swipeDistance) > 100 ? `${colors[theme]["matching-text"]}` : `${colors[theme]["page-text"]}`}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 transition-colors duration-300`} style={{ opacity: Math.abs(swipeDistance) / 140 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                    </svg>

                </div>

            </div>
            <animated.div
                key={"verse:" + currentVerseKey}
                {...bindDrag()}
                onTouchEnd={() => api.start({ x: 0 })}
                style={{
                    transform: x.to(x => `translateX(${x}px)`),
                }}
                className={`relative rounded-md flex mx-0.5 items-center overflow-hidden`}>
                {(pulse && mode !== "reading") && <div className={`absolute inset-0 animate-rotate ${colors[theme]["matching-conic"]} `}></div>}
                <div
                    ref={(el) => verseRefs.current[currentVerseKey] = el}
                    lang={lang}
                    dir={direction}
                    className={`${cn} relative`}>
                    <div onClick={() => handleClick()} className={`px-1 w-full`}>
                        {
                            Array.isArray(text) ? (
                                text.some(element => typeof element === 'string' && element.includes('\n')) ? (
                                    text.flatMap((element, index) => {
                                        if (typeof element === 'string' && element.includes('\n')) {
                                            return element.split('\n').map((line, lineIndex) => ({
                                                line,
                                                indexToStart: `${lineIndex}`
                                            }));
                                        }
                                        return [{ line: element, combinedIndex: index }];
                                    })
                                        .map(({ line, indexToStart }, index) => {
                                            // SPECIAL CASE FOR RTL 29:17 inner title HACK for proper demonstration
                                            if (currentVerseKey === `29:17` && direction === 'rtl' && index !== 0) {
                                                if (parseInt(index) === 5) {
                                                    line = line?.props?.children + text[4].split('\n')[0];
                                                    const isTitle = true;
                                                    return (
                                                        <React.Fragment key={index}>
                                                            {index === 0 && typeof line === 'string' && (
                                                                <span className={mode === "light" ? `${colors[theme]["matching-text"]} font-semibold` : `brightness-150`}>
                                                                    {`${verseNumber}. `}
                                                                </span>
                                                            )}
                                                            <span className={isTitle ? `text-center w-full block py-1.5 md:py-2 transform italic font-semibold ${colors[theme]["app-background"]} ${mode === `reading` ? `scale-x-[1.03]` : `scale-x-[1.033] `}` : ``}>
                                                                {line}
                                                            </span>
                                                        </React.Fragment>
                                                    );
                                                } else if (parseInt(index) === 6) {
                                                    return <></>;
                                                } else {
                                                    return (
                                                        <React.Fragment key={index}>
                                                            {index === 0 && typeof line === 'string' && (
                                                                <span className={mode === "light" ? `${colors[theme]["matching-text"]} font-semibold` : `brightness-150`}>
                                                                    {`${verseNumber}. `}
                                                                </span>
                                                            )}
                                                            <span>
                                                                {line}
                                                            </span>
                                                        </React.Fragment>
                                                    );
                                                }
                                            } else {
                                                const isTitle = parseInt(indexToStart) === 2;
                                                return (
                                                    <React.Fragment key={index}>
                                                        {index === 0 && typeof line === 'string' && (
                                                            <span className={mode === "light" ? `${colors[theme]["matching-text"]} font-semibold` : `brightness-150`}>
                                                                {`${verseNumber}. `}
                                                            </span>
                                                        )}
                                                        <span className={isTitle ? `text-center w-full block py-1.5 md:py-2 transform italic font-semibold ${colors[theme]["app-background"]} ${mode === `reading` ? `scale-x-[1.03]` : `scale-x-[1.033] `}` : ``}>
                                                            {line}
                                                        </span>
                                                    </React.Fragment>
                                                );
                                            }
                                        })
                                ) : (
                                    text.map((element, index) => (
                                        <React.Fragment key={index}>
                                            {index === 0 && typeof element === 'string' && (
                                                <span className={mode === "light" ? hasBesmele ? `text-rose-600 font-semibold` : `${colors[theme]["matching-text"]} font-semibold` : `brightness-150`}>
                                                    {`${verseNumber}. `}
                                                </span>
                                            )}
                                            {typeof element === 'string' ? (
                                                <span>
                                                    {element}
                                                </span>
                                            ) : (
                                                element
                                            )}
                                        </React.Fragment>
                                    ))
                                )
                            ) : (
                                text.includes('\n') ? (
                                    text.split('\n').map((line, index, array) => {
                                        const middleIndex = Math.floor(array.length / 2);
                                        const isTitle = index === middleIndex;
                                        return (
                                            <React.Fragment key={index}>
                                                {index === 0 && (
                                                    <span className={mode === "light" ? `${colors[theme]["matching-text"]} font-semibold ` : `brightness-150`}>
                                                        {`${verseNumber}. `}
                                                    </span>
                                                )}
                                                <span className={isTitle ? `text-center w-full block py-1.5 md:py-2 transform italic font-semibold ${colors[theme]["app-background"]} ${mode === `reading` ? `scale-x-[1.03]` : `scale-x-[1.033] `}` : ``}>
                                                    {line}
                                                </span>
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <span className={`relative`}>
                                        <span className={mode === "light" ? hasBesmele ? `text-rose-600 font-semibold relative` : `${colors[theme]["matching-text"]} font-semibold relative` : `relative brightness-150`}>
                                            {`${verseNumber}. `}
                                        </span>
                                        <span>
                                            {text}
                                        </span>
                                    </span>
                                )
                            )
                        }
                    </div>
                    <div className={`w-full flex ${(mode === "reading" && bookmark) ? "p-0.5 mt-2 -mb-1" : "h-0"} `}>
                        <div className={`${(mode === "reading" && bookmark) ? " select-text ease-linear duration-300 " : "h-0 "} w-full transition-all  rounded ${colors[theme]["encrypted-background"]} `} >
                            <div className={`${(mode === "reading" && bookmark) ? `px-0.5 pt-1 -pb-1 ${direction === "rtl" ? "float-right" : "float-left"}` : "hidden"}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${(mode === "reading" && bookmark) ? `w-8 h-7 opacity-50` : "hidden"}`} >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75h1.5m9 0h-9" />
                                </svg>
                            </div>
                            <div className={`${(mode === "reading" && bookmark) ? ` p-1 text-start ${colors[theme]["matching-text"]}` : "h-0 "}`} dir={direction} >
                                {mode === "reading" && (supportsLookAhead() ? parseReferences(Bookmarks.format(typeof bookmark === 'object' ? bookmark === null ? '' : bookmark.value : bookmark), currentVerseKey + '-bookmarknote') : Bookmarks.format(typeof bookmark === 'object' ? bookmark === null ? '' : bookmark.value : bookmark))}
                            </div>
                        </div>
                    </div>
                    <div className={`w-full flex flex-col flex-1  ${mode === "reading" ? "p-0.5 mt-2" : "h-0"} `}>
                        <div className={`${mode === "reading" ? " select-text ease-linear mb-2 duration-300" : "h-0 "} w-full transition-all  rounded ${colors[theme]["encrypted-background"]} `} >
                            <p className={` pb-1 pt-2.5 px-2 text-start cursor-auto font-arabic text-3xl/relaxed md:text-4xl/relaxed lg:text-5xl/relaxed`} dir="rtl" >
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
                                                onClick={() => onRelatedVerseClick(verseKey, 'map_' + currentVerseKey)}
                                            >
                                                {verseKey}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </animated.div>
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