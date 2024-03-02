import React, { useState, useEffect } from 'react';
import Cover from '../components/Cover';
import Book from '../components/Book';
import introductionContent from '../assets/introduction.json';
import quranData from '../assets/qurantft.json';
import appendicesContent from '../assets/appendices.json';
import application from '../assets/application.json';
import cover from '../assets/cover.json';
import map from '../assets/map.json';

function Root() {
    const colors = {
        "light": {
            "text-background": "bg-neutral-200",
            "app-background": "bg-neutral-50",
            "notes-background": "bg-neutral-200",
            "base-background": "bg-neutral-100",
            "verse-detail-background": "bg-neutral-100",
            "encrypted-background": "bg-neutral-200",
            "relation-background": "bg-neutral-200",
            "table-title-text": "text-neutral-700",
            "border": "border-neutral-900",
            "text": "text-neutral-900",
            "app-text": "text-neutral-800",
            "page-text": "text-neutral-900/60",
            "log-text": "text-neutral-800/80",
            "verse-border": "border-neutral-800/80",
            "verse-ring": "ring-neutral-700/50",
            "title-ring": "ring-neutral-300/50",
            "ring": "ring-neutral-800/80",
            "focus-ring": "focus:ring-neutral-800/80",
            "focus-text": "focus:text-neutral-800",
            "matching-text": "text-pink-500",
            "matching-border": "border-pink-500"
        },
        "dark": {
            "text-background": "bg-neutral-800",
            "app-background": "bg-neutral-950",
            "notes-background": "bg-neutral-700",
            "base-background": "bg-neutral-900",
            "verse-detail-background": "bg-neutral-900",
            "encrypted-background": "bg-neutral-800",
            "relation-background": "bg-neutral-800",
            "table-title-text": "text-neutral-300",
            "border": "border-neutral-200",
            "text": "text-neutral-200",
            "app-text": "text-neutral-300",
            "page-text": "text-neutral-200/60",
            "log-text": "text-neutral-300/80",
            "verse-border": "border-neutral-300/80",
            "verse-ring": "ring-neutral-300/50",
            "title-ring": "ring-neutral-300/50",
            "ring": "ring-neutral-300/80",
            "focus-ring": "focus:ring-neutral-200/80",
            "focus-text": "focus:text-neutral-200",
            "matching-text": "text-fuchsia-400",
            "matching-border": "border-fuchsia-400"
        },
        "sky": {
            "text-background": "bg-sky-800",
            "app-background": "bg-sky-950",
            "notes-background": "bg-neutral-700",
            "base-background": "bg-neutral-800",
            "verse-detail-background": "bg-neutral-800",
            "encrypted-background": "bg-neutral-700",
            "relation-background": "bg-neutral-700",
            "table-title-text": "text-neutral-300",
            "border": "border-sky-100",
            "text": "text-neutral-100",
            "app-text": "text-neutral-300",
            "page-text": "text-sky-100/60",
            "log-text": "text-neutral-300/80",
            "verse-border": "border-sky-500/80",
            "verse-ring": "ring-amber-400/70",
            "title-ring": "ring-neutral-200/70",
            "ring": "ring-sky-500/80",
            "focus-ring": "focus:ring-neutral-200/80",
            "focus-text": "focus:text-neutral-200",
            "matching-text": "text-amber-400",
            "matching-border": "border-amber-400"

        },
        "green": {
            "text-background": "bg-teal-800",
            "app-background": "bg-teal-950",
            "notes-background": "bg-neutral-700",
            "base-background": "bg-neutral-900",
            "verse-detail-background": "bg-neutral-800",
            "encrypted-background": "bg-neutral-700/70",
            "relation-background": "bg-neutral-700/70",
            "table-title-text": "text-neutral-300",
            "border": "border-teal-100",
            "text": "text-neutral-200",
            "app-text": "text-neutral-300",
            "page-text": "text-neutral-200/60",
            "log-text": "text-neutral-300/80",
            "verse-border": "border-teal-500/80",
            "verse-ring": "ring-orange-400/70",
            "title-ring": "ring-neutral-200/70",
            "ring": "ring-teal-500/80",
            "focus-ring": "focus:ring-neutral-200/80",
            "focus-text": "focus:text-neutral-100",
            "matching-text": "text-orange-400",
            "matching-border": "border-orange-400"
        },
        "indigo": {
            "text-background": "bg-indigo-800",
            "app-background": "bg-indigo-950",
            "notes-background": "bg-neutral-700",
            "base-background": "bg-neutral-800",
            "verse-detail-background": "bg-neutral-800",
            "encrypted-background": "bg-indigo-600/70",
            "relation-background": "bg-indigo-600/70",
            "table-title-text": "text-neutral-300",
            "border": "border-indigo-100",
            "text": "text-neutral-100",
            "app-text": "text-neutral-300",
            "page-text": "text-indigo-100/60",
            "log-text": "text-neutral-300/80",
            "verse-border": "border-indigo-500/80",
            "verse-ring": "ring-lime-400/70",
            "title-ring": "ring-neutral-200/70",
            "ring": "ring-indigo-500/80",
            "focus-ring": "focus:ring-neutral-200/80",
            "focus-text": "focus:text-neutral-200",
            "matching-text": "text-lime-400",
            "matching-border": "border-lime-400"
        }
    };

    const [showCover, setShowCover] = useState(localStorage.getItem("qurantft-pn") ? false : (process.env.REACT_APP_DEFAULT_LANG ? false : true));
    const [coverData, setCoverData] = useState(cover);
    const [lang, setLang] = useState(localStorage.getItem("lang") ? localStorage.getItem("lang") : process.env.REACT_APP_DEFAULT_LANG || "en");

    const [translation, setTranslation] = useState(null);
    const [translationApplication, setTranslationApplication] = useState(application);
    const [translationIntro, setTranslationIntro] = useState(introductionContent);
    const [translationAppx, setTranslationAppx] = useState(appendicesContent);
    const [translationMap, setTranslationMap] = useState(map);



    const [theme, setTheme] = useState(localStorage.getItem("theme") ? localStorage.getItem("theme") : "sky");

    const onChangeTheme = (theme) => {
        setTheme(theme);
        localStorage.setItem("theme", theme)
    };

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
    }, [lang]);

    const loadTranslation = async (language) => {
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
    };

    const hideCover = () => {
        setShowCover(false);
    };

    return (
        <div className={`Root select-none flex flex-col h-screen`}>
            {showCover && <Cover onCoverSeen={hideCover} coverData={coverData} lang={lang} onChangeLanguage={setLang} />}
            {!showCover && <Book
                onChangeTheme={onChangeTheme}
                colors={colors} theme={theme}
                translationApplication={translationApplication}
                introductionContent={translationIntro}
                quranData={quranData}
                map={translationMap}
                appendicesContent={translationAppx}
                translation={translation} 
                onChangeLanguage={setLang}
                />}
        </div>
    );
}

export default Root;
