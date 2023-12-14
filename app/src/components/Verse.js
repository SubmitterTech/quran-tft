import React, { useCallback, useEffect, useState } from 'react';

const Verse = ({ verseClassName, hasAsterisk, suraNumber, verseNumber, verseText, encryptedText, verseRefs, handleVerseClick, pulse, grapFocus, pageGWC }) => {
    const [mode, setMode] = useState("idle");
    const [cn, setCn] = useState(verseClassName);
    const [text, setText] = useState(verseText);

    const lightGODwords = useCallback((verse) => {
        const regex = /\b(GOD)\b/g;

        return verse.split(regex).reduce((prev, current, index) => {
            if (index % 2 === 0) {
                return [...prev, current];
            } else {
                return [...prev, <span key={index} className="font-bold text-sky-400">GOD</span>];
            }
        }, []);
    }, []);


    const lightAllahwords = (text) => {
        let parts = [];
        const namesofGOD = "الله|لله"; // Regular expression to match "الله" or "لله"
        let localCount = 0;
    
        parts = text.split(new RegExp(`(${namesofGOD})`, 'g')).reverse();
        return parts.map((part, index) => {
            if (part.match(new RegExp(namesofGOD))) {
                localCount++;
                return (
                    <span key={index} className="text-sky-400 " dir="rtl">
                        {part}<sub> {pageGWC[`${suraNumber}:${verseNumber}`] - localCount + 1} </sub>
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
            setCn(verseClassName + " flex-col bg-neutral-800 ");
            setText(highlighted);
        } else if (mode === "light") {
            setCn(verseClassName + " bg-sky-700 ring-1 ring-sky-100 my-2");
        } else if (mode === "idle") {
            setCn(verseClassName + " bg-sky-700 ");
        }
    }, [mode, verseClassName, verseText, lightGODwords]);



    const handleClick = () => {
        if (mode === "light") {
            handleVerseClick(hasAsterisk, `${suraNumber}:${verseNumber}`)
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
            ref={(el) => verseRefs.current[`${suraNumber}:${verseNumber}`] = el}
            className={`${cn}`}
            onClick={() => handleClick()}>
            <p className="p-1 w-full">
                <span className="text-neutral-300/50 font-bold ">{`${verseNumber}. `}</span>
                <span className="text-neutral-200 ">
                    {text}
                </span>
            </p>

            {mode === "reading" &&
                <div className="w-full flex flex-col mt-2">
                    <p className=" w-full rounded bg-neutral-600 p-2 mb-2 text-end" >
                        {lightAllahwords(encryptedText)}
                    </p>
                    <div className=" w-full rounded bg-neutral-600 flex items-center justify-center p-2 ">
                        Related Verses
                    </div>
                </div>
            }
        </div>
    );
};

export default Verse;