// The English base content: the Quran text with the Arabic verses, the introduction and the
// appendices. Every language needs it, either as the text itself or as the fallback for verses
// that are not translated yet.
//
// It used to be three static JSON imports, which put 2.7 MB of data into a JavaScript chunk and
// parsed it before the first render. It is now fetched once during bootstrap, so the screens can
// keep reading it synchronously while the bytes stay plain JSON.

import { getContent } from './ContentStore';

let baseQuran = null;
let baseIntroduction = null;
let baseAppendices = null;
let primePromise = null;

/**
 * Loads the base content. Bootstrap awaits this before the first render, so every getter below
 * has an answer by the time a screen asks.
 */
export const primeBaseContent = () => {
    if (!primePromise) {
        primePromise = Promise.all([
            getContent('quran', 'en'),
            getContent('introduction', 'en'),
            getContent('appendices', 'en'),
        ]).then(([quran, introduction, appendices]) => {
            baseQuran = quran;
            baseIntroduction = introduction;
            baseAppendices = appendices;
            return true;
        }).catch((error) => {
            primePromise = null;
            throw error;
        });
    }
    return primePromise;
};

export const getBaseQuran = () => baseQuran;

/**
 * The base Quran text for callers that can wait: it loads the file if bootstrap could not.
 */
export const ensureBaseQuran = async () => baseQuran || getContent('quran', 'en');

export const getBaseIntroduction = () => baseIntroduction;

export const getBaseAppendices = () => baseAppendices;

export const isBaseContentReady = () => Boolean(baseQuran);
