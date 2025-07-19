import React, { useState, useEffect, useRef } from 'react';
import Graph1 from '../specials/Graph1';
import Graph2 from '../specials/Graph2';

const Intro = ({ colors, theme, translationApplication, parseReferences, introduction, currentPage, restoreIntroText, refToRestore, refToJump, direction, upt }) => {

    const lang = localStorage.getItem("lang");
    const images = require.context('../assets/pictures/', false, /\.jpg$/);
    const introRef = useRef(null);
    const [isRefsReady, setIsRefsReady] = useState(false);
    const textRememberRef = useRef({});
    const [notify, setNotify] = useState(null);

    useEffect(() => {
        if (currentPage && isRefsReady) {
            setTimeout(() => {
                if (restoreIntroText.current && refToRestore.current && textRememberRef.current[refToRestore.current]) {
                    textRememberRef.current[refToRestore.current].scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (refToJump && textRememberRef.current[refToJump.current]) {
                    textRememberRef.current[refToJump.current].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setNotify(refToJump.current);
                    setTimeout(() => {
                        setNotify(null);
                    }, 5350);
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
        const smallTextTheme = direction === 'rtl' ? `text-xl md:text-2xl lg:text-3xl ` : `text-base md:text-lg lg:text-xl `;
        const textTheme = direction === 'rtl' ? `text-2xl md:text-3xl lg:text-4xl` : `text-lg md:text-xl lg:text-2xl `;
        const renderContent = introContent.map((item, index) => {
            if (item.type === 'titles') {
                const bsml = translationApplication.bsml.toLocaleLowerCase(lang);
                const hasBesmele = item.content.toLocaleLowerCase(lang).search(bsml) !== -1;
                const pulsate = notify === `intro-${item.type}-${item.order}` ? `animate-pulse` : ``;

                return (
                    <div
                        key={`title-${index}`}
                        dir={direction}
                        ref={(el) => textRememberRef.current["intro-" + item.type + "-" + item.order] = el}
                        className={hasBesmele ? `select-none w-full my-1.5 py-1.5 px-2.5 text-neutral-900 rounded ${textTheme} bg-gradient-to-r ${direction === 'rtl' ? ` from-sky-500 to-cyan-300` : ` from-cyan-300 to-sky-500`} besmele` : `${pulsate} select-text w-full flex items-center justify-center text-center p-2 font-semibold ${colors[theme]["app-text"]}  whitespace-pre-line ${item.order === 0 ? "text-3xl font-bold" : " text-lg"}`}>
                        <h2>{item.content}</h2>
                    </div>
                );
            } else if (item.type === 'text') {
                const pulsate = notify === `intro-${item.type}-${item.order}` ? `animate-pulse` : ``;
                return (
                    <div
                        lang={lang}
                        dir={direction}
                        key={`text-${index}`}
                        ref={(el) => textRememberRef.current["intro-" + item.type + "-" + item.order] = el}
                        onClick={(e) => handleRefClick(e, item.type + "-" + item.order)}
                        className={`select-text rounded ${colors[theme]["text-background"]} ${colors[theme]["app-text"]} p-1 mb-1 flex w-full justify-center hyphens-auto ${pulsate}`}>
                        <p className={`px-0.5 md:px-1`}>{parseReferences(item.content, "intro-" + item.type + "-" + item.order)}</p>
                    </div>
                );
            } else if (item.type === 'evidence') {
                // SPECIAL RENDER FOR GRAPH 1
                if (item.content.special && item.content.special.key === 1) {
                    return (
                        <Graph1
                            item={item}
                            lang={lang}
                            direction={direction}
                            colors={colors}
                            theme={theme}
                            translationApplication={translationApplication}
                        />
                    );
                }
                // SPECIAL RENDER FOR GRAPH 2
                else if (item.content.special && item.content.special.key === 2) {
                    return (
                        <Graph2
                            item={item}
                            lang={lang}
                            direction={direction}
                        />
                    );
                }
                return (
                    <div
                        key={`evidence-${index}`}
                        lang={lang}
                        dir={direction}
                        ref={(el) => textRememberRef.current["intro-" + item.type + "-" + item.order] = el}
                        onClick={(e) => handleRefClick(e, item.type + "-" + item.order)}
                        className={`${colors[theme]["base-background"]} ${colors[theme]["table-title-text"]} rounded ${smallTextTheme} p-3 border my-1.5 ${colors[theme]["border"]}`}>
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
            <div key={`content-${currentPage}-${lang}`} ref={() => handleRefsReady()} className={`${colors[theme]["text"]} overflow-auto flex-1 p-1 text-justify lg:text-start ${textTheme}`}>
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