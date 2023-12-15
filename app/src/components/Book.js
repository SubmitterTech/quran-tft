import React, { useState, useEffect } from 'react';
import Pages from '../components/Pages';
import quranData from '../assets/qurantft.json';
import Jump from '../components/Jump';
import '../assets/Book.css';
import introductionContent from '../assets/introduction.json';
import appendicesContent from '../assets/appendices.json';



const Book = () => {
    const [currentPage, setCurrentPage] = useState(parseInt(localStorage.getItem("qurantft-pn")) ? parseInt(localStorage.getItem("qurantft-pn")) : 5);
    const [pageHistory, setPageHistory] = useState([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [selectedSura, setSelectedSura] = useState(null);
    const [selectedVerse, setSelectedVerse] = useState(null);
    const bookContent = introductionContent.concat(appendicesContent);
    const images = require.context('../assets/', false, /\.jpg$/);

    const handleJump = async (page, suraNumber, verseNumber) => {
        updatePage(parseInt(page), suraNumber, verseNumber);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
    };

    const updatePage = (newPage, sura, verse) => {
        // Add currentPage to history only if it's different from the newPage
        if (currentPage !== newPage) {
            setPageHistory(prevHistory => [...prevHistory, currentPage]);
        }
        setSelectedSura(sura);
        setSelectedVerse(verse);
        setCurrentPage(newPage);
    };


    useEffect(() => {
        if (currentPage) {
            localStorage.setItem("qurantft-pn", currentPage)
        }
    }, [currentPage]);


    const nextPage = () => {

        let newPage = parseInt(currentPage) >= 508 ? parseInt(currentPage) : parseInt(currentPage) + 1;

        // Skip specified pages
        const skipPages = [7, 8, 9, 10, 11, 12];
        while (skipPages.includes(newPage)) {
            newPage++;
        }

        updatePage(newPage);
    };

    const prevPage = () => {
        if (pageHistory.length > 0) {
            // Get the last page from history and remove it from the history array
            const lastPage = pageHistory[pageHistory.length - 1];
            setPageHistory(prevHistory => prevHistory.slice(0, -1));
            setCurrentPage(lastPage);
        } else {
            // Skip specified pages when decrementing
            const skipPages = [7, 8, 9, 10, 11, 12];
            let newPage = parseInt(currentPage) > 5 ? parseInt(currentPage) - 1 : parseInt(currentPage);

            while (skipPages.includes(newPage)) {
                newPage--;
            }

            setCurrentPage(newPage);
        }
    };

    const createReferenceMap = () => {
        const referenceMap = {};

        Object.entries(quranData).forEach(([pageNumber, value]) => {
            // Ensure that pageValues is an array
            const pageValues = Array.isArray(value.page) ? value.page : [value.page];
            const suraVersePattern = /\d+:\d+-\d+/g;
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

    const referenceMap = createReferenceMap();

    const handleClickReference = (reference) => {
        // Parse the reference to extract sura and verse information
        let [sura, verses] = reference.split(':');
        let verseStart, verseEnd;
        if (verses.includes('-')) {
            [verseStart, verseEnd] = verses.split('-').map(Number);
        } else {
            verseStart = verseEnd = parseInt(verses);
        }

        // Iterate over the referenceMap to find the correct page number
        let foundPageNumber = null;
        Object.entries(referenceMap).forEach(([pageNumber, suraVersesArray]) => {
            if (foundPageNumber) return; // Skip further iterations if page is already found

            suraVersesArray.forEach(suraVerses => {
                let [suraMap, verseRange] = suraVerses.split(':');
                let [verseStartMap, verseEndMap] = verseRange.includes('-') ? verseRange.split('-').map(Number) : [parseInt(verseRange), parseInt(verseRange)];

                if (suraMap === sura && !(verseEnd < verseStartMap || verseStart > verseEndMap)) {
                    foundPageNumber = pageNumber;
                }
            });
        });

        if (foundPageNumber) {
            updatePage(foundPageNumber, sura, verseStart);
        } else {
            console.log("Reference not found in the book.");
        }
    };

    const parseReferences = (text) => {
        const referenceRegex = /(\d+:\d+(?:-\d+)?)/g;
        return text.split(referenceRegex).map((part, index) => {
            if (part.match(referenceRegex)) {
                return (
                    <span
                        key={index}
                        className="cursor-pointer text-sky-400"
                        onClick={() => handleClickReference(part)}>

                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    const renderBookContent = () => {

        // Render Pages component when current page is 23 or more
        if (parseInt(currentPage) >= 23 && parseInt(currentPage) <= 394) {
            return <Pages selectedPage={currentPage} selectedSura={selectedSura} selectedVerse={selectedVerse} handleClickReference={handleClickReference} />;
        }

        if (parseInt(currentPage) === 22) {
            return (
                <div className="w-screen h-screen flex items-center justify-center text-neutral-300">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                     Sura List Loading...
                </div>
            );
        }
        const combinedContent = [];

        const currentPageData = bookContent ? bookContent.find(iterator => iterator.page === currentPage) : null;


        if (!currentPageData || !currentPageData.titles) {
            return <div className="text-neutral-200/80 flex flex-1 items-center justify-center w-full ">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
            </div>;
        }

        // Add titles to combined content
        Object.entries(currentPageData.titles).forEach(([key, value]) => {
            combinedContent.push({ type: 'title', content: value, order: parseInt(key) });
        });

        // Add text paragraphs to combined content
        Object.entries(currentPageData.text).forEach(([key, value]) => {
            combinedContent.push({ type: 'text', content: value, order: parseInt(key) });
        });

        // Add evidence to combined content
        Object.entries(currentPageData.evidence).forEach(([key, value]) => {
            combinedContent.push({ type: 'evidence', content: value, order: parseInt(key) });
        });

        if (currentPageData.picture) {
            // Add pictures to combined content
            Object.entries(currentPageData.picture).forEach(([key, value]) => {
                combinedContent.push({ type: 'picture', no: value["no"], order: parseInt(key), text: value["text"] });
            });
        }
        // Sort the combined content by order
        combinedContent.sort((a, b) => a.order - b.order);

        // Render combined content
        const renderContent = combinedContent.map((item, index) => {
            if (item.type === 'title') {
                return (
                    <div className={`w-full my-3 flex items-center justify-center text-center bg-sky-700 rounded p-2 font-semibold text-neutral-300  whitespace-pre-line ${item.order === 0 ? "text-2xl font-bold" : " text-base"}`}>
                        <h2 key={`title-${index}`}>{item.content}</h2>
                    </div>
                );
            } else if (item.type === 'text') {
                return (
                    <div className="rounded bg-neutral-700 text-neutral-300 p-2 shadow-lg mb-3 flex w-fit justify-center">
                        <p key={`text-${index}`} className="px-1">{parseReferences(item.content)}</p>
                    </div>
                );
            } else if (item.type === 'evidence') {
                return (
                    <div key={`evidence-${index}`} className={`bg-neutral-800 rounded shadow-lg text-sm md:text-base p-3 border my-3 border-neutral-900`}>
                        {Object.entries(item.content.lines).map(([lineKey, lineValue]) => (
                            <p className=" whitespace-pre-wrap my-1" key={lineKey}>{parseReferences(lineValue)}</p>
                        ))}
                        {item.content.ref.length > 0 && (
                            <p>{parseReferences("[" + item.content.ref.join(', ') + "]")}</p>
                        )}
                    </div>
                );
            } else if (item.type === 'picture') {

                const imageUrl = images(`./${item.no}.jpg`);
                return (
                    <div className=" flex flex-col flex-1 items-center justify-center w-full px-1">

                        <div className="rounded shadow-lg flex justify-center">

                            <img
                                src={imageUrl}
                                alt={imageUrl}
                                className=" object-center"
                            />
                        </div>
                        {item.text && <div className="text-sky-200/70 w-full text-base flex justify-center">
                            <div className="p-2">
                                {item.text}
                            </div>
                        </div>}
                    </div>
                );
            } else {
                return (
                    <div className="text-neutral-200/80 flex flex-1 items-center justify-center w-full">
                        Unrecognized structered data or could not parse the data ...
                    </div>
                );
            }
        });

        return (
            <div className="text-neutral-200 overflow-auto flex-1 p-3 text-justify lg:text-start text-base md:text-xl">
                {renderContent}
            </div>
        );
    };

    return (
        <div className="flex flex-col justify-start h-screen bg-sky-950">
            {renderBookContent()}
            <div className="w-full flex z-20">
                <div className="flex w-full items-center justify-between p-2">
                    <button onClick={prevPage}
                        className="w-28 text-neutral-300 px-2 py-1 rounded mr-2 flex justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                    </button>
                    <div
                        onClick={() => setModalOpen(!isModalOpen)}
                        className="">
                        <h2 className="text-sm font-bold text-neutral-200/50 p-2">Page {currentPage}</h2>
                    </div>
                    <button onClick={nextPage}
                        className="w-28 text-neutral-300 px-2 py-1 rounded ml-2 flex justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                        </svg>
                    </button>
                </div>
            </div>
            {isModalOpen &&
                <Jump
                    currentPage={currentPage}
                    quran={quranData}
                    onClose={handleCloseModal}
                    onConfirm={handleJump}
                />
            }
        </div>
    );
};

export default Book;
