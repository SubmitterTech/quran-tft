import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import quran from '../assets/qurantft.json';

function Leaf() {
    const { params } = useParams();
    const [quranmap, setQuranmap] = useState({});

    const [verseList, setVerseList] = useState({});
    const [titleList, setTitleList] = useState({});

    useEffect(() => {
        let qm = {};
        Object.values(quran).forEach((value) => {
            Object.entries(value.sura).forEach(([sura, content]) => {
                // Initialize qm[sura] as an object if it doesn't exist
                if (!qm[sura]) {
                    qm[sura] = {};
                }

                Object.entries(content.verses).forEach(([verse, text]) => {
                    qm[sura][verse] = text;
                });

                Object.entries(content.titles).forEach(([title, text]) => {
                    qm[sura]["t" + title] = text;
                });
            });
        });
        setQuranmap(qm);
    }, []);

    useEffect(() => {

        let vl = {};
        let tl = {};
        params.split(";").forEach((key) => {
            const [s, v] = key.trim().split(":")
            if (quranmap && quranmap[s]) {
                vl[key] = quranmap[s][v]
                if (quranmap[s]["t" + v]) {
                    tl[key] = quranmap[s]["t" + v]
                }
            }
        });

        setVerseList(vl);
        setTitleList(tl);

    }, [params, quranmap]);

    return (
        <div className={`select-text w-screen h-screen bg-gradient-to-r from-sky-400 to-cyan-400 pl-2 py-2 flex flex-col justify-center`}>
            <div className={`w-full flex flex-col overflow-auto pr-2`}>
                {Object.entries(verseList).map(([key, text]) => (
                    <div className={` text-neutral-100 text-justify hyphens-auto p-1.5`}>
                        <div className={`text-center hyphens-auto p-1.5 text-neutral-900`}>
                            {key}
                        </div>
                        {titleList[key] &&
                            <div className={`rounded shadow-md bg-sky-800/90 text-justify hyphens-auto py-1.5 px-2 mb-2`}>
                                {titleList[key]}
                            </div>}
                        <div className={`rounded shadow-md bg-neutral-900/90 text-justify hyphens-auto py-1.5 px-2`}>
                            {text}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Leaf;
