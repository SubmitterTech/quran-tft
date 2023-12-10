import React, { useState, useEffect } from 'react';
import Pages from '../components/Pages';
import quranData from '../assets/structured_quran.json';
import Jump from '../components/Jump';
import '../assets/Book.css';

const Book = ({ bookContent }) => {
    const [currentPage, setCurrentPage] = useState(parseInt(localStorage.getItem("qurantft-pn"))? parseInt(localStorage.getItem("qurantft-pn")) : 13);
    const [pageHistory, setPageHistory] = useState([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [selectedSura, setSelectedSura] = useState(null);
    const [selectedVerse, setSelectedVerse] = useState(null);

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
        updatePage(currentPage + 1);
    };

    const prevPage = () => {
        if (pageHistory.length > 0) {
            // Get the last page from history and remove it from the history array
            const lastPage = pageHistory[pageHistory.length - 1];
            setPageHistory(prevHistory => prevHistory.slice(0, -1));
            setCurrentPage(lastPage);
        } else {
            // If history is empty and the current page is not 13, decrement the page
            if (currentPage !== 13) {
                setCurrentPage(prevPage => prevPage > 1 ? prevPage - 1 : 1);
            }
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
        console.log("Reference clicked:", reference);

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
            suraVersesArray.forEach(suraVerses => {
                let [suraMap, verseRange] = suraVerses.split(':');
                let [verseStartMap, verseEndMap] = verseRange.split('-').map(Number);

                if (suraMap === sura && verseStart >= verseStartMap && verseEnd <= verseEndMap) {
                    foundPageNumber = pageNumber;
                }
            });
        });

        if (foundPageNumber) {
            console.log("Page number:", foundPageNumber);
            updatePage(foundPageNumber, sura, verseStart);
        } else {
            console.log("Reference not found in the book.");
        }
    };



    // Function to render the book's content
    const renderBookContent = () => {
        // Render Pages component when current page is 23 or more
        if (currentPage >= 23) {
            return <Pages selectedPage={currentPage} selectedSura={selectedSura} selectedVerse={selectedVerse} />;
        }

        // Render normal book content for other pages
        const currentPageData = bookContent.find(page => page.page === currentPage);
        if (!currentPageData) return <div className="text-neutral-200/80 flex flex-1 items-center justify-center w-full ">
            <div>
                Loading ...
            </div>
        </div>;

        const parseReferences = (text) => {
            const referenceRegex = /(\d+:\d+(?:-\d+)?(?:,\s*\d+)*)/g;
            const parts = text.split(referenceRegex);
            return parts.map((part, index) => {
                if (part.match(referenceRegex)) {
                    return (
                        <span
                            key={index}
                            className=" cursor-pointer animatedText"
                            onClick={() => handleClickReference(part)}
                        >
                            {part}
                        </span>
                    );
                }
                return part;
            });
        };

        const paragraphs = currentPageData.text.split('\n\n').map((para, index) => {
            return <p key={index} className="mb-4 ">{parseReferences(para)}</p>;
        });

        return (
            <div className="text-neutral-200 overflow-auto flex-1 p-3 text-justify lg:text-start text-lg md:text-xl">
                {paragraphs}
            </div>
        );
    };

    return (
        <div className="flex flex-col justify-start h-screen bg-sky-800">
            {renderBookContent()}
            <div className="w-full flex z-20">
                <div className="flex w-full items-center justify-between p-2">
                    <button onClick={prevPage}
                        className="w-28 text-neutral-300 px-2 py-1 rounded mr-2 flex justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
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
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
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
