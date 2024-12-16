import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import defaultQuran from '../assets/qurantft.json';
import languages from '../assets/languages.json';
import application from '../assets/application.json';
import { mapQuranWithNotes } from '../utils/Mapper';

const Leaf = () => {
    const { lang = process.env.REACT_APP_DEFAULT_LANG || 'en', params } = useParams();
    const [quranmap, setQuranmap] = useState({});
    const [verseList, setVerseList] = useState({});
    const [titleList, setTitleList] = useState({});
    const [noteList, setNoteList] = useState({});
    const [uf, setUf] = useState(false);
    const loc = useLocation();
    const [direction, setDirection] = useState('ltr');
    const [translation, setTranslation] = useState(application);
    const [noteToggles, setNoteToggles] = useState({});

    const toggleNote = (noteKey) => {
        setNoteToggles((prevToggles) => ({
            ...prevToggles,
            [noteKey]: !prevToggles[noteKey],
        }));
    };

    useEffect(() => {
        // Function to process and set Quran data
        const processQuranData = (quranData) => {
            setQuranmap(mapQuranWithNotes(quranData));
        };

        if (lang && lang !== 'en') {
            // Dynamically load the translated Quran and Application data for the specified language
            import(`../assets/translations/${lang}/quran_${lang}.json`)
                .then(translatedQuran => {
                    processQuranData(translatedQuran.default);
                    setDirection((languages[lang] && languages[lang]["dir"]) ? languages[lang]["dir"] : 'ltr');
                })
                .catch(error => {
                    console.error("Error loading the translated Quran: ", error);
                    // Fallback to default Quran in case of error
                    processQuranData(defaultQuran);
                });
            import(`../assets/translations/${lang}/application_${lang}.json`)
                .then(translatedApplication => {
                    setTranslation(translatedApplication);
                })
                .catch(error => {
                    console.error("Error loading the translated Application data: ", error);
                    // Fallback to default Application data in case of error
                    setTranslation(application);
                });
        } else {
            // Use the default Quran data
            processQuranData(defaultQuran);
            setTranslation(application);
        }
    }, [lang]);

    useEffect(() => {
        let vl = {};
        let tl = {};
        let nl = {};

        function addVerseToCollection(key, surah, verse) {
            if (quranmap && quranmap[surah]) {
                vl[key] = quranmap[surah][verse];
                if (quranmap[surah]["t" + verse]) {
                    tl[key] = quranmap[surah]["t" + verse];
                }
                if (quranmap[surah]["n" + verse]) {
                    nl[key] = quranmap[surah]["n" + verse];
                }
            }
        }

        if (params && params.match(/^\d+:/)) {
            let formula;
            if (params.includes(";")) {
                formula = params.split(";");
            } else {
                formula = params.split("&");
            }
            formula.forEach((param) => {
                const trimmedParam = param.trim();
                if (!trimmedParam) {
                    return;
                }

                const [surah, versesString] = trimmedParam.split(":");
                if (versesString === undefined || versesString.trim() === "") {
                    if (quranmap && quranmap[surah]) {
                        Object.keys(quranmap[surah]).forEach((verseKey) => {
                            if (!verseKey.startsWith("t") && !verseKey.startsWith("n")) {
                                const key = `${surah}:${verseKey}`;
                                addVerseToCollection(key, surah, verseKey);
                            }
                        });
                    }
                } else {
                    const verseParts = versesString.split(",").filter(versePart => versePart.trim() !== "");

                    verseParts.forEach((versePart) => {
                        if (versePart.includes("-")) {
                            let [start, end] = versePart.split("-").map(Number);
                            if (!isNaN(start)) {
                                end = end === 0 ? start : end;
                                for (let verse = start; verse <= end; verse++) {
                                    const key = `${surah}:${verse}`;
                                    addVerseToCollection(key, surah, verse);
                                }
                            }
                        } else {
                            const verse = Number(versePart);
                            if (!isNaN(verse)) {
                                const key = `${surah}:${verse}`;
                                addVerseToCollection(key, surah, verse);
                            }
                        }
                    });
                }
            });

            setVerseList(vl);
            setTitleList(tl);
            setNoteList(nl);
        } else {
            setUf(true);
        }

    }, [params, quranmap]);

    return (
        <div className="select-text fixed w-screen h-full bg-gradient-to-r from-sky-500 to-cyan-500 pl-1 pb-2 flex flex-col justify-center items-center">
            <div className="text-base h-10 w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 absolute bottom-5 ">
                <Link to="/">
                    <img
                        src="/logo512.png"
                        alt="Logo"

                        className="mt-4"
                    />
                </Link>
            </div>
            {uf ? (
                <div className="text-neutral-50 text-3xl md:text-6xl ">
                    {loc.pathname + " ?"}
                </div>
            ) : (
                <div className="w-full md:text-xl lg:w-3/4 lg:text-2xl flex flex-col overflow-auto pr-1 mb-10 md:mb-12 lg:mb-14 mt-2.5">
                    {Object.entries(verseList).map(([key, text]) => (
                        <div dir={direction} key={key} className="text-neutral-100 text-justify hyphens-auto px-1 ">
                            {titleList[key] && (
                                <div
                                    key={key + "title"}
                                    className={`rounded-t whitespace-pre-line bg-gradient-to-r from-transparent via-blue-600/50 to-transparent text-center italic font-semibold py-1.5 px-2.5`}>
                                    {titleList[key]}
                                </div>
                            )}
                            <div
                                key={key + "verse"}
                                className={` bg-neutral-900/95 text-justify hyphens-auto py-1.5 px-2 ${noteList[key] ? `rounded-t shadow-t-md` : `shadow-md rounded mb-2`}`}>
                                <span className="text-sky-500">{key}</span> {text}
                            </div>
                            {noteList[key] && (
                                <div
                                    key={key + "note"}
                                    onClick={() => toggleNote(key + "note")}
                                    className={`whitespace-pre-line bg-green-700/95 hyphens-auto rounded-b py-1.5 px-2.5 mb-2 cursor-pointer transition-all duration-500 ease-linear ${noteToggles[key + "note"] ? 'max-h-[1000px] text-justify overflow-y-auto' : 'max-h-10 text-center'}`}
                                >
                                    {noteToggles[key + "note"] ? noteList[key] : translation.notes}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Leaf;
