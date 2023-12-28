import React, { useState, useEffect } from 'react';
import Cover from '../components/Cover';
import Book from '../components/Book';
import introductionContent from '../assets/introduction.json';
import quranData from '../assets/qurantft.json';
import appendicesContent from '../assets/appendices.json';
import application from '../assets/application.json';
import cover from '../assets/cover.json';
import colors from '../assets/colors.json';


function Root() {
    const [showCover, setShowCover] = useState(localStorage.getItem("qurantft-pn") ? false : true);
    const [coverData, setCoverData] = useState(cover);
    const [lang, setLang] = useState(localStorage.getItem("lang") ? localStorage.getItem("lang") : "en");

    const [translation, setTranslation] = useState(null);
    const [translationApplication, setTranslationApplication] = useState(application);
    const [translationIntro, setTranslationIntro] = useState(introductionContent);
    const [translationAppx, setTranslationAppx] = useState(appendicesContent);



    const [theme, setTheme] = useState(localStorage.getItem("theme") ? localStorage.getItem("theme") : "sky");

    const onChangeTheme = (theme) => {
        setTheme(theme);
        localStorage.setItem("theme", theme)
    };

    useEffect(() => {
        if (!lang.toLowerCase().includes("en")) {
            loadTranslation(lang);
            localStorage.setItem("lang", lang)
        } else {
            setTranslation(null);
            setCoverData(cover);
        }
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
                appendicesContent={translationAppx}
                translation={translation} />}
        </div>
    );
}

export default Root;
