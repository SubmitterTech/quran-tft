import React, { useState, useEffect } from 'react';

const Splash = ({ bookContent, currentPage, colors, theme }) => {
    const [showLines, setShowLines] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowLines(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const cpd = bookContent ? bookContent.find(iterator => iterator.page === currentPage) : null;
    const lines = cpd?.text.split("\n").filter(element => element.trim().length > 0) || [];

    return (
        <div className={`w-screen h-screen flex flex-col items-center justify-center text-lg ${colors[theme]["text"]}`}>
            <div className={`text-left`}>
                {lines.map((line, index) => (
                    <div
                        key={index}
                        className={`mb-1 transition-opacity duration-1000 text-left ${showLines ? 'opacity-100' : 'opacity-0'} ${colors[theme]["text"]}`}
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