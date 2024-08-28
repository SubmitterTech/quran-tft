export const mapAppendices = (appendices, translationApplication) => {
    const appendixMap = {};
    let currentAppendixNum = 1;
    let globalContentOrder = 1;

    appendices.forEach(page => {
        if (page.page < 397) {
            return;
        }
        let allContentItems = [];
        Object.entries(page.titles || {}).forEach(([key, title]) => {
            allContentItems.push({
                type: 'title',
                content: title,
                key: parseInt(key)
            });
        });

        const collectContent = (type, data) => {
            Object.entries(data || {}).forEach(([key, value]) => {
                if (value) {
                    allContentItems.push({ type, content: value, key: parseInt(key) });
                }

            });
        };
        collectContent('text', page.text);
        collectContent('evidence', page.evidence);
        collectContent('table', page.table);
        collectContent('picture', page.picture);

        allContentItems.sort((a, b) => a.key - b.key);
        allContentItems.forEach(item => {
            item.order = globalContentOrder++;
            if (item.type === 'title') {
                const appx = translationApplication ? translationApplication.appendix : "Appendix";
                const match = item.content.match(new RegExp(`${appx}\\s*(\\d+)`));
                if (/\d+/.test(item.content) && match) {
                    currentAppendixNum = match[1];
                }
            }
            if (!appendixMap[currentAppendixNum]) {
                appendixMap[currentAppendixNum] = { content: [] };
            }

            appendixMap[currentAppendixNum].content.push(item);
        });
    });

    Object.values(appendixMap).forEach(appendix => {
        appendix.content.sort((a, b) => a.order - b.order);
    });

    return appendixMap;
};

export const mapQuran = (quran) => {
    let qm = {};
    Object.values(quran).forEach((value) => {
        Object.entries(value.sura).forEach(([sura, content]) => {
            // Initialize qm[sura] as an object if it doesn't exist
            if (!qm[sura]) {
                qm[sura] = {};
            }

            Object.entries(content.verses).forEach(([verse, text]) => {
                qm[sura][verse.trim()] = text;
            });

            Object.entries(content.titles).forEach(([title, text]) => {
                qm[sura]["t" + title] = text;
            });
        });
    });
    return qm;
};

export const mapQuranWithNotes = (quran) => {
    let qm = {};

    Object.values(quran).forEach((value) => {
        Object.entries(value.sura).forEach(([sura, content]) => {
            // Initialize qm[sura] as an object if it doesn't exist
            if (!qm[sura]) {
                qm[sura] = {};
            }

            // Map verses
            Object.entries(content.verses).forEach(([verse, text]) => {
                qm[sura][verse.trim()] = text;
            });

            // Map titles
            Object.entries(content.titles).forEach(([title, text]) => {
                qm[sura]["t" + title] = text;
            });
        });

        // Variables to keep track of the last matched Surah and Verse
        let lastMatchedSura = null;
        let lastMatchedVerse = null;

        // Map notes at the page level
        if (value.notes && value.notes.data) {
            value.notes.data.forEach(note => {
                const noteKey = note.match(/^\*(\d+):(\d+)/); // Match notes with "sura:verse" format

                if (noteKey) {
                    const [, noteSura, noteVerse] = noteKey;
                    if (!qm[noteSura]) {
                        qm[noteSura] = {};
                    }
                    qm[noteSura]["n" + noteVerse] = qm[noteSura]["n" + noteVerse] ? qm[noteSura]["n" + noteVerse] + "\n\n" + note : note;

                    // Update last matched Surah and Verse
                    lastMatchedSura = noteSura;
                    lastMatchedVerse = noteVerse;
                } else if (lastMatchedSura && lastMatchedVerse) {
                    // Attach the note to the last matched Surah and Verse
                    qm[lastMatchedSura]["n" + lastMatchedVerse] = qm[lastMatchedSura]["n" + lastMatchedVerse] ? qm[lastMatchedSura]["n" + lastMatchedVerse] + "\n\n" + note : note;
                }
            });
        }
    });

    return qm;
};


export const adjustReference = (ref) => {
    const reverseRegex = /(\d+-\d+:\d+)/g;
    if (ref.includes("-") && ref.match(reverseRegex)) {
        return ref.trim().split('-').reverse().join('-');
    }
    return ref;
};

export const generateReferenceMap = (quran) => {
    const referenceMap = {};

    Object.entries(quran).forEach(([pageNumber, value]) => {
        // Ensure that pageValues is an array
        const pageValues = Array.isArray(value.page) ? value.page : [value.page];
        const suraVersePattern = /\d+:\d+-?(\d+)?/g;
        let matches = [];

        pageValues.forEach(pageValue => {
            const match = pageValue.match(suraVersePattern);
            if (match) {
                matches = matches.concat(match);
            }
        });

        referenceMap[pageNumber] = matches;
    });

    return referenceMap;
};

export const transformAppendices = (appc) => {
    const lines = appc[1].evidence["2"].lines;

    const newAppendices = Object.entries(lines).map(([key, value]) => {

        const match = value.match(/^(\d+)\.\s*(.+)/);
        if (match && key > 1) {
            const elements = value.split(".").filter(element => element);

            return { number: parseInt(elements[0]), title: elements[1].trim() };
        }
        return null;
    }).filter(Boolean);

    return newAppendices;
};

export const extractReferenceDetails = (reference) => {
    let [sura, verses] = reference.split(':');
    let verseStart, verseEnd;

    if (verses.includes('-')) {
        [verseStart, verseEnd] = verses.split('-').map(Number);
    } else {
        verseStart = verseEnd = parseInt(verses);
    }

    return { sura, verseStart, verseEnd };
};

export const isVerseInRange = (verseStart, verseEnd, verseStartMap, verseEndMap) => {
    return !(verseEnd < verseStartMap || verseStart > verseEndMap);
};

export const findPageNumberInSuraVerses = (sura, verseStart, verseEnd, suraVersesArray) => {
    for (const suraVerses of suraVersesArray) {
        const [suraMap, verseRange] = suraVerses.split(':');
        const [verseStartMap, verseEndMap] = verseRange.includes('-')
            ? verseRange.split('-').map(Number)
            : [parseInt(verseRange), parseInt(verseRange)];

        if (suraMap === sura && isVerseInRange(verseStart, verseEnd, verseStartMap, verseEndMap)) {
            return true;
        }
    }
    return false;
};

export const findPageNumber = (referenceMap, reference) => {
    const { sura, verseStart, verseEnd } = extractReferenceDetails(reference);

    for (const [pageNumber, suraVersesArray] of Object.entries(referenceMap)) {
        if (findPageNumberInSuraVerses(sura, verseStart, verseEnd, suraVersesArray)) {
            return pageNumber;
        }
    }

    return null;
};

export const generateFormula = (list) => {
    const sortedList = list.sort((a, b) => {
        const [suraA, verseA] = a.split(':').map(Number);
        const [suraB, verseB] = b.split(':').map(Number);

        if (suraA !== suraB) {
            return suraA - suraB;
        } else {
            return verseA - verseB;
        }
    });


    const grouped = {};
    sortedList.forEach(item => {
        const [sura, verse] = item.split(':').map(Number);
        if (!grouped[sura]) {
            grouped[sura] = [];
        }
        grouped[sura].push(verse);
    });

    const formula = Object.entries(grouped).map(([sura, verses]) => {
        verses.sort((a, b) => a - b);

        const ranges = [];
        let start = verses[0];
        let end = verses[0];

        for (let i = 1; i < verses.length; i++) {
            if (verses[i] === end + 1) {
                end = verses[i];
            } else {
                if (start === end) {
                    ranges.push(`${start}`);
                } else {
                    ranges.push(`${start}-${end}`);
                }
                start = verses[i];
                end = verses[i];
            }
        }

        if (start === end) {
            ranges.push(`${start}`);
        } else {
            ranges.push(`${start}-${end}`);
        }

        return `${sura}:${ranges.join(",")}`;
    }).join("&");

    return formula;
};