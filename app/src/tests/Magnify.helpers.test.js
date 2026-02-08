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
 */
function highlightTextLogic(originalText, keyword, lang, doNormalize, caseSensitive) {
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

    let regex;
    try {
        regex = new RegExp(processedKeyword, caseSensitive ? 'g' : 'gi');
    } catch (e) {
        return [originalText];
    }

    let match;
    const parts = [];
    let lastOrigEnd = 0;

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

    if (lastOrigEnd < origChars.length) {
        parts.push({ type: 'text', value: origChars.slice(lastOrigEnd).join("") });
    }

    return parts.length > 0 ? parts : [{ type: 'text', value: originalText }];
}

/** Shorthand: returns just the highlighted segment texts */
function getHighlights(originalText, keyword, lang = "en", doNormalize = true, caseSensitive = false) {
    const parts = highlightTextLogic(originalText, keyword, lang, doNormalize, caseSensitive);
    if (typeof parts[0] === 'string') return parts; // guard returns
    return parts.filter(p => p.type === 'highlight').map(p => p.value);
}

/** Shorthand: returns all parts as [{type, value}] */
function getAllParts(originalText, keyword, lang = "en", doNormalize = true, caseSensitive = false) {
    return highlightTextLogic(originalText, keyword, lang, doNormalize, caseSensitive);
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
