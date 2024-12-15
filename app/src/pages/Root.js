import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import Cover from '../components/Cover';
import Book from '../components/Book';
import { colorThemes } from '../utils/Theme';
import { setStatusBarStyle, initPlatform } from '../utils/Device';
import introductionContent from '../assets/introduction.json';
import quranData from '../assets/qurantft.json';
import appendicesContent from '../assets/appendices.json';
import application from '../assets/application.json';
import cover from '../assets/cover.json';
import map from '../assets/map.json';
import languages from '../assets/languages.json';

function Root() {
    const { language, id } = useParams();
    const location = useLocation();
    const isSearch = location.pathname.endsWith('/search');
    const isAppendix = location.pathname.match(/\/appendix\/\d+$/) !== null;

    const colors = useMemo(() => colorThemes, []);
    const [showCover, setShowCover] = useState(localStorage.getItem("qurantft-pn") ? false : ((isSearch || isAppendix) ? false : process.env.REACT_APP_DEFAULT_LANG ? false : true));
    const [coverData, setCoverData] = useState(cover);
    const [lang, setLang] = useState(language ? language : localStorage.getItem("lang") ? localStorage.getItem("lang") : process.env.REACT_APP_DEFAULT_LANG || "en");

    const [translation, setTranslation] = useState(null);
    const [translationApplication, setTranslationApplication] = useState(application);
    const [translationIntro, setTranslationIntro] = useState(introductionContent);
    const [translationAppx, setTranslationAppx] = useState(appendicesContent);
    const [translationMap, setTranslationMap] = useState(map);
    const [theme, setTheme] = useState(localStorage.getItem("theme") ? localStorage.getItem("theme") : "sky");
    const [font, setFont] = useState(localStorage.getItem("qurantft-font") ? localStorage.getItem("qurantft-font") : "font-sans");

    useEffect(() => {
        const initialize = async () => {
            await initPlatform();
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

    const loadTranslation = useCallback(async (language) => {
        try {
            const translatedQuran = await import(`../assets/translations/${language}/quran_${language}.json`)
                .catch(() => null);

            const translatedCover = await import(`../assets/translations/${language}/cover_${language}.json`)
                .catch(() => null);

            const translatedIntro = await import(`../assets/translations/${language}/introduction_${language}.json`)
                .catch(() => null);

            const translatedAppendix = await import(`../assets/translations/${language}/appendices_${language}.json`)
                .catch(() => null);

            const translationMap = await import(`../assets/translations/${language}/map_${language}.json`)
                .catch(() => null);

            if (translatedQuran) {
                setTranslation(translatedQuran.default);
            } else {
                console.error('Quran Translation file not found for language:', language);
                setTranslation(null);
            }

            if (translatedCover) {
                setCoverData(translatedCover.default);
            } else {
                console.error('Cover Translation file not found for language:', language);
            }

            if (translatedIntro) {
                setTranslationIntro(translatedIntro.default);
            } else {
                console.error('Introduction Translation file not found for language:', language);
            }

            if (translatedAppendix) {
                setTranslationAppx(translatedAppendix.default);
            } else {
                console.error('Appendices Translation file not found for language:', language);
            }

            if (translationMap) {
                setTranslationMap(translationMap.default);
            } else {
                console.error('Map Translation file not found for language:', language);
            }

            const translatedApplication = await import(`../assets/translations/${language}/application_${language}.json`)
                .catch(() => null);

            if (translatedApplication) {
                setTranslationApplication(translatedApplication.default);
            } else {
                console.error('Translation Application file not found for language:', language);
            }

        } catch (error) {
            console.error('Error loading translation:', error);
        }
    }, []);

    useEffect(() => {
        if (!lang.toLowerCase().includes("en")) {
            loadTranslation(lang);

        } else {
            setTranslation(null);
            setTranslationApplication(application);
            setTranslationIntro(introductionContent);
            setTranslationAppx(appendicesContent);
            setTranslationMap(map);
            setCoverData(cover);
        }
        localStorage.setItem("lang", lang)
    }, [lang, loadTranslation]);


    const hideCover = () => {
        setShowCover(false);
    };

    return (
        <div className={`Root select-none flex flex-col h-screen ${font}`}>
            {showCover && <Cover onCoverSeen={hideCover} coverData={coverData} lang={lang} onChangeLanguage={setLang} />}
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
                onChangeLanguage={setLang}
                direction={(languages[lang] && languages[lang]["dir"]) ? languages[lang]["dir"] : 'ltr'}
            />}
        </div>
    );
}

export default Root;
