import React, { useState, useEffect, useRef } from 'react';

const Intro = ({ colors, theme, translationApplication, parseReferences, introduction, currentPage, restoreIntroText, refToRestore, refToJump, direction, upt }) => {

    const lang = localStorage.getItem("lang");
    const images = require.context('../assets/pictures/', false, /\.jpg$/);
    const introRef = useRef(null);
    const [isRefsReady, setIsRefsReady] = useState(false);
    const textRememberRef = useRef({});
    const [futureManVisible, setFutureManVisible] = useState(false);


    useEffect(() => {
        if (currentPage && isRefsReady) {
            setTimeout(() => {
                if (restoreIntroText.current && refToRestore.current && textRememberRef.current[refToRestore.current]) {
                    textRememberRef.current[refToRestore.current].scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (refToJump && textRememberRef.current[refToJump.current]) {
                    textRememberRef.current[refToJump.current].scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    if (introRef && isRefsReady) {
                        introRef.current.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }, 38);
        }
    }, [currentPage, restoreIntroText, refToRestore, refToJump, isRefsReady, textRememberRef, upt]);

    const handleRefsReady = () => {
        setIsRefsReady(true);
    };

    const handleToggleFutureMan = () => {
        setFutureManVisible(!futureManVisible);
    };

    const handleRefClick = (_e, i) => {
        refToRestore.current = "intro-" + i;
    };

    const renderIntroduction = () => {

        const introContent = [];

        const currentPageData = introduction ? introduction.find(iterator => iterator.page === currentPage) : null;


        if (!currentPageData || !currentPageData.titles) {
            return <div className={`${colors[theme]["log-text"]} flex flex-1 items-center justify-center w-full text-xl`}>
                <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 text-white`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className={`opacity-25`} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className={`opacity-75`} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {translationApplication?.loading}
            </div>;
        }

        Object.entries(currentPageData.titles).forEach(([key, value]) => {
            introContent.push({ type: 'titles', content: value, order: parseInt(key) });
        });

        Object.entries(currentPageData.text).forEach(([key, value]) => {
            introContent.push({ type: 'text', content: value, order: parseInt(key) });
        });

        Object.entries(currentPageData.evidence).forEach(([key, value]) => {
            introContent.push({ type: 'evidence', content: value, order: parseInt(key) });
        });

        if (currentPageData.picture) {
            Object.entries(currentPageData.picture).forEach(([key, value]) => {
                introContent.push({ type: 'picture', no: value["no"], order: parseInt(key), text: value["text"] });
            });
        }

        introContent.sort((a, b) => a.order - b.order);

        const renderContent = introContent.map((item, index) => {
            if (item.type === 'titles') {
                const bsml = translationApplication.bsml.toLocaleLowerCase(lang);
                const hasBesmele = item.content.toLocaleLowerCase(lang).search(bsml) !== -1;

                return (
                    <div
                        key={`title-${index}`}
                        dir={direction}
                        ref={(el) => textRememberRef.current["intro-" + item.type + "-" + item.order] = el}
                        className={hasBesmele ? `select-none w-full my-1.5 py-1.5 px-2.5 text-neutral-900 rounded text-base md:text-lg lg:text-xl bg-gradient-to-r ${direction === 'rtl' ? ` from-sky-500 to-cyan-300` : ` from-cyan-300 to-sky-500`} besmele` : `select-text w-full flex items-center justify-center text-center p-2 font-semibold ${colors[theme]["app-text"]}  whitespace-pre-line ${item.order === 0 ? "text-3xl font-bold" : " text-lg"}`}>
                        <h2>{item.content}</h2>
                    </div>
                );
            } else if (item.type === 'text') {
                return (
                    <div
                        lang={lang}
                        dir={direction}
                        key={`text-${index}`}
                        ref={(el) => textRememberRef.current["intro-" + item.type + "-" + item.order] = el}
                        onClick={(e) => handleRefClick(e, item.type + "-" + item.order)}
                        className={`select-text rounded ${colors[theme]["text-background"]} ${colors[theme]["app-text"]} p-1 mb-1 flex w-full justify-center hyphens-auto `}>
                        <p className={`px-0.5 md:px-1`}>{parseReferences(item.content, "intro-" + item.type + "-" + item.order)}</p>
                    </div>
                );
            } else if (item.type === 'evidence') {
                // SPECIAL RENDER 1
                if (item.content.special && item.content.special.key === 1) {
                    const data = item.content.special.data;
                    return (
                        <div
                            key={`special-1-${index}`}
                            className={`w-full flex flex-col flex-1 my-2 `}>
                            <div className={`w-full px-1 mt-6`}>
                                <div
                                    onClick={handleToggleFutureMan}
                                    className={`bg-gray-100 text-gray-700 text-sm md:text-base border border-gray-700 flex justify-between w-full items-stretch cursor-pointer`}>
                                    <div className={`relative text-gray-100 bg-gray-700 w-[11%] flex flex-wrap `}>
                                        {/* Render SVGs for index 0 in this div */}
                                        {Object.entries(data).map(([key, value]) => {
                                            if (parseInt(key) === 0) {
                                                return Array.from({ length: value }, (_, i) => (
                                                    <div key={`prevman-${i}`} className={`p-0.5 transition-opacity duration-300 ease-in-out ${futureManVisible ? 'opacity-100' : 'opacity-0'}`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3 h-3 md:h-5 md:w-5 lg:h-6 lg:w-6`}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                                        </svg>
                                                    </div>
                                                ));
                                            }
                                            return null;
                                        })}
                                    </div>

                                    <div className={`relative w-full text-gray-900 bg-gray-100 h-fit flex flex-wrap `}>
                                        {/* Render SVGs for index 1 in this div */}
                                        {Object.entries(data).map(([key, value]) => {
                                            if (parseInt(key) === 1) {
                                                return Array.from({ length: value }, (_, i) => (
                                                    <div key={`futureman-${i}`} className={`p-0.5 `}
                                                        style={{
                                                            transition: 'opacity 300ms ease-in-out',
                                                            transitionDelay: futureManVisible ? `${i * 38}ms` : `0ms`,
                                                            opacity: futureManVisible ? 1 : 0
                                                        }}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={` w-3 h-3 md:h-5 md:w-5 lg:h-6 lg:w-6`}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                                        </svg>
                                                    </div>
                                                ));
                                            }
                                            return null;
                                        })}
                                    </div>
                                </div>
                                <div className={`w-full flex justify-between px-1`}>
                                    <div className={`relative h-6 w-[11%]`}>
                                        <div className={`absolute -left-2 text-xs transition-opacity duration-300 ease-in-out ${colors[theme]["log-text"]} ${futureManVisible ? 'opacity-100' : 'opacity-0'}`}>
                                            {translationApplication?.adam}
                                        </div>
                                    </div>
                                    <div className={`relative h-6 w-[100%]`}>
                                        <div className={`absolute -left-1 text-xs transition-opacity duration-300 ease-in-out ${colors[theme]["log-text"]} ${futureManVisible ? 'opacity-100' : 'opacity-0'}`}>
                                            1990
                                        </div>
                                    </div>
                                    <div className={`relative h-6 w-[11%] text-xs transition-opacity duration-300 ease-in-out ${colors[theme]["log-text"]} ${futureManVisible ? 'opacity-100 delay-[2800ms]' : 'opacity-0'}`}>
                                        <div className={`absolute -right-2`}>
                                            2280
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div
                                lang={lang}
                                dir={direction}
                                className={`w-full flex flex-col ${colors[theme]["log-text"]} p-1`}>
                                <div className={`w-full flex items-center justify-between`}>
                                    <div className={`w-7 h-9 bg-gray-100 border border-gray-400`}>
                                    </div>
                                    <div
                                        className={`${direction === "rtl" ? "mr-1" : "ml-1"} flex w-full text-sm md:text-base`}>
                                        {item.content.lines["1"]}
                                    </div>
                                </div>
                                <div className={`w-full flex items-center justify-between mt-1`}>
                                    <div className={`w-7 h-9 bg-gray-700 border border-gray-400`}>
                                    </div>
                                    <div
                                        className={`${direction === "rtl" ? "mr-1" : "ml-1"} w-full text-sm md:text-base`}>
                                        {item.content.lines["2"]}
                                    </div>
                                </div>
                            </div>
                        </div>

                    );
                }
                // SPECIAL RENDER 2
                else if (item.content.special && item.content.special.key === 2) {
                    return (
                        <div
                            key={`special-2-${index}`}
                            className={`w-full flex flex-col flex-1 my-3 px-1`}>
                            <div className={` text-gray-700 text-sm md:text-base border border-gray-950 flex justify-between w-full items-stretch`}>
                                <div
                                    lang={lang}
                                    dir={direction}
                                    className={`relative w-full bg-gray-100 flex flex-wrap justify-center p-2.5 text-gray-700`}>
                                    {item.content.lines["1"]}
                                </div>
                                <div className={`relative bg-gray-500 w-[3%] flex flex-wrap py-2`}>
                                </div>
                            </div>
                            <div className={`w-full flex justify-end py-0.5 `}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 md:w-20 h-6`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 4.5-15 15m0 0h11.25m-11.25 0V8.25" />
                                </svg>
                            </div>
                            <div key={`special-2-${index + 1}`}
                                lang={lang}
                                dir={direction}
                                className={` text-gray-700 text-sm md:text-base border border-gray-950 flex justify-between w-full items-stretch`}>
                                <div className={`relative w-full bg-gray-500 flex flex-wrap justify-center p-2.5 text-gray-200`}>
                                    {item.content.lines["2"]}
                                </div>
                                <div className={`relative bg-gray-900 w-[3%] flex flex-wrap py-2 `}>
                                </div>
                            </div>
                        </div>
                    );
                }
                return (
                    <div
                        key={`evidence-${index}`}
                        lang={lang}
                        dir={direction}
                        ref={(el) => textRememberRef.current["intro-" + item.type + "-" + item.order] = el}
                        onClick={(e) => handleRefClick(e, item.type + "-" + item.order)}
                        className={`${colors[theme]["base-background"]} ${colors[theme]["table-title-text"]} rounded  text-base md:text-xl p-3 border my-1.5 ${colors[theme]["border"]}`}>
                        {Object.entries(item.content.lines).map(([lineKey, lineValue]) => (
                            <p className={` whitespace-pre-wrap my-1`} key={lineKey}>{parseReferences(lineValue, "intro-" + item.type + "-" + item.order)}</p>
                        ))}
                        {item.content.ref.length > 0 && (
                            <p>{parseReferences("[" + item.content.ref.join(', ') + "]", "intro-" + item.type + "-" + item.order)}</p>
                        )}
                    </div>
                );
            } else if (item.type === 'picture') {
                const imageUrl = images(`./${item.no}.jpg`);
                return (
                    <div
                        key={`picture-${index}`}
                        className={` flex flex-col flex-1 items-center justify-center w-full`}>
                        <div className={`rounded  flex justify-center`}>

                            <img
                                src={imageUrl}
                                alt={imageUrl}
                                className={`object-center`}
                            />
                        </div>
                        {item.text && <div className={`${colors[theme]["log-text"]} w-full text-base flex justify-center`}>
                            <div className={`py-2 px-1`}>
                                {item.text}
                            </div>
                        </div>}
                    </div>
                );
            } else {
                return (
                    <div className={`${colors[theme]["log-text"]} flex flex-1 items-center justify-center w-full`}>
                        {translationApplication?.unrecognizedData}
                    </div>
                );
            }
        });

        return (
            <div key={`content-${currentPage}-${lang}`} ref={() => handleRefsReady()} className={`${colors[theme]["text"]} overflow-auto flex-1 p-1 text-justify lg:text-start text-lg md:text-xl lg:text-2xl`}>
                {renderContent}
            </div>
        );
    };

    return (
        <div
            className={`h-screen w-screen relative overflow-y-auto pb-10 md:pb-14 ${colors[theme]["app-text"]} text-lg md:text-xl lg:text-2xl select-text`}>
            <div ref={introRef}>
                {renderIntroduction()}
                {!isRefsReady &&
                    <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex ${colors[theme]["page-text"]} select-none`}>
                        <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 text-white`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className={`opacity-25`} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className={`opacity-75`} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {translationApplication?.loading}
                    </div>
                }
            </div>
        </div>
    );
};

export default Intro;