import React, { useState } from 'react';
import Pages from '../components/Pages';
import quranData from '../assets/structured_quran.json';
import '../Book.css';

const Book = ({ bookContent }) => {
    const [currentPage, setCurrentPage] = useState(13);
    const [pageHistory, setPageHistory] = useState([]);

    const updatePage = (newPage) => {
        setPageHistory(prevHistory => [...prevHistory, currentPage]);
        setCurrentPage(newPage);
    };

    const nextPage = () => {
        updatePage(currentPage + 1);
    };

    const prevPage = () => {
        if (pageHistory.length > 0) {
            // Get the last page from history and remove it from the history array
            const lastPage = pageHistory[pageHistory.length - 1];
            setPageHistory(prevHistory => prevHistory.slice(0, -1));
            setCurrentPage(lastPage);
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
            updatePage(parseInt(foundPageNumber));
        } else {
            console.log("Reference not found in the book.");
        }
    };
    


    // Function to render the book's content
    const renderBookContent = () => {
        // Render Pages component when current page is 23 or more
        if (currentPage >= 23) {
            return <Pages selectedPage={currentPage} />;
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
            <div className="text-neutral-200 overflow-auto flex-1 p-3 text-justify lg:text-start indent-8 text-lg md:text-xl">
                {paragraphs}
            </div>
        );
    };

    return (
        <div className="flex flex-col justify-start h-screen bg-sky-800">
            <div className="w-full flex items-center justify-start">
                
            </div>

            {renderBookContent()}
            <div className="w-full flex">
                <div className="flex w-full items-center justify-between p-2">

                    <button onClick={prevPage} className="w-28 text-neutral-300 px-2 py-1 rounded mr-2 border-2 text-sm border-neutral-300">Previous Page</button>
                    <h2 className="text-sm font-bold text-neutral-200/50 p-2">Page {currentPage}</h2>
                    <button onClick={nextPage} className="w-28 text-neutral-300 px-2 py-1 rounded ml-2 border-2 text-sm border-neutral-300">Next Page</button>
                </div>
            </div>
        </div>
    );
};

export default Book;
