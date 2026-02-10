/**
 * Unit tests for Magnify helper functions:
 *   normalizeText, removePunctuations, searchFold — null/edge-case guards
 *   parseNumericRefs, pushRanges, matchesNumeric — verse reference parsing
 *   highlightText (logic only) — crash scenarios & edge cases
 *
 * Run:  npx react-scripts test --testPathPattern="Magnify.helpers" --watchAll=false
 */

// ── normalizeText ──────────────────────────────────────────────────────────

function normalizeText(text) {
    if (!text) return '';
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

describe("normalizeText", () => {
    test("strips French accents: 'école' → 'ecole'", () => {
        expect(normalizeText("école")).toBe("ecole");
    });
    test("strips Spanish tilde: 'niño' → 'nino'", () => {
        expect(normalizeText("niño")).toBe("nino");
    });
    test("strips Turkish cedilla: 'çalışma' → 'calısma'", () => {
        expect(normalizeText("çalışma")).toBe("calısma");
    });
    test("strips German umlaut: 'über' → 'uber'", () => {
        expect(normalizeText("über")).toBe("uber");
    });
    test("strips Greek polytonic: 'Αθήνα' → 'Αθηνα'", () => {
        expect(normalizeText("Αθήνα")).toBe("Αθηνα");
    });
    test("leaves plain ASCII untouched", () => {
        expect(normalizeText("Hello World")).toBe("Hello World");
    });
    test("handles empty string", () => {
        expect(normalizeText("")).toBe("");
    });
    test("handles null → returns ''", () => {
        expect(normalizeText(null)).toBe("");
    });
    test("handles undefined → returns ''", () => {
        expect(normalizeText(undefined)).toBe("");
    });
});

// ── removePunctuations (regex-escaper) ─────────────────────────────────────

function removePunctuations(text) {
    if (!text) return '';
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe("removePunctuations (regex escaper)", () => {
    test("escapes dot", () => {
        expect(removePunctuations("a.b")).toBe("a\\.b");
    });
    test("escapes asterisk", () => {
        expect(removePunctuations("a*b")).toBe("a\\*b");
    });
    test("escapes parentheses", () => {
        expect(removePunctuations("(test)")).toBe("\\(test\\)");
    });
    test("escapes square brackets", () => {
        expect(removePunctuations("[abc]")).toBe("\\[abc\\]");
    });
    test("escapes backslash", () => {
        expect(removePunctuations("a\\b")).toBe("a\\\\b");
    });
    test("escapes multiple special chars", () => {
        expect(removePunctuations("a.*+?^${}()|[]\\z")).toBe(
            "a\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\z"
        );
    });
    test("leaves normal text untouched", () => {
        expect(removePunctuations("hello world")).toBe("hello world");
    });
    test("handles empty string", () => {
        expect(removePunctuations("")).toBe("");
    });
    test("handles null → returns ''", () => {
        expect(removePunctuations(null)).toBe("");
    });
    test("handles undefined → returns ''", () => {
        expect(removePunctuations(undefined)).toBe("");
    });
});

// ── searchFold — null / edge-case guards ────────────────────────────────────

function searchFold(text, lang, doNormalize, caseSensitive) {
    if (!text) return '';
    let t = text;
    if ((lang === "tr" || lang === "az") && doNormalize) {
        t = t.replace(/[İIıi]/g, "i");
    }
    if (doNormalize) {
        t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    if (!caseSensitive) {
        t = t.toLocaleUpperCase(lang);
    }
    return t;
}

describe("searchFold — null & edge-case guards", () => {
    test("null → returns ''", () => {
        expect(searchFold(null, "en", true, false)).toBe("");
    });
    test("undefined → returns ''", () => {
        expect(searchFold(undefined, "en", true, false)).toBe("");
    });
    test("empty string → returns ''", () => {
        expect(searchFold("", "en", true, false)).toBe("");
    });
    test("single space", () => {
        expect(searchFold(" ", "en", false, false)).toBe(" ");
    });
    test("only special chars: '***'", () => {
        expect(searchFold("***", "en", false, false)).toBe("***");
    });
    test("emoji preserved", () => {
        const result = searchFold("test 🎉", "en", false, false);
        expect(result).toContain("🎉");
    });
    test("very long string does not throw", () => {
        const long = "a".repeat(100000);
        expect(() => searchFold(long, "en", true, false)).not.toThrow();
    });
});

// ── parseNumericRefs & matchesNumeric ──────────────────────────────────────

function pushRanges(arr, part) {
    const [a, b] = part.split('-').map(Number);
    if (isNaN(a)) return;
    if (!isNaN(b) && b >= a) {
        arr.push({ start: a, end: b });
    } else {
        arr.push({ start: a, end: a });
    }
}

function parseNumericRefs(formula) {
    const tokens = formula.split(/[,\s;]+/).filter(Boolean);
    const refs = {};
    let currentSura = null;

    tokens.forEach(tok => {
        if (tok.includes(':')) {
            let [sRaw, vRaw = ''] = tok.split(':');
            currentSura = sRaw === '' ? '*' : Number(sRaw);
            if (!refs[currentSura]) refs[currentSura] = [];

            if (!vRaw) {
                refs[currentSura].push({ start: 1, end: Infinity });
            } else {
                pushRanges(refs[currentSura], vRaw);
            }
        } else {
            if (currentSura == null) return;
            pushRanges(refs[currentSura], tok);
        }
    });

    return refs;
}

function matchesNumeric(refs, suraNumber, verseNumber) {
    const s = Number(suraNumber), v = Number(verseNumber);
    if (refs['*'] && refs['*'].some(r => v >= r.start && v <= r.end)) return true;
    if (refs[s] && refs[s].some(r => v >= r.start && v <= r.end)) return true;
    return false;
}

describe("parseNumericRefs", () => {
    test("single verse: '2:5' → sura 2, verse 5", () => {
        const refs = parseNumericRefs("2:5");
        expect(refs[2]).toEqual([{ start: 5, end: 5 }]);
    });

    test("verse range: '2:1-5' → sura 2, verses 1–5", () => {
        const refs = parseNumericRefs("2:1-5");
        expect(refs[2]).toEqual([{ start: 1, end: 5 }]);
    });

    test("multiple verses: '2:1, 3, 7' → sura 2 verses 1,3,7", () => {
        const refs = parseNumericRefs("2:1, 3, 7");
        expect(refs[2]).toEqual([
            { start: 1, end: 1 },
            { start: 3, end: 3 },
            { start: 7, end: 7 }
        ]);
    });

    test("full sura: '2:' → sura 2, all verses", () => {
        const refs = parseNumericRefs("2:");
        expect(refs[2]).toEqual([{ start: 1, end: Infinity }]);
    });

    test("multiple suras: '2:5, 3:10' → two suras", () => {
        const refs = parseNumericRefs("2:5, 3:10");
        expect(refs[2]).toEqual([{ start: 5, end: 5 }]);
        expect(refs[3]).toEqual([{ start: 10, end: 10 }]);
    });

    test("wildcard sura: ':12' → all suras verse 12", () => {
        const refs = parseNumericRefs(":12");
        expect(refs['*']).toEqual([{ start: 12, end: 12 }]);
    });

    test("mixed range and single: '2:1-3, 7, 10-15'", () => {
        const refs = parseNumericRefs("2:1-3, 7, 10-15");
        expect(refs[2]).toEqual([
            { start: 1, end: 3 },
            { start: 7, end: 7 },
            { start: 10, end: 15 }
        ]);
    });

    test("semicolon separator: '2:5; 3:10'", () => {
        const refs = parseNumericRefs("2:5; 3:10");
        expect(refs[2]).toEqual([{ start: 5, end: 5 }]);
        expect(refs[3]).toEqual([{ start: 10, end: 10 }]);
    });

    test("empty string → empty object", () => {
        expect(parseNumericRefs("")).toEqual({});
    });

    test("garbage 'abc' → empty (no colon context)", () => {
        expect(parseNumericRefs("abc")).toEqual({});
    });

    test("inverted range '2:5-3' → single verse 5 (b < a)", () => {
        const refs = parseNumericRefs("2:5-3");
        expect(refs[2]).toEqual([{ start: 5, end: 5 }]);
    });
});

describe("matchesNumeric", () => {
    test("exact match: sura 2, verse 5", () => {
        const refs = parseNumericRefs("2:5");
        expect(matchesNumeric(refs, 2, 5)).toBe(true);
    });

    test("no match: sura 2, verse 6", () => {
        const refs = parseNumericRefs("2:5");
        expect(matchesNumeric(refs, 2, 6)).toBe(false);
    });

    test("range match: sura 2, verse 3 in range 1-5", () => {
        const refs = parseNumericRefs("2:1-5");
        expect(matchesNumeric(refs, 2, 3)).toBe(true);
    });

    test("range boundary: verse at start", () => {
        const refs = parseNumericRefs("2:1-5");
        expect(matchesNumeric(refs, 2, 1)).toBe(true);
    });

    test("range boundary: verse at end", () => {
        const refs = parseNumericRefs("2:1-5");
        expect(matchesNumeric(refs, 2, 5)).toBe(true);
    });

    test("range outside: verse 6", () => {
        const refs = parseNumericRefs("2:1-5");
        expect(matchesNumeric(refs, 2, 6)).toBe(false);
    });

    test("wrong sura: sura 3 when only sura 2 defined", () => {
        const refs = parseNumericRefs("2:5");
        expect(matchesNumeric(refs, 3, 5)).toBe(false);
    });

    test("wildcard sura ':12' matches any sura", () => {
        const refs = parseNumericRefs(":12");
        expect(matchesNumeric(refs, 1, 12)).toBe(true);
        expect(matchesNumeric(refs, 99, 12)).toBe(true);
        expect(matchesNumeric(refs, 1, 13)).toBe(false);
    });

    test("full sura '2:' matches all verses", () => {
        const refs = parseNumericRefs("2:");
        expect(matchesNumeric(refs, 2, 1)).toBe(true);
        expect(matchesNumeric(refs, 2, 999)).toBe(true);
        expect(matchesNumeric(refs, 3, 1)).toBe(false);
    });

    test("string sura/verse numbers coerced correctly", () => {
        const refs = parseNumericRefs("2:5");
        expect(matchesNumeric(refs, "2", "5")).toBe(true);
    });
});

// ── highlightText — crash & edge-case scenarios ────────────────────────────

/**
 * Simplified highlightText that returns text segments (no JSX)
 * to test the core logic: position mapping, keyword matching, splitting.
 * Supports both regex (normal) and exact (boundary-aware) modes.
 */
function highlightTextLogic(originalText, keyword, lang, doNormalize, caseSensitive, useExact = false) {
    // Guard: null/undefined originalText
    if (!originalText) return [originalText ?? ''];
    if (!keyword || keyword.trim() === '') return [originalText];

    const origChars = [...originalText];
    let searchStr = "";
    const posMap = [];

    for (let i = 0; i < origChars.length; i++) {
        let ch = origChars[i];
        if ((lang === "tr" || lang === "az") && doNormalize) {
            ch = ch.replace(/[İIıi]/g, "i");
        }
        if (doNormalize) {
            ch = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        }
        if (!caseSensitive) {
            ch = ch.toLocaleUpperCase(lang);
        }
        for (let j = 0; j < ch.length; j++) {
            searchStr += ch[j];
            posMap.push(i);
        }
    }

    let processedKeyword = keyword;
    if ((lang === "tr" || lang === "az") && doNormalize) {
        processedKeyword = processedKeyword.replace(/[İIıi]/g, "i");
    }
    if (doNormalize) {
        processedKeyword = normalizeText(processedKeyword);
    }
    // Always escape regex specials to prevent SyntaxError
    const escapedKeyword = removePunctuations(processedKeyword);
    if (!escapedKeyword || escapedKeyword.trim() === '') return [originalText];
    processedKeyword = !caseSensitive ? escapedKeyword.toLocaleUpperCase(lang) : escapedKeyword;

    const parts = [];
    let lastOrigEnd = 0;

    if (useExact) {
        // Boundary-aware exact matching (mirrors Magnify.js exact branch)
        let pos = 0;
        while (true) {
            const idx = exactIndexOf(searchStr, processedKeyword, pos);
            if (idx === -1) break;
            const phraseWords = processedKeyword.split(/\s+/).filter(Boolean);
            let cursor = idx;
            for (let w = 0; w < phraseWords.length; w++) {
                if (w > 0) { while (cursor < searchStr.length && !isWordChar(searchStr[cursor])) cursor++; }
                cursor += phraseWords[w].length;
            }
            const origStart = posMap[idx];
            const origEnd = posMap[cursor - 1] + 1;
            const matchText = origChars.slice(origStart, origEnd).join("");

            if (origStart > lastOrigEnd) {
                parts.push({ type: 'text', value: origChars.slice(lastOrigEnd, origStart).join("") });
            }
            parts.push({ type: 'highlight', value: matchText });
            lastOrigEnd = origEnd;
            pos = cursor;
        }
    } else {
        let regex;
        try {
            regex = new RegExp(processedKeyword, caseSensitive ? 'g' : 'gi');
        } catch (e) {
            return [originalText];
        }

        let match;
        while ((match = regex.exec(searchStr)) !== null) {
            if (match[0].length === 0) { regex.lastIndex++; continue; }
            const origStart = posMap[match.index];
            const origEnd = (posMap[match.index + match[0].length - 1] ?? origChars.length - 1) + 1;
            const matchText = origChars.slice(origStart, origEnd).join("");

            if (origStart > lastOrigEnd) {
                parts.push({ type: 'text', value: origChars.slice(lastOrigEnd, origStart).join("") });
            }
            parts.push({ type: 'highlight', value: matchText });
            lastOrigEnd = origEnd;
        }
    }

    if (lastOrigEnd < origChars.length) {
        parts.push({ type: 'text', value: origChars.slice(lastOrigEnd).join("") });
    }

    return parts.length > 0 ? parts : [{ type: 'text', value: originalText }];
}

/** Shorthand: returns just the highlighted segment texts */
function getHighlights(originalText, keyword, lang = "en", doNormalize = true, caseSensitive = false, useExact = false) {
    const parts = highlightTextLogic(originalText, keyword, lang, doNormalize, caseSensitive, useExact);
    if (typeof parts[0] === 'string') return parts; // guard returns
    return parts.filter(p => p.type === 'highlight').map(p => p.value);
}

/** Shorthand: returns all parts as [{type, value}] */
function getAllParts(originalText, keyword, lang = "en", doNormalize = true, caseSensitive = false, useExact = false) {
    return highlightTextLogic(originalText, keyword, lang, doNormalize, caseSensitive, useExact);
}

describe("highlightText — crash guards", () => {
    test("null originalText → returns ['']", () => {
        const result = highlightTextLogic(null, "test", "en", true, false);
        expect(result).toEqual(['']);
    });

    test("undefined originalText → returns ['']", () => {
        const result = highlightTextLogic(undefined, "test", "en", true, false);
        expect(result).toEqual(['']);
    });

    test("empty originalText → returns ['']", () => {
        const result = highlightTextLogic("", "test", "en", true, false);
        expect(result).toEqual([""]);
    });

    test("null keyword → returns [originalText]", () => {
        const result = highlightTextLogic("Hello", null, "en", true, false);
        expect(result).toEqual(["Hello"]);
    });

    test("empty keyword → returns [originalText]", () => {
        const result = highlightTextLogic("Hello", "", "en", true, false);
        expect(result).toEqual(["Hello"]);
    });

    test("whitespace-only keyword → returns [originalText]", () => {
        const result = highlightTextLogic("Hello", "   ", "en", true, false);
        expect(result).toEqual(["Hello"]);
    });

    test("keyword with regex special chars does not crash", () => {
        expect(() => {
            highlightTextLogic("test (value) [array]", "(value)", "en", true, false);
        }).not.toThrow();
    });

    test("keyword '.*' does not cause runaway regex", () => {
        expect(() => {
            highlightTextLogic("Hello World", ".*", "en", true, false);
        }).not.toThrow();
    });

    test("keyword '(?<invalid)' does not throw", () => {
        expect(() => {
            highlightTextLogic("test data", "(?<invalid)", "en", true, false);
        }).not.toThrow();
    });

    test("keyword '?' with normalize OFF does not crash (white screen bug)", () => {
        expect(() => {
            highlightTextLogic("Is this a question?", "?", "en", false, false);
        }).not.toThrow();
    });

    test("keyword '+' with normalize OFF does not crash", () => {
        expect(() => {
            highlightTextLogic("1+1=2", "+", "en", false, false);
        }).not.toThrow();
    });

    test("keyword '*' with normalize OFF does not crash", () => {
        expect(() => {
            highlightTextLogic("footnote *19:2", "*", "en", false, false);
        }).not.toThrow();
    });

    test("regex special chars with normalize OFF still highlight correctly", () => {
        const highlights = getHighlights("Is this a question?", "?", "en", false, false);
        expect(highlights).toEqual(["?"]);
    });
});

describe("highlightText — correct highlighting", () => {
    test("basic English match", () => {
        const highlights = getHighlights("Hello World", "hello", "en", false, false);
        expect(highlights).toEqual(["Hello"]);
    });

    test("multiple matches", () => {
        const highlights = getHighlights("the cat and the dog", "the", "en", false, false);
        expect(highlights).toEqual(["the", "the"]);
    });

    test("case-sensitive: exact match only", () => {
        const highlights = getHighlights("Hello hello HELLO", "Hello", "en", false, true);
        expect(highlights).toEqual(["Hello"]);
    });

    test("no match → returns original text only", () => {
        const parts = getAllParts("Hello World", "xyz", "en", false, false);
        expect(parts).toEqual([{ type: 'text', value: "Hello World" }]);
    });

    test("French accents with normalize ON: 'ecole' highlights 'école'", () => {
        const highlights = getHighlights("Une école française", "ecole", "fr", true, false);
        expect(highlights).toEqual(["école"]);
    });

    test("German ß: 'strasse' highlights 'Straße'", () => {
        const highlights = getHighlights("Die Straße ist lang", "strasse", "de", true, false);
        expect(highlights).toEqual(["Straße"]);
    });

    test("Turkish normalize ON: 'istanbul' highlights 'İstanbul'", () => {
        const highlights = getHighlights("İstanbul güzel", "istanbul", "tr", true, false);
        expect(highlights).toEqual(["İstanbul"]);
    });

    test("Turkish normalize OFF: 'istanbul' highlights 'İstanbul' (case pair i↔İ)", () => {
        const highlights = getHighlights("İstanbul güzel", "istanbul", "tr", false, false);
        expect(highlights).toEqual(["İstanbul"]);
    });

    test("Turkish normalize OFF: 'israıl' does NOT highlight 'İsrail' (ı≠i)", () => {
        const highlights = getHighlights("İsrail devleti", "israıl", "tr", false, false);
        expect(highlights).toEqual([]);
    });

    test("match at very start of text", () => {
        const highlights = getHighlights("Hello World", "hello", "en", false, false);
        expect(highlights).toEqual(["Hello"]);
    });

    test("match at very end of text", () => {
        const highlights = getHighlights("Hello World", "world", "en", false, false);
        expect(highlights).toEqual(["World"]);
    });

    test("entire text is a match", () => {
        const highlights = getHighlights("Hello", "hello", "en", false, false);
        expect(highlights).toEqual(["Hello"]);
    });

    test("emoji in text does not break highlighting", () => {
        const highlights = getHighlights("test 🎉 data", "data", "en", false, false);
        expect(highlights).toEqual(["data"]);
    });

    test("Arabic text case-insensitive (no case in Arabic)", () => {
        const highlights = getHighlights("بسم الله الرحمن", "الله", "ar", false, false);
        expect(highlights).toEqual(["الله"]);
    });
});

// ── localStorage JSON.parse crash scenario ──────────────────────────────────

describe("localStorage JSON.parse safety", () => {
    test("valid 'true' string parses correctly", () => {
        expect(JSON.parse("true")).toBe(true);
    });
    test("valid 'false' string parses correctly", () => {
        expect(JSON.parse("false")).toBe(false);
    });
    test("malformed string throws SyntaxError", () => {
        expect(() => JSON.parse("not-json")).toThrow(SyntaxError);
    });
    test("empty string throws SyntaxError", () => {
        expect(() => JSON.parse("")).toThrow(SyntaxError);
    });
    test("safe wrapper pattern works", () => {
        function safeJsonParse(str, fallback) {
            try { return JSON.parse(str); }
            catch { return fallback; }
        }
        expect(safeJsonParse("true", false)).toBe(true);
        expect(safeJsonParse("corrupted!", false)).toBe(false);
        expect(safeJsonParse("", false)).toBe(false);
        expect(safeJsonParse(null, false)).toBe(null); // JSON.parse(null) → null, not throw
    });
});

// ── exactIndexOf — word-boundary exact phrase matching ──────────────────────

const isWordChar = (ch) => {
    if (!ch) return false;
    const c = ch.charCodeAt(0);
    if (c >= 0x30 && c <= 0x39) return true;
    if (ch.toUpperCase() !== ch.toLowerCase()) return true;
    if (c >= 0x0621 && c <= 0x064A) return true;
    if (c >= 0x066E && c <= 0x06D3) return true;
    if (c >= 0x05D0 && c <= 0x05EA) return true;
    if (c >= 0x4E00 && c <= 0x9FFF) return true;
    if (c >= 0x0900 && c <= 0x0DFF) return true;
    if (c >= 0x0E00 && c <= 0x0E7F) return true;
    return false;
};

function exactIndexOf(hay, phrase, startFrom) {
    const phraseWords = phrase.split(/\s+/).filter(Boolean);
    if (phraseWords.length === 0) return -1;

    let pos = startFrom || 0;
    while (pos <= hay.length - 1) {
        const idx = hay.indexOf(phraseWords[0], pos);
        if (idx === -1) return -1;

        if (idx > 0 && isWordChar(hay[idx - 1])) { pos = idx + 1; continue; }

        let cursor = idx + phraseWords[0].length;
        let ok = true;
        for (let w = 1; w < phraseWords.length; w++) {
            if (cursor >= hay.length || isWordChar(hay[cursor])) { ok = false; break; }
            while (cursor < hay.length && !isWordChar(hay[cursor])) cursor++;
            if (hay.indexOf(phraseWords[w], cursor) !== cursor) { ok = false; break; }
            cursor += phraseWords[w].length;
        }
        if (!ok) { pos = idx + 1; continue; }

        if (cursor < hay.length && isWordChar(hay[cursor])) { pos = idx + 1; continue; }

        return idx;
    }
    return -1;
}

describe("exactIndexOf — word-boundary exact phrase matching", () => {
    test("single word: 'GOD' found at word boundary", () => {
        expect(exactIndexOf("IN THE NAME OF GOD", "GOD", 0)).toBe(15);
    });

    test("single word: 'GOD' not found inside 'GODLY'", () => {
        expect(exactIndexOf("GODLY PEOPLE", "GOD", 0)).toBe(-1);
    });

    test("single word: 'GOD' not found inside 'DEMIGOD'", () => {
        expect(exactIndexOf("A DEMIGOD", "GOD", 0)).toBe(-1);
    });

    test("single word at start of string", () => {
        expect(exactIndexOf("GOD IS GREAT", "GOD", 0)).toBe(0);
    });

    test("single word at end of string", () => {
        expect(exactIndexOf("PRAISE GOD", "GOD", 0)).toBe(7);
    });

    test("multi-word phrase: 'MOST GRACIOUS' found", () => {
        expect(exactIndexOf("IN THE NAME OF GOD MOST GRACIOUS", "MOST GRACIOUS", 0)).toBe(19);
    });

    test("multi-word phrase: words must be adjacent", () => {
        expect(exactIndexOf("MOST PEOPLE ARE GRACIOUS", "MOST GRACIOUS", 0)).toBe(-1);
    });

    test("multi-word phrase with extra whitespace in haystack", () => {
        expect(exactIndexOf("GOD  MOST   GRACIOUS", "MOST GRACIOUS", 0)).toBe(5);
    });

    test("multi-word phrase with newline in haystack", () => {
        expect(exactIndexOf("GOD\nMOST\nGRACIOUS", "MOST GRACIOUS", 0)).toBe(4);
    });

    test("multi-word phrase with tab in haystack", () => {
        expect(exactIndexOf("GOD\tMOST\tGRACIOUS", "MOST GRACIOUS", 0)).toBe(4);
    });

    test("phrase not at word boundary (left)", () => {
        expect(exactIndexOf("THEMOST GRACIOUS", "MOST GRACIOUS", 0)).toBe(-1);
    });

    test("phrase not at word boundary (right)", () => {
        expect(exactIndexOf("MOST GRACIOUSNESS", "MOST GRACIOUS", 0)).toBe(-1);
    });

    test("multiple matches: finds first from startFrom", () => {
        expect(exactIndexOf("GOD IS GOD", "GOD", 0)).toBe(0);
        expect(exactIndexOf("GOD IS GOD", "GOD", 1)).toBe(7);
    });

    test("empty phrase returns -1", () => {
        expect(exactIndexOf("HELLO", "", 0)).toBe(-1);
    });

    test("empty haystack returns -1", () => {
        expect(exactIndexOf("", "GOD", 0)).toBe(-1);
    });

    test("phrase longer than haystack returns -1", () => {
        expect(exactIndexOf("HI", "HELLO WORLD", 0)).toBe(-1);
    });

    test("NBSP treated as whitespace boundary", () => {
        expect(exactIndexOf("HELLO\u00A0WORLD", "HELLO", 0)).toBe(0);
        expect(exactIndexOf("HELLO\u00A0WORLD", "WORLD", 0)).toBe(6);
    });

    test("three-word phrase", () => {
        expect(exactIndexOf("THE MOST GRACIOUS GOD", "THE MOST GRACIOUS", 0)).toBe(0);
    });

    test("three-word phrase not at boundary", () => {
        expect(exactIndexOf("ATHEMOST GRACIOUS GOD", "THE MOST GRACIOUS", 0)).toBe(-1);
    });

    // ── punctuation as word boundary ──
    test("word followed by comma: 'GOD,' contains 'GOD'", () => {
        expect(exactIndexOf("PRAISE GOD, THE ALMIGHTY", "GOD", 0)).toBe(7);
    });

    test("word followed by period: 'GOD.' contains 'GOD'", () => {
        expect(exactIndexOf("PRAISE GOD.", "GOD", 0)).toBe(7);
    });

    test("word followed by colon: 'GOD:' contains 'GOD'", () => {
        expect(exactIndexOf("GOD: THE CREATOR", "GOD", 0)).toBe(0);
    });

    test("word followed by semicolon", () => {
        expect(exactIndexOf("PRAISE GOD; HE IS GREAT", "GOD", 0)).toBe(7);
    });

    test("word in parentheses: '(GOD)' contains 'GOD'", () => {
        expect(exactIndexOf("PRAISE (GOD) ALWAYS", "GOD", 0)).toBe(8);
    });

    test("word in quotes", () => {
        expect(exactIndexOf('HE SAID "GOD" IS GREAT', "GOD", 0)).toBe(9);
    });

    test("word preceded by dash: '-GOD' contains 'GOD'", () => {
        expect(exactIndexOf("ALL-KNOWING GOD", "GOD", 0)).toBe(12);
    });

    test("word followed by exclamation", () => {
        expect(exactIndexOf("OH GOD!", "GOD", 0)).toBe(3);
    });

    test("word followed by question mark", () => {
        expect(exactIndexOf("IS IT GOD?", "GOD", 0)).toBe(6);
    });

    test("asterisk as boundary: '*GOD*' contains 'GOD'", () => {
        expect(exactIndexOf("*GOD* IS GREAT", "GOD", 0)).toBe(1);
    });

    test("multi-word with punctuation gap: 'MOST, GRACIOUS' matches 'MOST GRACIOUS'", () => {
        expect(exactIndexOf("THE MOST, GRACIOUS GOD", "MOST GRACIOUS", 0)).toBe(4);
    });

    test("multi-word with mixed separators: 'MOST - GRACIOUS'", () => {
        expect(exactIndexOf("GOD MOST - GRACIOUS", "MOST GRACIOUS", 0)).toBe(4);
    });

    test("still rejects partial word: 'GODLY,' does not match 'GOD'", () => {
        expect(exactIndexOf("GODLY, PEOPLE", "GOD", 0)).toBe(-1);
    });

    test("still rejects partial word: ',DEMIGOD' does not match 'GOD'", () => {
        expect(exactIndexOf("A ,DEMIGOD", "GOD", 0)).toBe(-1);
    });

    // ── Unicode punctuation (smart quotes, em dash, guillemets) ──
    test("right double quote \u201D is boundary", () => {
        expect(exactIndexOf("SAY \u201CGOD\u201D IS GREAT", "GOD", 0)).toBe(5);
    });

    test("left double quote \u201C is boundary", () => {
        expect(exactIndexOf("\u201CGOD\u201D IS GREAT", "GOD", 0)).toBe(1);
    });

    test("right single quote \u2019 is boundary", () => {
        expect(exactIndexOf("THE GOD\u2019S MERCY", "GOD", 0)).toBe(4);
    });

    test("em dash \u2014 is boundary", () => {
        expect(exactIndexOf("TRUTH\u2014GOD\u2014IS CLEAR", "GOD", 0)).toBe(6);
    });

    test("en dash \u2013 is boundary", () => {
        expect(exactIndexOf("PAGES 5\u201310 GOD", "GOD", 0)).toBe(11);
    });

    test("guillemets \u00AB \u00BB are boundary", () => {
        expect(exactIndexOf("\u00ABGOD\u00BB IS GREAT", "GOD", 0)).toBe(1);
    });

    test("Arabic comma \u060C is boundary", () => {
        expect(exactIndexOf("\u0627\u0644\u0644\u0647\u060C \u0627\u0644\u0631\u062D\u0645\u0646", "\u0627\u0644\u0644\u0647", 0)).toBe(0);
    });
});

// ── highlightText exact mode ────────────────────────────────────────────────

describe("highlightText — exact mode", () => {
    test("single word exact match", () => {
        const highlights = getHighlights("In the name of God", "God", "en", false, false, true);
        expect(highlights).toEqual(["God"]);
    });

    test("exact mode: does NOT match partial word", () => {
        const highlights = getHighlights("Godly people praise God", "God", "en", false, false, true);
        expect(highlights).toEqual(["God"]);
    });

    test("exact mode: does NOT match inside word (suffix)", () => {
        const highlights = getHighlights("A demigod appeared", "God", "en", false, false, true);
        expect(highlights).toEqual([]);
    });

    test("exact mode: multi-word phrase", () => {
        const highlights = getHighlights("God Most Gracious Most Merciful", "Most Gracious", "en", false, false, true);
        expect(highlights).toEqual(["Most Gracious"]);
    });

    test("exact mode: multi-word with extra whitespace in text", () => {
        const highlights = getHighlights("God  Most   Gracious", "Most Gracious", "en", false, false, true);
        expect(highlights).toEqual(["Most   Gracious"]);
    });

    test("exact mode: multi-word with newline in text", () => {
        const highlights = getHighlights("God\nMost\nGracious end", "Most Gracious", "en", false, false, true);
        expect(highlights).toEqual(["Most\nGracious"]);
    });

    test("exact mode: multi-word with punctuation between words in text", () => {
        const highlights = getHighlights("the Most, Gracious God", "Most Gracious", "en", false, false, true);
        expect(highlights).toEqual(["Most, Gracious"]);
    });

    test("exact mode: multi-word with dash between words in text", () => {
        const highlights = getHighlights("God Most - Gracious", "Most Gracious", "en", false, false, true);
        expect(highlights).toEqual(["Most - Gracious"]);
    });

    test("exact mode: word at punctuation boundary", () => {
        const highlights = getHighlights("Praise God, the Almighty", "God", "en", false, false, true);
        expect(highlights).toEqual(["God"]);
    });

    test("exact mode: word in quotes", () => {
        const highlights = getHighlights('He said "God" is great', "God", "en", false, false, true);
        expect(highlights).toEqual(["God"]);
    });

    test("exact mode: word in smart quotes", () => {
        const highlights = getHighlights("He said \u201CGod\u201D is great", "God", "en", false, false, true);
        expect(highlights).toEqual(["God"]);
    });

    test("exact mode: word after em-dash", () => {
        const highlights = getHighlights("Truth\u2014God\u2014is clear", "God", "en", false, false, true);
        expect(highlights).toEqual(["God"]);
    });

    test("exact mode: multiple matches", () => {
        const highlights = getHighlights("God is God and God alone", "God", "en", false, false, true);
        expect(highlights).toEqual(["God", "God", "God"]);
    });

    test("exact mode: with normalize ON and accented text", () => {
        const highlights = getHighlights("Une école française", "ecole", "fr", true, false, true);
        expect(highlights).toEqual(["école"]);
    });

    test("exact mode: Turkish with normalize ON", () => {
        const highlights = getHighlights("İstanbul güzel şehir", "istanbul", "tr", true, false, true);
        expect(highlights).toEqual(["İstanbul"]);
    });

    test("exact mode: no match returns original text only", () => {
        const parts = getAllParts("Hello World", "xyz", "en", false, false, true);
        expect(parts).toEqual([{ type: 'text', value: "Hello World" }]);
    });

    test("exact mode: crash guard — regex special chars in keyword", () => {
        expect(() => {
            highlightTextLogic("test (value) data", "(value)", "en", false, false, true);
        }).not.toThrow();
    });

    test("exact mode: keyword '?' does not crash", () => {
        expect(() => {
            highlightTextLogic("Is this a question?", "?", "en", false, false, true);
        }).not.toThrow();
    });
});

// ── lightWords logic (keyword extraction from search term) ──────────────────

/**
 * Simulates the lightWords keyword-extraction logic from Magnify.js.
 * Returns the list of keywords that would be used for highlighting.
 */
function extractLightWordsKeywords(searchTerm, lang, doNormalize, caseSensitive, useExact) {
    let processedTerm = searchFold(searchTerm, lang, doNormalize, caseSensitive);
    if (useExact) {
        const orParts = processedTerm.split('|').map(t => t.trim()).filter(t => t !== '');
        const keywords = [];
        orParts.forEach(part => {
            const tokens = part.split(/\s+/).filter(t => t.trim() !== '');
            const textTokens = tokens.filter(t => !/\d/.test(t));
            if (textTokens.length > 0) keywords.push(textTokens.join(' '));
        });
        return keywords;
    } else {
        return processedTerm.split(' ').filter(keyword => (keyword.trim() !== '' && keyword.trim() !== '|' && keyword.trim().length > 0));
    }
}

/**
 * Simulates the full lightWords pipeline: extract keywords then highlight text.
 * In real Magnify.js, highlightText returns a mix of strings and JSX elements.
 * Here we simulate with {type:'text',value} and {type:'highlight',value} objects.
 * The chaining logic: only 'text' parts get re-highlighted by subsequent keywords.
 */
function lightWordsHighlights(text, searchTerm, lang = "en", doNormalize = false, caseSensitive = false, useExact = false) {
    const keywords = extractLightWordsKeywords(searchTerm, lang, doNormalize, caseSensitive, useExact);
    // Start with the original text as a single text part
    let parts = [{ type: 'text', value: text }];
    keywords.forEach(keyword => {
        parts = parts.flatMap(part => {
            // Only re-highlight text parts (in real code: typeof part === 'string')
            if (part.type === 'text') {
                const result = highlightTextLogic(part.value, keyword, lang, doNormalize, caseSensitive, useExact);
                // Guard returns (string arrays)
                if (typeof result[0] === 'string') return [{ type: 'text', value: result[0] }];
                return result;
            }
            // Already highlighted — keep as-is
            return part;
        });
    });
    return parts.filter(p => p.type === 'highlight').map(p => p.value);
}

describe("lightWords — keyword extraction", () => {
    test("single word: normal mode", () => {
        expect(extractLightWordsKeywords("hello", "en", false, false, false)).toEqual(["HELLO"]);
    });

    test("multiple words: normal mode splits by space", () => {
        expect(extractLightWordsKeywords("hello world", "en", false, false, false)).toEqual(["HELLO", "WORLD"]);
    });

    test("pipe separates OR groups: normal mode keeps all as flat list", () => {
        expect(extractLightWordsKeywords("hello | world", "en", false, false, false)).toEqual(["HELLO", "WORLD"]);
    });

    test("formula + text with pipe: normal mode includes all tokens", () => {
        const kw = extractLightWordsKeywords("27:19; 37:154 | statement", "en", false, false, false);
        expect(kw).toEqual(["27:19;", "37:154", "STATEMENT"]);
    });

    test("exact mode: single word", () => {
        expect(extractLightWordsKeywords("hello", "en", false, false, true)).toEqual(["HELLO"]);
    });

    test("exact mode: multiple words become one phrase", () => {
        expect(extractLightWordsKeywords("most gracious", "en", false, false, true)).toEqual(["MOST GRACIOUS"]);
    });

    test("exact mode: pipe separates OR groups, each group becomes phrase", () => {
        expect(extractLightWordsKeywords("most gracious | most merciful", "en", false, false, true)).toEqual(["MOST GRACIOUS", "MOST MERCIFUL"]);
    });

    test("exact mode: formula tokens (with digits) are excluded from keywords", () => {
        const kw = extractLightWordsKeywords("27:19; 37:154 | statement", "en", false, false, true);
        expect(kw).toEqual(["STATEMENT"]);
    });

    test("exact mode: pure formula has no text keywords", () => {
        expect(extractLightWordsKeywords("2:5, 3:10", "en", false, false, true)).toEqual([]);
    });

    test("exact mode: formula + text in same OR group separates correctly", () => {
        const kw = extractLightWordsKeywords("19: meryem", "en", false, false, true);
        expect(kw).toEqual(["MERYEM"]);
    });

    test("exact mode: mixed formula and text across pipes", () => {
        const kw = extractLightWordsKeywords("2:5 god | 3:10 merciful", "en", false, false, true);
        expect(kw).toEqual(["GOD", "MERCIFUL"]);
    });

    test("normal mode: pipe literal is filtered out", () => {
        const kw = extractLightWordsKeywords("a | b | c", "en", false, false, false);
        expect(kw).toEqual(["A", "B", "C"]);
    });

    test("empty search term returns empty", () => {
        expect(extractLightWordsKeywords("", "en", false, false, false)).toEqual([]);
    });

    test("whitespace-only search term returns empty", () => {
        expect(extractLightWordsKeywords("   ", "en", false, false, false)).toEqual([]);
    });
});

describe("lightWords — full highlight pipeline", () => {
    test("normal mode: single word highlights in text", () => {
        const h = lightWordsHighlights("God is Most Gracious", "god", "en", false, false, false);
        expect(h).toEqual(["God"]);
    });

    test("normal mode: multiple words each highlight independently", () => {
        const h = lightWordsHighlights("God is Most Gracious", "god gracious", "en", false, false, false);
        expect(h).toEqual(["God", "Gracious"]);
    });

    test("normal mode: pipe search highlights both sides", () => {
        const h = lightWordsHighlights("God is Gracious and Merciful", "gracious | merciful", "en", false, false, false);
        expect(h).toEqual(["Gracious", "Merciful"]);
    });

    test("normal mode: formula+text pipe — text keyword highlights in verse", () => {
        const h = lightWordsHighlights("This is a statement about truth", "27:19; 37:154 | statement", "en", false, false, false);
        expect(h).toEqual(["statement"]);
    });

    test("normal mode: formula tokens don't highlight in verse text", () => {
        const h = lightWordsHighlights("God is Most Gracious", "27:19 | god", "en", false, false, false);
        expect(h).toEqual(["God"]);
    });

    test("exact mode: single word highlights with boundary check", () => {
        const h = lightWordsHighlights("Godly people praise God", "god", "en", false, false, true);
        expect(h).toEqual(["God"]);
    });

    test("exact mode: multi-word phrase highlights together", () => {
        const h = lightWordsHighlights("God Most Gracious Most Merciful", "most gracious", "en", false, false, true);
        expect(h).toEqual(["Most Gracious"]);
    });

    test("exact mode: pipe OR — both phrases highlight", () => {
        const h = lightWordsHighlights("God Most Gracious Most Merciful", "most gracious | most merciful", "en", false, false, true);
        expect(h).toEqual(["Most Gracious", "Most Merciful"]);
    });

    test("exact mode: formula+text pipe — only text keyword highlights", () => {
        const h = lightWordsHighlights("This is a statement about truth", "27:19; 37:154 | statement", "en", false, false, true);
        expect(h).toEqual(["statement"]);
    });

    test("exact mode: formula tokens excluded from highlighting", () => {
        const h = lightWordsHighlights("Verse 27:19 says something", "27:19; 37:154 | statement", "en", false, false, true);
        expect(h).toEqual([]);
    });

    test("exact mode: formula + text in same group — text highlights", () => {
        const h = lightWordsHighlights("Onu taşıyarak Meryem geldi", "19: meryem", "en", false, false, true);
        expect(h).toEqual(["Meryem"]);
    });

    test("exact mode: Turkish with normalize — formula + text", () => {
        const h = lightWordsHighlights("Onu taşıyarak Meryem geldi", "19: meryem", "tr", true, false, true);
        expect(h).toEqual(["Meryem"]);
    });

    test("normal mode: no match returns empty highlights", () => {
        const h = lightWordsHighlights("Hello World", "xyz", "en", false, false, false);
        expect(h).toEqual([]);
    });

    test("exact mode: no match returns empty highlights", () => {
        const h = lightWordsHighlights("Hello World", "xyz", "en", false, false, true);
        expect(h).toEqual([]);
    });

    test("normal mode: regex special chars in search don't crash", () => {
        expect(() => {
            lightWordsHighlights("test (value) data", "(value)", "en", false, false, false);
        }).not.toThrow();
    });

    test("exact mode: regex special chars in search don't crash", () => {
        expect(() => {
            lightWordsHighlights("test (value) data", "(value)", "en", false, false, true);
        }).not.toThrow();
    });

    test("normal mode: formula-only search has no text highlights in verse", () => {
        const h = lightWordsHighlights("God is Most Gracious", "2:5, 3:10", "en", false, false, false);
        expect(h).toEqual([]);
    });

    test("exact mode: formula-only search has no text highlights in verse", () => {
        const h = lightWordsHighlights("God is Most Gracious", "2:5, 3:10", "en", false, false, true);
        expect(h).toEqual([]);
    });

    test("normal mode: semicolon-separated formulas with pipe and text", () => {
        const h = lightWordsHighlights("Truth and statement here", "2:5; 3:10 | statement", "en", false, false, false);
        expect(h).toEqual(["statement"]);
    });

    test("exact mode: semicolon-separated formulas with pipe and text", () => {
        const h = lightWordsHighlights("Truth and statement here", "2:5; 3:10 | statement", "en", false, false, true);
        expect(h).toEqual(["statement"]);
    });

    test("exact mode: multi-word text with formula on other side of pipe", () => {
        const h = lightWordsHighlights("En Lütufkâr olan Tanrı", "2:5 | en lütufkâr", "en", false, false, true);
        expect(h).toEqual(["En Lütufkâr"]);
    });

    test("normal mode: case insensitive highlighting", () => {
        const h = lightWordsHighlights("STATEMENT about God", "statement", "en", false, false, false);
        expect(h).toEqual(["STATEMENT"]);
    });

    test("exact mode: case insensitive highlighting", () => {
        const h = lightWordsHighlights("STATEMENT about God", "statement", "en", false, false, true);
        expect(h).toEqual(["STATEMENT"]);
    });
});
