import React from 'react';

const Picture10 = ({ item, imageUrl, colors, theme }) => {
    const data = item.content.data;
    const text = item.content.text;
    const textColor = colors[theme]["log-text"];
    return (
        <div key={`picture-10-special`} className={`flex flex-col flex-1 items-center justify-center w-full px-1`}>
            <div className={`flex px-1 pt-1 pb-3 overflow-x-auto`}>
                <div className={` flex flex-col justify-between `}>
                    {data.slice(0, 4).map((word) => (
                        <div key={word} className={`p-1.5 whitespace-nowrap text-right`}>{word}</div>
                    ))}
                </div>
                <img src={imageUrl} alt={imageUrl} className={`object-contain `} />
                <div className={` flex flex-col justify-between`}>
                    {data.slice(4, 8).map((word) => (
                        <div key={word} className={`p-1.5 flex-1 whitespace-pre text-left`}>{word}</div>
                    ))}
                </div>
            </div>
            {text && (
                <div className={`${textColor} w-full text-base flex justify-center text-justify`}>
                    <div className={`p-2`}>{text}</div>
                </div>
            )}
        </div>
    );
};

export default Picture10;
