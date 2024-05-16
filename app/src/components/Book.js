import React, { useState, useEffect, useRef, useCallback } from 'react';
import { App } from '@capacitor/app';
import { Toast } from '@capacitor/toast';
import Pages from '../components/Pages';
import Apps from '../components/Apps';
import Jump from '../components/Jump';
import Magnify from '../components/Magnify';
import Splash from '../components/Splash';
import '../assets/css/Book.css';

const Book = ({ onChangeTheme, colors, theme, translationApplication, introductionContent, quranData, map, appendicesContent, translation, onChangeLanguage }) => {
    const lang = localStorage.getItem("lang")
    const images = require.context('../assets/pictures/', false, /\.jpg$/);
    const [selectOpen, setSelectOpen] = useState(false);
    const magnifyConfirm = useRef(false);
    const [currentPage, setCurrentPage] = useState(parseInt(localStorage.getItem("qurantft-pn")) ? parseInt(localStorage.getItem("qurantft-pn")) : 1);
    const [pageHistory, setPageHistory] = useState([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [selectedSura, setSelectedSura] = useState(null);
    const [selectedVerse, setSelectedVerse] = useState(null);
    const [action, setAction] = useState(null);
    const [bookContent, setBookContent] = useState(null);
    const [isSearchOpen, setSearchOpen] = useState(false);

    const contentRef = useRef(null);
    const restoreAppText = useRef(null);
    const refToRestore = useRef(null);
    const [pages, setPages] = useState([]);

    const [selectedApp, setSelectedApp] = useState(1);
    const [backButtonPressedOnce, setBackButtonPressedOnce] = useState(false);

    let path = useRef({});

    const setSelectedAppendix = (number) => {
        updatePage(397, null, null, 'openAppendix', parseInt(number));
        setSelectedApp(parseInt(number));
    };

    const [appendices, setAppendices] = useState(
        Array.from({ length: 38 }, (_, i) => ({ number: i + 1, title: "" }))
    );

    function transformAppendices(appc) {
        const lines = appc[1].evidence["2"].lines;

        const newAppendices = Object.entries(lines).map(([key, value]) => {

            const match = value.match(/^(\d+)\.\s*(.+)/);
            if (match && key > 1) {
                const elements = value.split(".").filter(element => element);

                return { number: parseInt(elements[0]), title: elements[1].trim() };
            }
            return null;
        }).filter(Boolean);

        return newAppendices;
    }

    useEffect(() => {

        if (appendicesContent) {
            const scApps = transformAppendices(appendicesContent);
            setAppendices(scApps);
        }

        if (introductionContent && appendicesContent) {
            const content = introductionContent.concat(appendicesContent)
            setBookContent(content);
            let pgs = [];
            Object.values(introductionContent).forEach((item) => {
                pgs.push(item.page)
                if (item.page === 22) {
                    for (let i = 23; i <= 397; i++) {
                        pgs.push(i);
                    }
                }
            });
            setPages(pgs);
        }
    }, [appendicesContent, introductionContent]);

    useEffect(() => {
        if (currentPage) {
            localStorage.setItem("qurantft-pn", currentPage)
            if (contentRef.current) {
                contentRef.current.scrollTo({
                    top: 0,
                    left: 0,
                    behavior: 'smooth'
                });
            }
        }
    }, [currentPage]);

    const handleJump = async (page, suraNumber, verseNumber) => {
        updatePage(parseInt(page), suraNumber, verseNumber);
    };

    const handleMagnifyConfirm = (reference) => {
        magnifyConfirm.current = true;
        handleClickReference(reference);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
    };

    const handleCloseSearch = () => {
        setSearchOpen(false);
        setModalOpen(false);
    };

    const handleTogglePage = () => {
        setModalOpen(!isModalOpen);
        if (isSearchOpen) {
            setSearchOpen(false);
        }
    };

    const updatePage = useCallback((newPage, sura = null, verse = null, actionType = 'navigate', appReference = null) => {
        setAction(actionType);
        if (actionType !== 'previous' && parseInt(newPage) !== parseInt(currentPage)) {
            setPageHistory(prevHistory => {
                const lastElement = prevHistory[prevHistory.length - 1];
                if (lastElement && lastElement.page === parseInt(currentPage)) {
                    lastElement.sura = sura;
                    lastElement.verse = verse;
                    return [...prevHistory.slice(0, prevHistory.length - 1), lastElement];
                } else {
                    return [...prevHistory, {
                        page: parseInt(currentPage),
                        sura: selectedSura,
                        verse: selectedVerse,
                        actionType,
                        appReference
                    }];
                }
            });
        }

        setSelectedSura(sura);
        setSelectedVerse(verse);
        setCurrentPage(newPage);
    }, [currentPage, selectedSura, selectedVerse]);

    const nextPage = () => {
        let newPage = parseInt(currentPage) > 396 ? parseInt(currentPage) : parseInt(currentPage) + 1;

        // Skip specified pages
        const skipPages = [2, 3, 4, 8, 9, 10, 12];
        while (skipPages.includes(newPage)) {
            newPage++;
        }
        if (newPage === 397) {
            if (parseInt(currentPage) === 396) {
                updatePage(parseInt(newPage), null, null, 'next', 1);
                return setSelectedApp(parseInt(1));
            }
            if (selectedApp && selectedApp !== 38) {
                setSelectedAppendix(parseInt(selectedApp) + 1);
            }
        } else {
            updatePage(parseInt(newPage), null, null, 'next', selectedApp);
        }
    };

    const prevPage = useCallback(() => {
        if (pageHistory.length > 0) {
            const lastHistoryItem = pageHistory.pop();
            setPageHistory([...pageHistory]);

            // Restore the page, sura, and verse from the history
            setCurrentPage(lastHistoryItem.page);
            setSelectedSura(lastHistoryItem.sura);
            setSelectedVerse(lastHistoryItem.verse);

            restoreAppText.current = lastHistoryItem.actionType === 'fromAppendix';

            if (lastHistoryItem.page === 397) {
                if (pageHistory[pageHistory.length - 1]) {
                    setSelectedApp(parseInt(pageHistory[pageHistory.length - 1].appReference));
                }
            }
        } else {
            // Default back navigation without history
            let newPage = parseInt(currentPage) > 1 ? parseInt(currentPage) - 1 : parseInt(currentPage);
            updatePage(newPage, null, null, 'previous');
        }
    }, [currentPage, pageHistory, updatePage]);


    const createReferenceMap = () => {
        const referenceMap = {};

        Object.entries(quranData).forEach(([pageNumber, value]) => {
            // Ensure that pageValues is an array
            const pageValues = Array.isArray(value.page) ? value.page : [value.page];
            const suraVersePattern = /\d+:\d+-?(\d+)?/g;
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
            updatePage(13, null, null, currentPage === 397 ? 'fromAppendix' : 'relationClick', currentPage === 397 ? selectedApp : null);
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
            let act = magnifyConfirm.current === true ? 'navigate' : 'relationClick';
            if (parseInt(currentPage) < 23) {
                act = 'fromIntro';
            } else if (parseInt(currentPage) > 396) {
                act = 'fromAppendix';
            }
            updatePage(foundPageNumber, sura, verseStart + '', act, currentPage === 397 ? selectedApp : null);
        } else {
            Toast.show({
                text: translationApplication.refNotFound,
            });
        }
        magnifyConfirm.current = false;
    };

    const handleClickAppReference = (inp) => {
        const number = parseInt(inp);
        if (number > 0 && number < 39) {
            setSelectedApp(number);
            updatePage(397, null, null, 'openAppendix', number);
        }
    };

    const parseReferences = (text) => {
        const verseRegex = /(\d+:\d+(?:-\d+)?)/g;
        const app = translation ? translationApplication.appendix : translationApplication.appendix + "?";
        const intro = translationApplication.intro;
        const appendixRegex = new RegExp(`${app}`, 'g');
        const introRegex = new RegExp(`${intro}`, 'gi');

        const replaceAppendixNumbers = (part) => {
            return part.split(/(\d+)/).map((segment, index) => {
                if (/\d+/.test(segment)) {
                    return (
                        <span key={index} className="cursor-pointer text-sky-500" onClick={() => handleClickAppReference(segment)}>
                            {segment}
                        </span>
                    );
                } else {
                    return segment;
                }
            });
        };

        const splitted = text.split(/(\S+\s*)/).filter(part => part.length > 0)

        let processingAppendix = false;

        const result = splitted.map((part, i) => {
            if (part.match(appendixRegex)) {
                processingAppendix = true;
                return part;
            }

            if (processingAppendix) {
                if (part.match(/\d+/)) {
                    if (part.includes('.')) {
                        processingAppendix = false;
                    }
                    return replaceAppendixNumbers(part);
                } else if (['&', translationApplication.and].includes(part.trim())) {
                    return part;
                } else {
                    processingAppendix = false;
                }
            }

            if (part.match(verseRegex)) {

                const matches = [...part.matchAll(verseRegex)];
                let lastIndex = 0;
                const elements = [];

                matches.forEach((match, index) => {
                    elements.push(part.slice(lastIndex, match.index));
                    const reference = (splitted[i - 2] && !splitted[i - 2].match(/\d+/) ? splitted[i - 2] : " ") + "" + splitted[i - 1]
                    let oldscripture = false
                    //TODO: give outer references for old oldscripture
                    if (reference && !reference.match(/\d+/)) {
                        if (reference.includes(translationApplication.acts) ||
                            reference.includes(translationApplication.isaiah) ||
                            reference.includes(translationApplication.john) ||
                            reference.includes(translationApplication.mark) ||
                            reference.includes(translationApplication.luke) ||
                            reference.includes(translationApplication.matthew) ||
                            reference.includes(translationApplication.romans) ||
                            reference.includes(translationApplication.malachi) ||
                            reference.includes(translationApplication.deuteronomy)) {

                            oldscripture = true;
                        } else if (reference.toLowerCase().includes(translationApplication.quran.toLocaleLowerCase(lang))) {
                            oldscripture = false;
                        }
                    }

                    if (oldscripture) {
                        elements.push(match[0]);
                    } else {
                        elements.push(
                            <span key={index} className="cursor-pointer text-sky-500" onClick={() => handleClickReference(match[0])}>
                                {match[0]}
                            </span>
                        );
                    }


                    lastIndex = match.index + match[0].length;
                });

                elements.push(part.slice(lastIndex));
                return elements;
            }

            if (introRegex.test(part)) {
                const segments = part.split(introRegex);
                const elements = [];
                segments.forEach((segment, index) => {
                    elements.push(segment);

                    if (index < segments.length - 1) {
                        elements.push(
                            <span key={index} className={`cursor-pointer text-sky-500`} onClick={() => handleClickReference("Introduction")}>
                                {translationApplication?.intro}
                            </span>
                        );
                    }
                });

                return elements;
            } else {
                return part;
            }
        });

        return result;
    };

    useEffect(() => {
        // Async function to add the back button listener
        const addBackButtonListener = async () => {
            const listener = await App.addListener('backButton', async () => {
                if (!backButtonPressedOnce) {
                    setBackButtonPressedOnce(true);
                    if (isModalOpen) {
                        setModalOpen(false);
                    } else {
                        prevPage();
                    }
                    setSearchOpen(false);
                    await Toast.show({
                        text: translationApplication.exitToast,
                    });
                    setTimeout(() => setBackButtonPressedOnce(false), 2000);
                } else {
                    App.exitApp();
                }
            });

            // Return a cleanup function
            return () => {
                listener.remove();
            };
        };

        // Call the async function to add the listener
        let removeListener;
        addBackButtonListener().then(remove => {
            removeListener = remove;
        });

        // Cleanup the listener when the component unmounts
        return () => {
            if (removeListener) {
                removeListener();
            }
        };
    }, [backButtonPressedOnce, isModalOpen, translationApplication, prevPage]);

    const onMagnify = () => {
        setSearchOpen(true);
        setModalOpen(false);
    };

    const renderTable = (tableData) => {
        const tableRef = tableData.ref;
        const columnCount = tableData.title.length;
        const rows = [];

        for (let i = 0; i < tableData.values.length; i += columnCount) {
            rows.push(tableData.values.slice(i, i + columnCount));
        }

        return (
            <div
                key={`${tableData.title}`}
                className={`w-full flex flex-col ${colors[theme]["table-title-text"]}`}>
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

        if (parseInt(currentPage) === 1) {
            return <Splash bookContent={bookContent} currentPage={currentPage} colors={colors} theme={theme} />;
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
                        <div
                            key={`each-title-${key}`}
                            className={`${colors[theme]["app-text"]} w-full flex justify-between`} >
                            <div className={`p-3 w-1/6 flex justify-center text-center`}>{no}</div>
                            <div className={`p-3 w-full flex justify-center`}>{name}</div>
                            <div className={`p-3 w-1/6 flex justify-center text-center`}>{arabic}</div>
                        </div>
                    );
                } else {
                    return (
                        <div
                            onClick={() => updatePage(parseInt(page) + 22)}
                            key={`each-key-${key}`}
                            className={`flex w-full justify-between mb-2`}>
                            <div className={`font-semibold rounded m-0.5 ${colors[theme]["text-background"]} w-1/6 text-lg flex items-center justify-center`}>
                                <p className={``} key={key + no}>{no}</p>
                            </div>
                            <div className={`m-0.5 ring-1 ${colors[theme]["ring"]} text-lg flex justify-between ${colors[theme]["base-background"]} w-full rounded `}>
                                <div className={`rounded-l px-1 py-1.5 text-left`}>
                                    <p className={``} key={key + name + no}>{name}</p>
                                </div>
                                <div className={`rounded-r px-1 py-1.5 text-right`}>
                                    <p className={``} key={key + arabic}>{arabic}</p>
                                </div>
                            </div>
                            <div className={`rounded px-2 py-1 m-0.5 ${colors[theme]["text-background"]} w-1/6 text-base flex items-center justify-center`}>
                                <p className={``} key={key + versecount}>{versecount}</p>
                            </div>
                        </div>
                    );
                }
            });

            return (
                <div
                    key={`title-of-suras}`}
                    className={`w-screen h-screen flex flex-col overflow-auto ${colors[theme]["app-text"]}`}>
                    <div className={`w-full p-3`}>
                        <div className={`w-full flex items-center justify-center text-center ${colors[theme]["base-background"]} rounded p-2 font-semibold ${colors[theme]["app-text"]} text-2xl `}>
                            <h2>{cpd.titles["1"]}</h2>
                        </div>
                    </div>
                    {renderedContent}
                </div>
            );
        }

        if (parseInt(currentPage) >= 23 && parseInt(currentPage) <= 394) {
            return <Pages
                colors={colors}
                theme={theme}
                translationApplication={translationApplication}
                map={map}
                quranData={quranData}
                translation={translation}
                actionType={action}
                selectedPage={currentPage}
                selectedSura={selectedSura}
                selectedVerse={selectedVerse}
                setSelectedSura={setSelectedSura}
                setSelectedVerse={setSelectedVerse}
                handleClickReference={handleClickReference}
                handleClickAppReference={handleClickAppReference}
                handleTogglePage={handleTogglePage}
                path={path}
            />;
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

            const handleAppClick = (no) => {
                setSelectedApp(no)
                updatePage(397, null, null, 'openAppendix', no);
            };

            const content = cpd.evidence["2"].lines;
            const renderedContent = Object.entries(content).map(([key, value]) => {
                const elements = value.split(".").filter(element => element);
                if (parseInt(key) === 1) {
                    const titles = elements[0].split(" ").filter(element => element);
                    return (
                        <div className={`${colors[theme]["app-text"]} text-3xl w-full flex justify-center`} key={key}>
                            <div className={`p-3`}>{titles[0]}</div>
                        </div>
                    );
                } else {
                    return (
                        <div
                            key={key}
                            onClick={() => handleAppClick(parseInt(elements[0]))}
                            className={`flex w-full justify-between text-lg`}>
                            <div className={`font-semibold rounded p-3 m-1 ${colors[theme]["base-background"]} w-16 flex items-center justify-center`}>
                                <p className={``} >{elements[0]}</p>
                            </div>
                            <div key={key} className={`rounded p-3 my-1 mr-1 ${colors[theme]["text-background"]} w-full flex items-center`}>
                                <p className={``} >{elements[1]}</p>
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

        if (parseInt(currentPage) > 396) {
            return <Apps
                colors={colors}
                theme={theme}
                translationApplication={translationApplication}
                parseReferences={parseReferences}
                appendices={appendicesContent}
                selected={selectedApp}
                restoreAppText={restoreAppText}
                refToRestore={refToRestore}
            />;
        }


        const combinedContent = [];

        const currentPageData = bookContent ? bookContent.find(iterator => iterator.page === currentPage) : null;


        if (!currentPageData || !currentPageData.titles) {
            return <div className={`${colors[theme]["log-text"]} flex flex-1 items-center justify-center w-full text-xl`}>
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
                const bsml = translationApplication.bsml.toLocaleLowerCase(lang);
                const hasBesmele = item.content.toLocaleLowerCase(lang).search(bsml) !== -1;

                return (
                    <div
                        key={`title-${index}`}
                        className={hasBesmele ? `select-none w-full my-3 py-1.5 px-2.5 text-neutral-900 rounded text-base md:text-lg lg:text-xl bg-gradient-to-r from-cyan-300 to-sky-500 besmele` : `select-text w-full flex items-center justify-center text-center p-2 font-semibold ${colors[theme]["app-text"]}  whitespace-pre-line ${item.order === 0 ? "text-3xl font-bold" : " text-lg"}`}>
                        <h2>{item.content}</h2>
                    </div>
                );
            } else if (item.type === 'text') {
                return (
                    <div
                        lang={lang}
                        key={`text-${index}`}
                        className={`select-text rounded ${colors[theme]["text-background"]} ${colors[theme]["app-text"]} p-1.5 mb-1.5 flex w-full justify-center hyphens-auto `}>
                        <p className={`px-1`}>{parseReferences(item.content)}</p>
                    </div>
                );
            } else if (item.type === 'evidence') {
                // SPECIAL RENDER 1
                if (item.content.special && item.content.special.key === 1) {
                    const data = item.content.special.data;
                    return (
                        <div
                            key={`special-1-${index}`}
                            className={`w-full flex flex-col flex-1 my-3 `}>
                            <div className={`w-full px-1.5`}>
                                <div className={`bg-gray-100 text-gray-700 rounded  text-sm md:text-base border border-gray-700 flex justify-between w-full items-stretch `}>
                                    <div className={`relative text-gray-100 bg-gray-700 w-[11%] flex flex-wrap `}>
                                        {/* Render SVGs for index 0 in this div */}
                                        {Object.entries(data).map(([key, value]) => {
                                            if (parseInt(key) === 0) {
                                                return Array.from({ length: value }, (_, i) => (
                                                    <div key={`prevman-${i}`} className={`p-0.5`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3 h-3 md:h-5 md:w-5 lg:h-6 lg:w-6`}>
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
                                                    <div key={`futureman-${i}`} className={`p-0.5`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={` w-3 h-3 md:h-5 md:w-5 lg:h-6 lg:w-6`}>
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
                            </div>
                            <div className={`w-full flex flex-col rounded border border-gray-700 p-1`}>
                                <div className={`w-full flex items-center justify-between`}>
                                    <div className={`w-7 h-7 rounded bg-gray-100 border border-gray-300 `}>

                                    </div>
                                    <div className={`flex ml-1 w-full text-sm`}>
                                        {item.content.lines["1"]}
                                    </div>
                                </div>
                                <div className={`w-full flex items-center justify-between mt-1`}>
                                    <div className={`w-7 h-7 rounded bg-gray-700 border border-gray-300 `}>
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
                        <div
                            key={`special-2-${index}`}
                            className={`w-full flex flex-col flex-1 my-3`}>
                            <div className={` text-gray-700 rounded  text-sm md:text-base border border-gray-950 flex justify-between w-full items-stretch`}>
                                <div className={`relative w-full bg-gray-100 flex flex-wrap justify-center p-2 text-gray-700 rounded-l`}>
                                    {item.content.lines["1"]}
                                </div>
                                <div className={`relative bg-gray-500 w-[3%] flex flex-wrap py-2 rounded-r`}>
                                </div>
                            </div>
                            <div className={`w-full flex justify-end py-0.5`}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25L12 21m0 0l-3.75-3.75M12 21V3" />
                                </svg>
                            </div>
                            <div key={`special-2-${index + 1}`}
                                className={` text-gray-700 rounded  text-sm md:text-base border border-gray-950 flex justify-between w-full items-stretch`}>
                                <div className={`relative w-full bg-gray-500 flex flex-wrap justify-center p-2 text-gray-200 rounded-l`}>
                                    {item.content.lines["2"]}
                                </div>
                                <div className={`relative bg-gray-900 w-[3%] flex flex-wrap py-2 rounded-r`}>

                                </div>
                            </div>
                        </div>
                    );
                }
                return (
                    <div
                        key={`evidence-${index}`}
                        className={`${colors[theme]["base-background"]} ${colors[theme]["table-title-text"]} rounded  text-base md:text-xl p-3 border my-3 ${colors[theme]["border"]}`}>
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
                    <div
                        key={`picture-${index}`}
                        className={` flex flex-col flex-1 items-center justify-center w-full px-1`}>
                        <div className={`rounded  flex justify-center`}>

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
            <div key={`content-${currentPage}-${lang}`} ref={contentRef} className={`${colors[theme]["text"]} overflow-auto flex-1 p-1.5 text-justify lg:text-start text-lg md:text-xl lg:text-2xl`}>
                {renderContent}
            </div>
        );
    };

    return (
        <div className={`fixed flex w-full flex-col justify-start h-screen ${colors[theme]["app-background"]} overflow-y-hidden`}
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {renderBookContent()}
            <div>
                <div className=" h-14 md:h-20"></div>
                <div className={`w-full flex z-40 ${colors[theme]["app-background"]} fixed bottom-0`}
                    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                    <div className={`flex w-full items-center justify-between`}>

                        <button onClick={prevPage}
                            disabled={(isModalOpen || currentPage === 1 || isSearchOpen)}
                            className={`w-1/2 h-full ${colors[theme]["app-text"]} px-2 mr-2 flex items-center justify-center transition-all duration-500 ease-linear ${(isModalOpen || currentPage === 1 || isSearchOpen) ? "opacity-0" : "opacity-100"} `}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7 lg:w-12 lg:h-12`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                            </svg>
                            {pageHistory.length > 0 && (
                                <div className={`bg-transparent absolute translate-y-3 -translate-x-3 text-xs lg:translate-y-4 lg:-translate-x-4 lg:text-base ${colors[theme]["matching-text"]} flex items-center justify-center px-2 py-1 rounded-full`}>
                                    {pageHistory.length}
                                </div>
                            )}

                        </button>

                        <div
                            className={`w-full flex items-center ${colors[theme]["page-text"]} justify-center p-0.5`}>
                            {
                                isModalOpen ?

                                    (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-11 h-11 lg:w-14 lg:h-14 transition-all duration-1000 ease-linear ${colors[theme]["text"]}`} onClick={() => handleTogglePage()}>
                                        <path fillRule="evenodd" d="M3 6a3 3 0 0 1 3-3h2.25a3 3 0 0 1 3 3v2.25a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm9.75 0a3 3 0 0 1 3-3H18a3 3 0 0 1 3 3v2.25a3 3 0 0 1-3 3h-2.25a3 3 0 0 1-3-3V6ZM3 15.75a3 3 0 0 1 3-3h2.25a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2.25Zm9.75 0a3 3 0 0 1 3-3H18a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3h-2.25a3 3 0 0 1-3-3v-2.25Z" clipRule="evenodd" />
                                    </svg>) :
                                    (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-11 h-11 lg:w-14 lg:h-14 transition-all duration-1000 ease-linear `} onClick={() => handleTogglePage()}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                                    </svg>)
                            }

                            {!isSearchOpen && (parseInt(currentPage) < 397 ?
                                (<div className={`text-sm lg:text-lg flex transition-all duration-300 ease-linear ${isModalOpen ? "opacity-0 w-0" : "opacity-100 ml-3 p-1 "}`}>
                                    <div className={`font-bold text-center flex items-center justify-center ${colors[theme]["page-text"]}`}>
                                        {translationApplication?.page}
                                    </div>
                                    <select
                                        value={currentPage}
                                        onChange={(e) => setCurrentPage(parseInt(e.target.value))}
                                        className={`flex rounded ${colors[theme]["app-background"]} ${colors[theme]["page-text"]} text-base py-2 pr-0.5 text-right focus:outline-none focus:ring-2 focus:border-sky-500 focus:ring-sky-500`}
                                    >
                                        {pages.map((page, index) => (
                                            <option key={index} value={page}>
                                                {page}
                                            </option>
                                        ))}
                                    </select>
                                </div>) :
                                (<div
                                    onClick={() => document.getElementById('appselect').click()}
                                    className={`text-2xl lg:text-3xl xl:text-4xl flex transition-all duration-300 ease-linear ${isModalOpen ? "opacity-0 w-0" : "opacity-100 ml-3 p-1 "}`}>
                                    <div
                                        className={`text-center flex items-center justify-center ${colors[theme]["page-text"]}`}>
                                        {translationApplication?.appendix}
                                    </div>
                                    <select
                                        id="appselect"
                                        name="appselect"
                                        value={selectedApp}
                                        onChange={(e) => setSelectedAppendix(e.target.value)}
                                        onFocus={() => setSelectOpen(true)}
                                        onBlur={() => setSelectOpen(false)}
                                        className={`flex w-12 lg:w-14 pt-0.5 md:pt-1 whitespace-pre-line rounded ${colors[theme]["app-background"]} ${colors[theme]["page-text"]} text-2xl pr-0.5 text-right focus:outline-none focus:ring-2 focus:border-sky-500 focus:ring-sky-500`}
                                    >
                                        {appendices.map((appendix, index) => (
                                            <option key={index} value={appendix.number}>
                                                {selectOpen ? `${appendix.number}\t${appendix.title}` : appendix.number}
                                            </option>
                                        ))}
                                    </select>
                                </div>))}
                        </div>
                        <button onClick={nextPage}
                            disabled={(isModalOpen || (selectedApp === 38 && currentPage === 397) || isSearchOpen)}
                            className={`w-1/2 h-full ${colors[theme]["app-text"]} px-2 ml-2 flex items-center justify-center transition-all duration-500 ease-linear ${(isModalOpen || (selectedApp === 38 && currentPage === 397) || isSearchOpen) ? "opacity-0" : "opacity-100"}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7 lg:w-12 lg:h-12`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            {isModalOpen &&
                <Jump
                    onChangeLanguage={onChangeLanguage}
                    suraNames={introductionContent[introductionContent.length - 1].evidence["2"].lines}
                    onChangeTheme={onChangeTheme}
                    colors={colors} theme={theme}
                    translationApplication={translationApplication}
                    currentPage={currentPage}
                    quran={translation ? translation : quranData}
                    onClose={handleCloseModal}
                    onConfirm={handleJump}
                    onMagnify={onMagnify}
                />
            }
            {isSearchOpen &&
                <Magnify
                    colors={colors}
                    theme={theme}
                    translationApplication={translationApplication}
                    currentPage={currentPage}
                    quran={translation ? translation : quranData}
                    map={map}
                    onClose={handleCloseSearch}
                    onConfirm={handleMagnifyConfirm}
                />
            }
        </div>
    );
};

export default Book;
