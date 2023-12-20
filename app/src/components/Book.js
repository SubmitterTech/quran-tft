import React, { useState, useEffect } from 'react';
import Pages from '../components/Pages';
import Jump from '../components/Jump';
import '../assets/css/Book.css';

const Book = ({ onChangeTheme, colors, theme, translationApplication, introductionContent, quranData, appendicesContent, translation }) => {
    const [currentPage, setCurrentPage] = useState(parseInt(localStorage.getItem("qurantft-pn")) ? parseInt(localStorage.getItem("qurantft-pn")) : 5);
    const [pageHistory, setPageHistory] = useState([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [selectedSura, setSelectedSura] = useState(null);
    const [selectedVerse, setSelectedVerse] = useState(null);
    const [bookContent, setBookContent] = useState(null);

    const images = require.context('../assets/pictures/', false, /\.jpg$/);



    const [appendicesMap, setAppendicesMap] = useState({});

    useEffect(() => {
        if (appendicesContent) {
            const appList = appendicesContent.find(iterator => iterator.page === 396)?.evidence["2"]?.lines;

            if (appList) {
                const newMap = {};

                Object.entries(appList).forEach(([key, value], index) => {
                    if (index !== 0) {
                        const details = value.split(".").filter(element => element);
                        if (details.length >= 3) {
                            newMap[parseInt(details[0])] = parseInt(details[2]) + 22;
                        }
                    }
                });

                setAppendicesMap(newMap);
            }
        }
    }, [appendicesContent]);


    useEffect(() => {
        if (introductionContent && appendicesContent) {
            setBookContent(introductionContent.concat(appendicesContent))
        }
    }, [appendicesContent, introductionContent]);


    const handleJump = async (page, suraNumber, verseNumber) => {
        updatePage(parseInt(page), suraNumber, verseNumber);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
    };

    const updatePage = (newPage, sura, verse) => {
        // Add currentPage to history only if it's different from the newPage
        if (currentPage !== newPage) {
            setPageHistory(prevHistory => [...prevHistory, currentPage]);
        }
        setSelectedSura(sura);
        setSelectedVerse(verse);
        setCurrentPage(newPage);
    };


    useEffect(() => {
        if (currentPage) {
            localStorage.setItem("qurantft-pn", currentPage)
        }
    }, [currentPage]);


    const nextPage = () => {

        let newPage = parseInt(currentPage) >= 508 ? parseInt(currentPage) : parseInt(currentPage) + 1;

        // Skip specified pages
        const skipPages = [8, 9, 10, 12];
        while (skipPages.includes(newPage)) {
            newPage++;
        }

        updatePage(newPage);
    };

    const prevPage = () => {
        if (pageHistory.length > 0) {
            // Get the last page from history and remove it from the history array
            const lastPage = pageHistory[pageHistory.length - 1];
            setPageHistory(prevHistory => prevHistory.slice(0, -1));
            setCurrentPage(lastPage);
        } else {
            // Skip specified pages when decrementing
            const skipPages = [8, 9, 10, 12];
            let newPage = parseInt(currentPage) > 5 ? parseInt(currentPage) - 1 : parseInt(currentPage);

            while (skipPages.includes(newPage)) {
                newPage--;
            }

            setCurrentPage(newPage);
        }
    };

    const createReferenceMap = () => {
        const referenceMap = {};

        Object.entries(quranData).forEach(([pageNumber, value]) => {
            // Ensure that pageValues is an array
            const pageValues = Array.isArray(value.page) ? value.page : [value.page];
            const suraVersePattern = /\d+:\d+-\d+/g;
            let matches = [];

            pageValues.forEach(pageValue => {
                const match = pageValue.match(suraVersePattern);
                if (match) {
                    matches = matches.concat(match);
                }
            });

            referenceMap[pageNumber] = matches;
        });

        return referenceMap;
    };

    const referenceMap = createReferenceMap();

    const handleClickReference = (reference) => {

        if (reference.toLowerCase().includes("introduction") || reference.toLowerCase().includes("intro")) {
            updatePage(13);
            return;
        }
        // Parse the reference to extract sura and verse information
        let [sura, verses] = reference.split(':');
        let verseStart, verseEnd;
        if (verses.includes('-')) {
            [verseStart, verseEnd] = verses.split('-').map(Number);
        } else {
            verseStart = verseEnd = parseInt(verses);
        }

        // Iterate over the referenceMap to find the correct page number
        let foundPageNumber = null;
        Object.entries(referenceMap).forEach(([pageNumber, suraVersesArray]) => {
            if (foundPageNumber) return; // Skip further iterations if page is already found

            suraVersesArray.forEach(suraVerses => {
                let [suraMap, verseRange] = suraVerses.split(':');
                let [verseStartMap, verseEndMap] = verseRange.includes('-') ? verseRange.split('-').map(Number) : [parseInt(verseRange), parseInt(verseRange)];

                if (suraMap === sura && !(verseEnd < verseStartMap || verseStart > verseEndMap)) {
                    foundPageNumber = pageNumber;
                }
            });
        });

        if (foundPageNumber) {
            updatePage(foundPageNumber, sura, verseStart);
        } else {
            console.log("Reference not found in the book.");
        }
    };

    const handleClickAppReference = (number) => {
        if (number > 0 && number < 40) {
            updatePage(appendicesMap[parseInt(number)]);
        }
    };

    const parseReferences = (text) => {
        // Define the regular expressions
        const verseRegex = /(\d+:\d+(?:-\d+)?)/g;
        const appendixRegex = /Appendix?/g;
        const introRegex = /introduction/gi;

        const replaceAppendixNumbers = (appendixPart) => {
            const startIndex = appendixPart.search(appendixRegex);
            let endIndex = startIndex;
            let isNumberStarted = false;

            for (let i = startIndex; i < appendixPart.length; i++) {
                const char = appendixPart[i];

                // Check if the next characters form the word "and"
                const isAndAhead = appendixPart.substring(i, i + 3).toLowerCase() === 'and';

                if (/\d/.test(char)) {
                    isNumberStarted = true;
                    endIndex = i;
                } else if (isNumberStarted && !(/[,&\s]/.test(char))) {
                    if (char === '&' || isAndAhead) {
                        // If an '&' or "and" is found, skip the "and" sequence by advancing 'i'
                        if (isAndAhead) {
                            i += 2; // Skip the next two characters of "and"
                        }
                        continue;
                    } else if (!/\s/.test(char)) {
                        // If the character is not a whitespace and not part of "and", stop detecting
                        break;
                    }
                }
            }


            const appendixReference = appendixPart.substring(startIndex, endIndex + 1);
            const parts = appendixReference.split(/(\d+|\s+|,|&|and)/gi);

            return (
                <>
                    {appendixPart.substring(0, startIndex)}
                    {parts.map((segment, index) => {
                        if (segment.match(/^\d+$/) && parseInt(segment) >= 1 && parseInt(segment) <= 39) {
                            return (
                                <span key={index} className={`cursor-pointer text-sky-600`} onClick={() => handleClickAppReference(segment)}>
                                    {segment}
                                </span>
                            );
                        } else {
                            return segment;
                        }
                    })}
                    {appendixPart.substring(endIndex + 1)}
                </>
            );
        };


        // Split the text into parts and process each part
        return text.split(verseRegex).map((part, index) => {
            if (part.match(appendixRegex)) {
                // Split the part into pieces with "."
                const pieces = part.split('.');

                // Create an array to hold JSX elements and strings
                const elements = [];

                // Re-iterate over the pieces to find which piece is matching
                for (let i = 0; i < pieces.length; i++) {
                    if (appendixRegex.test(pieces[i])) {
                        // Process the matching piece and add it to the elements array
                        elements.push(replaceAppendixNumbers(pieces[i]));
                    } else {
                        // If the piece does not match, add it as a string
                        elements.push(pieces[i]);
                    }

                    // Add the period back as a string, except for the last piece
                    if (i < pieces.length - 1) {
                        elements.push('.');
                    }
                }

                // Return the array of JSX elements and strings
                return elements;
            } else if (part.match(verseRegex)) {
                if (text.includes("[") && text.match(/[a-zA-Z]/)) {
                    return part;
                }
                return (
                    <span key={index} className={`cursor-pointer text-sky-600`} onClick={() => handleClickReference(part)}>
                        {part}
                    </span>
                );
            } else if (introRegex.test(part)) {
                // Split the part into segments around introRegex matches
                const segments = part.split(introRegex);

                // Create an array to hold JSX elements and strings
                const elements = [];

                // Iterate over the segments
                segments.forEach((segment, index) => {
                    // Push the regular segment as plain text
                    elements.push(segment);

                    // If this is not the last segment, add the intro match as a clickable span
                    if (index < segments.length - 1) {
                        elements.push(
                            <span key={index} className={`cursor-pointer text-sky-600`} onClick={() => handleClickReference("Introduction")}>
                                {translationApplication?.intro}
                            </span>
                        );
                    }
                });

                // Return the array of JSX elements and strings
                return elements;
            } else {
                // If it doesn't match anything, return the part as plain text
                return part;
            }
        });
    };





    const renderTable = (tableData) => {
        const tableRef = tableData.ref;
        const columnCount = tableData.title.length;
        const rows = [];

        for (let i = 0; i < tableData.values.length; i += columnCount) {
            rows.push(tableData.values.slice(i, i + columnCount));
        }

        return (
            <div className={`w-full flex flex-col ${colors[theme]["table-title-text"]}`}>
                <div className={`${colors[theme]["base-background"]} w-full rounded text-sm py-2 text-center `}>
                    {tableRef}
                </div>
                <table title={tableRef} className={`table-auto ${colors[theme]["base-background"]} border-collapse border-2 ${colors[theme]["border"]} text-center mb-3 w-full text-sm md:text-base`}>
                    <thead>
                        <tr>
                            {tableData.title.map((header, index) => (
                                <th key={index} className={`border-2 ${colors[theme]["border"]} p-2 `}>{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {row.map((cell, cellIndex) => (
                                    <td key={cellIndex} className={`border-2 ${colors[theme]["border"]} p-2`}>{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderBookContent = () => {
        // Render Pages component when current page is 23 to 394
        if (parseInt(currentPage) >= 23 && parseInt(currentPage) <= 394) {
            return <Pages colors={colors} theme={theme} translationApplication={translationApplication} quranData={quranData} translation={translation} selectedPage={currentPage} selectedSura={selectedSura} selectedVerse={selectedVerse} handleClickReference={handleClickReference} handleClickAppReference={handleClickAppReference} />;
        }

        if (parseInt(currentPage) === 22) {
            const cpd = bookContent ? bookContent.find(iterator => iterator.page === currentPage) : null;

            if (!cpd || !cpd.evidence["2"] || !cpd.evidence["2"].lines) {
                return (
                    <div className={`${colors[theme]["log-text"]} flex flex-1 items-center justify-center w-full `}>
                        {translationApplication?.contentNotAvailable}
                    </div>
                )
            }

            const content = cpd.evidence["2"].lines;
            const renderedContent = Object.entries(content).map(([key, value]) => {
                const elements = value.split(".")
                    .filter(element => element.trim().length > 0); // Filter out elements that are only spaces

                const no = elements[0];
                let name = elements[1];
                let arabic = elements[2];
                let versecount = elements[3];
                let page = elements[4];

                if (elements.length > 5) {
                    name = elements[1] + " " + elements[2];
                    arabic = elements[3];
                    versecount = elements[4];
                    page = elements[5];
                }

                if (parseInt(key) === 0) {
                    return (
                        <div className={`${colors[theme]["app-text"]} w-full flex justify-between`} key={key}>
                            <div className={`p-3 w-1/6 flex justify-center text-center`}>{no}</div>
                            <div className={`p-3 w-full flex justify-center`}>{name}</div>
                            <div className={`p-3 w-1/6 flex justify-center text-center`}>{arabic}</div>
                        </div>
                    );
                } else {
                    return (
                        <div
                            onClick={() => updatePage(parseInt(page) + 22)}
                            className={`flex w-full justify-between`}>
                            <div className={`font-semibold rounded m-0.5 ${colors[theme]["base-background"]} w-1/6 text-sm flex items-center justify-center`}>
                                <p className={``} key={key + no}>{no}</p>
                            </div>
                            <div className={`m-0.5 ring-1 ${colors[theme]["ring"]} flex justify-between ${colors[theme]["base-background"]} w-full rounded shadow-md`}>
                                <div className={`rounded-l px-1 py-2 text-left`}>
                                    <p className={``} key={key + name + no}>{name}</p>
                                </div>
                                <div className={`rounded-r px-1 py-2 text-right`}>
                                    <p className={``} key={key + arabic}>{arabic}</p>
                                </div>
                            </div>
                            <div className={`rounded px-2 py-1 m-0.5 ${colors[theme]["base-background"]} w-1/6 text-base flex items-center justify-center`}>
                                <p className={``} key={key + versecount}>{versecount}</p>
                            </div>
                        </div>
                    );
                }
            });

            return (
                <div className={`w-screen h-screen flex flex-col overflow-auto ${colors[theme]["app-text"]}`}>
                    <div className={`w-full p-3`}>
                        <div className={`w-full flex items-center justify-center text-center ${colors[theme]["base-background"]} rounded p-2 font-semibold ${colors[theme]["app-text"]}  text-2xl shadow-md`}>
                            <h2 key={`title-1}`}>{cpd.titles["1"]}</h2>
                        </div>
                    </div>
                    {renderedContent}
                </div>
            );
        }

        if (parseInt(currentPage) === 395) {
            return (
                <div
                    onClick={nextPage}
                    className={`w-screen h-screen flex items-center justify-center  ${colors[theme]["app-text"]}`}>
                    <div className={`text-4xl mx-2`}>
                        {translationApplication?.appendices}
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                    </svg>
                </div>
            );
        }

        if (parseInt(currentPage) === 396) {
            const cpd = bookContent ? bookContent.find(iterator => iterator.page === currentPage) : null;

            if (!cpd || !cpd.evidence["2"] || !cpd.evidence["2"].lines) {
                return (
                    <div className={`${colors[theme]["log-text"]} flex flex-1 items-center justify-center w-full `}>
                        {translationApplication?.contentNotAvailable}
                    </div>
                )
            }

            const content = cpd.evidence["2"].lines;
            const renderedContent = Object.entries(content).map(([key, value]) => {
                const elements = value.split(".").filter(element => element);
                if (parseInt(key) === 1) {
                    const titles = elements[0].split(" ").filter(element => element);
                    return (
                        <div className={` ${colors[theme]["app-text"]} w-full flex justify-center`} key={key}>
                            <div className={`p-3`}>{titles[0]}</div>
                        </div>
                    );
                } else {
                    return (
                        <div
                            onClick={() => updatePage(parseInt(elements[2]) + 22)}
                            className={`flex w-full justify-between`}>
                            <div className={` font-semibold rounded p-3 m-1 ${colors[theme]["base-background"]} w-12 flex items-center justify-center`}>
                                <p className={``} key={key}>{elements[0]}</p>
                            </div>
                            <div className={`rounded p-3 mr-2 m-1 ${colors[theme]["base-background"]} w-full text-base flex items-center`}>
                                <p className={``} key={key}>{elements[1]}</p>
                            </div>
                        </div>
                    );
                }
            });

            return (
                <div className={`w-screen h-screen flex flex-col overflow-auto ${colors[theme]["app-text"]}`}>
                    {renderedContent}
                </div>);
        }


        const combinedContent = [];

        const currentPageData = bookContent ? bookContent.find(iterator => iterator.page === currentPage) : null;


        if (!currentPageData || !currentPageData.titles) {
            return <div className={`${colors[theme]["log-text"]} flex flex-1 items-center justify-center w-full `}>
                <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 text-white`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className={`opacity-25`} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className={`opacity-75`} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {translationApplication?.loading}
            </div>;
        }

        // Add titles to combined content
        Object.entries(currentPageData.titles).forEach(([key, value]) => {
            combinedContent.push({ type: 'title', content: value, order: parseInt(key) });
        });

        // Add text paragraphs to combined content
        Object.entries(currentPageData.text).forEach(([key, value]) => {
            combinedContent.push({ type: 'text', content: value, order: parseInt(key) });
        });

        // Add evidence to combined content
        Object.entries(currentPageData.evidence).forEach(([key, value]) => {
            combinedContent.push({ type: 'evidence', content: value, order: parseInt(key) });
        });

        if (currentPageData.picture) {
            // Add pictures to combined content
            Object.entries(currentPageData.picture).forEach(([key, value]) => {
                combinedContent.push({ type: 'picture', no: value["no"], order: parseInt(key), text: value["text"] });
            });
        }

        if (currentPageData.table) {
            // Add pictures to combined content
            Object.entries(currentPageData.table).forEach(([key, value]) => {
                combinedContent.push({ type: 'table', content: value, order: parseInt(key) });
            });
        }
        // Sort the combined content by order
        combinedContent.sort((a, b) => a.order - b.order);

        // Render combined content
        const renderContent = combinedContent.map((item, index) => {
            if (item.type === 'title') {
                return (
                    <div className={`w-full my-3 flex items-center justify-center text-center ${colors[theme]["base-background"]} rounded p-2 font-semibold ${colors[theme]["app-text"]}  whitespace-pre-line ${item.order === 0 ? "text-2xl font-bold" : " text-base"}`}>
                        <h2 key={`title-${index}`}>{item.content}</h2>
                    </div>
                );
            } else if (item.type === 'text') {
                return (
                    <div className={`rounded ${colors[theme]["text-background"]} ${colors[theme]["app-text"]} p-2 shadow-md mb-3 flex w-fit justify-center`}>
                        <p key={`text-${index}`} className={`px-1`}>{parseReferences(item.content)}</p>
                    </div>
                );
            } else if (item.type === 'evidence') {
                // SPECIAL RENDER 1
                if (item.content.special && item.content.special.key === 1) {
                    const data = item.content.special.data;
                    return (
                        <div className={`w-full flex flex-col flex-1 my-3`}>
                            <div key={`evidence-${index}`}
                                className={`bg-gray-100 text-gray-700 rounded shadow-md text-sm md:text-base border border-gray-700 flex justify-between w-full items-stretch`}>

                                <div className={`relative text-gray-100 bg-gray-700 w-[11%] flex flex-wrap `}>
                                    {/* Render SVGs for index 0 in this div */}
                                    {Object.entries(data).map(([key, value]) => {
                                        if (parseInt(key) === 0) {
                                            return Array.from({ length: value }, (_, i) => (
                                                <div className={`p-0.5`}>
                                                    <svg key={i} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3 h-3 md:h-5 md:w-5 lg:h-6 lg:w-6`}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                                    </svg>
                                                </div>

                                            ));
                                        }
                                        return null;
                                    })}
                                </div>

                                <div className={`relative w-full text-gray-900 bg-gray-100 h-fit flex flex-wrap rounded-r`}>
                                    {/* Render SVGs for index 1 in this div */}
                                    {Object.entries(data).map(([key, value]) => {
                                        if (parseInt(key) === 1) {
                                            return Array.from({ length: value }, (_, i) => (
                                                <div className={`p-0.5`}>
                                                    <svg key={i} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={` w-3 h-3 md:h-5 md:w-5 lg:h-6 lg:w-6`}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                                    </svg>
                                                </div>
                                            ));
                                        }
                                        return null;
                                    })}
                                </div>

                            </div>
                            <div className={`w-full flex justify-between`}>
                                <div className={`relative h-6 w-[11%]`}>
                                    <div className={`absolute -left-2 text-xs`}>
                                        {translationApplication?.adam}
                                    </div>
                                </div>
                                <div className={`relative h-6 w-[100%]`}>
                                    <div className={`absolute -left-1 text-xs`}>
                                        1990
                                    </div>
                                </div>
                                <div className={`relative h-6 w-[11%] text-xs`}>
                                    <div className={`absolute -right-2`}>
                                        2280
                                    </div>
                                </div>

                            </div>
                            <div className={`w-full flex flex-col rounded border border-gray-700 p-1`}>
                                <div className={`w-full flex items-center justify-between`}>
                                    <div className={`w-7 h-7 rounded bg-gray-100 border border-gray-300 shadow-md`}>

                                    </div>
                                    <div className={`flex ml-1 w-full text-sm`}>
                                        {item.content.lines["1"]}
                                    </div>
                                </div>
                                <div className={`w-full flex items-center justify-between mt-1`}>
                                    <div className={`w-7 h-7 rounded bg-gray-700 border border-gray-300 shadow-md`}>
                                    </div>
                                    <div className={`ml-1 w-full text-sm`}>
                                        {item.content.lines["2"]}
                                    </div>
                                </div>

                            </div>
                        </div>

                    );
                }
                // SPECIAL RENDER 2
                else if (item.content.special && item.content.special.key === 2) {

                    return (
                        <div className={`w-full flex flex-col flex-1 my-3`}>
                            <div key={`evidence-${index}`}
                                className={` text-gray-700 rounded shadow-md text-sm md:text-base border border-gray-950 flex justify-between w-full items-stretch`}>
                                <div className={`relative w-full bg-gray-100 flex flex-wrap justify-center p-2 text-gray-700 rounded-l`}>
                                    {item.content.lines["1"]}
                                </div>
                                <div className={`relative bg-gray-500 w-[3%] flex flex-wrap py-2`}>
                                </div>
                            </div>
                            <div className={`w-full flex justify-end py-0.5`}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25L12 21m0 0l-3.75-3.75M12 21V3" />
                                </svg>
                            </div>
                            <div key={`evidence-${index + 1}`}
                                className={` text-gray-700 rounded shadow-md text-sm md:text-base border border-gray-950 flex justify-between w-full items-stretch`}>
                                <div className={`relative w-full bg-gray-500 flex flex-wrap justify-center p-2 text-gray-200 rounded-l`}>
                                    {item.content.lines["2"]}
                                </div>
                                <div className={`relative bg-gray-900 w-[3%] flex flex-wrap py-2`}>

                                </div>
                            </div>
                        </div>
                    );
                }
                return (
                    <div key={`evidence-${index}`} className={`${colors[theme]["base-background"]} ${colors[theme]["table-title-text"]} rounded shadow-md text-sm md:text-base p-3 border my-3 ${colors[theme]["border"]}`}>
                        {Object.entries(item.content.lines).map(([lineKey, lineValue]) => (
                            <p className={` whitespace-pre-wrap my-1`} key={lineKey}>{parseReferences(lineValue)}</p>
                        ))}
                        {item.content.ref.length > 0 && (
                            <p>{parseReferences("[" + item.content.ref.join(', ') + "]")}</p>
                        )}
                    </div>
                );
            } else if (item.type === 'picture') {
                const imageUrl = images(`./${item.no}.jpg`);
                return (
                    <div className={` flex flex-col flex-1 items-center justify-center w-full px-1`}>

                        <div className={`rounded shadow-md flex justify-center`}>

                            <img
                                src={imageUrl}
                                alt={imageUrl}
                                className={`object-center`}
                            />
                        </div>
                        {item.text && <div className={`${colors[theme]["log-text"]} w-full text-base flex justify-center`}>
                            <div className={`p-2`}>
                                {item.text}
                            </div>
                        </div>}
                    </div>
                );
            } else if (item.type === 'table') {
                return (renderTable(item.content));

            } else {
                return (
                    <div className={`${colors[theme]["log-text"]} flex flex-1 items-center justify-center w-full`}>
                        {translationApplication?.unrecognizedData}
                    </div>
                );
            }
        });

        return (
            <div className={`${colors[theme]["text"]} overflow-auto flex-1 p-3 text-justify lg:text-start text-base md:text-xl`}>
                {renderContent}
            </div>
        );
    };

    return (
        <div className={`flex flex-col justify-start h-screen ${colors[theme]["app-background"]}`}>
            {renderBookContent()}
            <div className={`w-full flex z-20`}>
                <div className={`flex w-full items-center justify-between`}>
                    <button onClick={prevPage}
                        className={`w-28 ${colors[theme]["app-text"]} px-2 py-1 rounded mr-2 flex justify-center`}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7`}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                    </button>
                    <div
                        onClick={() => setModalOpen(!isModalOpen)}
                        className={``}>
                        <h2 className={`text-sm font-bold ${colors[theme]["page-text"]} p-2`}>{translationApplication?.page} {currentPage}</h2>
                    </div>
                    <button onClick={nextPage}
                        className={`w-28 ${colors[theme]["app-text"]} px-2 py-1 rounded ml-2 flex justify-center`}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7`}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                        </svg>
                    </button>
                </div>
            </div>
            {isModalOpen &&
                <Jump
                    onChangeTheme={onChangeTheme}
                    colors={colors} theme={theme}
                    translationApplication={translationApplication}
                    currentPage={currentPage}
                    quran={quranData}
                    onClose={handleCloseModal}
                    onConfirm={handleJump}
                />
            }
        </div>
    );
};

export default Book;
