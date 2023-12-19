import React, { useState, useEffect } from 'react';
import Splash from '../components/Splash';
import Book from '../components/Book';
import introductionContent from '../assets/introduction.json';
import quranData from '../assets/qurantft.json';
import appendicesContent from '../assets/appendices.json';
import application from '../assets/application.json';


function Root() {
    const [showSplash, setShowSplash] = useState(localStorage.getItem("qurantft-pn") ? false : true);
    const [translation, setTranslation] = useState(null);
    const [translationApplication, setTranslationApplication] = useState(application);

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

    const hideSplash = () => {
        setShowSplash(false);
    };

    return (
        <div className="Root select-none flex flex-col h-screen">
            {showSplash && <Splash onHideSplash={hideSplash} />}
            {!showSplash && <Book translationApplication={translationApplication} introductionContent={introductionContent} quranData={quranData} appendicesContent={appendicesContent} translation={translation} />}
        </div>
    );
}

export default Root;
