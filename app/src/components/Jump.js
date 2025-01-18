import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import languages from '../assets/languages.json';
import { getRandom } from '../utils/Generator';
import { adjustReference } from '../utils/Mapper';
import { isNative } from '../utils/Device';
import { ColorPicker, FontPicker } from '../utils/Theme';
import Bookmarks from '../utils/Bookmarks';

const languageDisabilityThreshold = 60;

const Jump = React.memo(({ onChangeLanguage, suraNames, onChangeFont, font, onChangeColor, colors, theme, translationApplication, currentPage, quran, onClose, onConfirm, onMagnify, direction, isMagnifyVisited }) => {
    const [suraNumber, setSuraNumber] = useState("0");
    const [verseNumber, setVerseNumber] = useState("0");
    const [selectedPage, setSelectedPage] = useState(currentPage);
    const [showThemes, setShowThemes] = useState(false);
    const [showBookmarks, setShowBookmarks] = useState(false);
    const [lightOpen, setLightOpen] = useState(false);
    const isMobile = isNative() | false;

    const [isShufflingSura, setIsShufflingSura] = useState(false);
    const [isShufflingVerse, setIsShufflingVerse] = useState(false);

    const bookmarksContainerRef = useRef(null);
    const bookmarkItemRefs = useRef({});
    const [bookmarksList, setBookmarksList] = useState([]);
    const [lastClickedBookmarkKey, setLastClickedBookmarkKey] = useState(null);
    const [isBookmarkHighlighted, setIsBookmarkHighlighted] = useState(false);

    const updateBookmark = useCallback((key, val) => {
        Bookmarks.set(key, val);
    }, []);

    const updateBookmarksList = () => {
        const allBookmarks = Bookmarks.all();
        setBookmarksList(Object.entries(allBookmarks).reverse());
    };

    useEffect(() => {
        updateBookmarksList();

        const handleStorageEvent = (event) => {
            if (event.key === 'bookmarks') {
                updateBookmarksList();
            }
        };

        window.addEventListener('storage', handleStorageEvent);

        return () => {
            window.removeEventListener('storage', handleStorageEvent);
        };
    }, []);

    // Load last clicked bookmark on initial render
    useEffect(() => {
        const savedBookmarkKey = sessionStorage.getItem('qurantft-lcb');
        if (savedBookmarkKey) {
            setLastClickedBookmarkKey(savedBookmarkKey);
            setIsBookmarkHighlighted(true);
        }
    }, []);

    useEffect(() => {
        if (showBookmarks && bookmarksContainerRef.current && lastClickedBookmarkKey && bookmarkItemRefs.current[lastClickedBookmarkKey]) {
            bookmarkItemRefs.current[lastClickedBookmarkKey].scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
            const highlightTimer = setTimeout(() => {
                setIsBookmarkHighlighted(false);
                setLastClickedBookmarkKey(null);
                sessionStorage.removeItem('qurantft-lcb');
            }, 3800);
            return () => clearTimeout(highlightTimer);
        }
    }, [lastClickedBookmarkKey, bookmarksContainerRef, showBookmarks]);

    // Compute suraNameMap using useMemo
    const suraNameMap = useMemo(() => {
        const themap = {};
        if (suraNames) {
            Object.entries(suraNames).forEach(([key, value]) => {
                if (key > 0) {
                    const vals = value.split('.').filter((e) => e.trim());
                    if (vals.length > 5) {
                        themap[key] = `${vals[1].trim()}.${vals[2]}. (${vals[3].trim()})`;
                    } else {
                        themap[key] = `${vals[1].trim()} (${vals[2].trim()})`;
                    }
                }
            });
        }
        return themap;
    }, [suraNames]);

    // Compute other derived data using useMemo
    const { pageTitles, versesInSuras, pageForSuraVerse, surasInPagesMap } = useMemo(() => {
        const surasInPagesMap = {};
        const versesInSurasMap = {};
        const pageForSuraVerseMap = {};
        const newPageTitles = {};

        Object.entries(quran).forEach(([page, data]) => {
            surasInPagesMap[page] = Object.keys(data.sura);
            data.page.forEach((info) => {
                if (info.includes(':')) {
                    newPageTitles[page] = info.split('&');
                }
            });

            Object.entries(data.sura).forEach(([sura, suraData]) => {
                versesInSurasMap[sura] = versesInSurasMap[sura] || [];
                pageForSuraVerseMap[sura] = pageForSuraVerseMap[sura] || {};

                Object.keys(suraData.verses).forEach((verse) => {
                    if (!versesInSurasMap[sura].includes(verse)) {
                        const hasTitle = parseInt(verse) !== 1 ? suraData.titles[verse] ? suraData.titles[verse] : null : null;
                        versesInSurasMap[sura].push([verse, hasTitle]);
                    }
                    pageForSuraVerseMap[sura][verse] = page;
                });
            });
        });

        return {
            pageTitles: newPageTitles,
            versesInSuras: versesInSurasMap,
            pageForSuraVerse: pageForSuraVerseMap,
            surasInPagesMap,
        };
    }, [quran]);

    // Initialize suraNumber and verseNumber based on currentPage
    useEffect(() => {
        setSelectedPage(currentPage);

        if (surasInPagesMap[currentPage] && pageForSuraVerse) {
            const initialSura = surasInPagesMap[currentPage][0];
            setSuraNumber(initialSura);

            const versesForSura = pageForSuraVerse[initialSura];
            for (const [verseKey, pageValue] of Object.entries(versesForSura)) {
                if (parseInt(pageValue) === parseInt(currentPage)) {
                    setVerseNumber(verseKey);
                    break;
                }
            }
        }
    }, [currentPage, surasInPagesMap, pageForSuraVerse]);

    const shuffleSuraVerse = useCallback(() => {
        const randomVerse = getRandom();
        let verseIndex = randomVerse;
        let ns = 0;
        let nv = 0;
        for (const s of Object.keys(versesInSuras)) {
            if (verseIndex - versesInSuras[s].length <= 0) {
                ns = parseInt(s, 10);
                nv = verseIndex;
                break;
            } else {
                verseIndex -= versesInSuras[s].length;
            }
        }

        setIsShufflingSura(true);
        setSuraNumber('0');
        setVerseNumber('0');
        setLightOpen(false);
        setTimeout(() => {
            setSuraNumber(ns.toString());
            setIsShufflingSura(false);
            setTimeout(() => {
                setIsShufflingVerse(true);
                setTimeout(() => {
                    setVerseNumber(nv.toString());
                    setIsShufflingVerse(false);

                    if (pageForSuraVerse[ns] && pageForSuraVerse[ns][nv]) {
                        setSelectedPage(pageForSuraVerse[ns][nv]);
                    }
                    setLightOpen(true);
                }, 209);
            }, 76);
        }, 209);
    }, [versesInSuras, pageForSuraVerse]);

    const handleSuraChange = useCallback(
        (e) => {
            const newSuraNumber = e.target.value;
            setSuraNumber(newSuraNumber);
            setVerseNumber('0');
            setLightOpen(false);
            const firstVerseOfSura = versesInSuras[newSuraNumber][0][0];
            if (firstVerseOfSura && pageForSuraVerse[newSuraNumber][firstVerseOfSura]) {
                setSelectedPage(pageForSuraVerse[newSuraNumber][firstVerseOfSura]);
            }
        },
        [versesInSuras, pageForSuraVerse]
    );

    const handleVerseChange = useCallback(
        (e) => {
            setLightOpen(true);
            const newVerseNumber = e.target.value;
            setVerseNumber(newVerseNumber);

            if (pageForSuraVerse[suraNumber] && pageForSuraVerse[suraNumber][newVerseNumber]) {
                setSelectedPage(pageForSuraVerse[suraNumber][newVerseNumber]);
            }
        },
        [suraNumber, pageForSuraVerse]
    );

    const handleSubmit = useCallback(() => {
        onConfirm(selectedPage, suraNumber, verseNumber ? verseNumber !== '0' ? verseNumber : '1' :'1');
        onClose();
    }, [onConfirm, onClose, selectedPage, suraNumber, verseNumber]);

    const handleMarkJump = useCallback(
        (key) => {
            const [sno, vno] = key.trim().split(':');
            if (pageForSuraVerse[sno] && pageForSuraVerse[sno][vno]) {
                onConfirm(pageForSuraVerse[sno][vno], sno, vno);
            }
            setLastClickedBookmarkKey(key);
            sessionStorage.setItem('qurantft-lcb', key);
            setShowBookmarks(false);
            onClose();
        },
        [pageForSuraVerse, onConfirm, onClose]
    );

    const goIntro = useCallback(() => {
        onConfirm('13');
        onClose();
    }, [onConfirm, onClose]);

    const goApps = useCallback(() => {
        onConfirm('396');
        onClose();
    }, [onConfirm, onClose]);

    const toggleThemeView = useCallback(() => {
        if (!showThemes) {
            setShowBookmarks(false);
        }
        setShowThemes((prev) => !prev);
    }, [showThemes]);

    const toggleBookmark = useCallback(() => {
        if (!showBookmarks) {
            setShowThemes(false);
            updateBookmarksList();
        }
        setShowBookmarks((prev) => !prev);
    }, [showBookmarks]);

    const handleLanguageChange = useCallback(
        (e) => {
            onChangeLanguage(e.target.value);

            if(!isMagnifyVisited) {
                onClose();
            }
        },
        [onChangeLanguage, onClose, isMagnifyVisited]
    );

    return (
        <div className={`w-screen h-full fixed left-0 top-0 inset-0 z-10 outline-none focus:outline-none `} id="jump-screen">
            <div className={` w-full h-full backdrop-blur-xl flex items-center justify-center `}>
                <div className={`w-full fixed top-14 flex justify-between ${colors[theme]["app-text"]} mb-2 -z-10 `}>
                    <div className={`w-full flex justify-end place-self-end pr-3`}>
                        <button className={`flex justify-center`} onClick={onClose}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-14 h-14`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className={`w-full md:w-2/3 lg:w-1/2 2xl:w-1/3 fixed bottom-12 md:bottom-16 flex justify-center -z-10`}
                    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                    <select
                        id="languagepicker"
                        name="langpick"
                        onChange={handleLanguageChange}
                        value={localStorage.getItem("lang")}
                        className={`w-full m-2 text-center rounded px-4 py-2 border border-neutral-400/40 text-lg brightness-80 bg-neutral-500/30 ${colors[theme]["page-text"]} focus:outline-none focus:ring-2 focus:border-sky-500 focus:ring-sky-500`}>
                        {Object.keys(languages).map((key) => {
                            if (key && languages[key]["comp"] >= languageDisabilityThreshold) {
                                return (
                                    <option dir={languages[key]["dir"]} key={key} value={key}>
                                        {languages[key]["name"]}
                                    </option>
                                );
                            }
                            return null;
                        })}
                    </select>
                </div>
                <div className={` w-full md:w-2/3 lg:w-1/2 2xl:w-1/3 px-2 flex flex-col transition-all duration-200 ease-linear mb-7 `}>
                    <div className={`shadow-[rgba(125,211,252,0.4)_0px_2px_10px_10px] transition-colors duration-200 ease-linear flex flex-col items-center justify-center ${colors[theme]["app-background"]} rounded  w-full `}>
                        <div className={`w-full pt-2`}>
                            <div className={`w-full flex space-x-2 px-2`}>
                                <div
                                    onClick={onMagnify}
                                    dir={direction}
                                    className={`w-3/4 flex justify-center ${colors[theme]["text"]} rounded p-2 ${colors[theme]["text-background"]} cursor-pointer`}>
                                    <button className={`flex justify-center`} >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-14 h-14`}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                                        </svg>
                                    </button>
                                    <div className={`flex items-center ml-3 font-semibold ${colors[theme]["matching-text"]} text-xl`}>
                                        {translationApplication.search}<span className={`${colors[theme]["text"]}`}>{"..."}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={toggleBookmark}
                                    className={`flex flex-col w-1/3 items-center justify-between pt-2 rounded ${colors[theme]["text"]} ${colors[theme]["text-background"]}`}>
                                    <div className={`flex justify-center`}>
                                        {showBookmarks ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-11 h-11`}>
                                                <path fillRule="evenodd" d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6Zm1.5 1.5a.75.75 0 0 0-.75.75V16.5a.75.75 0 0 0 1.085.67L12 15.089l4.165 2.083a.75.75 0 0 0 1.085-.671V5.25a.75.75 0 0 0-.75-.75h-9Z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-11 h-11`}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75h1.5m9 0h-9" />
                                            </svg>

                                        )}
                                    </div>
                                    <div className={`flex ${colors[theme]["page-text"]} text-sm items-center justify-center pb-2`}>
                                        {translationApplication?.bookmark}
                                    </div>
                                </button>
                            </div>
                        </div>
                        <div className={`w-full`}>
                            {showBookmarks ?
                                (
                                    <div
                                        ref={bookmarksContainerRef}
                                        className={`md:h-80 lg:h-96 h-72 m-2 px-1 py-1 text-base rounded ${colors[theme]["relation-background"]} overflow-y-auto overflow-x-hidden`}>
                                        {bookmarksList.map(([key, val]) => (
                                            <div key={key}
                                                ref={(el) => (bookmarkItemRefs.current[key] = el)}
                                                className={`bookmark-entry flex py-1 space-x-1 mb-1.5 border-b ${lastClickedBookmarkKey === key && isBookmarkHighlighted
                                                    ? `${colors[theme]['matching-border']} animate-pulse`
                                                    : `${colors[theme]['verse-border']}`}`}>
                                                <div className={`w-full ${colors[theme]["page-text"]} flex items-center justify-center`}>
                                                    <input
                                                        type="text"
                                                        dir={direction}
                                                        defaultValue={Bookmarks.format(val)}
                                                        onBlur={(e) => {
                                                            updateBookmark(key, e.target.value);
                                                        }}
                                                        className={`w-full rounded text-lg p-2.5 ${colors[theme]["text"]} bg-transparent/20 text-center focus:outline-none focus:ring-2 focus:border-sky-500 focus:ring-sky-500`}
                                                    />
                                                </div>
                                                <div
                                                    onClick={() => handleMarkJump(key)}
                                                    className={`w-24 text-lg rounded px-2 ${colors[theme]["base-background"]} shadow-lg text-sky-500 flex items-center justify-center`}>
                                                    {key}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : showThemes ? (
                                    <div className={`flex flex-col items-center justify-center h-48 m-2`}>
                                        <div className={`flex items-center h-full w-full space-x-2`}>
                                            <div className={`flex flex-col justify-center ${colors[theme]["notes-background"]} rounded h-full w-full px-2`}>
                                                <div>
                                                    <ColorPicker
                                                        theme={theme}
                                                        colors={colors}
                                                        onChangeColor={onChangeColor} />
                                                </div>
                                            </div>
                                            <div className={`flex flex-col justify-center ${colors[theme]["notes-background"]} rounded h-full w-1/4 px-2`}>
                                                <div>
                                                    <FontPicker
                                                        theme={theme}
                                                        colors={colors}
                                                        languages={languages}
                                                        lang={localStorage.getItem("lang")}
                                                        font={font}
                                                        onChangeFont={onChangeFont} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) :
                                    (
                                        <div>
                                            <div className={` w-full flex space-x-2 mt-2`}>
                                                <div className={`relative w-full flex justify-end`}>
                                                    <div
                                                        style={isShufflingSura ? { animation: 'animate-scale 0.2s ease-in-out' } : {}}
                                                        className={`text-3xl w-3/4 p-3 absolute shadow-md text-center rounded flex items-center justify-center ${colors[theme]["text"]} ${colors[theme]["notes-background"]}`}
                                                        onClick={() => document.getElementById('sura').click()}
                                                    >
                                                        {parseInt(suraNumber) !== 0 ? suraNumber : translationApplication?.sura}
                                                    </div>
                                                    {parseInt(suraNumber) !== 0 && <div className={`text-xs absolute bottom-0.5 right-1 ${colors[theme]["page-text"]} brightness-75`}>{translationApplication?.sura}</div>}
                                                    <select
                                                        id="sura"
                                                        name="sura"
                                                        dir={isMobile ? `ltr` : direction}
                                                        onChange={handleSuraChange}
                                                        value={suraNumber}
                                                        className={`inset-0 opacity-0 text-3xl w-3/4 p-3 rounded ${colors[theme]["text"]} ${colors[theme]["notes-background"]} focus:ring-2 focus:outline-none focus:ring-sky-500  `}
                                                    >
                                                        <option key="0" value="0" disabled>{translationApplication?.sura}</option>
                                                        {Object.entries(suraNameMap).map(([sura, sname]) => {
                                                            const line = direction === 'rtl' ? (isMobile ? sname + `\t` + sura : sura + `\t` + sname) : sura + `\t` + sname;
                                                            return (
                                                                <option key={sura} value={sura}>{line}</option>
                                                            )
                                                        })}
                                                    </select>
                                                </div>

                                                <div className={`relative w-1/3 flex items-center justify-center cursor-pointer ${colors[theme]["text"]}`} onClick={shuffleSuraVerse} >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-11 h-11 p-0.5`}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                                                    </svg>
                                                </div>
                                                <div className={`relative w-full flex justify-start`}>
                                                    <div
                                                        style={isShufflingVerse ? { animation: 'animate-scale 0.2s ease-in-out' } : {}}
                                                        className={`text-3xl w-3/4 p-3 absolute shadow-md text-center rounded flex items-center justify-center ${colors[theme]["text"]} ${colors[theme]["notes-background"]}`}
                                                        onClick={() => document.getElementById('verse').click()}
                                                    >
                                                        {parseInt(verseNumber) !== 0 ? verseNumber : translationApplication?.verse}
                                                    </div>
                                                    {parseInt(verseNumber) !== 0 && <div className={`text-xs absolute bottom-0.5 left-1 ${colors[theme]["page-text"]} brightness-75`}>{translationApplication?.verse}</div>}
                                                    <select
                                                        id="verse"
                                                        name="verse"
                                                        dir={isMobile ? `ltr` : direction}
                                                        onChange={handleVerseChange}
                                                        value={verseNumber}
                                                        className={`inset-0 opacity-0 text-3xl w-3/4 p-3 rounded ${colors[theme]["text"]} ${colors[theme]["notes-background"]} focus:ring-2 focus:outline-none focus:ring-sky-500`}>
                                                        <option key="0" value="0" disabled>{translationApplication?.verse}</option>
                                                        {suraNumber && versesInSuras[suraNumber] && versesInSuras[suraNumber].map(([verse, iftitle]) => {
                                                            const line = direction === 'rtl' ? (isMobile ? ((iftitle ? iftitle + `\t` : ``) + verse) : (verse + (iftitle ? `\t` + iftitle : ``))) : (verse + (iftitle ? `\t` + iftitle : ``));
                                                            return (
                                                                <option key={verse} value={verse}>{line}</option>
                                                            )
                                                        })}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className={`w-full p-2 ${colors[theme]["app-text"]} flex-1 `}>
                                                <div
                                                    dir={direction}
                                                    className={`w-full p-1`}>
                                                    <div className={`flex w-full ${colors[theme]["app-text"]} mb-4 text-sm`}>
                                                        {translationApplication?.page} {selectedPage}
                                                    </div>
                                                    {pageTitles[selectedPage] && pageTitles[selectedPage].map((title, index) => {
                                                        // Use a regex to match the three groups: name, Latin pronunciation, and page info
                                                        const titleRegex = /^(.*?)\s+\((.*?)\)\s+(.*)$/;
                                                        const match = title.match(titleRegex);

                                                        // If the title matches the expected format, render the groups
                                                        if (match) {
                                                            return (
                                                                <div key={index} className="flex justify-between w-full mt-1">
                                                                    <div className="w-full flex justify-between mr-0.5">
                                                                        <span className={`${direction === 'rtl' ? "text-right" : "text-left"} font-bold justify-self-center text-sky-500`}>{match[1]}</span>
                                                                        <span className={`${direction === 'rtl' ? "text-left" : "text-right"} text-nowrap`}>{`(${match[2]})`}</span>
                                                                    </div>
                                                                    <span className={`${direction === 'rtl' ? "text-left" : "text-right"} w-5/12 text-nowrap`}>{adjustReference(match[3])}</span>
                                                                </div>
                                                            );
                                                        } else {
                                                            // If the title doesn't match the expected format, split and render
                                                            const lastSpaceIndex = title.lastIndexOf(" ");
                                                            const namePart = title.substring(0, lastSpaceIndex);
                                                            const pageInfoPart = title.substring(lastSpaceIndex + 1);

                                                            return (
                                                                <div key={index} className="flex justify-between w-full">
                                                                    <span className={`${direction === 'rtl' ? "text-right" : "text-left"} flex-1 font-bold text-sky-500`}>{namePart}</span>
                                                                    <span className={`${direction === 'rtl' ? "text-left" : "text-right"} flex-1`}>{adjustReference(pageInfoPart)}</span>
                                                                </div>
                                                            );
                                                        }
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )
                            }
                        </div>
                        {!showBookmarks &&
                            <div className={`flex w-full justify-between items-center ${colors[theme]["text"]} space-x-2 px-2 pb-2 `}>
                                <button
                                    onClick={handleSubmit}
                                    className={`flex flex-col w-full items-center justify-between pt-1 rounded  transition-all delay-150 duration-700 ease-in-out ${lightOpen ? "bg-sky-500" : colors[theme]["text-background"]}`}>
                                    <div className={`flex justify-center transition-all delay-150 duration-700 ${lightOpen ? "text-neutral-50" : colors[theme]["text"]}`} >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-12 h-12 transition-all delay-150 duration-600 ease-in-out ${lightOpen ? "opacity-0" : "opacity-100"}`}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                                        </svg>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-12 h-12 absolute transition-all ease-in-out duration-400 ${lightOpen ? "opacity-100" : "opacity-0"}`}>
                                            <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
                                        </svg>
                                    </div>
                                    <div className={` flex text-sm items-center justify-center pb-1 transition-all delay-100 duration-700 ${lightOpen ? "text-neutral-50" : colors[theme]["page-text"]}`}>
                                        {translationApplication?.open}
                                    </div>
                                </button>
                                <button
                                    onClick={goIntro}
                                    className={`flex flex-col w-full items-center justify-between pt-2 rounded  ${colors[theme]["text-background"]}`}>
                                    <div className={`flex justify-center`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-12 h-12`}>
                                            <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm5.03 4.72a.75.75 0 010 1.06l-1.72 1.72h10.94a.75.75 0 010 1.5H10.81l1.72 1.72a.75.75 0 11-1.06 1.06l-3-3a.75.75 0 010-1.06l3-3a.75.75 0 011.06 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className={`flex ${colors[theme]["page-text"]} text-xs items-center justify-center pb-1`}>
                                        {translationApplication?.intro}
                                    </div>
                                </button>
                                <button
                                    onClick={goApps}
                                    className={`flex flex-col w-full items-center justify-between pt-2 rounded  ${colors[theme]["text-background"]}`}>
                                    <div className={`flex justify-center`} >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-12 h-12`}>
                                            <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className={`flex ${colors[theme]["page-text"]} text-xs items-center justify-center pb-1`}>
                                        {translationApplication?.appendices}
                                    </div>
                                </button>
                                <button
                                    onClick={toggleThemeView}
                                    className={`flex flex-col w-full items-center justify-between pt-1 rounded  ${colors[theme]["text-background"]}`}>
                                    <div className={`flex justify-center`} >
                                        {showThemes ?
                                            (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-12 h-12`}>
                                                <path fillRule="evenodd" d="M2.25 4.125c0-1.036.84-1.875 1.875-1.875h5.25c1.036 0 1.875.84 1.875 1.875V17.25a4.5 4.5 0 1 1-9 0V4.125Zm4.5 14.25a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25Z" clipRule="evenodd" />
                                                <path d="M10.719 21.75h9.156c1.036 0 1.875-.84 1.875-1.875v-5.25c0-1.036-.84-1.875-1.875-1.875h-.14l-8.742 8.743c-.09.089-.18.175-.274.257ZM12.738 17.625l6.474-6.474a1.875 1.875 0 0 0 0-2.651L15.5 4.787a1.875 1.875 0 0 0-2.651 0l-.1.099V17.25c0 .126-.003.251-.01.375Z" />
                                            </svg>
                                            ) :
                                            (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-12 h-12`}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
                                            </svg>
                                            )}
                                    </div>
                                    <div className={`flex ${colors[theme]["page-text"]} text-sm items-center justify-center pb-1`}>
                                        {translationApplication?.theme}
                                    </div>
                                </button>
                            </div>
                        }
                    </div>
                </div>
            </div>
        </div>
    );
});

export default Jump;
