import React, { useState } from 'react';
import Pages from '../components/Pages';
import '../Book.css';

const Book = ({ bookContent }) => {
    const [currentPage, setCurrentPage] = useState(13); // Starting with the first page of your content

    const nextPage = () => {
        setCurrentPage((prev) => prev + 1);
    };

    const prevPage = () => {
        setCurrentPage((prev) => (prev > 13 ? prev - 1 : prev));
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

        const handleClickReference = (reference) => {
            console.log("Reference clicked:", reference);
            // Implement logic when a reference is clicked
        };

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
            <div className="text-neutral-200 text-xl overflow-auto flex-1 p-3 text-justify lg:text-start">
                {paragraphs}
            </div>
        );
    };

    return (
        <div className="flex flex-col justify-start h-screen bg-sky-800 ">
            <div className="w-full flex items-center justify-start">
                <h2 className="text-sm font-bold text-neutral-200/50 p-2">Page {currentPage}</h2>
            </div>

            {renderBookContent()}
            <div className="w-full flex">
                <div className="flex w-full items-center justify-between p-2">

                    <button onClick={prevPage} className=" text-neutral-300 px-2 py-1 rounded mr-2 border-2 text-sm border-neutral-300">Previous Page</button>
                    <button onClick={nextPage} className=" text-neutral-300 px-2 py-1 rounded ml-2 border-2 text-sm border-neutral-300">Next Page</button>
                </div>
            </div>
        </div>
    );
};

export default Book;
