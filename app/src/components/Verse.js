import React, { useCallback, useEffect, useState } from 'react';
import relationalData from '../assets/map.json'; // Import relational data

const Verse = ({ translationApplication, verseClassName, hasAsterisk, suraNumber, verseNumber, verseText, encryptedText, verseRefs, handleVerseClick, pulse, grapFocus, pageGWC, handleClickReference }) => {
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
        const gw = translationApplication.gw;
        const regex = new RegExp(`\\b(${gw})\\b`, 'g');

        return verse.split(regex).reduce((prev, current, index) => {
            if (index % 2 === 0) {
                return [...prev, current];
            } else {
                return [...prev, <span key={index} className="font-bold text-sky-600">{gw}</span>];
            }
        }, []);
    }, [translationApplication.gw]);


    const lightAllahwords = (text) => {
        let parts = [];
        const namesofGOD = "الله|لله"; // Regular expression to match "الله" or "لله"
        let localCount = 0;

        parts = text.split(new RegExp(`(${namesofGOD})`, 'g'));
        return parts.map((part, index) => {
            if (part.match(new RegExp(namesofGOD))) {
                localCount++;
                return (
                    <span key={index} className="text-sky-600 " dir="rtl">
                        {part}<sub> {pageGWC[currentVerseKey] - localCount + 1} </sub>
                    </span>
                );
            } else {
                return <span key={index} dir="rtl">{part}</span>;
            }
        });
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
            setCn(verseClassName + " flex-col bg-neutral-100 ring-1 ring-neutral-900/50");
            setText(highlighted);
        } else if (mode === "light") {
            setCn(verseClassName + " bg-neutral-300 border border-neutral-800/80");
        } else if (mode === "idle") {
            setCn(verseClassName + " bg-neutral-300");
        }
    }, [mode, verseClassName, verseText, lightGODwords]);



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
            <div className="px-1 w-full">
                <span className="text-sky-600">{`${verseNumber}. `}</span>
                <span className="text-neutral-800">
                    {text}
                </span>
            </div>

            {mode === "reading" &&
                <div className="w-full flex flex-col mt-2">
                    <p className=" w-full rounded bg-neutral-200 p-2 mb-2 text-start shadow-inner" dir="rtl" >
                        {lightAllahwords(encryptedText)}
                    </p>
                    {relatedVerses.length > 0 &&
                        <div className=" w-full rounded bg-neutral-200 p-2 ">
                            <div>
                                {relatedVerses.map(verseKey => (
                                    <button className="bg-neutral-100 p-2 rounded m-1 shadow-md text-sky-600" key={verseKey} onClick={() => onRelatedVerseClick(verseKey)}>
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