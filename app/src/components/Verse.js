import React, { useEffect, useState } from 'react';

const Verse = ({ verseClassName, hasAsterisk, suraNumber, verseNumber, verseText, encryptedText, verseRefs, handleVerseClick, pulse , grapFocus}) => {
    const [mode, setMode] = useState("idle");
    const [cn, setCn] = useState(verseClassName);

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
        if (mode === "reading") {
            setCn(verseClassName + " flex-col bg-neutral-800 ")
        } else if (mode === "light") {
            setCn(verseClassName + " bg-sky-700 ring-1 ring-sky-100 my-2");
        } else if (mode === "idle") {
            setCn(verseClassName + " bg-sky-700 ")
        }
    }, [mode, verseClassName]);


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
                    {verseText}
                </span>
            </p>

            {mode === "reading" &&
                <div className="w-full flex flex-col mt-2">
                    <div className=" w-full rounded bg-sky-600 flex items-center h-16 justify-start p-2 mb-2">
                        GOD word count UI
                    </div>
                    <div className=" w-full rounded bg-neutral-600 flex items-center justify-end text-end p-2 mb-2">
                        {encryptedText}
                    </div>
                    <div className=" w-full rounded bg-neutral-600 flex items-center justify-center p-2 ">
                        Related Verses
                    </div>
                </div>
            }
        </div>
    );
};

export default Verse;