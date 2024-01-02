const fs = require('fs');
const pdf = require('pdf-parse');

const sourceData = require('./quraninpages.json');
const quranData = require('../../app/src/assets/qurantft.json');
const translation = require('../../app/src/assets/translations/tr/quran_tr.json');

let qmap = {};
Object.values(quranData).forEach((page) => {
    Object.entries(page.sura).forEach(([sno, content]) => {
        if (!qmap[sno]) { qmap[sno] = {}; }
        Object.entries(content.verses).forEach(([vno, verse]) => {
            qmap[sno][vno] = verse;
        });
    });
});

let tqmap = {};
if (translation) {
    Object.values(translation).forEach((page) => {
        Object.entries(page.sura).forEach(([sno, content]) => {
            if (!tqmap[sno]) { tqmap[sno] = {}; }
            Object.entries(content.verses).forEach(([vno, verse]) => {
                tqmap[sno][vno] = verse;
            });
        });
    });
}

function prepareRegexPattern(wordsArray) {
    const escapedWords = wordsArray.map(word => word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const pattern = escapedWords.join('[\\s\\\'"\u201C\u201D\u2018\u2019]*');
    // Add context to the pattern: capture a few words (e.g., 10) before and after the match
    return new RegExp('(?:\\w+\\s){0,10}\u201C*' + pattern + '\u201D*', 'i');
}

let changable = {};

for (let s in tqmap) {
    for (let v in tqmap[s]) {
        const wordsToSearch = tqmap[s][v].trim().split(" ").filter(element => element);
        const regex = prepareRegexPattern(wordsToSearch);
        // console.log(regex)

       
            Object.values(sourceData).forEach((page) => {
                const text = page.text;
                const matches = text.match(regex);

                if (matches && matches.length > 0) {
                    changable[s + ":" + v] = matches[0];
                }

            });
        

    }
}

Object.entries(changable).forEach(([key, text]) => {
    changable[key] = text.replaceAll('\n', '').replace(/\s+/g,' ' )
});

const filename = './changable.json';

// Write to a JSON file
fs.writeFile(filename, JSON.stringify(changable, null, 4), 'utf8', function (err) {
    if (err) {
        console.log('An error occurred while writing JSON Object to File.');
        return console.log(err);
    }

    console.log('JSON file has been saved.');
});