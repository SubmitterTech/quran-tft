import React from 'react';

const Picture4and5 = ({ item, colors, theme }) => {
    const text = item.content.text;
    const textColor = colors[theme]["log-text"];
    const images = require.context('../assets/pictures/', false, /\.jpg$/);
    const image4URL = images(`./${4}.jpg`);
    const image5URL = images(`./${5}.jpg`);

    return (
        <div key="picture-4and5-special" className="w-full px-1">
            <div className="px-1 pt-1 pb-4 overflow-x-auto w-full lg:flex lg:items-center lg:flex-col">
                <div className="inline-flex flex-col">
                    <div className="flex flex-nowrap ">
                        <div className="flex-shrink-0 flex">
                            <img src={image4URL} alt={image4URL} className="object-cover" />
                        </div>
                        <div className="flex-shrink-0 flex items-start bg-white">
                            <img src={image5URL} alt={image5URL} className="object-contain" />
                        </div>
                    </div>
                    {text && (
                        <div className={`${textColor} text-base flex justify-start text-justify `}>
                            <div className="py-1.5">{text}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Picture4and5;
