import React, { useState, useEffect } from 'react';

const Splash = ({ bookContent, currentPage, colors, theme, direction }) => {
    const [showLines, setShowLines] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowLines(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const cpd = bookContent ? bookContent.find(iterator => iterator.page === currentPage) : null;
    const lines = cpd?.text.split("\n").filter(element => element.trim().length > 0) || [];
    const textTheme = direction === 'rtl' ? `text-2xl md:text-3xl lg:text-4xl ` : `text-lg md:text-xl lg:text-2xl `;

    return (
        <div className={`w-screen h-screen flex flex-col items-center justify-center ${textTheme} ${colors[theme]["text"]}`}>
            <div className={direction === "ltr" ? `text-left` : `text-right`}>
                {lines.map((line, index) => (
                    <div
                        key={index}
                        dir={direction}
                        className={`mb-1 transition-opacity duration-1000 ${showLines ? 'opacity-100' : 'opacity-0'} ${colors[theme]["text"]}`}
                        style={{ transitionDelay: `${index * 1700}ms` }}
                    >
                        {line}
                    </div>
                ))}
            </div>
        </div>

    );
};

export default Splash;