import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import defaultQuran from '../assets/qurantft.json'; // Import the default Quran data
import { mapQuran } from '../utils/Mapper';

const Leaf = () => {
    const { lang = process.env.REACT_APP_DEFAULT_LANG || 'en', params } = useParams();
    const [quranmap, setQuranmap] = useState({});
    const [verseList, setVerseList] = useState({});
    const [titleList, setTitleList] = useState({});

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
    
        params.split(";").forEach((param) => {
            const trimmedParam = param.trim();
            if (!trimmedParam) {
                return;
            }
    
            const [surah, versesString] = trimmedParam.split(":");
            if (!versesString) {
                return;
            }
    
            const verseParts = versesString.split(",").filter(versePart => versePart.trim() !== "");
    
            verseParts.forEach((versePart) => {
                if (versePart.includes("-")) {
                    // Handling range of verses
                    const [start, end] = versePart.split("-").map(Number);
                    if (!isNaN(start) && !isNaN(end)) {
                        for (let verse = start; verse <= end; verse++) {
                            const key = `${surah}:${verse}`;
                            addVerseToCollection(key, surah, verse);
                        }
                    }
                } else {
                    // Handling a single verse
                    const verse = Number(versePart);
                    if (!isNaN(verse)) {
                        const key = `${surah}:${verse}`;
                        addVerseToCollection(key, surah, verse);
                    }
                }
            });
        });
    
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
    
    }, [params, quranmap]);
    
    return (
        <div className={`select-text w-screen h-screen bg-gradient-to-r from-sky-400 to-cyan-400 pl-2 py-2 flex flex-col justify-center items-center`}>
            <div className={`w-full lg:w-1/2 flex flex-col overflow-auto pr-2`}>
                {Object.entries(verseList).map(([key, text]) => (
                    <div key={key} className={` text-neutral-100 text-justify hyphens-auto p-1.5`}>
                        {/* <div className={`text-center hyphens-auto p-1.5 text-neutral-900`}>
                            {key}
                        </div> */}
                        {titleList[key] &&
                            <div key={key + "title"} className={`rounded shadow-lg bg-sky-900/90 text-justify hyphens-auto py-2 px-2.5 mb-1.5`}>
                                {titleList[key]}
                            </div>}
                        <div key={key + "verse"} className={`rounded shadow-lg bg-neutral-900/90 text-justify hyphens-auto py-1.5 px-2 mb-2`}>
                            <span className={`text-sky-500`}>{key}</span> {text}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Leaf;
