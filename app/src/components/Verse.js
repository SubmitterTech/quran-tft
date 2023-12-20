import React, { useCallback, useEffect, useState } from 'react';
import relationalData from '../assets/map.json'; // Import relational data

const Verse = ({ colors, theme, translationApplication, verseClassName, hasAsterisk, suraNumber, verseNumber, verseText, encryptedText, verseRefs, handleVerseClick, pulse, grapFocus, pageGWC, handleClickReference }) => {
    const [mode, setMode] = useState("idle");
    const [cn, setCn] = useState(verseClassName);
    const [text, setText] = useState(verseText);
    const currentVerseKey = `${suraNumber}:${verseNumber}`;
    const [relatedVerses, setRelatedVerses] = useState([]);

    const onRelatedVerseClick = (verseKey) => {
        handleClickReference(verseKey);
    };

    const findRelatedVerses = useCallback(() => {
        const related = [];

        // Function to add individual verse keys from a group relation
        const addGroupRelation = (groupRelation) => {
            const [sura, verses] = groupRelation.split(':');
            verses.split(',').forEach(verse => {
                const individualKey = `${sura}:${verse}`;
                if (individualKey !== currentVerseKey) { // Exclude the current verse key
                    related.push(individualKey);
                }
            });
        };

        // Check if current verse is a key in the map
        if (relationalData[currentVerseKey]) {
            relationalData[currentVerseKey].forEach(relation => {
                if (relation.includes(',')) {
                    addGroupRelation(relation);
                } else if (relation !== currentVerseKey) { // Exclude the current verse key
                    related.push(relation);
                }
            });
        }

        // Check if current verse is in the values of any key
        Object.entries(relationalData).forEach(([key, verses]) => {
            if (verses.includes(currentVerseKey)) {
                if (key.includes(',')) {
                    addGroupRelation(key);
                } else {
                    related.push(key);
                }
            }
            verses.forEach(relation => {
                if (relation.includes(',') && relation.includes(currentVerseKey)) {
                    addGroupRelation(key);
                }
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
            className={`${cn}`}
            onClick={() => handleClick()}>
            <div className={`px-1 w-full`}>
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
        </div>
    );
};

export default Verse;