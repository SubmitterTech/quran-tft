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
        window.location.href = '/quran-tft/quran-english1667577051837.pdf';
    };

    return (
        <div className="splash-screen h-screen flex flex-col w-full p-1 justify-between  text-center bg-sky-800 text-neutral-300">

            <div className="w-full h-full flex items-center">
                <div className="flex flex-col w-full space-y-2 md:space-y-3 mt-4 ">
                    <h1 className="text-6xl font-extrabold">{coverData.quran}</h1>
                    <h2 className="text-4xl font-bold whitespace-pre">{coverData.title}</h2>
                    <h2 className="text-lg font-bold whitespace-pre">{coverData.version}</h2>
                </div>
            </div>
            <div className="w-full h-full">
                <div className={`flex flex-col flex-1 items-center justify-end ${show19 ? "opacity-100 " : "opacity-0 h-0"} transition-all duration-1000 ease-linear `}
                    onClick={handleTap}>
                    {/* 19 lines for animated splash, starting from the bottom */}
                    {Array.from({ length: 19 }).map((_, index) => (
                        <div
                            key={index}
                            className="splash-line bg-white h-1 my-1.5 md:h-2 md:my-4"
                            style={{
                                animationDelay: `${0.5 * (18 - index)}s`, // Animation delay starts from the longest (bottom) line
                                width: `${91 - 2 * (18 - index)}%` // Width decreases from bottom to top
                            }}
                        >

                        </div>
                    ))}
                </div>
                <div className={` flex flex-col max-h-full justify-center flex-1 p-4 space-y-5 items-center bg-sky-900 rounded mx-4 ${show19 ? "opacity-0 h-0 pointer-events-none" : "opacity-100"} transition-all duration-1000 ease-linear `}>
                    {Object.keys(languages).map((key) => {
                        if (key) {
                            const isSelectedLanguage = lang === key;
                            return (
                                <div
                                    key={key}
                                    className={`flex p-2 shadow-md rounded bg-neutral-800 justify-center ${isSelectedLanguage ? "ring-1 ring-offset-4 ring-sky-400 ring-offset-sky-900" : ""}`}
                                    onClick={() => onChangeLanguage(key)}>
                                    <input
                                        type="radio"
                                        name="theme"
                                        value={key}
                                        checked={isSelectedLanguage}
                                        onChange={(e) => onChangeLanguage(e.target.value)}
                                        className="hidden"
                                    />
                                    {languages[key]}
                                </div>
                            );
                        }
                        return <></>;
                    })}
                </div>
                {show19 || <div className="text-neutral-200 flex items-center justify-center w-full mt-3">
                    <button onClick={() => onCoverSeen()}
                        className={` px-2 mb-1 rounded ml-2 flex justify-center`}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-12 h-12`}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                        </svg>
                    </button>
                </div>}
            </div>

            <div className="w-full mb-5 flex flex-col space-y-3 h-full justify-center">
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
