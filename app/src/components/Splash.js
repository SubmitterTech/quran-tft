import React from 'react';
import splashData from '../assets/splash.json';
import '../Splash.css';

const Splash = ({onHideSplash}) => {
    // Split the text into lines
    const lines = splashData.text.split('\n');

    const handleTap = async (e) => {
       onHideSplash();
    };
    // Forward to the source
    const openPdf = () => {
        window.location.href = '/quran-tft/quran-english1667577051837.pdf';
    };

    return (
        <div className="splash-screen h-screen flex flex-col w-full p-1 justify-between text-center text-neutral-100">
            <div className="flex flex-col w-full space-y-2 md:space-y-4 mt-4">
                <h1 className="text-6xl font-extrabold">{lines[0]}</h1>
                <h2 className="text-3xl font-bold">{lines[2]}</h2>
                <h2 className="text-3xl font-bold">{lines[3]}</h2>
                <h2 className="text-3xl font-bold">{lines[4]}</h2>
                <p className="text-lg ">{lines[5]}</p>
            </div>
            <button className="flex flex-col items-center justify-end"
                onClick = {handleTap}>
                {/* 19 lines for animated splash, starting from the bottom */}
                {Array.from({ length: 19 }).map((_, index) => (
                    <div
                        key={index}
                        className="splash-line bg-neutral-100 h-1 my-1.5 md:h-2 md:my-4"
                        style={{
                            animationDelay: `${0.5 * (18 - index)}s`, // Animation delay starts from the longest (bottom) line
                            width: `${91 - 2 * (18 - index)}%` // Width decreases from bottom to top
                        }}
                    >

                    </div>
                ))}
            </button>

            <div
                className="text-[#ffd700] cursor-pointer"
                onClick={openPdf}
            >
                <p>{lines[7]}</p>
                <p>{lines[8]}</p>
                <p>{lines[9]}</p>
            </div>
            <p>{lines[11] + ' 1992'}</p>
        </div>
    );
};

export default Splash;
