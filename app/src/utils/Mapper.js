export const mapAppendices = (appendices, translationApplication) => {
    const appendixMap = {};
    let currentAppendixNum = 1;
    let globalContentOrder = 1;

    appendices.forEach(page => {
        if (page.page < 397) {
            return;
        }
        let allContentItems = [];
        Object.entries(page.titles || {}).forEach(([key, title]) => {
            allContentItems.push({
                type: 'title',
                content: title,
                key: parseInt(key)
            });
        });

        const collectContent = (type, data) => {
            Object.entries(data || {}).forEach(([key, value]) => {
                if (value) {
                    allContentItems.push({ type, content: value, key: parseInt(key) });
                }

            });
        };
        collectContent('text', page.text);
        collectContent('evidence', page.evidence);
        collectContent('table', page.table);
        collectContent('picture', page.picture);

        allContentItems.sort((a, b) => a.key - b.key);
        allContentItems.forEach(item => {
            item.order = globalContentOrder++;
            if (item.type === 'title') {
                const appx = translationApplication ? translationApplication.appendix : "Appendix";
                const match = item.content.match(new RegExp(`${appx}\\s*(\\d+)`));
                if (/\d+/.test(item.content) && match) {
                    currentAppendixNum = match[1];
                }
            }
            if (!appendixMap[currentAppendixNum]) {
                appendixMap[currentAppendixNum] = { content: [] };
            }

            appendixMap[currentAppendixNum].content.push(item);
        });
    });

    Object.values(appendixMap).forEach(appendix => {
        appendix.content.sort((a, b) => a.order - b.order);
    });

    return appendixMap;
};

export const mapQuran = (quran) => {
    let qm = {};
    Object.values(quran).forEach((value) => {
        Object.entries(value.sura).forEach(([sura, content]) => {
            // Initialize qm[sura] as an object if it doesn't exist
            if (!qm[sura]) {
                qm[sura] = {};
            }

            Object.entries(content.verses).forEach(([verse, text]) => {
                qm[sura][verse.trim()] = text;
            });

            Object.entries(content.titles).forEach(([title, text]) => {
                qm[sura]["t" + title] = text;
            });
        });
    });
    return qm;
};
