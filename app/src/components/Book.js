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
        if (!currentPageData) return <div>Loading...</div>;

        // Split text into paragraphs for better readability
        const paragraphs = currentPageData.text.split('\n\n').map((para, index) => {
            return <p key={index} className="mb-4">{para}</p>;
        });

        return (
            <div className="text-neutral-200 text-xl overflow-auto px-6 py-4">
                {paragraphs}
            </div>
        );
    };

    return (
        <div className="flex flex-col items-center justify-center p-4 h-screen">
            <h2 className="text-2xl font-bold mb-4">Page {currentPage}</h2>
            <button onClick={prevPage} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-2">Previous Page</button>
            <button onClick={nextPage} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 ml-2">Next Page</button>
            {renderBookContent()}
        </div>
    );
};

export default Book;
