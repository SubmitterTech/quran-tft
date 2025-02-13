import React from 'react';

const Picture22 = ({ item, lang, direction, colors, theme, parseReferences, textRef, appno, handleClick }) => {
    const texts = item.content.text;
    const images = require.context('../assets/pictures/', false, /\.jpg$/);
    const borderColor = colors[theme]["border"];
    return (
        <div key={`picture-22-special`} className={`flex flex-col space-y-1.5 flex-1 items-center justify-center w-full mb-2`}>
            {texts && Object.entries(texts).map(([pickey, text]) => {
                const imageURL = images(`./${pickey}.jpg`);
                return (
                    <div key={pickey} className={`w-full flex flex-wrap md:flex-nowrap border-b ${borderColor} pb-0.5`}>
                        <img src={imageURL} alt={imageURL} className={`object-contain`} />
                        <div
                            ref={(el) => textRef.current[appno + `-picture-22-special-` + pickey] = el}
                            onClick={(e) => handleClick(e, appno, `picture-22-special-` + pickey)}
                            className={`w-full p-1 `}>
                            <div
                                lang={lang}
                                dir={direction}
                                className={`text-justify hyphens-auto break-words italic`}>
                                {parseReferences(text, 'picture-22-special', null)}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

export default Picture22;
