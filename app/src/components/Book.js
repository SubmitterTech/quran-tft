import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { App } from '@capacitor/app';
import { Toast } from '@capacitor/toast';
import { Share } from '@capacitor/share';
import { Toaster, toast } from 'react-hot-toast';
import Pages from '../components/Pages';
import Apps from '../components/Apps';
import Jump from '../components/Jump';
import Magnify from '../components/Magnify';
import Splash from '../components/Splash';
import Intro from '../components/Intro';
import Isbn from '../components/Isbn';
import { adjustReference, generateReferenceMap, transformAppendices, findPageNumber, extractReferenceDetails, mapQuranWithNotes, generateFormula, toRoman } from '../utils/Mapper';
import { listCopy, smartCopy, supportsLookAhead, isNative } from '../utils/Device';
import LongPressable from '../hooks/LongPressable';
import '../assets/css/Book.css';

const Book = React.memo(({ incomingSearch = false, incomingAppendix = false, incomingAppendixNumber = 1, onChangeFont, font, onChangeColor, colors, theme, translationApplication, introductionContent, quranData, map, appendicesContent, translation, onChangeLanguage, direction }) => {
    const lang = localStorage.getItem("lang")
    const magnifyConfirm = useRef(false);
    const [currentPage, setCurrentPage] = useState(parseInt(localStorage.getItem("qurantft-pn")) ? parseInt(localStorage.getItem("qurantft-pn")) : 1);
    const [pageHistory, setPageHistory] = useState([]);
    const [isJumpOpen, setJumpOpen] = useState(false);
    const [selectedSura, setSelectedSura] = useState(null);
    const [selectedVerse, setSelectedVerse] = useState(null);
    const [action, setAction] = useState(null);

    const [isMagnifyOpen, setMagnifyOpen] = useState(incomingSearch);
    const [isMagnifyVisited, setMagnifyVisited] = useState(false);
    const [shouldMagnifyRemembered, setShouldMagnifyRemembered] = useState(false);
    const restoreAppText = useRef(null);
    const restoreIntroText = useRef(null);
    const endReferenceToRestore = useRef(null);
    const appxReferenceToJump = useRef(null);
    const beginingReferenceToRestore = useRef(null);
    const beginingReferenceToJump = useRef(null);
    const lastPosition = useRef(null);

    const [isPrevSettingsOpen, setPrevSettingsOpen] = useState(false);
    const [prevSettingsOpenningProgress, setPrevSettingsOpenningProgress] = useState(0);

    //prevButton Settings
    const [rememberHistory, setRememberHistory] = useState(() => {
        const saved = localStorage.getItem("qurantft-rh");
        return (saved !== null) ? JSON.parse(saved) : true;
    });

    const [keepVerseDetailsOpen, setKeepVerseDetailsOpen] = useState(() => {
        const saved = localStorage.getItem("qurantft-kvdo");
        return (saved !== null) ? JSON.parse(saved) : false;
    });

    const [includeSearchScreen, setIncludeSearchScreen] = useState(() => {
        const saved = localStorage.getItem("qurantft-iss");
        return (saved !== null) ? JSON.parse(saved) : false;
    });

    const referenceMap = useMemo(() => generateReferenceMap(quranData), [quranData]);
    const quranmap = useMemo(() => mapQuranWithNotes(translation || quranData), [translation, quranData]);

    const [pages, setPages] = useState([]);
    const [selectedApp, setSelectedApp] = useState(incomingAppendixNumber);
    const [backButtonPressedOnce, setBackButtonPressedOnce] = useState(false);

    const [multiSelect, setMultiSelect] = useState(false);
    const [selectedVerseList, setSelectedVerseList] = useState([]);
    const [updatePageTriggered, setUpdatePageTriggered] = useState(false);

    const accumulatedCopiesRef = useRef({});
    const copyTimerRef = useRef(null);
    const timerRef = useRef(null);
    const [remainingTime, setRemainingTime] = useState(0);
    const progressPercentage = remainingTime ? (remainingTime / 20000) * 100 : 0;

    const skipPages = useMemo(() => [3, 4, 8, 9, 10, 12], []);

    let path = useRef({});

    const [appendices, setAppendices] = useState(
        Array.from({ length: 38 }, (_, i) => ({ number: i + 1, title: "" }))
    );

    useEffect(() => {
        if (incomingAppendix) {
            setCurrentPage(397);
        }
    }, [incomingAppendix]);

    useEffect(() => {
        if (appendicesContent) {
            const scApps = transformAppendices(appendicesContent);
            setAppendices(scApps);
        }

        if (introductionContent) {
            let pgs = [];
            Object.values(introductionContent).forEach((item) => {
                if (item.page <= 22) {
                    pgs.push({ page: toRoman(item.page), value: item.page });
                }
                if (item.page === 1) {
                    pgs.push({ page: toRoman(2), value: 2 });
                }
                if (item.page === 22) {
                    for (let i = 23; i < 397; i++) {
                        pgs.push({ page: i - 22, value: i });
                    }
                }
            });
            setPages(pgs);
        }
    }, [appendicesContent, introductionContent]);

    useEffect(() => {
        if (currentPage) {
            localStorage.setItem("qurantft-pn", currentPage);
        }
    }, [currentPage]);

    useEffect(() => {
        localStorage.setItem("qurantft-rh", JSON.stringify(rememberHistory));
    }, [rememberHistory]);

    useEffect(() => {
        localStorage.setItem("qurantft-kvdo", JSON.stringify(keepVerseDetailsOpen));
    }, [keepVerseDetailsOpen]);

    useEffect(() => {
        localStorage.setItem("qurantft-iss", JSON.stringify(includeSearchScreen));
    }, [includeSearchScreen]);

    const handleMagnifyConfirm = (reference, from = null) => {
        from = 'magnify'
        magnifyConfirm.current = true;
        const refType = reference.split(":")[0];
        const refKey = reference.split(":")[1];
        beginingReferenceToJump.current = null;
        if (refType === "appx") {
            appxReferenceToJump.current = refKey;
            handleClickAppReference(refKey.split("-")[0], from, 'jumpAppendix');
        } else if (refType === "intro") {
            const [page, part, no] = refKey.split("-");
            const refer = part + "-" + no;
            beginingReferenceToJump.current = "intro-" + refer;
            updatePage(parseInt(page), null, null, 'jumpIntroduction', null, from);
        } else {
            handleClickReference(reference, from);
        }
    };

    const handleCloseSearch = () => {
        setSelectedVerseList([]);
        setMultiSelect(false);
        setMagnifyOpen(false);
        setJumpOpen(false);
    };

    const handleToggleJump = () => {
        window.dispatchEvent(new CustomEvent('navigation:click'));
        if (!isJumpOpen) {
            setMultiSelect(false);
        }
        setJumpOpen(!isJumpOpen);
        if (isMagnifyOpen) {
            setMagnifyVisited(true);
            setMagnifyOpen(false);
        } else {
            setMagnifyVisited(false);
        }
        setPrevSettingsOpen(false);
    };

    const setSelectedAppendix = (number) => {
        updatePage(397, null, null, 'openAppendix', parseInt(number), 'navigation');
        setSelectedApp(parseInt(number));
    };

    const updatePage = useCallback((newPage, sura = null, verse = null, actionType = 'navigate', position = null, from = null) => {
        setPrevSettingsOpen(false);
        setUpdatePageTriggered(pt => !pt);
        setAction(actionType);
        lastPosition.current = from;
        if (actionType !== 'previous' && (parseInt(newPage) === 397 || (parseInt(newPage) !== parseInt(currentPage)))) {
            setPageHistory(previous => {
                let last = previous[previous.length - 1];

                if (last && last.page === parseInt(currentPage) && (parseInt(currentPage) !== 397)) {
                    last.sura = sura;
                    last.verse = verse;
                    last.actionType = actionType;
                    last.position = position;
                    last.from = from;
                    return [...previous.slice(0, previous.length - 1), last];
                } else {

                    if (last && parseInt(newPage) === 397 && actionType === 'jumpAppendix' && last.position !== null && last.position === position) {
                        return previous;
                    }

                    if (from !== null && from.includes('notes')) {
                        return [...previous, {
                            page: parseInt(currentPage),
                            sura: null,
                            verse: null,
                            actionType,
                            position,
                            from
                        }];
                    }

                    if (from !== null && from.includes('magnify') && rememberHistory && includeSearchScreen) {
                        setShouldMagnifyRemembered(true);
                    }

                    return [...previous, {
                        page: parseInt(currentPage),
                        sura: selectedSura,
                        verse: selectedVerse,
                        actionType,
                        position,
                        from
                    }];
                }
            });
        }

        setSelectedSura(sura);
        setSelectedVerse(verse);
        setCurrentPage(newPage);
    }, [currentPage, selectedSura, selectedVerse, rememberHistory, includeSearchScreen]);

    const nextPage = () => {
        let newPage = parseInt(currentPage) > 396 ? parseInt(currentPage) : parseInt(currentPage) + 1;

        while (skipPages.includes(newPage)) {
            newPage++;
        }
        if (newPage === 397) {
            if (parseInt(currentPage) === 396) {
                updatePage(parseInt(newPage), null, null, 'next', 1, 'navigation');
                return setSelectedApp(parseInt(1));
            }
            if (selectedApp && selectedApp !== 38) {
                setSelectedAppendix(parseInt(selectedApp) + 1);
            }
        } else {
            updatePage(parseInt(newPage), null, null, 'next', null, 'navigation');
        }
        restoreIntroText.current = false;
        beginingReferenceToJump.current = null;
    };

    const prevPage = useCallback(() => {
        if (pageHistory.length > 0 && rememberHistory) {
            const lastHistoryItem = pageHistory.pop();
            setPageHistory([...pageHistory]);

            setCurrentPage(lastHistoryItem.page);
            setSelectedSura(lastHistoryItem.sura);
            setSelectedVerse(lastHistoryItem.verse);

            lastPosition.current = lastHistoryItem.from;

            restoreAppText.current = (lastHistoryItem.actionType === 'fromAppendix' || lastHistoryItem.actionType === 'openAppendix');
            restoreIntroText.current = (lastHistoryItem.actionType === 'fromIntro' || lastHistoryItem.actionType === 'openAppendix');

            if (lastHistoryItem.page === 397) {
                if (pageHistory[pageHistory.length - 1]) {
                    setSelectedApp(parseInt(pageHistory[pageHistory.length - 1].position));
                }
            }

            if (includeSearchScreen && shouldMagnifyRemembered && lastHistoryItem.from.includes('magnify')) {
                setTimeout(() => {
                    setShouldMagnifyRemembered(false);
                    setMagnifyOpen(true);
                }, 19);
            }
        } else {
            let newPage = parseInt(currentPage);
            do {
                newPage = newPage > 1 ? newPage - 1 : newPage;
            } while (skipPages.includes(newPage) && newPage > 1);
            updatePage(newPage, null, null, 'previous', null, 'navigation');
        }
    }, [currentPage, pageHistory, skipPages, rememberHistory, includeSearchScreen, shouldMagnifyRemembered, updatePage]);

    const longPressHandler = () => {
        setPrevSettingsOpenningProgress(1);
    };

    const longPressCancelled = () => {
        const duration = 285;
        const startTime = Date.now();
        const initialProgress = prevSettingsOpenningProgress;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.max(initialProgress * (1 - elapsed / duration), 0);
            setPrevSettingsOpenningProgress(progress);
            if (elapsed < duration) {
                requestAnimationFrame(animate);
            } else {
                setPrevSettingsOpenningProgress(0);
                setPrevSettingsOpen(false);
            }
        };

        requestAnimationFrame(animate);
    };

    const handleTimerUpdate = (progress, elapsed) => {
        if (elapsed >= 285) {
            setPrevSettingsOpen(true);
            setPrevSettingsOpenningProgress(progress);
        } else {
            window.dispatchEvent(new CustomEvent('navigation:click'));
        }
    };

    const handleNavigationButton = (whichone) => {
        window.dispatchEvent(new CustomEvent('navigation:click'));
        if (isPrevSettingsOpen) {
            setPrevSettingsOpen(false);
        } else {
            if (whichone === 'left') {
                if (direction === 'rtl') {
                    nextPage();
                } else {
                    prevPage();
                }
            } else if (whichone === 'right') {
                if (direction === 'rtl') {
                    prevPage();
                } else {
                    nextPage();
                }
            } else {
                console.error("UNKNOWN action from navigation buttons");
            }
        }
    };

    const checkOldScripture = (reference) => {
        return (
            reference.includes(translationApplication.acts) ||
            reference.includes(translationApplication.isaiah) ||
            reference.includes(translationApplication.john) ||
            reference.includes(translationApplication.mark) ||
            reference.includes(translationApplication.luke) ||
            reference.includes(translationApplication.matthew) ||
            reference.includes(translationApplication.romans) ||
            reference.includes(translationApplication.malachi) ||
            reference.includes(translationApplication.peter) ||
            reference.includes(translationApplication.deuteronomy) ||
            reference.includes(translationApplication.genesis)
        )
    }

    const handleClickReference = (reference, from = null) => {
        const lowerRef = reference.toLowerCase();

        if (lowerRef.includes("introduction") || lowerRef.includes("intro")) {
            updatePage(13, null, null, currentPage === 397 ? 'fromAppendix' : 'relationClick', currentPage === 397 ? selectedApp : null, from);
            return;
        }

        const foundPageNumber = findPageNumber(referenceMap, reference);

        if (foundPageNumber) {
            const { sura, verseStart, verseEnd } = extractReferenceDetails(reference);
            let act = magnifyConfirm.current === true ? 'navigate' : 'relationClick';
            if (parseInt(currentPage) < 23) {
                act = 'fromIntro';
            } else if (parseInt(currentPage) > 396) {
                act = 'fromAppendix';
            }
            updatePage(foundPageNumber, sura, verseStart !== verseEnd ? verseStart + "-" + verseEnd : verseStart.toString(), act, currentPage === 397 ? selectedApp : null, from);
        } else {
            if (isNative()) {
                Toast.show({
                    text: translationApplication.refNotFound,
                });
            } else {
                toast.error(translationApplication.refNotFound, {
                    duration: 4000,
                });
            }
        }
        magnifyConfirm.current = false;
    };

    const handleClickAppReference = (inp, from = null, actionType = 'openAppendix') => {
        const number = parseInt(inp);
        if (number > 0 && number < 39) {
            setSelectedApp(number);
            updatePage(397, null, null, actionType, number, from);
        }
    };

    const parseReferences = (text, from = null, controller = null) => {
        if (text === null || text === undefined || typeof text.split !== 'function') {
            return text;
        }
        return direction === 'rtl' ? parseReferencesRTL(text, from, controller) : parseReferencesLTR(text, from, controller);
    };

    const parseReferencesLTR = (text, from = null, controller = null) => {

        const versePattern = '(?<!\\d:)\\b(\\d+:\\d+(?:-\\d+)?)\\b(?!:\\d)';
        const fallbackPattern = '(\\d+:\\d+(?:-\\d+)?)';

        const verseRegex = supportsLookAhead()
            ? new RegExp(`${versePattern}`, 'g')
            : new RegExp(`${fallbackPattern}`, 'g');
        const app = translation ? translationApplication.appendix + "|" + translationApplication.appendices : translationApplication.appendix + "?";
        const intro = translationApplication.intro;
        const appendixRegex = new RegExp(`${app}`, 'g');
        const introRegex = new RegExp(`${intro}`, 'g');

        const replaceAppendixNumbers = (part) => {
            return part.split(/(\d+)/).map((segment, index) => {
                if (/\d+/.test(segment)) {
                    return (
                        <span key={index} className="cursor-pointer text-sky-500" onClick={() => handleClickAppReference(segment, from)}>
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
        let pushedOld = false;

        const result = splitted.map((part, i) => {
            if (part.match(appendixRegex)) {
                processingAppendix = true;
                return part;
            }
            if (processingAppendix) {
                if (part.match(/\d+/)) {
                    if (part.includes('.')) {
                        processingAppendix = false;
                    } else if (part.includes(')')) {
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
                    const reference = splitted[i - 1] ? ((splitted[i - 2] && !splitted[i - 2].match(/\d+/) ? splitted[i - 2] : " ") + "" + splitted[i - 1]) : null
                    let oldscripture = false
                    //TODO: give outer references for old scriptures
                    if (reference && !reference.match(/\d+/)) {
                        if (checkOldScripture(reference)) {
                            oldscripture = true;
                            pushedOld = true;
                        } else if (reference.toLowerCase().includes(translationApplication.quran.toLocaleLowerCase(lang))) {
                            oldscripture = false;
                        } else if ((reference.trim().includes(translationApplication.and) || reference.trim().includes('&')) && pushedOld) {
                            oldscripture = true;
                        }
                    }

                    if (oldscripture) {
                        elements.push(match[0]);
                    } else {
                        elements.push(
                            <span key={index} className="cursor-pointer text-sky-500" onClick={() => controller ? controller(match[0], from) : handleClickReference(match[0], from)}>
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
                            <span key={index} className={`cursor-pointer text-sky-500`} onClick={() => handleClickReference("Introduction", from)}>
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

    const parseReferencesRTL = (text, from = null, controller = null) => {
        const versePattern = '(?<!\\d:)\b(\\d+:\\d+-\\d+|\\d+-\\d+:\\d+|\\d+:\\d+)\b(?!:\\d)';
        const fallbackPattern = '(\\d+:\\d+-\\d+|\\d+-\\d+:\\d+|\\d+:\\d+)';

        const verseRegex = false //supportsLookAhead() DISABLE lookahead for RTL
            ? new RegExp(`${versePattern}`, 'g')
            : new RegExp(`${fallbackPattern}`, 'g');
        const app = translation ? translationApplication.appendix : translationApplication.appendix + "?";
        const intro = translationApplication.intro;
        const appendixRegex = new RegExp(`${app}`, 'g');
        const introRegex = new RegExp(`${intro}`, 'gi');

        const replaceAppendixNumbers = (part) => {
            return part.split(/(\d+)/).map((segment, index) => {
                if (/\d+/.test(segment)) {
                    return (
                        <span key={index} className="cursor-pointer text-nowrap text-sky-500" onClick={() => handleClickAppReference(segment, from)}>
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
        let pushedOld = false;

        const result = splitted.map((part, i) => {
            if (part.match(verseRegex)) {
                part = adjustReference(part)
                const matches = [...part.matchAll(verseRegex)];
                let lastIndex = 0;
                const elements = [];
                matches.forEach((match, index) => {
                    elements.push(part.slice(lastIndex, match.index));
                    const reference = splitted[i - 1] ? ((splitted[i - 2] && !splitted[i - 2].match(/\d+/) ? splitted[i - 2].trim() : " ") + "" + splitted[i - 1].trim()) : null
                    let oldscripture = false
                    //TODO: give outer references for old scriptures
                    if (reference && !reference.match(/\d+/)) {
                        if (checkOldScripture(reference)) {
                            oldscripture = true;
                            pushedOld = true;
                        } else if (reference.toLowerCase().includes(translationApplication.quran.toLocaleLowerCase(lang))) {
                            oldscripture = false;
                        } else if (reference.trim().includes(translationApplication.and) && pushedOld) {
                            oldscripture = true;
                        }
                    }

                    if (oldscripture) {
                        elements.push(
                            <span key={index} dir={"ltr"} className="text-nowrap text-right ml-0.5">
                                {match[0]}
                            </span>
                        );
                    } else {
                        elements.push(
                            <span key={index} dir={"ltr"} className="cursor-pointer text-nowrap text-right ml-0.5 text-sky-500" onClick={() => controller ? controller(match[0], from) : handleClickReference(match[0], from)}>
                                {match[0]}
                            </span>
                        );
                    }
                    lastIndex = match.index + match[0].length;
                });

                elements.push(part.slice(lastIndex));
                return elements;
            }

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

            if (introRegex.test(part)) {
                const segments = part.split(introRegex);
                const elements = [];
                segments.forEach((segment, index) => {
                    elements.push(segment);

                    if (index < segments.length - 1) {
                        elements.push(
                            <span key={index} dir={direction} className={`cursor-pointer text-sky-500`} onClick={() => handleClickReference("Introduction", from)}>
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
                    window.dispatchEvent(new CustomEvent('navigation:click'));
                    if (isJumpOpen) {
                        setJumpOpen(false);
                    } else if (isMagnifyOpen) {
                        handleCloseSearch();
                    } else if (isPrevSettingsOpen) {
                        setPrevSettingsOpen(false);
                    } else {
                        setBackButtonPressedOnce(true);
                        prevPage();
                        await Toast.show({
                            text: translationApplication.exitToast,
                            duration: 'long'
                        });
                    }
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
    }, [backButtonPressedOnce, isJumpOpen, isMagnifyOpen, isPrevSettingsOpen, translationApplication, prevPage]);

    const handleCopy = async () => {
        const copied = await listCopy(selectedVerseList, quranmap);

        if (copied) {
            const textToShow = Object.values(selectedVerseList).join(", ");
            toast.success(textToShow + ` ` + translationApplication.copied, {
                duration: 4000,
            });
        }
        setMultiSelect(false);
    };

    const handleShare = async () => {
        try {
            const canShare = await Share.canShare();

            if (canShare.value) {
                await Share.share({
                    title: translationApplication.bsml,
                    url: 'https://qurantft.com/' + lang + '/' + generateFormula(selectedVerseList),
                    dialogTitle: translationApplication.bsml,
                });
            } else {
                toast.error(translationApplication.shareNotSupported, {
                    duration: 5000,
                });
                console.error('Sharing is not supported on this device.');
            }
        } catch (error) {
            console.error('Error checking share capability:', error);
        } finally {
            setMultiSelect(false);
        }
    };

    const onCloseJump = useCallback(() => {
        setJumpOpen(false);
    }, []);

    const onConfirmJump = useCallback(async (page, suraNumber, verseNumber) => {
        updatePage(parseInt(page), suraNumber, verseNumber, 'navigate', null, 'jump');
    }, [updatePage]);

    const onMagnify = useCallback(() => {
        setMagnifyOpen(true);
        setJumpOpen(false);
    }, []);

    const startCopyTimer = useCallback((currentVerseKey, verseText, hasTitle, hasNotes, translationApplication) => {
        const handleAccumulatedCopy = async () => {
            const clip = `[${currentVerseKey}]`;
            const s = await smartCopy(clip, accumulatedCopiesRef, verseText, hasTitle, hasNotes);
            if (s) {
                const textToShow = Object.keys(accumulatedCopiesRef.current).join(", ") + ` ` + translationApplication.copied
                toast.success(textToShow, { duration: 3000 });
            }

            // Clear existing timer
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);

            // Start a new timeout
            copyTimerRef.current = setTimeout(() => {
                accumulatedCopiesRef.current = {};
                setRemainingTime(0);
            }, 19000);

            let startTime = Date.now();
            let endTime = startTime + 19999;

            // Cancel any previous animation frame
            if (timerRef.current) cancelAnimationFrame(timerRef.current);

            const updateRemainingTime = () => {
                let now = Date.now();
                let remaining = Math.max(endTime - now, 0);
                setRemainingTime(remaining);
                if (remaining > 0) {
                    timerRef.current = requestAnimationFrame(updateRemainingTime);
                }
            };
            updateRemainingTime();
        };

        handleAccumulatedCopy();
    }, [accumulatedCopiesRef, copyTimerRef, timerRef]);

    const stopCopyTimer = useCallback(() => {
        accumulatedCopiesRef.current = {};
        setRemainingTime(0);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        if (timerRef.current) cancelAnimationFrame(timerRef.current);
    }, []);

    const renderBookContent = () => {

        if (parseInt(currentPage) === 1) {
            return <Splash
                bookContent={introductionContent}
                currentPage={currentPage}
                colors={colors}
                theme={theme}
                direction={direction} />;
        }

        if (parseInt(currentPage) === 2) {
            return <Isbn
                colors={colors}
                theme={theme}
                translationApplication={translationApplication} />;
        }

        if (parseInt(currentPage) > 2 && parseInt(currentPage) <= 21) {
            return <Intro
                colors={colors}
                theme={theme}
                translationApplication={translationApplication}
                parseReferences={parseReferences}
                introduction={introductionContent}
                currentPage={currentPage}
                restoreIntroText={restoreIntroText}
                refToRestore={beginingReferenceToRestore}
                refToJump={beginingReferenceToJump}
                direction={direction}
                upt={updatePageTriggered}
            />;
        }

        if (parseInt(currentPage) === 22) {
            const cpd = introductionContent ? introductionContent.find(iterator => iterator.page === currentPage) : null;

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
                            onClick={() => updatePage(parseInt(page) + 22, no, 1, 'navigate', null, 'suralist')}
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
                from={lastPosition}
                parseReferences={parseReferences}
                selectedPage={currentPage}
                selectedSura={selectedSura}
                selectedVerse={selectedVerse}
                setSelectedSura={setSelectedSura}
                setSelectedVerse={setSelectedVerse}
                handleClickReference={handleClickReference}
                handleToggleJump={handleToggleJump}
                path={path}
                startCopyTimer={startCopyTimer}
                direction={direction}
                upt={updatePageTriggered}
                kvdo={keepVerseDetailsOpen && rememberHistory}
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
            const cpd = appendicesContent ? appendicesContent.find(iterator => iterator.page === currentPage) : null;

            if (!cpd || !cpd.evidence["2"] || !cpd.evidence["2"].lines) {
                return (
                    <div className={`${colors[theme]["log-text"]} flex flex-1 items-center justify-center w-full `}>
                        {translationApplication?.contentNotAvailable}
                    </div>
                )
            }

            const handleAppClick = (no) => {
                setSelectedApp(no)
                updatePage(397, null, null, 'openAppendix', no, 'appencideslist');
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
                            dir={direction}
                            onClick={() => handleAppClick(parseInt(elements[0]))}
                            className={`flex w-full justify-between text-lg`}>
                            <div className={`font-semibold rounded p-3 m-1 ${colors[theme]["base-background"]} w-16 flex items-center justify-center`}>
                                <p className={``} >{elements[0]}</p>
                            </div>
                            <div key={key} className={`rounded p-3 my-1 ${direction === 'ltr' ? "mr-1" : "ml-1"} ${colors[theme]["text-background"]} w-full flex items-center`}>
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
                refToRestore={endReferenceToRestore}
                refToJump={appxReferenceToJump}
                direction={direction}
                upt={updatePageTriggered}
            />;
        }
    };

    return (
        <div
            className={`fixed w-full h-full flex flex-col justify-start ${colors[theme]["app-background"]} overflow-y-hidden`}
            style={{ paddingTop: 'calc(env(safe-area-inset-top) * 0.76)', paddingBottom: 'calc(env(safe-area-inset-bottom) * 0.57)' }}>
            <Toaster
                position="top-center"
                reverseOrder={false}
                containerStyle={{
                    marginTop: 'calc(env(safe-area-inset-top) + 2rem)',
                }}
                toastOptions={{
                    success: {
                        style: {
                            background: colors[theme]["toast-background"],
                            color: colors[theme]["toast-text"],
                            borderRadius: '5px',
                            padding: '7px',
                            boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
                        },
                        iconTheme: {
                            primary: colors[theme]["toast-text"],
                            secondary: colors[theme]["toast-background"],
                        },
                    },
                    error: {
                        style: {
                            background: colors[theme]["toast-background"],
                            color: colors[theme]["toast-text"],
                            borderRadius: '5px',
                            padding: '7px',
                            boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
                        },
                        iconTheme: {
                            primary: colors[theme]["toast-text"],
                            secondary: colors[theme]["toast-background"],
                        },
                    },
                }} />
            {renderBookContent()}
            <div>
                <div className={`h-12 lg:h-14`}></div>
                <div className={`w-full flex z-40 ${colors[theme]["app-background"]} fixed bottom-0`}
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) * 0.57)' }}>
                    <div className={`relative flex w-full items-center justify-between`}>
                        <div className={`absolute h-0.5 left-0 -top-0.5 ${colors[theme]["matching"]}`} style={{ width: `${progressPercentage}%` }}></div>
                        {progressPercentage > 0 &&
                            <div className={`absolute pb-1 left-1/2 -translate-x-1/2 -top-14 ${colors[theme]["app-background"]} rounded flex flex-col justify-center shadow-md shadow-cyan-300/30`}>
                                <button className={`flex justify-center ${colors[theme]["text"]}`} onClick={stopCopyTimer}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-12 h-12`}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                                <div className={`absolute bottom-0 w-full flex items-center justify-center text-xs ${colors[theme]["matching-text"]}`}>
                                    <div>{parseInt(remainingTime / 1000)}</div>
                                </div>
                            </div>
                        }
                        <div className={`w-1/2 h-full`}>
                            {multiSelect ?
                                (<button onClick={handleShare}
                                    disabled={selectedVerseList.length === 0}
                                    className={`${colors[theme]["passive-text"]} flex items-center w-full h-full justify-end`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7 lg:w-10 lg:h-10 ${selectedVerseList.length > 0 ? `${colors[theme]["text"]}` : ``}`}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                                    </svg>
                                </button>)
                                :
                                (
                                    <LongPressable
                                        onTap={() => handleNavigationButton('left')}
                                        onLongPress={direction === 'rtl' ? null : longPressHandler}
                                        onTimerUpdate={direction === 'rtl' ? null : handleTimerUpdate}
                                        onCancel={longPressCancelled}>
                                        <button
                                            disabled={direction === 'rtl' ? (isJumpOpen || (selectedApp === 38 && currentPage === 397) || isMagnifyOpen) : (isJumpOpen || currentPage === 1 || isMagnifyOpen)}
                                            className={`w-full h-full ${colors[theme]["app-text"]} px-2 ${direction === 'rtl' ? 'ml-1' : 'mr-2'} flex items-center justify-center ${direction === 'rtl' ? (isJumpOpen || (selectedApp === 38 && currentPage === 397) || isMagnifyOpen) ? "opacity-0" : "opacity-100" : (isJumpOpen || currentPage === 1 || isMagnifyOpen) ? "opacity-0" : "opacity-100"}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7 lg:w-12 lg:h-12`}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                            </svg>
                                            {direction !== 'rtl' && pageHistory.length > 0 && rememberHistory && (
                                                <div className={`bg-transparent absolute translate-y-3 -translate-x-3 text-xs lg:translate-y-4 lg:-translate-x-4 lg:text-base ${colors[theme]["matching-text"]} flex items-center justify-center px-2 py-1 rounded-full`}>
                                                    {pageHistory.length}
                                                </div>
                                            )}
                                        </button>
                                    </LongPressable>
                                )}
                        </div>

                        <div
                            dir={direction}
                            className={`w-full flex items-center ${colors[theme]["page-text"]} justify-center p-0.5`}>
                            <div className={`menu-icon flex items-center justify-center self-center`}>
                                {
                                    isJumpOpen ?

                                        (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-11 h-11 lg:w-14 lg:h-14 ${colors[theme]["text"]}`} onClick={() => handleToggleJump()}>
                                            <path fillRule="evenodd" d="M3 6a3 3 0 0 1 3-3h2.25a3 3 0 0 1 3 3v2.25a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm9.75 0a3 3 0 0 1 3-3H18a3 3 0 0 1 3 3v2.25a3 3 0 0 1-3 3h-2.25a3 3 0 0 1-3-3V6ZM3 15.75a3 3 0 0 1 3-3h2.25a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2.25Zm9.75 0a3 3 0 0 1 3-3H18a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3h-2.25a3 3 0 0 1-3-3v-2.25Z" clipRule="evenodd" />
                                        </svg>) :
                                        (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-11 h-11 lg:w-14 lg:h-14 `} onClick={() => handleToggleJump()}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                                        </svg>)
                                }
                            </div>
                            {!isMagnifyOpen &&
                                (parseInt(currentPage) < 23 ? (
                                    <div className={` relative h-11 lg:h-14 ${isJumpOpen ? `w-0` : `${direction === 'rtl' ? 'mr-2.5' : 'ml-2.5'} w-12 lg:w-16 `} transition-all duration-200 ease-out `}>
                                        <div
                                            className={` absolute -top-1 h-full w-full text-3xl lg:text-4xl ${colors[theme]["app-text"]} flex items-center justify-start ${isJumpOpen ? `hidden` : `w-20`}`}
                                            onClick={() => document.getElementById('pageselect').click()}>
                                            {pages.find((p) => p.value === currentPage)?.page || currentPage}
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4  ${direction === 'rtl' ? `mr-0.5 -ml-2` : ` ml-0.5 -mr-2`}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                        <select
                                            id="pageselect"
                                            name="pageselect"
                                            value={currentPage}
                                            onChange={(e) => {
                                                setPrevSettingsOpen(false);
                                                setCurrentPage(parseInt(e.target.value));
                                            }}
                                            className={`inset-0 opacity-0 w-20 h-full text-3xl ${isJumpOpen ? `hidden` : ``} bg-transparent focus:outline-none focus:ring-2 focus:border-sky-500 focus:ring-sky-500`}
                                        >
                                            {pages.map(({ page, value }, index) => (
                                                <option key={index} value={value}>
                                                    {page}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : parseInt(currentPage) < 397 ? (
                                    <div className={` relative h-11 lg:h-14 ${isJumpOpen ? `w-0` : `${direction === 'rtl' ? 'mr-2.5' : 'ml-2.5'} w-12 lg:w-16`} transition-all duration-200 ease-out `}>
                                        <div
                                            className={` absolute top-0 h-full w-full pt-3.5 lg:pt-4 text-xl lg:text-2xl xl:text-3xl ${colors[theme]["app-text"]} flex items-center justify-start ${isJumpOpen ? `hidden` : `w-20`}`}
                                            onClick={() => document.getElementById('pageselect').click()}>
                                            {pages.find((p) => parseInt(p.value) === parseInt(currentPage))?.page || (parseInt(currentPage) - 22)}
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4  ${direction === 'rtl' ? `mr-0.5 -ml-2` : ` ml-0.5 -mr-2`}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                        {<div dir={direction} className={`text-xs absolute top-0.5 lg:top-1 ${direction === 'rtl' ? `right-0.5` : ` left-0.5`} ${colors[theme]["page-text"]} brightness-80 ${isJumpOpen ? `hidden` : ``}`}>{translationApplication?.page}</div>}
                                        <select
                                            id="pageselect"
                                            name="pageselect"
                                            value={currentPage}
                                            onChange={(e) => {
                                                setPrevSettingsOpen(false);
                                                setCurrentPage(parseInt(e.target.value));
                                                window.dispatchEvent(new CustomEvent('navigation:click'));
                                            }}
                                            className={`inset-0 opacity-0 w-20 h-full text-3xl ${isJumpOpen ? `hidden` : ``} bg-transparent focus:outline-none focus:ring-2 focus:border-sky-500 focus:ring-sky-500`}
                                        >
                                            {pages.map(({ page, value }, index) => (
                                                <option key={index} value={value}>
                                                    {page}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className={` relative h-11 lg:h-14 ${isJumpOpen ? `w-0` : `${direction === 'rtl' ? 'mr-2.5' : 'ml-2.5'} w-12`} transition-all duration-200 ease-out `}>
                                        <div
                                            className={` absolute top-0 h-full w-full pt-2.5 lg:pt-3 text-2xl lg:text-3xl xl:text-4xl ${colors[theme]["app-text"]} flex items-center justify-start ${isJumpOpen ? `hidden` : `w-20`}`}
                                            onClick={() => document.getElementById('appselect').click()}>
                                            {selectedApp}
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4  ${direction === 'rtl' ? `mr-0.5 -ml-2` : ` ml-0.5 -mr-2`}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                        {<div dir={direction} className={`text-xs absolute top-0.5 lg:top-1 ${direction === 'rtl' ? `right-0.5` : ` left-0.5`} ${colors[theme]["page-text"]} brightness-80 ${isJumpOpen ? `hidden` : ``}`}>{translationApplication?.appendix}</div>}
                                        <select
                                            id="appselect"
                                            name="appselect"
                                            value={selectedApp}
                                            onChange={(e) => {
                                                setPrevSettingsOpen(false);
                                                setSelectedAppendix(e.target.value);
                                            }}
                                            className={`inset-0 opacity-0 w-20 h-full text-3xl ${isJumpOpen ? `hidden` : ``} bg-transparent focus:outline-none focus:ring-2 focus:border-sky-500 focus:ring-sky-500`}
                                        >
                                            {appendices.map((appendix, index) => (
                                                <option key={index} value={appendix.number}>
                                                    {`${appendix.number} ${appendix.title}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                        </div>
                        <div className={`w-1/2 h-full`}>
                            {multiSelect ?
                                (<button onClick={handleCopy}
                                    disabled={selectedVerseList.length === 0}
                                    className={`${colors[theme]["passive-text"]} flex items-center w-full h-full justify-start`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 lg:w-11 lg:h-11 ${selectedVerseList.length > 0 ? `${colors[theme]["text"]}` : ``}`}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                                    </svg>
                                    {selectedVerseList.length > 0 && (
                                        <div className={`bg-transparent absolute translate-y-4 translate-x-5 text-xs lg:translate-y-5 lg:translate-x-6 lg:text-sm ${colors[theme]["matching-text"]} flex items-center justify-center px-2 py-1 rounded-full`}>
                                            {selectedVerseList.length}
                                        </div>
                                    )}
                                </button>)
                                :
                                (
                                    <LongPressable
                                        onTap={() => handleNavigationButton('right')}
                                        onLongPress={direction === 'rtl' ? longPressHandler : null}
                                        onTimerUpdate={direction === 'rtl' ? handleTimerUpdate : null}
                                        onCancel={longPressCancelled}>
                                        <button
                                            disabled={direction === 'rtl' ? (isJumpOpen || currentPage === 1 || isMagnifyOpen) : (isJumpOpen || (selectedApp === 38 && currentPage === 397) || isMagnifyOpen)}
                                            className={`w-full h-full ${colors[theme]["app-text"]} px-2 ${direction === 'rtl' ? 'mr-2' : 'ml-1'} flex items-center justify-center ${direction === 'rtl' ? (isJumpOpen || currentPage === 1 || isMagnifyOpen) ? "opacity-0" : "opacity-100" : (isJumpOpen || (selectedApp === 38 && currentPage === 397) || isMagnifyOpen) ? "opacity-0" : "opacity-100"} `}>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-7 h-7 lg:w-12 lg:h-12`}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                                            </svg>
                                            {direction === 'rtl' && pageHistory.length > 0 && rememberHistory && (
                                                <div className={`bg-transparent absolute translate-y-3 translate-x-3 text-xs lg:translate-y-4 lg:translate-x-4 lg:text-base ${colors[theme]["matching-text"]} flex items-center justify-center px-2 py-1 rounded-full`}>
                                                    {pageHistory.length}
                                                </div>
                                            )}
                                        </button>
                                    </LongPressable>
                                )}
                        </div>
                    </div>
                </div>
            </div>
            {isJumpOpen &&
                <Jump
                    onChangeLanguage={onChangeLanguage}
                    suraNames={introductionContent[introductionContent.length - 1].evidence["2"].lines}
                    onChangeFont={onChangeFont}
                    font={font}
                    onChangeColor={onChangeColor}
                    colors={colors} theme={theme}
                    translationApplication={translationApplication}
                    currentPage={currentPage}
                    quran={translation ? translation : quranData}
                    onClose={onCloseJump}
                    onConfirm={onConfirmJump}
                    onMagnify={onMagnify}
                    direction={direction}
                    isMagnifyVisited={isMagnifyVisited}
                />
            }
            {isMagnifyOpen &&
                <Magnify
                    colors={colors}
                    theme={theme}
                    translationApplication={translationApplication}
                    currentPage={currentPage}
                    quran={translation ? translation : quranData}
                    map={map}
                    appendices={appendicesContent}
                    introduction={introductionContent}
                    onClose={handleCloseSearch}
                    onConfirm={handleMagnifyConfirm}
                    direction={direction}
                    multiSelect={multiSelect}
                    setMultiSelect={setMultiSelect}
                    selectedVerseList={selectedVerseList}
                    setSelectedVerseList={setSelectedVerseList}
                />
            }
            {isPrevSettingsOpen &&
                <div className={`w-screen h-full fixed left-0 top-0 inset-0 z-20 outline-none focus:outline-none`}>
                    <div
                        style={{ opacity: prevSettingsOpenningProgress }}
                        className={`w-full h-full backdrop-blur flex items-center justify-center relative`}>
                        <div
                            onClick={() => setPrevSettingsOpen(false)}
                            className={` w-full h-full absolute left-0 top-0`}></div>
                        {prevSettingsOpenningProgress !== 1 ? (
                            <div className={`flex items-center justify-center transition-all duration-300 ease-linear ${prevSettingsOpenningProgress < 0.57 ? " " : " rotate-180 "} ${prevSettingsOpenningProgress >= 0.57 ? colors[theme]["matching-text"] : colors[theme]["log-text"]}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-24 h-24 `}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                </svg>
                            </div>)
                            :
                            (<div
                                style={{ animation: 'animate-scale 0.2s ease-in-out' }}
                                className={`mx-3 z-40 ${colors[theme]["app-background"]} flex items-center justify-center rounded shadow-lg`}>
                                <div className={`rounded px-1 py-1.5 border ${colors[theme]["border"]}`}
                                    style={{ top: `calc(3.3rem + env(safe-area-inset-top) * 0.76)` }}>
                                    <div className={`flex flex-col text-lg md:text-xl`}>
                                        <label dir={direction} className={`flex items-center justify-between md:justify-end pt-3.5 px-3 pb-2 cursor-pointer  ${direction === 'rtl' ? `` : `space-x-4 `}`}>
                                            <span className={`${rememberHistory ? colors[theme]["text"] : colors[theme]["page-text"]}`}>{translationApplication?.returnToJumped}</span>
                                            <div>
                                                <label className='flex cursor-pointer select-none items-center'>
                                                    <div className='relative'>
                                                        <input
                                                            type='checkbox'
                                                            checked={rememberHistory}
                                                            onChange={(e) => setRememberHistory(e.target.checked)}
                                                            className='sr-only'
                                                        />
                                                        <div className={`box block h-8 w-14 rounded-full ${rememberHistory ? colors[theme]["text-background"] : colors[theme]["base-background"]}`}></div>
                                                        <div className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full ${rememberHistory ? colors[theme]["matching"] : colors[theme]["notes-background"]} transition ${rememberHistory ? 'translate-x-full' : ''}`}></div>
                                                    </div>
                                                </label>
                                            </div>
                                        </label>
                                        <div className={`border-b ${colors[theme]["verse-border"]} mx-1 mt-2`} ></div>
                                        <label dir={direction} className={`flex items-center justify-between md:justify-end pt-3.5 px-3 pb-2 cursor-pointer ${direction === 'rtl' ? `` : `space-x-4 `}`}>
                                            <span className={`text-base ${direction === 'rtl' ? `pl-4` : ` `} break-words ${rememberHistory ? `` : ` brightness-50`} ${(keepVerseDetailsOpen && rememberHistory) ? colors[theme]["text"] : colors[theme]["page-text"]}`}>{translationApplication?.keepDetailsOpen}</span>
                                            <div>
                                                <label className='flex cursor-pointer select-none items-center'>
                                                    <div className='relative'>
                                                        <input
                                                            type='checkbox'
                                                            disabled={!rememberHistory}
                                                            checked={keepVerseDetailsOpen}
                                                            onChange={(e) => setKeepVerseDetailsOpen(e.target.checked)}
                                                            className='sr-only'
                                                        />
                                                        <div className={`box block h-8 w-14 rounded-full ${(keepVerseDetailsOpen && rememberHistory) ? colors[theme]["text-background"] : colors[theme]["base-background"]}`}></div>
                                                        <div className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full ${(keepVerseDetailsOpen && rememberHistory) ? colors[theme]["matching"] : colors[theme]["notes-background"]} transition ${keepVerseDetailsOpen ? 'translate-x-full' : ''}`}></div>
                                                    </div>
                                                </label>
                                            </div>
                                        </label>
                                        <div className={`border-b ${colors[theme]["verse-border"]} mx-1 mt-2`} ></div>
                                        <label dir={direction} className={`flex items-center justify-between md:justify-end pt-3.5 px-3 pb-2 cursor-pointer ${direction === 'rtl' ? `` : `space-x-4 `}`}>
                                            <span className={`text-base ${direction === 'rtl' ? `pl-4` : ` `} break-words ${rememberHistory ? `` : ` brightness-50`} ${(includeSearchScreen && rememberHistory) ? colors[theme]["text"] : colors[theme]["page-text"]}`}>{translationApplication?.includeSearch}</span>
                                            <div>
                                                <label className='flex cursor-pointer select-none items-center'>
                                                    <div className='relative'>
                                                        <input
                                                            type='checkbox'
                                                            disabled={!rememberHistory}
                                                            checked={includeSearchScreen}
                                                            onChange={(e) => setIncludeSearchScreen(e.target.checked)}
                                                            className='sr-only'
                                                        />
                                                        <div className={`box block h-8 w-14 rounded-full ${(includeSearchScreen && rememberHistory) ? colors[theme]["text-background"] : colors[theme]["base-background"]}`}></div>
                                                        <div className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full ${(includeSearchScreen && rememberHistory) ? colors[theme]["matching"] : colors[theme]["notes-background"]} transition ${includeSearchScreen ? 'translate-x-full' : ''}`}></div>
                                                    </div>
                                                </label>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>)}
                    </div>
                </div>
            }
        </div>
    );
});

export default Book;