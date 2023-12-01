import React, { useState } from 'react';
import Verses from '../components/Verses';

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
        // Render Verses component when current page is 23 or more
        if (currentPage >= 23) {
            return <Verses selectedPage={currentPage} />;
        }

        // Render normal book content for other pages
        const currentPageData = bookContent.find(page => page.page === currentPage);
        if (!currentPageData) return <div className="text-neutral-200/80 flex flex-1 items-center justify-center w-full ">
            <div>
                Loading ...
            </div>
        </div>;

        // Split text into paragraphs for better readability
        const paragraphs = currentPageData.text.split('\n\n').map((para, index) => {
            return <p key={index} className="mb-4">{para}</p>;
        });

        return (
            <div className="text-neutral-200 text-xl overflow-auto flex-1 p-2">
                {paragraphs}
            </div>
        );
    };

    return (
        <div className="flex flex-col justify-start h-screen">
            <div className="w-full flex items-center justify-start">
                <h2 className="text-sm font-bold text-neutral-200/50 p-2">Page {currentPage}</h2>
            </div>

            {renderBookContent()}
            <div className="w-full flex">
                <div className="flex w-full items-center justify-between p-2">

                    <button onClick={prevPage} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-2">Previous Page</button>
                    <button onClick={nextPage} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 ml-2">Next Page</button>
                </div>
            </div>
        </div>
    );
};

export default Book;
