// src/renders/Graph2.js
import React from 'react';

const Graph2 = ({ item, lang, direction }) => {
    const lines = item.content.lines;
    return (
        <div
            key={`special-graph-2`}
            className={`w-full flex flex-col flex-1 my-3 px-1`}>
            <div className={` text-gray-700 text-base md:text-lg lg:text-xl border border-gray-950 flex justify-between w-full items-stretch`}>
                <div
                    lang={lang}
                    dir={direction}
                    className={`relative w-full bg-gray-100 flex flex-wrap justify-center p-2.5 text-gray-700`}>
                    {lines["1"]}
                </div>
                <div className={`relative bg-gray-500 w-[2%] flex flex-wrap py-2`}>
                </div>
            </div>
            <div className={`w-full flex justify-end py-0.5 `}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 md:w-10 lg:w-12 xl:w-14 h-6`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 4.5-15 15m0 0h11.25m-11.25 0V8.25" />
                </svg>
            </div>
            <div key={`special-graph-2-2`}
                lang={lang}
                dir={direction}
                className={` text-gray-700 text-base md:text-lg lg:text-xl border border-gray-950 flex justify-between w-full items-stretch`}>
                <div className={`relative w-full bg-gray-500 flex flex-wrap justify-center p-2.5 text-gray-100`}>
                    {lines["2"]}
                </div>
                <div className={`relative bg-gray-900 w-[2%] flex flex-wrap py-2 `}>
                </div>
            </div>
        </div>
    );
};

export default Graph2;
