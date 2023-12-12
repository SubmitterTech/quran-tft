import React, { useState } from 'react';
import Splash from '../components/Splash';
import Book from '../components/Book';
import introductionContent from '../assets/introduction.json';

function Root() {
    const [showSplash, setShowSplash] = useState(localStorage.getItem("qurantft-pn") ? false : true);

    const hideSplash = () => {
        setShowSplash(false);
    };
    return (
        <div className="Root select-none flex flex-col h-screen">
            {showSplash && <Splash onHideSplash={hideSplash} />}
            {!showSplash && <Book bookContent={introductionContent} />}
        </div>
    );
}

export default Root;
