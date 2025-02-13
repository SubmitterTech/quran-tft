import React, { useState } from 'react';

const Graph1 = ({
    item,
    lang,
    direction,
    colors,
    theme,
    translationApplication,
}) => {
    const data = item.content.special.data;
    const lines = item.content.lines;

    const [futureManVisible, setFutureManVisible] = useState(false);

    const handleToggleFutureMan = () => {
        setFutureManVisible(!futureManVisible);
    };

    return (
        <div
            key={`special-graph-1`}
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
                        {lines["1"]}
                    </div>
                </div>
                <div className={`w-full flex items-center justify-between mt-1`}>
                    <div className={`w-7 h-9 bg-gray-700 border border-gray-400`}>
                    </div>
                    <div
                        className={`${direction === "rtl" ? "mr-1" : "ml-1"} w-full text-sm md:text-base`}>
                        {lines["2"]}
                    </div>
                </div>
            </div>
        </div>

    );
};

export default Graph1;
