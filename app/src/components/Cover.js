import React, { useState, useEffect, useRef } from 'react';
import '../assets/css/Splash.css';
import languages from '../assets/languages.json';

const Cover = ({ onCoverSeen, coverData, lang, onChangeLanguage }) => {
    const [show19, setShow19] = useState(true)
    const parentRef = useRef(null);
    const [lineHeight, setLineHeight] = useState(0);
    const [lineMargin, setLineMargin] = useState(0);
    const direction = languages[lang]["dir"] ? languages[lang]["dir"] : "ltr";
    const languageDisabilityThreshold = 60;

    useEffect(() => {
        if (parentRef.current) {
            const totalHeight = parentRef.current.offsetHeight;
            const linesHeight = totalHeight * 0.28;
            const marginsHeight = totalHeight * 0.32;
            setLineHeight(linesHeight / 19);
            setLineMargin(marginsHeight / 18);
        }
    }, [show19, parentRef]);

    const handleTap = async (e) => {
        setShow19(!show19);
    };

    // Forward to the source
    const openPdf = () => {
        window.location.href = '/quran-english1667577051837.pdf';
    };

    return (
        <div className="splash-screen fixed h-screen flex flex-col w-full justify-between  text-center bg-sky-950 text-neutral-200 overflow-hidden">
            <div
                onClick={handleTap}
                className="w-full h-1/3 flex items-center ">
                <div className="flex flex-col w-full space-y-1 md:space-y-3 mt-3">
                    <h1 className="text-6xl font-extrabold" style={{
                        backgroundImage: 'linear-gradient(45deg, #ECC440, #FFFA8A, #DDAC17, #FFFF95)',
                        color: 'transparent',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        textShadow: '0 2px 2px rgba(0,0,0,0.1), 0 3px 5px rgba(255,215,0,0.19)'
                    }}>
                        {coverData.quran}
                    </h1>
                    <h2 className="text-4xl font-bold whitespace-pre" style={{
                        backgroundImage: 'linear-gradient(45deg, #ECC440, #FFFA8A, #DDAC17, #FFFF95)',
                        color: 'transparent',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        textShadow: '0 1px 1px rgba(0,0,0,0.1), 0 2px 3px rgba(255,215,0,0.19)'
                    }}>
                        {coverData.title}
                    </h2>
                    <h2 className="text-lg font-bold whitespace-pre">{coverData.version}</h2>
                </div>
            </div>
            <div className=" w-full h-1/2" ref={parentRef}>
                {show19 && (
                    <div className={`flex flex-col items-center h-full pt-1`} onClick={handleTap}>
                        {Array.from({ length: 19 }).map((_, index) => (
                            <div
                                key={index}
                                className="splash-line "
                                style={{
                                    animationDelay: `${0.4 * (18 - index)}s`,
                                    width: `${90 - 2.2 * (18 - index)}%`,
                                    height: `${lineHeight}px`,
                                    margin: `${lineMargin}px 0`,
                                }}
                            ></div>
                        ))}
                    </div>
                )}
                <div className="flex w-full items-center justify-center h-full pt-2">
                    <div className={`overflow-y-scroll flex flex-col p-2 space-y-4 items-end m-4 ${show19 ? "opacity-0 h-0 w-0 pointer-events-none" : "opacity-100 h-full transition-opacity duration-500 ease-in"}`}>
                        {Object.keys(languages).map((key) => {
                            if (key) {
                                const isSelectedLanguage = lang === key;
                                const isLanguageDisabled = languages[key]["comp"] < languageDisabilityThreshold;

                                const languageClass = isLanguageDisabled
                                    ? "bg-neutral-500 cursor-not-allowed opacity-50"
                                    : "bg-neutral-800 cursor-pointer";

                                return (
                                    <div
                                        key={key}
                                        className={`flex flex-col p-2 rounded text-base justify-center ${languageClass} ${isSelectedLanguage ? "ring-1 ring-offset-4 ring-sky-400 ring-offset-sky-950" : ""}`}
                                        onClick={() => isLanguageDisabled ? null : onChangeLanguage(key)}>
                                        <input
                                            type="radio"
                                            name="theme"
                                            value={key}
                                            disabled={isLanguageDisabled}
                                            checked={isSelectedLanguage}
                                            onChange={(e) => isLanguageDisabled ? null : onChangeLanguage(e.target.value)}
                                            className="hidden"
                                        />
                                        <div className={`flex justify-between items-center w-full ${key === "en" ? 'py-3' : ''}`}>
                                            <span dir={languages[key]["dir"]}>{languages[key]["name"]}</span>
                                        </div>
                                        {key !== "en" && (
                                            <div className="relative w-full rounded h-3.5 bg-neutral-600 mt-1.5 font-semibold ">
                                                <div
                                                    className="bg-sky-400 h-3.5 rounded "
                                                    style={{ width: `${languages[key]["comp"]}%` }}
                                                ></div>
                                                <span className="absolute inset-0 flex items-center justify-center text-xs text-neutral-800">
                                                    {languages[key]["comp"]}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            return null;
                        })}
                    </div>
                    <div
                        onClick={() => onCoverSeen()}
                        className={`text-neutral-200 flex items-center justify-center transition-opacity ease-in py-10 px-3 ${show19 ? "opacity-0 h-0 pointer-events-none" : "delay-700 duration-700 opacity-100"}`}>
                        <div className={` px-2 mb-1 rounded ml-2 flex justify-center`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-12 h-12`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
            <div
                onClick={handleTap}
                className="w-full flex flex-col space-y-3 h-1/6 justify-center pb-1">
                <div
                    className="text-sky-400 cursor-pointer"
                    onClick={openPdf}
                >
                    <p className="whitespace-pre">{coverData.translated}</p>
                    <p className="whitespace-pre">{coverData.author}</p>

                </div>
                <p dir={direction} className="whitespace-pre">{coverData.edition + "  1992"}</p>
            </div>
        </div>
    );
};

export default Cover;
