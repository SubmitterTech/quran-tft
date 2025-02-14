const bookmarksKey = 'bookmarks';

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
}

let bookmarks = parseJSON(localStorage.getItem(bookmarksKey)) || {};

const subscribers = {};

const subscribe = (verseKey, callback) => {
    if (!subscribers[verseKey]) {
        subscribers[verseKey] = [];
    }
    subscribers[verseKey].push(callback);
};

const unsubscribe = (verseKey, callback) => {
    if (subscribers[verseKey]) {
        subscribers[verseKey] = subscribers[verseKey].filter((cb) => cb !== callback);
        if (subscribers[verseKey].length === 0) {
            delete subscribers[verseKey];
        }
    }
};

const notifySubscribers = (verseKey) => {
    if (subscribers[verseKey]) {
        subscribers[verseKey].forEach((callback) => callback(bookmarks[verseKey]));
    }
};

const get = (verseKey) => {
    return bookmarks.hasOwnProperty(verseKey) ? bookmarks[verseKey] : null;
};

const set = (verseKey, value) => {
    if (value === null) {
        value = format(Date.now());
    }
    bookmarks[verseKey] = value;
    localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
    notifySubscribers(verseKey);
};

const remove = (verseKey) => {
    delete bookmarks[verseKey];
    localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
    notifySubscribers(verseKey);
};

const all = () => {
    return { ...bookmarks };
};


// Handle storage events (for cross-tab synchronization)
window.addEventListener('storage', (event) => {
    if (event.key === bookmarksKey) {
        bookmarks = parseJSON(event.newValue) || {};
        // Notify all subscribers
        Object.keys(subscribers).forEach((verseKey) => {
            notifySubscribers(verseKey);
        });
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