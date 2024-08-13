import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import defaultQuran from '../assets/qurantft.json';
import { mapQuran } from '../utils/Mapper';

const Leaf = () => {
    const { lang = process.env.REACT_APP_DEFAULT_LANG || 'en', params } = useParams();
    const [quranmap, setQuranmap] = useState({});
    const [verseList, setVerseList] = useState({});
    const [titleList, setTitleList] = useState({});
    const [uf, setUf] = useState(false);
    const loc = useLocation();
    useEffect(() => {
        // Function to process and set Quran data
        const processQuranData = (quranData) => {
            setQuranmap(mapQuran(quranData));
        };

        if (lang && lang !== 'en') {
            // Dynamically load the translated Quran for the specified language
            import(`../assets/translations/${lang}/quran_${lang}.json`)
                .then(translatedQuran => {
                    processQuranData(translatedQuran.default);
                })
                .catch(error => {
                    console.error("Error loading the translated Quran: ", error);
                    // Fallback to default Quran in case of error
                    processQuranData(defaultQuran);
                });
        } else {
            // Use the default Quran data
            processQuranData(defaultQuran);
        }
    }, [lang]);

    useEffect(() => {
        let vl = {};
        let tl = {};
        if (params && params.match(/^\d+:/)) {
            const formula = params.includes(";") ? params.split(";") : params.includes("%") ? params.split("%") : null;
            if (formula) {
                formula.forEach((param) => {
                    const trimmedParam = param.trim();
                    if (!trimmedParam) {
                        return;
                    }

                    const [surah, versesString] = trimmedParam.split(":");
                    if (versesString === undefined || versesString.trim() === "") {
                        if (quranmap && quranmap[surah]) {
                            Object.keys(quranmap[surah]).forEach((verseKey) => {
                                if (!verseKey.startsWith("t")) {
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
            } else {
                setUf(true);
            }
            setVerseList(vl);
            setTitleList(tl);

            function addVerseToCollection(key, surah, verse) {
                if (quranmap && quranmap[surah]) {
                    vl[key] = quranmap[surah][verse];
                    if (quranmap[surah]["t" + verse]) {
                        tl[key] = quranmap[surah]["t" + verse];
                    }
                }
            }
        } else {
            setUf(true);
        }

    }, [params, quranmap]);

    return (
        <div className="select-text fixed w-screen h-screen bg-gradient-to-r from-sky-500 to-cyan-500 pl-1 pb-2 flex flex-col justify-center items-center">
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
                <div className="w-full md:text-xl lg:w-3/4 lg:text-2xl flex flex-col overflow-auto pr-1 mb-10 md:mb-12 lg:mb-14 ">
                    {Object.entries(verseList).map(([key, text]) => (
                        <div key={key} className="text-neutral-100 text-justify hyphens-auto px-1 ">
                            {titleList[key] && (
                                <div
                                    key={key + "title"}
                                    className={`rounded-t whitespace-pre-line bg-gradient-to-r from-sky-500 via-blue-900/90 to-cyan-500 text-center py-2 px-2.5`}>
                                    {titleList[key]}
                                </div>
                            )}
                            <div
                                key={key + "verse"}
                                className={`rounded shadow-md bg-neutral-900/95 text-justify hyphens-auto py-1.5 px-2 mb-2`}>
                                <span className="text-sky-500">{key}</span> {text}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Leaf;
