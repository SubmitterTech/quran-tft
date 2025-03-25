const bookmarksKey = 'bookmarks';
const timestampRegex = /^(\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2}:\d{2})$/;

const parseJSON = (value) => {
    try {
        return JSON.parse(value);
    } catch (error) {
        console.error('Error parsing JSON:', error);
        return {};
    }
};

const format = (timestamp) => {
    if (/^\d+$/.test(String(timestamp).trim())) {
        const date = new Date(parseInt(timestamp, 10));
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } else {
        return timestamp;
    }
};

let bookmarks = parseJSON(localStorage.getItem(bookmarksKey)) || {};

let needsMigration = false;

Object.keys(bookmarks).forEach(key => {
    const histEntry = bookmarks[key];

    if (histEntry && typeof histEntry === 'object' && histEntry.timestamp) {
        return;
    }

    const trimmedValue = typeof histEntry === 'string' ? histEntry.trim() : '';

    if (timestampRegex.test(trimmedValue)) {
        bookmarks[key] = { value: null, timestamp: trimmedValue };
    } else {
        bookmarks[key] = { value: histEntry, timestamp: format(Date.now()) };
    }
    needsMigration = true;
});

if (needsMigration) {
    localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
}

const subscribers = {};

const subscribe = (verseKey, callback) => {
    if (!subscribers[verseKey]) subscribers[verseKey] = [];
    subscribers[verseKey].push(callback);
};

const unsubscribe = (verseKey, callback) => {
    if (subscribers[verseKey]) {
        subscribers[verseKey] = subscribers[verseKey].filter(cb => cb !== callback);
        if (subscribers[verseKey].length === 0) delete subscribers[verseKey];
    }
};

const notifySubscribers = (verseKey) => {
    if (subscribers[verseKey]) {
        subscribers[verseKey].forEach(callback => callback(bookmarks[verseKey]));
    }
};

const get = (verseKey) => {
    if (bookmarks.hasOwnProperty(verseKey)) {
        const bookmark = bookmarks[verseKey];
        return bookmark.value !== null ? bookmark.value : bookmark.timestamp;
    }
    return null;
};

const set = (verseKey, value) => {
    const trimmedValue = value ? value.trim() : '';
    const currentTimestamp = format(Date.now());
    let normalizedValue = trimmedValue.replace(timestampRegex, "$1 $2");
    if (bookmarks[verseKey]) {
        if (normalizedValue === bookmarks[verseKey].timestamp) {
            bookmarks[verseKey] = { value: null, timestamp: currentTimestamp };
        } else {
            bookmarks[verseKey] = { value: value || null, timestamp: currentTimestamp };
        }
    } else {
        bookmarks[verseKey] = { value: value || null, timestamp: currentTimestamp };
    }

    localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
    notifySubscribers(verseKey);
};

const remove = async (verseKey) => {
    const bookmark = bookmarks[verseKey];
    if (bookmark && bookmark.value) {
        const confirmed = await new Promise((resolve) => {
            const event = new CustomEvent('bookmarks:confirm-delete', {
                detail: { data: { key: verseKey, value: bookmark.value }, resolve }
            });
            window.dispatchEvent(event);
        });
        if (!confirmed) return;
    }
    delete bookmarks[verseKey];
    localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
    notifySubscribers(verseKey);
};

const all = () => {
    const result = {};
    Object.entries(bookmarks).forEach(([key, bookmark]) => {
        result[key] = bookmark.value !== null ? bookmark.value : bookmark.timestamp;
    });
    return result;
};

window.addEventListener('storage', (event) => {
    if (event.key === bookmarksKey) {
        bookmarks = parseJSON(event.newValue) || {};
        Object.keys(subscribers).forEach(verseKey => notifySubscribers(verseKey));
    }
});

const Bookmarks = {
    subscribe,
    unsubscribe,
    get,
    set,
    remove,
    all,
    format,
};

export default Bookmarks;