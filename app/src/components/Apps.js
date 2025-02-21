import React, { useState, useEffect, useRef, useCallback } from 'react';
import { mapAppendices } from '../utils/Mapper';
import Picture4and5 from '../specials/Picture4and5';
import Picture10 from '../specials/Picture10';
import Picture22 from '../specials/Picture22';

const Apps = ({ colors, theme, translationApplication, parseReferences, appendices, selected, restoreAppText, refToRestore, refToJump, direction, upt }) => {

    const lang = localStorage.getItem("lang");
    const containerRef = useRef(null);
    const appendixRef = useRef({});

    const [appendixMap, setAppendixMap] = useState({});
    const images = require.context('../assets/pictures/', false, /\.jpg$/);

    const textRef = useRef({});

    const [isRefsReady, setIsRefsReady] = useState(false);
    const [notify, setNotify] = useState(null);

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
                    setNotify(refToJump.current);
                    setTimeout(() => {
                        setNotify(null);
                    }, 5350);
                } else {
                    if (appendixRef.current && appendixRef.current[`appendix-${selected}`] && isRefsReady) {
                        appendixRef.current[`appendix-${selected}`].scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }, 266);
        }
    }, [selected, restoreAppText, refToRestore, refToJump, isRefsReady, textRef, upt]);

    const handleRefsReady = () => {
        setIsRefsReady(true);
    };

    const handleClick = useCallback((_e, n, i) => {
        refToRestore.current = n + "-" + i;
    }, [refToRestore]);

    const renderTable = useCallback((tableData, appno, key) => {
        const tableRef = tableData.ref;
        const { title: columnHeaders, values } = tableData;
        const columnCount = columnHeaders.length;
        const rows = [];
        for (let i = 0; i < values.length; i += columnCount) {
            rows.push(values.slice(i, i + columnCount));
        }

        return (
            <div key={key} className={`${colors[theme]["table-title-text"]}`}>
                <div className={` my-4 overflow-x-auto`}>
                    <div className={`${colors[theme]["base-background"]} w-full rounded text-sm py-2 px-1 text-center `}>
                        {tableRef}
                    </div>
                    <table className={`table-auto w-full text-base md:text-lg ${colors[theme]["base-background"]} border-collapse border-2 ${colors[theme]["border"]}`}>
                        <thead>
                            <tr>
                                {(() => {
                                    let pending = 0;
                                    const mergedHeaders = [];
                                    // Process the header cells (table titles) with the merging rule.
                                    for (let i = 0; i < columnHeaders.length; i++) {
                                        if (columnHeaders[i] !== "") {
                                            // A non-empty cell: add any pending merge count from previous empty cells.
                                            const colspan = 1 + pending;
                                            pending = 0;
                                            mergedHeaders.push({
                                                content: columnHeaders[i],
                                                colspan,
                                                cellIndex: i,
                                            });
                                        } else {
                                            // An empty header cell.
                                            // If a non-empty cell follows, accumulate pending.
                                            if (i + 1 < columnHeaders.length && columnHeaders[i + 1].trim() !== "") {
                                                pending++;
                                            } else {
                                                // No valid non-empty neighbor to the right: merge immediately with the previous non-empty header cell.
                                                if (mergedHeaders.length > 0) {
                                                    mergedHeaders[mergedHeaders.length - 1].colspan++;
                                                } else {
                                                    // In case the very first header cell is empty.
                                                    pending++;
                                                }
                                            }
                                        }
                                    }
                                    // If all header cells are empty, create one cell spanning all columns.
                                    if (mergedHeaders.length === 0) {
                                        mergedHeaders.push({
                                            content: "",
                                            colspan: columnHeaders.length,
                                            cellIndex: 0,
                                        });
                                    }
                                    return mergedHeaders.map((header, index) => (
                                        <th key={`header-${index}`}
                                            colSpan={header.colspan}
                                            className={`border ${colors[theme]["border"]} p-2 text-balance`}>
                                            {header.content}
                                        </th>
                                    ));
                                })()}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, rowIndex) => {
                                // Process the row into a set of cells that include colspan values.
                                // The idea: as we iterate over the row, if a cell is non-empty, render it
                                // with any accumulated pending merges from previous empty cells.
                                // If a cell is empty and a non-empty cell follows, we “accumulate” a pending count;
                                // otherwise, if no non-empty cell follows, merge it immediately into the previous cell.
                                let pending = 0;
                                const renderedCells = [];

                                for (let i = 0; i < row.length; i++) {
                                    if (row[i] !== "") {
                                        // This is a non-empty cell.
                                        // Add any pending empty cells to its colspan.
                                        const colspan = 1 + pending;
                                        pending = 0;
                                        renderedCells.push({
                                            content: row[i],
                                            colspan,
                                            // Store the original cell index for key/ref purposes.
                                            cellIndex: i,
                                        });
                                    } else {
                                        // The cell is empty.
                                        // Check if the next cell exists and is non-empty.
                                        if (i + 1 < row.length && row[i + 1].trim() !== "") {
                                            // Defer merging with the next non-empty cell.
                                            pending++;
                                        } else {
                                            // No valid non-empty neighbor to the right: merge immediately with the previous non-empty cell.
                                            if (renderedCells.length > 0) {
                                                renderedCells[renderedCells.length - 1].colspan++;
                                            } else {
                                                // In case this is the first cell (and it's empty), we accumulate pending;
                                                // when the next non-empty cell is found, it will inherit the colspan.
                                                pending++;
                                            }
                                        }
                                    }
                                }

                                // If the entire row is empty, then render one empty cell spanning all columns.
                                if (renderedCells.length === 0) {
                                    renderedCells.push({
                                        content: "",
                                        colspan: columnCount,
                                        cellIndex: 0,
                                    });
                                }
                                return (
                                    <tr key={`row-${rowIndex}`}>
                                        {renderedCells.map((cell, renderedIndex) => (
                                            <td key={`cell-${rowIndex}-${renderedIndex}`}
                                                colSpan={cell.colspan}
                                                ref={(el) => (textRef.current[`${appno}-${key}-${rowIndex}-${cell.cellIndex}`] = el)}
                                                onClick={(e) => handleClick(e, appno, `${key}-${rowIndex}-${cell.cellIndex}`)}
                                                className={`text-center p-2 ${/^\s+$/.test(cell.content) ? `` : `border ${colors[theme]["border"]} border-opacity-25 `} ${((cell.cellIndex === 0 && row.length > 3) || (cell.cellIndex === row.length - 1 && row.length > 3) || (cell.content.includes('x') && /\d+ x/.test(cell.content))) ? ` text-nowrap ` : ` break-words `} `}>
                                                {parseReferences(cell.content, `${appno}-${key}-${rowIndex}-${cell.cellIndex}`)}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
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
                const pulsateTitle = notify === `${appno}-${index}` ? `animate-pulse` : ``;

                return (
                    <div
                        key={`app-${appno}-${item.type}-${item.order}`}
                        dir={direction}
                        className={`${isAppendixTitle ? `px-2 pb-1 pt-2.5 ${colors[theme]["page-text"]}` : `${pulsateTitle} sticky top-10 px-2 pb-1 pt-2 ${colors[theme]["app-text"]}`} flex items-center justify-center text-center  font-semibold  ${colors[theme]["app-background"]} `}
                        ref={isAppendixTitle ? (el) => appendixRef.current[`appendix-${item.content.match(/\d+/)[0]}`] = el : (el) => textRef.current[appno + "-" + index] = el}>
                        {item.content}
                    </div>
                );
            case 'text':
                const pulsate = notify === `${appno}-${index}` ? `animate-pulse` : ``;
                return (
                    <div
                        lang={lang}
                        dir={direction}
                        key={`app-${appno}-${item.type}-${item.order}`}
                        ref={(el) => textRef.current[appno + "-" + index] = el}
                        onClick={(e) => handleClick(e, appno, index)}
                        className={`rounded ${colors[theme]["text-background"]} ${colors[theme]["text"]} p-0.5 mb-1 flex w-full text-justify hyphens-auto ${pulsate}`}>
                        <div className={`overflow-x-auto`}>
                            <p className={`px-1 break-words`}>{parseReferences(item.content, appno + "-" + index)}</p>
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
                            <p key={`${lineKey}`} className={`whitespace-pre-wrap text-justify my-2`}>{parseReferences(lineValue, appno + "-" + index)}</p>
                        ))}
                        {item.content.ref.length > 0 && (
                            <p>{parseReferences("[" + item.content.ref.join(', ') + "]", appno + "-" + index)}</p>
                        )}
                    </div>
                );
            case 'picture':
                if (!item.content.no) return;
                const no = parseInt(item.content.no);
                const imageUrl = images(`./${no}.jpg`);

                // SPECIAL RENDER FOR PICTURE 4 and 5
                if (no === 4) {
                    return (
                        <Picture4and5
                            item={item}
                            colors={colors}
                            theme={theme}
                        />
                    );
                }
                if (no === 5) return;
 
                // SPECIAL RENDER FOR PICTURE 10
                if (no === 10) {
                    return (
                        <Picture10
                            item={item}
                            imageUrl={imageUrl}
                            colors={colors}
                            theme={theme}
                        />
                    );
                }
                // SPECIAL RENDER FOR PICTURE 22
                if (parseInt(item.content.no) === 22) {
                    return (
                        <Picture22
                            item={item}
                            lang={lang}
                            direction={direction}
                            colors={colors}
                            theme={theme}
                            parseReferences={parseReferences}
                            textRef={textRef}
                            appno={appno}
                            handleClick={handleClick}
                        />
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
            <div className={``} key={selected} ref={() => handleRefsReady()}>
                {groups.map((group, groupIndex) => (
                    <div key={`group-${groupIndex}`} className={`${groupIndex === 0 ? `main-group sticky -top-0.5 z-10 shadow-md` : `group px-1`}`}>
                        {group.map((element) => element)}
                    </div>
                ))}
            </div>
        );
    };


    return (
        <div
            className={`h-full w-screen relative overflow-y-auto pb-10 md:pb-14 ${colors[theme]["app-text"]} text-lg md:text-xl lg:text-2xl select-text`}>
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
