import React, { useState } from 'react';
import Splash from '../components/Splash';
import Book from '../components/Book';

function Root() {
    const [showSplash, setShowSplash] = useState(localStorage.getItem("qurantft-pn") ? false : true);

    const hideSplash = () => {
        setShowSplash(false);
    };
    return (
        <div className="Root select-none flex flex-col h-screen bg-sky-800">
            {showSplash && <Splash onHideSplash={hideSplash} />}
            {!showSplash && <Book />}
        </div>
    );
}

export default Root;