import React, { useState, useEffect, useCallback, useRef } from 'react';
import quranData from './assets/qurantft.json';
import './App.css';

function App() {

  const [selectedSura, setSelectedSura] = useState(null);
  const [selectedVerse, setSelectedVerse] = useState(null);
  const [selectedWord, setSelectedWord] = useState(null);
  const [displayedVerses, setDisplayedVerses] = useState({});
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const batchSize = 19;
  const observer = useRef();


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

  const filterVersesByWord = useCallback((verses) => {
    if (!selectedWord) return verses;
    return Object.fromEntries(
      Object.entries(verses).filter(([_, verseText]) =>
        verseText.includes(selectedWord))
    );
  }, [selectedWord]);

  const loadMoreVerses = useCallback(() => {
    if (currentBatchIndex * batchSize >= Object.keys(quranMap).length) {
      // All verses are loaded, no more to load
      return;
    }

    const newBatch = {};
    const verseEntries = Object.entries(quranMap); // Use quranMap directly

    for (let i = currentBatchIndex * batchSize;
      i < Math.min((currentBatchIndex + 1) * batchSize, verseEntries.length);
      i++) {
      const [sura, verses] = verseEntries[i];
      newBatch[sura] = verses;
    }

    setDisplayedVerses(prevVerses => ({ ...prevVerses, ...newBatch }));
    setCurrentBatchIndex(prevIndex => prevIndex + 1);
  }, [quranMap, currentBatchIndex]);

  const lastVerseElementRef = useCallback(node => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && Object.keys(quranMap).length > currentBatchIndex * batchSize) {
        loadMoreVerses();
      }
    });
    if (node) observer.current.observe(node);
  }, [loadMoreVerses, currentBatchIndex, quranMap]);

  const handleScroll = useCallback(() => {
    if (window.innerHeight + document.documentElement.scrollTop !== document.documentElement.offsetHeight) return;
    loadMoreVerses();
  }, [loadMoreVerses]);

  useEffect(() => {
    loadMoreVerses();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMoreVerses, handleScroll]);

  useEffect(() => {
    // Call loadMoreVerses when quranMap is ready
    if (Object.keys(quranMap).length > 0) {
      loadMoreVerses();
    }
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [quranMap, loadMoreVerses, handleScroll]); // Depend on quranMap



  // const countLetterInSura = async (sura, l) => {
  //   let cnt = 0;

  //   // Convert the task to asynchronous using Promise
  //   await new Promise(resolve => {
  //     Object.values(quranMap[sura]).forEach((verse) => {
  //       // Count the occurrences of the letter in each verse
  //       for (const char of verse) {
  //         if (char === l) {
  //           cnt++;
  //         }
  //       }
  //       // console.log(verse, l, cnt)

  //     });
  //     resolve();
  //   });

  //   return cnt;
  // };

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
    <div className="App w-screen h-screen bg-neutral-400 text-neutral-100 flex ">
      <div className="verses-main-list flex flex-col w-full overflow-auto mb-2 mt-2">
        <div className="rounded shadow-lg p-2 text-start mx-2 mb-3 bg-fuchsia-800 sticky top-0 flex justify-between">
          <div>Filter: {selectedWord ? selectedWord : "N / A"}</div>
          <div>{selectedWord && `Occurrences: ${countWordOccurrences()}`}</div>
        </div>

        {Object.entries(displayedVerses).map(([sura, verses], index) => (
          <div key={sura} className="flex flex-col space-y-1 mx-2 my-1">
            {Object.entries(filterVersesByWord(verses)).map(([vno, verseText], verseIndex, verseArray) => {
              const isLastVerse = index === Object.keys(displayedVerses).length - 1 && verseIndex === verseArray.length - 1;
              return (
                <div
                  ref={isLastVerse ? lastVerseElementRef : null}
                  key={vno}
                  className="text-start w-full flex justify-between space-x-3">
                  <div className="w-20 p-2 rounded shadow-lg bg-sky-600 text-end">{sura}:{vno}</div>
                  <div
                    onClick={() => handleSelectedVerse(sura, vno)}
                    className={`w-full p-2 rounded shadow-lg cursor-pointer ${selectedSura === sura && selectedVerse === vno ? "bg-neutral-700" : "bg-neutral-800"}`}
                    dir="rtl">
                    {lightMatchWords(verseText)}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {currentBatchIndex * batchSize < Object.keys(quranMap).length && (
          <div ref={lastVerseElementRef} className="loading-indicator">
            Loading more verses...
          </div>
        )}
      </div>


      <div className="flex flex-col w-full overflow-auto h-full ">
        <div className="w-full p-1">

          <div className="p-2 bg-amber-800 mb-4 mt-1 rounded shadow-lg">
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
              <div dir="rtl" className={`w-full flex overflow-y-auto items-center justify-start pb-3  rounded `}>
                {quranMap[selectedSura][selectedVerse].split(" ").map((word, index) => (
                  <p
                    onClick={() => handleSelectedWord(word.trim())}
                    key={selectedSura + selectedVerse + index + word}
                    className={`p-2 shadow-md rounded text-start ml-1 cursor-pointer ${selectedWord === word.trim() ? "bg-neutral-700 " : "bg-neutral-800 "}`}
                    dir="rtl">
                    {word}
                  </p>
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
