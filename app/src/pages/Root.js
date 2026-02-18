import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import Cover from '../components/Cover';
import Book from '../components/Book';
import { colorThemes } from '../utils/Theme';
import { setStatusBarStyle, applyConditionalOrientationLock } from '../utils/Device';
import { init as initBookmarks } from '../utils/Bookmarks';
import introductionContent from '../assets/introduction.json';
import quranData from '../assets/qurantft.json';
import appendicesContent from '../assets/appendices.json';
import application from '../assets/application.json';
import cover from '../assets/cover.json';
import map from '../assets/map.json';
import languages from '../assets/languages.json';

const CORE_TRANSLATION_SEGMENTS = ['loadQuran', 'loadCover', 'loadIntro', 'loadAppendices', 'loadApplication'];
const ALL_TRANSLATION_SEGMENTS = [...CORE_TRANSLATION_SEGMENTS, 'loadMap'];
const TRANSLATION_PROGRESS_MIN_VISIBLE_MS = 280;
const TRANSLATION_PROGRESS_FINISH_HOLD_MS = 140;
const TRANSLATION_PROGRESS_GUIDED_STEP = 0.1;
const TRANSLATION_PROGRESS_GUIDED_INTERVAL_MS = 30;
const TRANSLATION_PROGRESS_GUIDED_CAP = 96;

function Root({ bootData = null }) {
    const { language, id } = useParams();
    const location = useLocation();
    const isSearch = location.pathname.endsWith('/search');
    const isAppendix = location.pathname.match(/\/appendix\/\d+$/) !== null;

    const colors = useMemo(() => colorThemes, []);
    const initialLang = language ? language : localStorage.getItem("lang") ? localStorage.getItem("lang") : process.env.REACT_APP_DEFAULT_LANG || "en";
    const normalizedInitialLang = initialLang.toLowerCase();
    const hasInitialBootData = bootData?.language === normalizedInitialLang;
    const initialStoredPage = parseInt(localStorage.getItem("qurantft-pn") || "", 10);
    const fallbackInitialBookPage = Number.isFinite(initialStoredPage) && initialStoredPage > 0 ? initialStoredPage : 1;
    const [showCover, setShowCover] = useState(localStorage.getItem("qurantft-pn") ? false : ((isSearch || isAppendix) ? false : process.env.REACT_APP_DEFAULT_LANG ? false : true));
    const [bookPage, setBookPage] = useState(isAppendix ? 397 : fallbackInitialBookPage);
    const [coverData, setCoverData] = useState(hasInitialBootData && bootData.coverData ? bootData.coverData : cover);
    const [lang, setLang] = useState(initialLang);

    const [translation, setTranslation] = useState(hasInitialBootData ? (bootData.translation || null) : null);
    const [translationApplication, setTranslationApplication] = useState(hasInitialBootData && bootData.application ? bootData.application : application);
    const [translationIntro, setTranslationIntro] = useState(hasInitialBootData && bootData.introduction ? bootData.introduction : introductionContent);
    const [translationAppx, setTranslationAppx] = useState(hasInitialBootData && bootData.appendices ? bootData.appendices : appendicesContent);
    const [translationMap, setTranslationMap] = useState(hasInitialBootData && bootData.map ? bootData.map : map);
    const [translationLoadProgress, setTranslationLoadProgress] = useState({ active: false, loaded: 0, total: 0, uiProgress: 0 });
    const [theme, setTheme] = useState(localStorage.getItem("theme") ? localStorage.getItem("theme") : "sky");
    const [font, setFont] = useState(localStorage.getItem("qurantft-font") ? localStorage.getItem("qurantft-font") : "font-normal");
    const activeLangRef = useRef(normalizedInitialLang);
    const mapLoadPromiseRef = useRef(null);
    const introLoadPromiseRef = useRef(null);
    const translationProgressStartedAtRef = useRef(0);
    const translationProgressTimerRef = useRef(null);
    const loadedSegmentsRef = useRef({
        loadQuran: false,
        loadCover: false,
        loadIntro: false,
        loadAppendices: false,
        loadApplication: false,
        loadMap: false,
    });

    useEffect(() => {
        const initialize = async () => {
            await applyConditionalOrientationLock();
            await initBookmarks();
        };
        initialize();
    }, []);

    const onChangeFont = useCallback((f) => {
        setFont(f);
        localStorage.setItem("qurantft-font", f);
    }, []);

    useEffect(() => {
        setStatusBarStyle(theme, colors[theme]['status-bar-background']).catch((error) => {
            console.error('Failed to update status bar style:', error);
        });
    }, [theme, colors]);

    const onChangeColor = useCallback((theme) => {
        setTheme(theme);
        setStatusBarStyle(theme, colors[theme]['status-bar-background']).catch((error) => {
            console.error('Failed to update status bar style:', error);
        });
        localStorage.setItem("theme", theme);
    }, [colors]);

    const onBookPageChange = useCallback((nextPage) => {
        if (!Number.isFinite(nextPage)) {
            return;
        }
        setBookPage(parseInt(nextPage, 10));
    }, []);

    const isEnglishLanguage = useCallback((value) => {
        const normalized = (value || "").toLowerCase();
        return normalized === "en" || normalized.startsWith("en-");
    }, []);

    const stopTranslationProgressTimer = useCallback(() => {
        if (translationProgressTimerRef.current) {
            window.clearInterval(translationProgressTimerRef.current);
            translationProgressTimerRef.current = null;
        }
    }, []);

    const resetTranslationProgress = useCallback(() => {
        stopTranslationProgressTimer();
        translationProgressStartedAtRef.current = 0;
        setTranslationLoadProgress({ active: false, loaded: 0, total: 0, uiProgress: 0 });
    }, [stopTranslationProgressTimer]);

    const startGuidedTranslationProgress = useCallback(() => {
        stopTranslationProgressTimer();
        translationProgressTimerRef.current = window.setInterval(() => {
            setTranslationLoadProgress((prev) => {
                if (!prev.active) {
                    return prev;
                }

                const nextUi = Math.min(
                    TRANSLATION_PROGRESS_GUIDED_CAP,
                    Number((prev.uiProgress + TRANSLATION_PROGRESS_GUIDED_STEP).toFixed(1))
                );

                if (nextUi === prev.uiProgress) {
                    return prev;
                }

                return {
                    ...prev,
                    uiProgress: nextUi,
                };
            });
        }, TRANSLATION_PROGRESS_GUIDED_INTERVAL_MS);
    }, [stopTranslationProgressTimer]);

    const onChangeLanguage = useCallback((nextLang) => {
        const normalizedNext = (nextLang || "").toLowerCase();
        const normalizedCurrent = (activeLangRef.current || "").toLowerCase();

        if (!normalizedNext || normalizedNext === normalizedCurrent) {
            return;
        }

        if (!isEnglishLanguage(normalizedNext)) {
            translationProgressStartedAtRef.current = performance.now();
            setTranslationLoadProgress({
                active: true,
                loaded: 0,
                total: 0,
                uiProgress: 0,
            });
            startGuidedTranslationProgress();
        } else {
            resetTranslationProgress();
        }

        setLang(nextLang);
    }, [isEnglishLanguage, startGuidedTranslationProgress, resetTranslationProgress]);

    const loadCoreTranslations = useCallback(async (language, preloadPlan = null, onSegmentSettled = null) => {
        const normalizedLanguage = (language || "").toLowerCase();

        if (!normalizedLanguage || isEnglishLanguage(normalizedLanguage)) {
            return null;
        }

        const shouldLoad = (key) => {
            if (!preloadPlan) {
                return true;
            }
            return Boolean(preloadPlan[key]);
        };

        const loadOptional = (key, importer) => {
            if (!shouldLoad(key)) {
                return Promise.resolve(null);
            }

            return importer()
                .catch(() => null)
                .finally(() => {
                    if (typeof onSegmentSettled === "function") {
                        onSegmentSettled(key);
                    }
                });
        };

        try {
            const [
                translatedQuran,
                translatedCover,
                translatedIntro,
                translatedAppendix,
                translatedApplication,
            ] = await Promise.all([
                loadOptional("loadQuran", () => import(`../assets/translations/${normalizedLanguage}/quran_${normalizedLanguage}.json`)),
                loadOptional("loadCover", () => import(`../assets/translations/${normalizedLanguage}/cover_${normalizedLanguage}.json`)),
                loadOptional("loadIntro", () => import(`../assets/translations/${normalizedLanguage}/introduction_${normalizedLanguage}.json`)),
                loadOptional("loadAppendices", () => import(`../assets/translations/${normalizedLanguage}/appendices_${normalizedLanguage}.json`)),
                loadOptional("loadApplication", () => import(`../assets/translations/${normalizedLanguage}/application_${normalizedLanguage}.json`)),
            ]);

            return {
                translation: translatedQuran?.default || null,
                coverData: translatedCover?.default || null,
                introduction: translatedIntro?.default || null,
                appendices: translatedAppendix?.default || null,
                application: translatedApplication?.default || null,
            };
        } catch (error) {
            console.error('Error loading translation bundle:', error);
            return null;
        }
    }, [isEnglishLanguage]);

    const loadMapTranslation = useCallback(async (language) => {
        const normalizedLanguage = (language || "").toLowerCase();

        if (!normalizedLanguage || isEnglishLanguage(normalizedLanguage)) {
            return null;
        }

        try {
            const translatedMap = await import(`../assets/translations/${normalizedLanguage}/map_${normalizedLanguage}.json`).catch(() => null);
            return translatedMap?.default || null;
        } catch (error) {
            console.error('Error loading map translation:', error);
            return null;
        }
    }, [isEnglishLanguage]);

    const getRequiredTranslationPlan = useCallback((page, shouldShowCover) => ({
        loadQuran: true,
        loadCover: Boolean(shouldShowCover),
        loadIntro: parseInt(page, 10) <= 22,
        loadAppendices: parseInt(page, 10) >= 396,
        loadApplication: true,
    }), []);

    const onIntroTranslationNeeded = useCallback(() => {
        const normalizedLang = (activeLangRef.current || "").toLowerCase();

        if (!normalizedLang || isEnglishLanguage(normalizedLang)) {
            return;
        }

        if (loadedSegmentsRef.current.loadIntro || introLoadPromiseRef.current) {
            return;
        }

        introLoadPromiseRef.current = (async () => {
            const translatedBundle = await loadCoreTranslations(normalizedLang, {
                loadQuran: false,
                loadCover: false,
                loadIntro: true,
                loadAppendices: false,
                loadApplication: false,
            });

            if (activeLangRef.current !== normalizedLang) {
                return;
            }

            loadedSegmentsRef.current.loadIntro = true;
            if (translatedBundle?.introduction) {
                setTranslationIntro(translatedBundle.introduction);
            }
        })().finally(() => {
            introLoadPromiseRef.current = null;
        });
    }, [isEnglishLanguage, loadCoreTranslations]);

    useEffect(() => {
        const normalizedLang = lang.toLowerCase();
        activeLangRef.current = normalizedLang;
        mapLoadPromiseRef.current = null;
        introLoadPromiseRef.current = null;
        const canUseBootData = bootData?.language === normalizedLang;

        if (isEnglishLanguage(normalizedLang)) {
            setTranslation(null);
            setTranslationApplication(application);
            setTranslationIntro(introductionContent);
            setTranslationAppx(appendicesContent);
            setTranslationMap(map);
            setCoverData(cover);
            resetTranslationProgress();
            loadedSegmentsRef.current = ALL_TRANSLATION_SEGMENTS.reduce((acc, key) => {
                acc[key] = true;
                return acc;
            }, {});
        } else if (canUseBootData) {
            setTranslation(bootData.translation || null);
            setTranslationApplication(bootData.application || application);
            setTranslationIntro(bootData.introduction || introductionContent);
            setTranslationAppx(bootData.appendices || appendicesContent);
            setTranslationMap(bootData.map || map);
            setCoverData(bootData.coverData || cover);
            resetTranslationProgress();

            loadedSegmentsRef.current = {
                loadQuran: Boolean(bootData.translation),
                loadCover: Boolean(bootData.coverData),
                loadIntro: Boolean(bootData.introduction),
                loadAppendices: Boolean(bootData.appendices),
                loadApplication: Boolean(bootData.application),
                loadMap: Boolean(bootData.map),
            };
        } else {
            setTranslation(null);
            setTranslationApplication(application);
            setTranslationIntro(introductionContent);
            setTranslationAppx(appendicesContent);
            setTranslationMap(map);
            setCoverData(cover);
            loadedSegmentsRef.current = {
                loadQuran: false,
                loadCover: false,
                loadIntro: false,
                loadAppendices: false,
                loadApplication: false,
                loadMap: false,
            };
        }

        localStorage.setItem("lang", lang);
    }, [lang, bootData, isEnglishLanguage, resetTranslationProgress]);

    useEffect(() => {
        let cancelled = false;
        const normalizedLang = lang.toLowerCase();

        if (isEnglishLanguage(normalizedLang)) {
            resetTranslationProgress();
            return () => {
                cancelled = true;
            };
        }

        const requiredPlan = getRequiredTranslationPlan(bookPage, showCover);
        const missingPlan = CORE_TRANSLATION_SEGMENTS.reduce((acc, key) => {
            acc[key] = Boolean(requiredPlan[key] && !loadedSegmentsRef.current[key]);
            return acc;
        }, {});

        const missingCoreSegments = CORE_TRANSLATION_SEGMENTS.filter((key) => missingPlan[key]);
        const hasMissingCore = missingCoreSegments.length > 0;
        if (!hasMissingCore) {
            resetTranslationProgress();
            return () => {
                cancelled = true;
            };
        }

        if (!translationProgressStartedAtRef.current) {
            translationProgressStartedAtRef.current = performance.now();
        }
        setTranslationLoadProgress((prev) => ({
            active: true,
            loaded: 0,
            total: missingCoreSegments.length,
            uiProgress: Math.max(0.1, prev.uiProgress || 0),
        }));
        startGuidedTranslationProgress();

        (async () => {
            const settledSegments = new Set();
            const translatedBundle = await loadCoreTranslations(normalizedLang, missingPlan, (segmentKey) => {
                if (cancelled || activeLangRef.current !== normalizedLang || !missingPlan[segmentKey] || settledSegments.has(segmentKey)) {
                    return;
                }

                settledSegments.add(segmentKey);
                setTranslationLoadProgress((prev) => {
                    if (!prev.active) {
                        return prev;
                    }
                    const actualProgress = Number(((settledSegments.size / missingCoreSegments.length) * 100).toFixed(1));
                    const nextLoaded = Math.min(prev.total, prev.loaded + 1);
                    return {
                        ...prev,
                        loaded: nextLoaded,
                        uiProgress: Math.max(prev.uiProgress, actualProgress),
                    };
                });
            });
            if (cancelled || activeLangRef.current !== normalizedLang) {
                return;
            }

            if (missingPlan.loadQuran) {
                loadedSegmentsRef.current.loadQuran = true;
                if (translatedBundle?.translation) {
                    setTranslation(translatedBundle.translation);
                }
            }

            if (missingPlan.loadCover) {
                loadedSegmentsRef.current.loadCover = true;
                if (translatedBundle?.coverData) {
                    setCoverData(translatedBundle.coverData);
                }
            }

            if (missingPlan.loadIntro) {
                loadedSegmentsRef.current.loadIntro = true;
                if (translatedBundle?.introduction) {
                    setTranslationIntro(translatedBundle.introduction);
                }
            }

            if (missingPlan.loadAppendices) {
                loadedSegmentsRef.current.loadAppendices = true;
                if (translatedBundle?.appendices) {
                    setTranslationAppx(translatedBundle.appendices);
                }
            }

            if (missingPlan.loadApplication) {
                loadedSegmentsRef.current.loadApplication = true;
                if (translatedBundle?.application) {
                    setTranslationApplication(translatedBundle.application);
                }
            }

            stopTranslationProgressTimer();
            setTranslationLoadProgress((prev) => ({
                ...prev,
                active: true,
                loaded: missingCoreSegments.length,
                total: missingCoreSegments.length,
                uiProgress: 100,
            }));

            const elapsed = performance.now() - translationProgressStartedAtRef.current;
            const remainingVisibleMs = Math.max(0, TRANSLATION_PROGRESS_MIN_VISIBLE_MS - elapsed);
            if (remainingVisibleMs > 0) {
                await new Promise((resolve) => window.setTimeout(resolve, remainingVisibleMs));
            }
            await new Promise((resolve) => window.setTimeout(resolve, TRANSLATION_PROGRESS_FINISH_HOLD_MS));
            if (cancelled || activeLangRef.current !== normalizedLang) {
                return;
            }

            resetTranslationProgress();
        })();

        return () => {
            cancelled = true;
        };
    }, [lang, bookPage, showCover, loadCoreTranslations, getRequiredTranslationPlan, isEnglishLanguage, resetTranslationProgress, startGuidedTranslationProgress, stopTranslationProgressTimer]);

    useEffect(() => {
        let cancelled = false;
        const normalizedLang = (lang || "").toLowerCase();

        if (!normalizedLang || isEnglishLanguage(normalizedLang)) {
            return () => {
                cancelled = true;
            };
        }

        const timer = window.setTimeout(async () => {
            if (cancelled || activeLangRef.current !== normalizedLang) {
                return;
            }

            const requiredPlan = getRequiredTranslationPlan(bookPage, showCover);
            const backgroundPlan = CORE_TRANSLATION_SEGMENTS.reduce((acc, key) => {
                const isNonPriorityForCurrentView = !requiredPlan[key];
                const isAlreadyLoading = key === 'loadIntro' ? Boolean(introLoadPromiseRef.current) : false;
                acc[key] = Boolean(isNonPriorityForCurrentView && !loadedSegmentsRef.current[key] && !isAlreadyLoading);
                return acc;
            }, {});

            if (!Object.values(backgroundPlan).some(Boolean)) {
                return;
            }

            const translatedBundle = await loadCoreTranslations(normalizedLang, backgroundPlan);
            if (cancelled || activeLangRef.current !== normalizedLang) {
                return;
            }

            if (backgroundPlan.loadCover) {
                loadedSegmentsRef.current.loadCover = true;
                if (translatedBundle?.coverData) {
                    setCoverData(translatedBundle.coverData);
                }
            }

            if (backgroundPlan.loadIntro) {
                loadedSegmentsRef.current.loadIntro = true;
                if (translatedBundle?.introduction) {
                    setTranslationIntro(translatedBundle.introduction);
                }
            }

            if (backgroundPlan.loadAppendices) {
                loadedSegmentsRef.current.loadAppendices = true;
                if (translatedBundle?.appendices) {
                    setTranslationAppx(translatedBundle.appendices);
                }
            }
        }, 420);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [lang, bookPage, showCover, loadCoreTranslations, getRequiredTranslationPlan, isEnglishLanguage]);

    useEffect(() => {
        const normalizedLang = (lang || "").toLowerCase();

        if (!normalizedLang || isEnglishLanguage(normalizedLang)) {
            return;
        }

        if (!translation || loadedSegmentsRef.current.loadMap || mapLoadPromiseRef.current) {
            return;
        }

        mapLoadPromiseRef.current = (async () => {
            const translatedMap = await loadMapTranslation(normalizedLang);
            if (activeLangRef.current !== normalizedLang) {
                return;
            }

            loadedSegmentsRef.current.loadMap = true;
            if (translatedMap) {
                setTranslationMap(translatedMap);
            }
        })().finally(() => {
            mapLoadPromiseRef.current = null;
        });
    }, [lang, translation, isEnglishLanguage, loadMapTranslation]);

    useEffect(() => {
        if (isAppendix) {
            setBookPage(397);
        }
    }, [isAppendix]);

    useEffect(() => () => {
        stopTranslationProgressTimer();
    }, [stopTranslationProgressTimer]);


    const hideCover = () => {
        setShowCover(false);
    };

    const translationProgressPercent = Math.max(0, Math.min(100, translationLoadProgress.uiProgress || 0));

    return (
        <div className={`Root select-none flex flex-col h-screen ${font}`}>
            {showCover && <Cover onCoverSeen={hideCover} coverData={coverData} lang={lang} onChangeLanguage={onChangeLanguage} />}
            {!showCover && <Book
                incomingSearch={isSearch ? isSearch : false}
                incomingAppendix={isAppendix ? isAppendix : false}
                incomingAppendixNumber={id ? (id > 0 && id < 39) ? id : 1 : 1}
                onChangeFont={onChangeFont}
                font={font}
                onChangeColor={onChangeColor}
                colors={colors} theme={theme}
                translationApplication={translationApplication}
                introductionContent={translationIntro}
                quranData={quranData}
                map={translationMap}
                appendicesContent={translationAppx}
                translation={translation}
                onChangeLanguage={onChangeLanguage}
                onPageChange={onBookPageChange}
                onIntroTranslationNeeded={onIntroTranslationNeeded}
                isTranslationLoading={translationLoadProgress.active || translationProgressPercent > 0}
                translationLoadProgress={translationProgressPercent}
                direction={(languages[lang] && languages[lang]["dir"]) ? languages[lang]["dir"] : 'ltr'}
            />}
        </div>
    );
}

export default Root;
