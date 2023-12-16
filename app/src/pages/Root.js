import React, { useState } from 'react';
import Splash from '../components/Splash';
import Book from '../components/Book';

function Root() {
    const [showSplash, setShowSplash] = useState(localStorage.getItem("qurantft-pn") ? false : true);

    // Attempt to gather language info from the browser
    console.log(navigator.language || navigator.userLanguage);

    const hideSplash = () => {
        setShowSplash(false);
    };
    return (
        <div className="Root select-none flex flex-col h-screen">
            {showSplash && <Splash onHideSplash={hideSplash} />}
            {!showSplash && <Book />}
        </div>
    );
}

export default Root;
