import React, { useState, useEffect, useRef, useCallback } from 'react';

const Apps = ({ colors, theme, translationApplication, parseReferences, appendices, selectedApp, prevPage }) => {

    const containerRef = useRef(null);
    const appRefs = useRef({});
    const [visibleAppendices, setVisibleAppendices] = useState([]);
    const [appendixMap, setAppendixMap] = useState({});
    const images = require.context('../assets/pictures/', false, /\.jpg$/);
    const [isRendered, setIsRendered] = useState(false);


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
                const match = title.match(/Appendix\s*(\d+)/);
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
    }, []);


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
        if (selectedApp && isRendered && appRefs.current[`appendix-${selectedApp}`]) {
            appRefs.current[`appendix-${selectedApp}`].scrollIntoView({ behavior: 'smooth' });
        }
    }, [selectedApp, isRendered]);

    useEffect(() => {
        if (selectedApp && appRefs.current[`appendix-${selectedApp}`]) {
            setTimeout(() => {
                appRefs.current[`appendix-${selectedApp}`].scrollIntoView({ behavior: 'smooth' });
            }, 0);
        }
    }, [selectedApp, visibleAppendices]);

    useEffect(() => {
        const initialAppendixMap = mapAppendicesData(appendices);
        setAppendixMap(initialAppendixMap);

        if (selectedApp) {
            setVisibleAppendices([selectedApp]);
        } else {
            const initialAppendices = Object.keys(initialAppendixMap).slice(0, 3).map(Number);
            setVisibleAppendices(initialAppendices);
        }
    }, [appendices, selectedApp, mapAppendicesData]);

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
                    <table className={`table-auto w-full text-sm md:text-base ${colors[theme]["base-background"]} border-collapse border-2 ${colors[theme]["border"]}`}>
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
                                        <td key={`cell-${rowIndex}-${cellIndex}`} className={`border-2 ${colors[theme]["border"]} p-2 text-center break-words`}>{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }, [colors, theme]);

    useEffect(() => {
        setIsRendered(true);
    }, [visibleAppendices]);

    const renderAppendices = useCallback(() => {
        const renderContentItem = (item, index) => {
            switch (item.type) {
                case 'title':
                    const isAppendixTitle = /Appendix\s*(\d+)/i.test(item.content);
                    return (
                        <div
                            key={`title-${index}`}
                            className={`w-full my-3 flex items-center justify-center text-center ${colors[theme]["base-background"]} p-2 font-semibold ${colors[theme]["app-text"]}  whitespace-pre-line ${isAppendixTitle ? "text-2xl font-bold sticky top-0 z-10 shadow-md" : " rounded text-base"}`}
                            ref={isAppendixTitle ? el => appRefs.current[`appendix-${item.content.match(/\d+/)[0]}`] = el : null}
                        >
                            <h2>{item.content}</h2>
                        </div>
                    );
                case 'text':
                    return (
                        <div key={`text-${index}`} className={`rounded ${colors[theme]["text-background"]} ${colors[theme]["app-text"]} p-2 shadow-md mb-3 flex w-full justify-center text-justify hyphens-auto`}>
                            <p className={`px-1`}>{parseReferences(item.content)}</p>
                        </div>
                    );
                case 'evidence':
                    return (
                        <div key={`evidence-${index}`} className={`${colors[theme]["base-background"]} ${colors[theme]["table-title-text"]} rounded shadow-md text-sm md:text-base p-3 border my-3 ${colors[theme]["border"]}`}>
                            {Object.entries(item.content.lines).map(([lineKey, lineValue]) => (
                                <p key={lineKey} className={`whitespace-pre-wrap my-1`}>{parseReferences(lineValue)}</p>
                            ))}
                            {item.content.ref.length > 0 && (
                                <p>{parseReferences("[" + item.content.ref.join(', ') + "]")}</p>
                            )}
                        </div>
                    );
                case 'picture':
                    if (!item.no) return;
                    const imageUrl = images(`./${parseInt(item.no)}.jpg`);
                    return (
                        <div key={`picture-${index}`} className={`flex flex-col flex-1 items-center justify-center w-full px-1`}>
                            <div className={`rounded shadow-md flex justify-center`}>
                                <img src={imageUrl} alt={imageUrl} className={`object-center`} />
                            </div>
                            {item.text && (
                                <div className={`${colors[theme]["log-text"]} w-full text-base flex justify-center`}>
                                    <div className={`p-2`}>{item.text}</div>
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
                <div className={`p-1`} key={appendixNum}>
                    {appendixContent.map((item, index) => renderContentItem(item, `${item.type}-${index}`))}
                </div>
            );
        });
    }, [visibleAppendices, appendixMap, parseReferences, colors, theme, translationApplication, images, renderTable]);


    return (
        <div
            className={`h-screen w-screen ${colors[theme]["app-text"]} text-base`}>
            <button onClick={prevPage}
                className={`fixed top-0.5 left-0.5 z-30 rounded shadow-md p-2 ${colors[theme]["base-background"]}`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                </svg>
            </button>


            <div
                ref={containerRef}
                onScroll={loadMoreAppendices}
                className={`relative flex-1 h-screen overflow-y-auto`}>
                {renderAppendices()}
            </div>
        </div>
    );
};

export default Apps;
