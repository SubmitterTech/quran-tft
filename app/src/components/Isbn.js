import React, { useState, useEffect, useMemo } from 'react';

const Isbn = ({ colors, theme, translationApplication }) => {

    const images = require.context('../assets/pictures/', false, /\.png$/);
    const [loading, setLoading] = useState(true);

    const imgPaths = useMemo(() => [
        images('./qurantft-1989-ISBN.png'),
        images('./qurantft-1992-ISBN.png')
    ], [images]);

    useEffect(() => {
        const imgElements = imgPaths.map(src => {
            const img = new Image();
            img.src = src;
            return img;
        });

        const handleLoad = () => {
            setLoading(false);
        };

        Promise.all(imgElements.map(img => new Promise(resolve => {
            if (img.complete) {
                resolve();
            } else {
                img.onload = resolve;
            }
        }))).then(handleLoad);

        return () => {
            imgElements.forEach(img => {
                img.onload = null;
            });
        };
    }, [imgPaths]);

    return (
        <div className={`h-screen w-screen relative ${colors[theme]["app-text"]} text-lg md:text-xl lg:text-2xl select-text`}
            style={{ paddingBottom: 'calc((env(safe-area-inset-bottom) * 1.90) + 4rem)' }}>
            <div className={`flex flex-col flex-1 lg:grid lg:grid-flow-dense lg:grid-cols-2 p-0.5 pb-1.5 h-full overflow-y-auto `}>
                {loading ? (
                    <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex ${colors[theme]["page-text"]} select-none`}>
                        <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 text-white`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className={`opacity-25`} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className={`opacity-75`} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {translationApplication?.loading}
                    </div>
                ) : (
                    <>
                        <div className={`flex flex-1 w-full p-0.5 lg:p-2`}>
                            <div className={`flex flex-col border p-0.5 rounded-b-md ${colors[theme]["border"]}`}>
                                <img src={imgPaths[0]} alt="Qurantft 1989 ISBN" className="object-contain w-full select-none" />
                                <div className={`flex w-full justify-center items-center select-text`}>ISBN 0-934894-57-1</div>
                            </div>
                        </div>
                        <div className={`flex flex-1 w-full p-0.5 lg:p-2`}>
                            <div className={`flex flex-col border p-0.5 rounded-b-md ${colors[theme]["border"]}`}>
                                <img src={imgPaths[1]} alt="Qurantft 1992 ISBN" className="object-contain w-full select-none" />
                                <div className={`flex w-full justify-center items-center select-text`}>ISBN 09623622-2-0</div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Isbn;
