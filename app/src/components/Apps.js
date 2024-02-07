import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';

const Apps = forwardRef(({ colors, theme, translationApplication, parseReferences, appendices, selected, restoreAppText, refToRestore, prevPage }, ref) => {

    const lang = localStorage.getItem("lang");
    const containerRef = useRef(null);
    const appendixRef = useRef({});
    const [visibleAppendices, setVisibleAppendices] = useState([]);
    const [appendixMap, setAppendixMap] = useState({});
    const images = require.context('../assets/pictures/', false, /\.jpg$/);



    const textRef = useRef({});

    const currentRef = useRef(null);

    const [isRefsReady, setIsRefsReady] = useState(false);

    const mapAppendicesData = useCallback((appendices) => {
        const appendixMap = {};
        let currentAppendixNum = 1; // Start with Appendix 1
        let globalContentOrder = 1; // Global counter for overall content order across pages    
        appendices.forEach(page => {
            if (page.page < 397) {
                return;
            }
            if (!appendixMap[currentAppendixNum]) {
                appendixMap[currentAppendixNum] = { content: [] };
            }
            const checkAndUpdateAppendixNum = (title) => {
                const appx = translationApplication ? translationApplication.appendix : "Appendix";
                const match = title.match(new RegExp(`${appx}\\s*(\\d+)`));
                if (match) {
                    currentAppendixNum = parseInt(match[1]);
                    if (!appendixMap[currentAppendixNum]) {
                        appendixMap[currentAppendixNum] = { content: [] };
                    }
                }
            };
            // Collect all content items with their keys from the page
            let allContentItems = [];
            Object.entries(page.titles || {}).forEach(([key, title]) => {
                checkAndUpdateAppendixNum(title);
                allContentItems.push({ type: 'title', content: title, key: parseInt(key) });
            });

            const collectContent = (type, data) => {
                Object.entries(data || {}).forEach(([key, value]) => {
                    if (value) {
                        allContentItems.push({ type, content: value, key: parseInt(key) });
                    }
                });
            };
            // Collect content items from each section
            collectContent('text', page.text);
            collectContent('evidence', page.evidence);
            collectContent('table', page.table);
            collectContent('picture', page.picture);

            // Sort all content items by their keys to respect the order within the page
            allContentItems.sort((a, b) => a.key - b.key);

            // Add sorted content items to the appendix map with a global order
            allContentItems.forEach(item => {
                item.order = globalContentOrder++; // Assign global order and increment the counter
                appendixMap[currentAppendixNum].content.push(item);
            });
        });

        // Sort the content of each appendix by the global order
        Object.values(appendixMap).forEach(appendix => {
            appendix.content.sort((a, b) => a.order - b.order);
        });
        return appendixMap;
    }, [translationApplication]);

    useEffect(() => {
        const initialAppendixMap = mapAppendicesData(appendices);
        setAppendixMap(initialAppendixMap);
    }, [appendices, mapAppendicesData]);

    useImperativeHandle(ref, () => ({

        scrollToSelectedApp: (number) => {
            selected.current = number;
            currentRef.current = number;

            if (selected.current) {
                if (selected.current === 38) {
                    setVisibleAppendices([selected.current - 1, selected.current]);
                } else if (selected.current === 1) {
                    setVisibleAppendices([selected.current]);
                } else {
                    setVisibleAppendices([selected.current, selected.current + 1]);
                }
            }

            setTimeout(() => {
                if (appendixRef.current[`appendix-${number}`]) {
                    appendixRef.current[`appendix-${number}`].scrollIntoView({ behavior: 'smooth' });
                }
            }, 1000);
        }
    }));

    const handleRefsReady = () => {
        setIsRefsReady(true);
    };

    const loadMoreAppendices = useCallback(() => {
        if (containerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
            const currentMinAppendix = Math.min(...visibleAppendices);
            const currentMaxAppendix = Math.max(...visibleAppendices);

            // Check if the user is 20px from the bottom
            if (scrollTop + clientHeight >= scrollHeight - 20) {
                const nextAppendices = Object.keys(appendixMap)
                    .map(Number)
                    .filter(num => num > currentMaxAppendix)
                    .slice(0, 1); // Load the next appendix

                setVisibleAppendices(prevAppendices => [...prevAppendices, ...nextAppendices]);
            }

            // Check if the user is 20px from the top and the first appendix is not 1
            if (scrollTop <= 20 && currentMinAppendix > 1) {
                const previousAppendices = Object.keys(appendixMap)
                    .map(Number)
                    .filter(num => num < currentMinAppendix)
                    .slice(-1); // Load the previous appendix

                setVisibleAppendices(prevAppendices => [...previousAppendices, ...prevAppendices]);
            }
        }
    }, [visibleAppendices, appendixMap]);

    useEffect(() => {
        if (selected.current && isRefsReady && visibleAppendices && appendixRef.current[`appendix-${selected.current}`]) {
            if (restoreAppText.current && refToRestore.current && textRef.current[refToRestore.current]) {
                textRef.current[refToRestore.current].scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                appendixRef.current[`appendix-${selected.current}`].scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [selected, restoreAppText, refToRestore, visibleAppendices, isRefsReady, textRef]);

    useEffect(() => {
        if (selected.current) {
            if (selected.current === 38) {
                setVisibleAppendices([selected.current - 1, selected.current]);
            } else if (selected.current === 1) {
                setVisibleAppendices([selected.current]);
            } else {
                setVisibleAppendices([selected.current - 1, selected.current, selected.current + 1]);
            }
        } else {
            if (appendixMap) {
                const initialAppendices = Object.keys(appendixMap).slice(0, 2).map(Number);
                setVisibleAppendices(initialAppendices);
            }
        }
    }, [appendixMap, selected]);

    const renderTable = useCallback((tableData, key) => {

        const tableRef = tableData.ref;
        const { title: columnHeaders, values } = tableData;

        // Calculating rows based on column count
        const columnCount = columnHeaders.length;
        const rows = [];
        for (let i = 0; i < values.length; i += columnCount) {
            rows.push(values.slice(i, i + columnCount));
        }

        return (
            <div key={key} className={`${colors[theme]["table-title-text"]}`}>

                <div className={` my-4 overflow-x-scroll`}>
                    <div className={`${colors[theme]["base-background"]} w-full rounded text-sm py-2 text-center `}>
                        {tableRef}
                    </div>
                    <table className={`table-auto w-full text-base md:text-lg ${colors[theme]["base-background"]} border-collapse border-2 ${colors[theme]["border"]}`}>
                        <thead>
                            <tr>
                                {columnHeaders.map((header, index) => (
                                    <th key={index} className={`border ${colors[theme]["border"]} p-2 break-words`}>{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, rowIndex) => (
                                <tr key={`row-${rowIndex}`}>
                                    {row.map((cell, cellIndex) => (
                                        <td key={`cell-${rowIndex}-${cellIndex}`} className={`border-2 ${colors[theme]["border"]} p-2 text-center break-words`}>{parseReferences(cell)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }, [colors, theme, parseReferences]);

    const handleClick = (_e, n, i) => {
        //selected.current = n;
        refToRestore.current = n + "-" + i;
    };

    const renderAppendices = () => {
        const renderContentItem = (appno, item, index) => {
            switch (item.type) {
                case 'title':
                    const appx = translationApplication ? translationApplication.appendix : "Appendix";
                    const isAppendixTitle = new RegExp(appx + "\\s*(\\d+)", "i").test(item.content);

                    return (
                        <div
                            key={`title-${appno + index}`}
                            className={`w-full my-3 flex items-center justify-center text-center  p-2 font-semibold ${colors[theme]["app-text"]}  whitespace-pre-line ${isAppendixTitle ? `text-2xl font-bold sticky top-0 z-10 ${colors[theme]["base-background"]}` : " rounded text-lg"}`}
                            ref={isAppendixTitle ? el => appendixRef.current[`appendix-${item.content.match(/\d+/)[0]}`] = el : null}>
                            <h2>{item.content}</h2>
                        </div>
                    );
                case 'text':
                    return (

                        <div
                            lang={lang}
                            key={`text-${index}`}
                            ref={(el) => textRef.current[appno + "-" + index] = el}
                            onClick={(e) => handleClick(e, appno, index)}
                            className={`rounded ${colors[theme]["text-background"]} ${colors[theme]["app-text"]} p-1  mb-3 flex w-full text-justify hyphens-auto`}>
                            <div className={`overflow-x-scroll`}>
                                <p className={`px-1 break-words`}>{parseReferences(item.content)}</p>
                            </div>
                        </div>
                    );
                case 'evidence':
                    return (
                        <div key={`evidence-${index}`} className={`${colors[theme]["base-background"]} ${colors[theme]["table-title-text"]} rounded  text-base md:text-lg p-3 border my-3 ${colors[theme]["border"]}`}>
                            {Object.entries(item.content.lines).map(([lineKey, lineValue]) => (
                                <p key={`${lineKey}`} className={`whitespace-pre-wrap my-1`}>{parseReferences(lineValue)}</p>
                            ))}
                            {item.content.ref.length > 0 && (
                                <p>{parseReferences("[" + item.content.ref.join(', ') + "]")}</p>
                            )}
                        </div>
                    );
                case 'picture':
                    if (!item.content.no) return;
                    const imageUrl = images(`./${parseInt(item.content.no)}.jpg`);
                    // SPECIAL RENDER FOR PICTURE 10
                    if (parseInt(item.content.no) === 10) {
                        return (
                            <div key={`picture-${index}`} className={`flex flex-col flex-1 items-center justify-center w-full px-1`}>
                                <div className={` flex p-1 overflow-y-auto`}>
                                    <div className={` flex flex-col justify-between `}>
                                        {item.content.data.slice(0, 4).map((word) => (
                                            <div className={`p-1.5 whitespace-nowrap text-right`}>{word}</div>
                                        ))}
                                    </div>
                                    <img src={imageUrl} alt={imageUrl} className={`object-contain `} />
                                    <div className={` flex flex-col justify-between`}>
                                        {item.content.data.slice(4, 8).map((word) => (
                                            <div className={`p-1.5 flex-1 whitespace-pre text-left`}>{word}</div>
                                        ))}
                                    </div>
                                </div>
                                {item.content.text && (
                                    <div className={`${colors[theme]["log-text"]} w-full text-base flex justify-center`}>
                                        <div className={`p-2`}>{item.content.text}</div>
                                    </div>
                                )}
                            </div>
                        );
                    }
                    // SPECIAL RENDER FOR PICTURE 22
                    if (parseInt(item.content.no) === 22) {

                        return (
                            <div key={`picture-${index}`} className={`flex flex-col space-y-1.5 flex-1 items-center justify-center w-full px-1 mb-2`}>

                                {item.content.text && Object.entries(item.content.text).map(([pickey, text]) => (
                                    <div className={`rounded  flex flex-wrap md:flex-nowrap justify-between`}>
                                        <img src={images(`./${pickey}.jpg`)} alt={imageUrl} className={`object-contain`} />
                                        <div lang={lang} className={`p-2 text-justify hyphens-auto break-words`}>{parseReferences(text)}</div>
                                    </div>

                                ))}
                            </div>
                        );

                    }
                    return (
                        <div key={`picture-${index}`} className={`flex flex-col flex-1 items-center justify-center w-full px-1 mb-2`}>
                            <div className={`rounded  flex justify-center`}>
                                <img src={imageUrl} alt={imageUrl} className={`object-center`} />
                            </div>
                            {item.content.text && (
                                <div className={`${colors[theme]["log-text"]} w-full text-base flex justify-center`}>
                                    <div className={`p-2`}>{item.content.text}</div>
                                </div>
                            )}
                        </div>
                    );
                case 'table':
                    return renderTable(item.content, `table-${index}`);
                default:
                    return (
                        <div key={`unknown-${index}`} className={`${colors[theme]["log-text"]} flex flex-1 items-center justify-center w-full`}>
                            {translationApplication?.unrecognizedData}
                        </div>
                    );
            }
        };


        return visibleAppendices.map(appendixNum => {
            const appendixContent = appendixMap[appendixNum]?.content || [];
            return (
                <div className={`p-1`} key={appendixNum} ref={() => handleRefsReady()}>
                    {appendixContent.map((item, index) => renderContentItem(appendixNum, item, `${item.type}-${index}`))}
                </div>
            );
        });
    };


    return (
        <div
            className={`relative h-screen w-screen ${colors[theme]["app-text"]} text-lg select-text`}>

            <div className={`fixed top-0 left-0 w-full ${colors[theme]["base-background"]} h-12`}>

            </div>
            <button onClick={prevPage}
                className={`fixed top-0.5 left-0.5 z-30 rounded  p-2 ${colors[theme]["base-background"]}`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                </svg>
            </button>


            <div
                ref={containerRef}
                onScroll={loadMoreAppendices}
                className={`relative h-screen overflow-y-auto`}>
                {renderAppendices()}

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
});

export default Apps;
