import React, { useState } from 'react';
import '../assets/css/Splash.css';
import languages from '../assets/languages.json';

const Cover = ({ onCoverSeen, coverData, lang, onChangeLanguage }) => {
    // Split the text into lines

    const [show19, setShow19] = useState(true)

    const handleTap = async (e) => {
        setShow19(!show19);
    };
    // Forward to the source
    const openPdf = () => {
        window.location.href = '/quran-english1667577051837.pdf';
    };

    return (
        <div className="splash-screen relative h-screen flex flex-col w-full p-1 justify-between  text-center bg-sky-800 text-neutral-300">

            <div className="w-full h-96 md:h-1/3 flex items-center">
                <div className="flex flex-col w-full space-y-2 md:space-y-3 mt-4 ">
                    <h1 className="text-6xl font-extrabold">{coverData.quran}</h1>
                    <h2 className="text-4xl font-bold whitespace-pre">{coverData.title}</h2>
                    <h2 className="text-lg font-bold whitespace-pre">{coverData.version}</h2>
                </div>
            </div>
            <div className=" w-full h-96 md:h-1/2 ">

                {show19 && <div className={`flex flex-col items-center`}
                    onClick={handleTap}>
                    {/* 19 lines for animated splash, starting from the bottom */}
                    {Array.from({ length: 19 }).map((_, index) => (
                        <div
                            key={index}
                            className="splash-line bg-white h-1 my-1.5 md:h-2 md:my-2.5"
                            style={{
                                animationDelay: `${0.5 * (18 - index)}s`, // Animation delay starts from the longest (bottom) line
                                width: `${81 - 2 * (18 - index)}%` // Width decreases from bottom to top
                            }}
                        >

                        </div>
                    ))}
                </div>}
                <div className="flex w-full justify-center">
                    <div className={`overflow-y-auto flex flex-col p-4 space-y-4 items-end m-4 ${show19 ? "opacity-0 h-0 w-0 pointer-events-none" : "opacity-100 h-80"} transition-opacity duration-1000 ease-linear `}>
                        {Object.keys(languages).map((key) => {
                            if (key) {
                                const isSelectedLanguage = lang === key;
                                const isLanguageDisabled = languages[key].includes("not complete");

                                const languageClass = isLanguageDisabled
                                    ? "bg-neutral-500 cursor-not-allowed opacity-50"
                                    : "bg-neutral-800 cursor-pointer";

                                return (
                                    <div
                                        key={key}
                                        className={`flex p-2  rounded justify-center ${languageClass} ${isSelectedLanguage ? "ring-1 ring-offset-4 ring-sky-400 ring-offset-sky-900" : ""}`}
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
                                        {languages[key]}
                                    </div>
                                );
                            }
                            return null;
                        })}
                    </div>
                    {show19 || <div className={`text-neutral-200 flex items-center justify-center m-4  ${show19 ? "opacity-0 h-0 pointer-events-none" : "opacity-100"}`}>
                        <button onClick={() => onCoverSeen()}
                            className={` px-2 mb-1 rounded ml-2 flex justify-center`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-12 h-12`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                            </svg>
                        </button>
                    </div>}

                </div>
            </div>
            <div className="mb-3 w-full flex flex-col space-y-3 h-fit justify-center">
                <div
                    className="text-sky-400 cursor-pointer"
                    onClick={openPdf}
                >
                    <p className="whitespace-pre">{coverData.translated}</p>
                    <p className="whitespace-pre">{coverData.author}</p>

                </div>
                <p className="whitespace-pre">{coverData.edition + "  1992"}</p>
            </div>

        </div>
    );
};

export default Cover;
