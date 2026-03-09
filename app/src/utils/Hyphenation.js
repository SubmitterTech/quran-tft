import React from 'react';

const HYPHEN_CHAR = '\u00AD';
const ZERO_WIDTH_SPACE = '\u200B';
// Must stay in sync with runtime builder target list in Generator.js.
const SUPPORTED_HYPHEN_CACHE_LANGUAGES = new Set(['tr', 'az']);
const APOSTROPHE_CHARS = new Set(["'", '’']);

let cachedWordRegex = null;

const getWordRegex = () => {
    if (cachedWordRegex) {
        return cachedWordRegex;
    }

    try {
        cachedWordRegex = /\p{L}+/gu;
    } catch (_error) {
        cachedWordRegex = /[A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû]+/g;
    }

    return cachedWordRegex;
};

const extractBreakPositions = (hyphenatedToken) => {
    const positions = [];
    let plainIndex = 0;

    for (const ch of String(hyphenatedToken || '')) {
        if (ch === HYPHEN_CHAR) {
            positions.push(plainIndex);
            continue;
        }
        plainIndex += 1;
    }

    return positions;
};

const injectSoftHyphens = (token, breakPositions) => {
    if (!Array.isArray(breakPositions) || breakPositions.length === 0) {
        return token;
    }

    const validBreaks = new Set(
        breakPositions.filter((pos) => Number.isInteger(pos) && pos > 0 && pos < token.length)
    );
    if (validBreaks.size === 0) {
        return token;
    }

    let result = '';
    for (let i = 0; i < token.length; i++) {
        if (validBreaks.has(i)) {
            result += HYPHEN_CHAR;
        }
        result += token[i];
    }
    return result;
};

export const isHyphenCacheLanguage = (lang) => {
    const normalized = String(lang || '').toLowerCase();
    return SUPPORTED_HYPHEN_CACHE_LANGUAGES.has(normalized);
};

export const normalizeHyphenToken = (token, lang) => {
    let value = String(token || '');
    const normalizedLang = String(lang || '').toLowerCase();

    if (normalizedLang === 'tr' || normalizedLang === 'az') {
        value = value.replace(/[İIıi]/g, 'i');
    }

    value = value.normalize('NFC');
    return value.toLocaleLowerCase(normalizedLang || 'en');
};

const getPrimaryLanguage = (lang) => String(lang || '').toLowerCase().split('-')[0];

const isProtectedHyphenToken = (normalizedToken, protectedTokenSet) => (
    protectedTokenSet instanceof Set && protectedTokenSet.has(normalizedToken)
);

export const buildHyphenBreakMapFromSerializedIndex = (serializedIndex) => {
    const map = new Map();
    const entries = serializedIndex?.entries;
    if (!Array.isArray(entries)) {
        return map;
    }

    entries.forEach((pair) => {
        if (!Array.isArray(pair) || pair.length < 2) {
            return;
        }

        const [normalizedToken, hyphenatedToken] = pair;
        if (typeof normalizedToken !== 'string' || typeof hyphenatedToken !== 'string') {
            return;
        }

        const breakPositions = extractBreakPositions(hyphenatedToken);
        if (breakPositions.length > 0) {
            map.set(normalizedToken, breakPositions);
        }
    });

    return map;
};

export const buildHyphenProtectedTokenSetFromSerializedIndex = (serializedIndex) => {
    const protectedTokenSet = new Set();
    const tokens = serializedIndex?.protectedTokens;
    if (!Array.isArray(tokens)) {
        return protectedTokenSet;
    }

    tokens.forEach((token) => {
        if (typeof token !== 'string' || token.length === 0) {
            return;
        }
        protectedTokenSet.add(token);
    });

    return protectedTokenSet;
};

export const applyCachedHyphenationToText = (text, lang, hyphenBreakMap, protectedTokenSet = null) => {
    if (!text || !hyphenBreakMap || hyphenBreakMap.size === 0) {
        return text;
    }

    const normalizedLang = getPrimaryLanguage(lang);

    if (!isHyphenCacheLanguage(normalizedLang)) {
        return text;
    }

    const source = String(text);
    const regex = getWordRegex();
    regex.lastIndex = 0;

    let output = '';
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(source)) !== null) {
        const token = match[0];
        const start = match.index;
        const end = start + token.length;

        output += source.slice(lastIndex, start);

        const normalizedToken = normalizeHyphenToken(token, normalizedLang);
        const isProtectedToken = isProtectedHyphenToken(normalizedToken, protectedTokenSet);

        if (isProtectedToken) {
            const nextChar = source[end];
            if (APOSTROPHE_CHARS.has(nextChar)) {
                output += `${token}${nextChar}${ZERO_WIDTH_SPACE}`;
                lastIndex = end + 1;
                continue;
            }

            output += token;
            lastIndex = end;
            continue;
        }

        const breakPositions = hyphenBreakMap.get(normalizedToken);
        output += injectSoftHyphens(token, breakPositions);

        lastIndex = end;

        if (regex.lastIndex === match.index) {
            regex.lastIndex += 1;
        }
    }

    output += source.slice(lastIndex);
    return output;
};

export const hyphenateReactNode = (node, applyHyphenation) => {
    if (typeof applyHyphenation !== 'function') {
        return node;
    }

    if (node == null || typeof node === 'boolean') {
        return node;
    }

    if (typeof node === 'string') {
        return applyHyphenation(node);
    }

    if (Array.isArray(node)) {
        return node.map((child) => hyphenateReactNode(child, applyHyphenation));
    }

    if (React.isValidElement(node)) {
        const children = node.props?.children;
        if (children === undefined) {
            return node;
        }

        const nextChildren = hyphenateReactNode(children, applyHyphenation);
        return React.cloneElement(node, undefined, nextChildren);
    }

    return node;
};
