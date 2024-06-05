import React, { useState, useEffect, useCallback } from 'react';
import quranData from './assets/qurantft.json';
import './App.css';
import colorMap from './utils/ColorMap';

function App() {

  const [selectedSura, setSelectedSura] = useState(null);
  const [selectedVerse, setSelectedVerse] = useState(null);
  const [selectedWord, setSelectedWord] = useState(null);


  const [quranMap, setQuranMap] = useState({});

  useEffect(() => {
    let qmap = {};
    Object.values(quranData).forEach((page) => {
      Object.entries(page.sura).forEach(([sno, content]) => {
        if (!qmap[sno]) { qmap[sno] = {}; }
        Object.entries(content.encrypted).forEach(([vno, verse]) => {
          qmap[sno][vno] = verse;
        });
      });
    });
    setQuranMap(qmap);
  }, []);

  const countLetterInSura = async (sura, l) => {
    let cnt = 0;

    // Convert the task to asynchronous using Promise
    await new Promise(resolve => {
      Object.values(quranMap[sura]).forEach((verse) => {
        // Count the occurrences of the letter in each verse
        for (const char of verse) {
          if (char === l) {
            cnt++;
          }
        }
        // console.log(verse, l, cnt)

      });
      resolve();
    });

    return cnt;
  };

  const countWordOccurrences = () => {
    if (!selectedWord) return 0;
    let count = 0;
    Object.values(quranMap).forEach(verses => {
      Object.values(verses).forEach(verse => {
        count += verse.split(" ").filter(word => word.trim().includes(selectedWord)).length;
      });
    });
    return count;
  };

  const handleSelectedVerse = (s, v) => {
    if (selectedSura === s && selectedVerse === v) {
      setSelectedSura(null)
      setSelectedVerse(null)
      setSelectedWord(null)
    } else {
      setSelectedSura(s)
      setSelectedVerse(v)
    }
  }

  const handleSelectedWord = (w) => {
    console.log(w)
    if (selectedWord === w) {
      setSelectedWord(null)
    } else {
      setSelectedWord(w)
    }
  }

  const filterVersesByWord = (verses) => {
    if (!selectedWord) return verses;
    return Object.fromEntries(
      Object.entries(verses).filter(([_, verseText]) =>
        verseText.includes(selectedWord))
    );
  };

  const lightMatchWords = useCallback((verse) => {
    if (!selectedWord) {
      return verse;
    }

    // Use a regex to match words, keeping spaces intact
    const regex = new RegExp(`(${selectedWord})|\\s+|\\S+`, 'g');
    const words = verse.match(regex).map((word, index) => {
      if (word === selectedWord) {
        // Apply a different style for the selected word
        return <span key={index} className="text-sky-500">{word}</span>;
      } else {
        return <span key={index}>{word}</span>;
      }
    });

    return <div dir="rtl">{words}</div>;
  }, [selectedWord]);

  return (
    <div className="App text-xl w-screen h-screen bg-neutral-500 text-neutral-100 flex ">
      <div className="flex flex-col w-full overflow-auto mb-2 mt-2 space-y-1">

        <div className="rounded text-4xl shadow-lg p-2 text-start mx-2 mb-3 bg-fuchsia-300 text-neutral-900 sticky top-0 flex justify-between">
          <div >
            Filter: {selectedWord ? selectedWord : "N / A"}
          </div>
          <div>
            {selectedWord && `Occurrences: ${countWordOccurrences()}`}
          </div>

        </div>


        {Object.entries(quranMap).map(([sura, verses]) => (
          <div key={sura} className="flex flex-col space-y-1 mx-2 ">
            {/* <div className="p-2 rounded bg-rose-800 text-start sticky top-0 shadow-lg">
              Sura: {sura}
            </div> */}
            {Object.entries(filterVersesByWord(verses)).map(([vno, verseText]) => (
              <div key={vno} className="text-start w-full flex justify-between space-x-3">
                <div
                  onClick={() => handleSelectedVerse(sura, vno)}
                  className={`w-24 rounded shadow-lg flex items-center justify-center cursor-pointer ${selectedSura === sura && selectedVerse === vno ? "bg-sky-200 text-neutral-900" : "bg-sky-600"}`}>{sura}:{vno}</div>
                <div
                  onClick={() => handleSelectedVerse(sura, vno)}
                  className={`w-full p-2 rounded shadow-lg cursor-pointer ${selectedSura === sura && selectedVerse === vno ? "bg-sky-200 text-neutral-900" : "bg-neutral-800"}`}
                  dir="rtl">
                  {lightMatchWords(verseText)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-col w-full overflow-auto h-full ">
        <div className="w-full p-1">

          <div className="p-2 bg-amber-300 text-neutral-900 text-4xl mb-4 mt-1 rounded shadow-lg">
            {selectedSura}:{selectedVerse}
          </div>

          {selectedVerse &&
            <div className="flex flex-col space-y-2">
              <div
                key={"selected_" + selectedSura + ":" + selectedVerse}
                className="w-full p-2 rounded shadow-lg bg-neutral-800 text-start"
                dir="rtl">
                {quranMap[selectedSura][selectedVerse]}
              </div>
              <div dir="rtl" className={`w-full flex flex-wrap items-center justify-start pb-3  rounded `}>
                {quranMap[selectedSura][selectedVerse].split(" ").map((word, index) => (
                  <div
                    onClick={() => handleSelectedWord(word.trim())}
                    key={selectedSura + selectedVerse + index + word}
                    className={`p-2 shadow-md rounded text-start ml-1 mb-1 cursor-pointer ${selectedWord === word.trim() ? "bg-sky-300 text-neutral-900" : "bg-neutral-800 "}`}
                    dir="rtl">
                    <div className={`p-1 shadow-md rounded mb-1 text-base w-full text-center bg-neutral-600`}>
                      {index + 1}
                    </div>
                    <div className={`p-1 w-full `} >
                      {word}
                    </div>
                  </div>
                ))}
              </div>
              <div dir="rtl" className={`w-full flex flex-wrap items-center justify-start pb-3 rounded`}>
                {quranMap[selectedSura][selectedVerse].replace(/\s/g, '').split('').map((letter, index) => (
                  <div
                    key={`${selectedSura}${selectedVerse}${index}${letter}`}
                    className={`p-1 shadow-md rounded w-11 ml-1 mb-1 cursor-pointer bg-neutral-800 flex flex-col items-center`}
                    dir="rtl">
                    <div className={`p-1 shadow-md rounded mb-1 text-base w-9 bg-neutral-600`}>
                      {index + 1}
                    </div>
                    <div className={`p-1 w-full `} style={{ color: colorMap[letter] }}>
                      {letter}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          }

        </div>
      </div>

    </div>
  );
}

export default App;