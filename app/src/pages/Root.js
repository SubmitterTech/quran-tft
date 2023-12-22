import React, { useState, useEffect } from 'react';
import Cover from '../components/Cover';
import Book from '../components/Book';
import introductionContent from '../assets/introduction.json';
import quranData from '../assets/qurantft.json';
import appendicesContent from '../assets/appendices.json';
import application from '../assets/application.json';


function Root() {
    const [showCover, setShowCover] = useState(localStorage.getItem("qurantft-pn") ? false : true);
    const [translation, setTranslation] = useState(null);
    const [translationApplication, setTranslationApplication] = useState(application);



    const [theme, setTheme] = useState(localStorage.getItem("theme") ? localStorage.getItem("theme"): "sky");

    const colors = {
        "light": {
            "text-background": "bg-neutral-300",
            "app-background": "bg-neutral-200",
            "notes-background": "bg-neutral-200",
            "base-background": "bg-neutral-100",
            "verse-detail-background": "bg-neutral-100",
            "encrypted-background": "bg-neutral-200",
            "relation-background": "bg-neutral-200",
            "table-title-text": "text-neutral-700",
            "border": "border-neutral-900",
            "text": "text-neutral-900",
            "app-text": "text-neutral-800",
            "page-text": "text-neutral-900/50",
            "log-text": "text-neutral-800/80",
            "verse-border": "border-neutral-800/80",
            "ring": "ring-neutral-800/80"
        },
        "dark": {
            "text-background": "bg-neutral-700",
            "app-background": "bg-neutral-800",
            "notes-background": "bg-neutral-800",
            "base-background": "bg-neutral-900",
            "verse-detail-background": "bg-neutral-900",
            "encrypted-background": "bg-neutral-800",
            "relation-background": "bg-neutral-800",
            "table-title-text": "text-neutral-300",
            "border": "border-neutral-200",
            "text": "text-neutral-200",
            "app-text": "text-neutral-300",
            "page-text": "text-neutral-200/50",
            "log-text": "text-neutral-300/80",
            "verse-border": "border-neutral-300/80",
            "ring": "ring-neutral-300/80"

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
            "page-text": "text-sky-100/50",
            "log-text": "text-neutral-300/80",
            "verse-border": "border-sky-500/80",
            "ring": "ring-sky-500/80"
        }
    }

    const onChangeTheme = (theme) => {
        setTheme(theme);
        localStorage.setItem("theme", theme)
    };

    const lang = navigator.language || navigator.userLanguage;

    useEffect(() => {
        loadTranslation(lang);
    }, [lang]);

    const loadTranslation = async (language) => {
        try {
            const translatedQuran = await import(`../assets/translations/${language}/quran_${language}.json`)
                .catch(() => null);

            if (translatedQuran) {
                setTranslation(translatedQuran.default);
            } else {
                console.error('Translation file not found for language:', language);
                setTranslation(null);
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
            {showCover && <Cover onCoverSeen={hideCover} />}
            {!showCover && <Book
                onChangeTheme={onChangeTheme}
                colors={colors} theme={theme}
                translationApplication={translationApplication}
                introductionContent={introductionContent}
                quranData={quranData}
                appendicesContent={appendicesContent}
                translation={translation} />}
        </div>
    );
}

export default Root;
