import React, { useState, useEffect, useRef, useCallback } from 'react';
import { mapAppendices } from '../utils/Mapper';

const Apps = ({ colors, theme, translationApplication, parseReferences, appendices, selected, restoreAppText, refToRestore, refToJump, direction }) => {

    const lang = localStorage.getItem("lang");
    const containerRef = useRef(null);
    const appendixRef = useRef({});

    const [appendixMap, setAppendixMap] = useState({});
    const images = require.context('../assets/pictures/', false, /\.jpg$/);

    const textRef = useRef({});

    const [isRefsReady, setIsRefsReady] = useState(false);

    const mapAppendicesData = useCallback((appendices) => {
        return mapAppendices(appendices, translationApplication);
    }, [translationApplication]);

    useEffect(() => {
        const initialAppendixMap = mapAppendicesData(appendices);
        setAppendixMap(initialAppendixMap);
    }, [appendices, mapAppendicesData]);

    useEffect(() => {
        if (selected && isRefsReady) {
            setTimeout(() => {
                if (restoreAppText.current && refToRestore.current && textRef.current[refToRestore.current]) {
                    textRef.current[refToRestore.current].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    restoreAppText.current = null;
                } else if (refToJump.current && textRef.current[refToJump.current]) {
                    textRef.current[refToJump.current].scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    if (appendixRef.current && appendixRef.current[`appendix-${selected}`] && isRefsReady) {
                        appendixRef.current[`appendix-${selected}`].scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }, 266);
        }
    }, [selected, restoreAppText, refToRestore, refToJump, isRefsReady, textRef]);

    const handleRefsReady = () => {
        setIsRefsReady(true);
    };

    const handleClick = useCallback((_e, n, i) => {
        refToRestore.current = n + "-" + i;
    }, [refToRestore]);

    const renderTable = useCallback((tableData, appno, key) => {

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
                    <div className={`${colors[theme]["base-background"]} w-full rounded text-sm py-2 px-1 text-center `}>
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
                                        <td key={`cell-${rowIndex}-${cellIndex}`}
                                            ref={(el) => textRef.current[appno + "-" + key + "-" + row + rowIndex] = el}
                                            onClick={(e) => handleClick(e, appno, key + "-" + row + rowIndex)}
                                            className={`border-2 ${colors[theme]["border"]} p-2 text-center break-words`}>{parseReferences(cell)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }, [colors, theme, parseReferences, handleClick]);

    const renderContentItem = (appno, item, index) => {
        switch (item.type) {
            case 'title':
                const appx = translationApplication ? translationApplication.appendix : "Appendix";
                const isAppendixTitle = new RegExp(appx + "\\s*(\\d+)", "i").test(item.content);

                return (
                    <div
                        key={`app-${appno}-${item.type}-${item.order}`}
                        dir={direction}
                        className={`sticky top-0 flex items-center justify-center text-center p-2 font-semibold ${colors[theme]["app-text"]} ${colors[theme]["app-background"]} `}
                        ref={isAppendixTitle ? (el) => appendixRef.current[`appendix-${item.content.match(/\d+/)[0]}`] = el : (el) => textRef.current[appno + "-" + index] = el}>
                        {item.content}
                    </div>
                );
            case 'text':
                return (
                    <div
                        lang={lang}
                        dir={direction}
                        key={`app-${appno}-${item.type}-${item.order}`}
                        ref={(el) => textRef.current[appno + "-" + index] = el}
                        onClick={(e) => handleClick(e, appno, index)}
                        className={`rounded ${colors[theme]["text-background"]} ${colors[theme]["app-text"]} p-0.5 mb-1 flex w-full text-justify hyphens-auto`}>
                        <div className={`overflow-x-scroll`}>
                            <p className={`px-1 break-words`}>{parseReferences(item.content)}</p>
                        </div>
                    </div>
                );
            case 'evidence':
                return (
                    <div
                        dir={direction}
                        key={`app-${appno}-${item.type}-${item.order}`}
                        ref={(el) => textRef.current[appno + "-" + index] = el}
                        onClick={(e) => handleClick(e, appno, index)}
                        className={`${colors[theme]["base-background"]} ${colors[theme]["table-title-text"]} rounded  text-base md:text-lg p-3 border my-3 ${colors[theme]["border"]}`}>
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
                        <div key={`picture10-${index}`} className={`flex flex-col flex-1 items-center justify-center w-full px-1`}>
                            <div className={`flex p-1 overflow-y-auto`}>
                                <div className={` flex flex-col justify-between `}>
                                    {item.content.data.slice(0, 4).map((word) => (
                                        <div key={word} className={`p-1.5 whitespace-nowrap text-right`}>{word}</div>
                                    ))}
                                </div>
                                <img src={imageUrl} alt={imageUrl} className={`object-contain `} />
                                <div className={` flex flex-col justify-between`}>
                                    {item.content.data.slice(4, 8).map((word) => (
                                        <div key={word} className={`p-1.5 flex-1 whitespace-pre text-left`}>{word}</div>
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
                        <div key={`picture-22-special`} className={`flex flex-col space-y-1.5 flex-1 items-center justify-center w-full px-1 mb-2`}>
                            {item.content.text && Object.entries(item.content.text).map(([pickey, text]) => (
                                <div key={pickey} className={`rounded  flex flex-wrap md:flex-nowrap justify-between`}>
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
                return renderTable(item.content, appno, `${index}-${item.order}`);
            default:
                return (
                    <div key={`unknown-${index}`} className={`${colors[theme]["log-text"]} flex flex-1 items-center justify-center w-full`}>
                        {translationApplication?.unrecognizedData}
                    </div>
                );
        }
    };

    const renderAppendices = () => {
        const appendixContent = appendixMap[selected]?.content || [];
        let groups = [];
        let currentGroup = [];

        appendixContent.forEach((item, index) => {
            if (item.type === 'title' || index === 0) {
                if (currentGroup.length > 0) {
                    groups.push(currentGroup);
                }
                currentGroup = [renderContentItem(selected, item, `${item.type}-${item.key}-${item.order}`)];
            } else {
                currentGroup.push(renderContentItem(selected, item, `${item.type}-${item.key}-${item.order}`));
            }
        });
        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        return (
            <div className={`px-1`} key={selected} ref={() => handleRefsReady()}>
                {groups.map((group, groupIndex) => (
                    <div key={`group-${groupIndex}`} className="group">
                        {group.map((element) => element)}
                    </div>
                ))}
            </div>
        );
    };


    return (
        <div
            className={`h-screen w-screen relative overflow-y-auto pb-10 md:pb-14 ${colors[theme]["app-text"]} text-lg md:text-xl lg:text-2xl select-text`}>
            <div ref={containerRef}>
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
};

export default Apps;
