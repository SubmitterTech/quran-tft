const fs = require('fs');


const versesData = require('./tr-new.json');
const translation = require('../../app/src/assets/translations/tr/quran_tr.json');





let nqmap = {};

if (versesData) {
    Object.values(versesData).forEach((data) => {
        if (!nqmap[data.sure]) { nqmap[data.sure] = {}; }
        if (data.ayet != "0") {
            nqmap[data.sure][data.ayet] = data.metin;
        }
    });
}

if (translation) {
    Object.values(translation).forEach((page) => {
        Object.entries(page.sura).forEach(([sno, content]) => {
            Object.entries(content.verses).forEach(([vno, verse]) => {
                if (nqmap[sno] && nqmap[sno][vno]) {
                    // Assign the verse text from nqmap to translation
                    content.verses[vno] = nqmap[sno][vno];
                }
            });
        });
    });
}

// If you need to write the updated translation back to a file:
fs.writeFileSync('./quran_tr.json', JSON.stringify(translation, null, 4));