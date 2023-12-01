import React, { useState } from 'react';
import Splash from '../components/Splash';
import Book from '../components/Book';
import introductionContent from '../assets/introduction.json';

function Root() {
    const [showSplash, setShowSplash] = useState(true);

    const hideSplash = () => {
        // Set a timeout to hide the splash screen after a specified delay
        setTimeout(() => {
            setShowSplash(false);
        }, 1000); // Delay in milliseconds, e.g., 3000ms = 3 seconds
    };
    return (
        <div className="Root select-none bg-sky-700 flex flex-col h-screen">
            {showSplash && <Splash onHideSplash={hideSplash} />}
            {!showSplash && <Book bookContent={introductionContent} />}
        </div>
    );
}

export default Root;
