import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import defaultQuran from '../assets/qurantft.json';
import languages from '../assets/languages.json';
import { mapQuranWithNotes } from '../utils/Mapper';

const LEAF_BACKGROUND_COLOR = '#414833';
const NOTE_ACCENT_COLOR = '#7f5539';
const VERSE_SURFACE_COLOR = '#ffe6a7';
const TITLE_BESMELE_TEXT_COLOR = '#f0f0f0';
const NOTE_PANEL_MAX_HEIGHT = '57vh';
const TITLE_DECORATION_PATTERN = /^[\s♦]+$/;

const parseLeafTitle = (title, suraNumber) => {
    if (typeof title !== 'string' || !title.includes('♦')) {
        return null;
    }

    const cleanedLines = title
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !TITLE_DECORATION_PATTERN.test(line));

    if (cleanedLines.length === 0) {
        return null;
    }

    const lastLine = cleanedLines[cleanedLines.length - 1] || '';
    const hasBesmeleLine = cleanedLines.length > 2 || (cleanedLines.length === 2 && !/^\(.*\)$/.test(lastLine));
    const headerLines = hasBesmeleLine ? cleanedLines.slice(0, -1) : cleanedLines;
    const besmeleLine = hasBesmeleLine ? lastLine : '';
    const headerText = headerLines.join(' ').trim();

    let suraLabel = '';
    let suraNames = '';

    if (headerText.includes(':')) {
        const [labelPart, ...nameParts] = headerText.split(':');
        suraLabel = labelPart.trim();
        suraNames = nameParts.join(':').trim();
    } else {
        suraLabel = headerLines[0] || '';
        suraNames = headerLines.slice(1).join(' ').trim();
    }

    if (parseInt(suraNumber, 10) === 9 && suraNames) {
        const words = suraNames.split(/\s+/);
        const firstLine = words.slice(0, 2).join(' ');
        const secondLine = words.slice(2).join(' ');
        suraNames = secondLine ? `${firstLine}\n${secondLine}` : firstLine;
    }

    return { suraLabel, suraNames, besmeleLine };
};

const Leaf = () => {
    const { lang = process.env.REACT_APP_DEFAULT_LANG || 'en', params } = useParams();
    const [quranmap, setQuranmap] = useState({});
    const [verseList, setVerseList] = useState({});
    const [titleList, setTitleList] = useState({});
    const [noteList, setNoteList] = useState({});
    const [uf, setUf] = useState(false);
    const loc = useLocation();
    const [direction, setDirection] = useState('ltr');
    const [noteToggles, setNoteToggles] = useState({});
    const shouldUsePersianSans = (lang || '').toLowerCase() === 'fa';

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

        setDirection((languages[lang] && languages[lang]["dir"]) ? languages[lang]["dir"] : 'ltr');

        if (lang && lang !== 'en') {
            // Dynamically load translated Quran data for the specified language
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
            setNoteToggles({});
            setUf(false);
        } else {
            setVerseList({});
            setTitleList({});
            setNoteList({});
            setNoteToggles({});
            setUf(true);
        }

    }, [params, quranmap]);

    return (
        <div
            className={`select-text fixed w-screen h-full pb-2 flex flex-col justify-center items-center ${shouldUsePersianSans ? 'font-vazirmatn' : ''}`}
            style={{ backgroundColor: LEAF_BACKGROUND_COLOR }}
        >
            <div
                className="text-base h-14 w-14 md:h-16 md:w-16 lg:h-18 lg:w-18 absolute bottom-0 p-0.5 rounded-t-full z-50"
                style={{ backgroundColor: LEAF_BACKGROUND_COLOR }}
            >
                <Link to="/">
                    <img
                        src="/logo512.png"
                        alt="Logo"
                    />
                </Link>
            </div>
            {uf ? (
                <div className="text-neutral-50 text-3xl md:text-6xl ">
                    {loc.pathname + " ?"}
                </div>
            ) : (
                <div className="w-full lg:w-3/4 text-base lg:text-lg xl:text-xl flex flex-col overflow-auto pb-12 md:pb-14 lg:pb-16 mt-0.5">
                    {Object.entries(verseList).map(([key, text]) => {
                        const hasNote = Boolean(noteList[key]);
                        const isNoteOpen = Boolean(noteToggles[key]);
                        const [suraNumber] = key.split(':');
                        const parsedTitle = parseLeafTitle(titleList[key], suraNumber);

                        return (
                            <div dir={direction} key={key} className="text-neutral-950 text-justify hyphens-auto px-2">
                                {titleList[key] && (
                                    <div
                                        key={key + "title"}
                                        className={` w-full flex items-center justify-center`}>
                                        {parsedTitle ? (
                                            <div
                                                className="my-1.5 pt-1 px-2 text-center italic font-medium flex flex-col space-y-1"
                                                style={{ backgroundColor: 'transparent' }}
                                            >
                                                {parsedTitle.suraLabel && (
                                                    <div className="not-italic" style={{ color: TITLE_BESMELE_TEXT_COLOR }}>
                                                        {parsedTitle.suraLabel}
                                                    </div>
                                                )}
                                                {parsedTitle.suraNames && (
                                                    <div className="whitespace-pre-line" style={{ color: TITLE_BESMELE_TEXT_COLOR }}>
                                                        {parsedTitle.suraNames}
                                                    </div>
                                                )}
                                                {parsedTitle.besmeleLine && (
                                                    <div className="text-sm md:text-base" style={{ color: TITLE_BESMELE_TEXT_COLOR }}>
                                                        {parsedTitle.besmeleLine}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div
                                                className="rounded-t mt-1.5 pt-0.5 px-1 whitespace-pre-line text-center italic font-medium"
                                                style={{ backgroundColor: VERSE_SURFACE_COLOR }}
                                            >
                                                {titleList[key]}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div
                                    key={key + "verse"}
                                    onClick={hasNote ? () => toggleNote(key) : undefined}
                                    onKeyDown={hasNote ? (event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            toggleNote(key);
                                        }
                                    } : undefined}
                                    role={hasNote ? "button" : undefined}
                                    tabIndex={hasNote ? 0 : undefined}
                                    className={`relative text-justify hyphens-auto font-light px-1 ${hasNote ? `cursor-pointer` : ``} ${hasNote && isNoteOpen ? `rounded-t shadow-t-md` : `shadow-md rounded mb-0.5`}`}
                                    style={{ backgroundColor: VERSE_SURFACE_COLOR }}
                                >
                                    {hasNote && (
                                        <span
                                            aria-hidden="true"
                                            className={`pointer-events-none absolute right-0 bottom-0 h-3 w-3 transition-all duration-200 ease-out ${isNoteOpen ? `rounded-tl-full`: `rounded-tl-md rounded-br`}`}
                                            style={{ backgroundColor: NOTE_ACCENT_COLOR }}
                                        />
                                    )}
                                    <span
                                        className="font-semibold text-neutral-950"
                                        style={hasNote ? { color: NOTE_ACCENT_COLOR } : undefined}
                                    >
                                        {key}
                                    </span>{' '}
                                    {text}
                                </div>
                                {hasNote && (
                                    <div
                                        key={key + "note"}
                                        className={`whitespace-pre-line text-white hyphens-auto font-light rounded-b px-1 transition-all duration-200 ease-in-out ${isNoteOpen ? 'py-1 mb-0.5 opacity-100 shadow-md overflow-y-auto' : 'py-0 mb-0 opacity-0 overflow-hidden'}`}
                                        style={{
                                            backgroundColor: NOTE_ACCENT_COLOR,
                                            maxHeight: isNoteOpen ? NOTE_PANEL_MAX_HEIGHT : 0,
                                        }}
                                    >
                                        {noteList[key]}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Leaf;
