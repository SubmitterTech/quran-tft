import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import quran from '../assets/qurantft.json';

function Leaf() {
    const { params } = useParams();
    const [quranmap, setQuranmap] = useState({});

    const [verseList, setVerseList] = useState({});

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
            });
        });
        setQuranmap(qm);
    }, []);

    useEffect(() => {

        let vl = {};
        params.split(",").forEach((key) => {
            const [s,v] = key.trim().split(":")
            if (quranmap && quranmap[s]) {
                vl[key] = quranmap[s][v]
            }
        });

        setVerseList(vl);

        // Update the title
        const initialKey = params.split(",")[0]
        document.title = initialKey;

        // Update meta description
        let metaDescription = document.querySelector('meta[name="description"]');
        if (!metaDescription) {
            metaDescription = document.createElement('meta');
            metaDescription.setAttribute('name', 'description');
            document.head.appendChild(metaDescription);
        }

        // Set the content of the meta description
        if (quranmap && quranmap[initialKey.split(":")[0]]) {
            metaDescription.setAttribute('content', quranmap[initialKey.split(":")[0]][initialKey.split(":")[1]]);
        }

    }, [params, quranmap]);

    return (
        <div className={`w-screen h-screen bg-neutral-900 p-2`}>
            <div className={`w-full flex flex-col space-y-2 overflow-auto`}>
                {Object.entries(verseList).map(([key, text]) => (
                    <div className={`rounded shadow-lg text-neutral-100 bg-neutral-700 text-justify hyphens-auto p-1.5`}>
                        {key} {` `} {text}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Leaf;
