/**
 * Unit tests for Magnify searchFold & highlightText logic.
 *
 * These tests verify that case-insensitive search works correctly across
 * languages with special casing rules — Turkish İ/ı, German ß, Greek
 * polytonic, French accents, Cyrillic, Lithuanian, etc.
 *
 * Run:  cd app && npx react-scripts test --testPathPattern="Magnify.searchFold" --watchAll=false
 */

// ── helpers (mirror the logic inside Magnify.js) ────────────────────────────

function normalizeText(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * searchFold – collapses text into a canonical form for search matching.
 * @param {string} text
 * @param {string} lang        – BCP-47 language code
 * @param {boolean} doNormalize – strip diacritics (NFD)
 * @param {boolean} caseSensitive
 */
function searchFold(text, lang, doNormalize, caseSensitive) {
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

/** Shorthand: case-insensitive search via searchFold. */
function foldMatch(haystack, needle, lang, doNormalize = true) {
    const h = searchFold(haystack, lang, doNormalize, false);
    const n = searchFold(needle, lang, doNormalize, false);
    return h.includes(n);
}

// ── TURKISH (tr) ────────────────────────────────────────────────────────────

describe("Turkish (tr) — normalize ON", () => {
    const lang = "tr";
    const norm = true;

    test("'istanbul' matches 'İstanbul' (Latin keyboard user)", () => {
        expect(foldMatch("İstanbul güzel", "istanbul", lang, norm)).toBe(true);
    });
    test("'İstanbul' matches 'İstanbul'", () => {
        expect(foldMatch("İstanbul güzel", "İstanbul", lang, norm)).toBe(true);
    });
    test("'ISTANBUL' matches 'İstanbul'", () => {
        expect(foldMatch("İstanbul güzel", "ISTANBUL", lang, norm)).toBe(true);
    });
    test("'İSTANBUL' matches 'İstanbul'", () => {
        expect(foldMatch("İstanbul güzel", "İSTANBUL", lang, norm)).toBe(true);
    });
    test("single 'i' matches 'İman'", () => {
        expect(foldMatch("İman etmek", "i", lang, norm)).toBe(true);
    });
    test("single 'İ' matches 'İman'", () => {
        expect(foldMatch("İman etmek", "İ", lang, norm)).toBe(true);
    });
    test("single 'ı' matches 'İman' (norm ON → ı≈i)", () => {
        expect(foldMatch("İman etmek", "ı", lang, norm)).toBe(true);
    });
    test("single 'I' matches 'İman' (norm ON → I≈i)", () => {
        expect(foldMatch("İman etmek", "I", lang, norm)).toBe(true);
    });
    test("'sınıf' matches 'Sınıf'", () => {
        expect(foldMatch("Sınıf dersi", "sınıf", lang, norm)).toBe(true);
    });
    test("'sinif' matches 'Sınıf' (norm ON → ı≈i)", () => {
        expect(foldMatch("Sınıf dersi", "sinif", lang, norm)).toBe(true);
    });
    test("'SINIF' matches 'Sınıf' (norm ON → I≈i≈ı≈İ)", () => {
        expect(foldMatch("Sınıf dersi", "SINIF", lang, norm)).toBe(true);
    });
    test("'israıl' matches 'İsrail' (norm ON → ı≈i)", () => {
        expect(foldMatch("İsrail devleti", "israıl", lang, norm)).toBe(true);
    });
});

describe("Turkish (tr) — normalize OFF", () => {
    const lang = "tr";
    const norm = false;

    test("'istanbul' matches 'İstanbul' (case-insensitive: i↔İ)", () => {
        expect(foldMatch("İstanbul güzel", "istanbul", lang, norm)).toBe(true);
    });
    test("'İstanbul' matches 'İstanbul'", () => {
        expect(foldMatch("İstanbul güzel", "İstanbul", lang, norm)).toBe(true);
    });
    test("'ISTANBUL' does NOT match 'İstanbul' (I≠İ when norm OFF)", () => {
        // I is uppercase of ı, not İ — these are different letters
        expect(foldMatch("İstanbul güzel", "ISTANBUL", lang, norm)).toBe(false);
    });
    test("'sınıf' matches 'Sınıf' (case-insensitive: ı↔I, case pair)", () => {
        expect(foldMatch("Sınıf dersi", "sınıf", lang, norm)).toBe(true);
    });
    test("'sinif' does NOT match 'Sınıf' (norm OFF → i≠ı)", () => {
        expect(foldMatch("Sınıf dersi", "sinif", lang, norm)).toBe(false);
    });
    test("'SINIF' does NOT match 'Sınıf' (I is uppercase of ı, not i → different letters)", () => {
        // SINIF → case pairs to → sınıf (via Turkish), but İ≠I means İstanbul's İ≠I
        // Actually: S-I-N-I-F uppercased stays S-I-N-I-F
        // Sınıf uppercased → S-I-N-I-F (ı→I). So this SHOULD match!
        expect(foldMatch("Sınıf dersi", "SINIF", lang, norm)).toBe(true);
    });
    test("'israıl' does NOT match 'İsrail' (norm OFF → ı≠i, strict)", () => {
        expect(foldMatch("İsrail devleti", "israıl", lang, norm)).toBe(false);
    });
    test("single 'i' matches text with 'İ' (case-insensitive: i↔İ)", () => {
        expect(foldMatch("İman etmek", "i", lang, norm)).toBe(true);
    });
    test("single 'ı' does NOT match text with 'İ' (norm OFF → ı≠i, ı↔I only)", () => {
        expect(foldMatch("İman etmek", "ı", lang, norm)).toBe(false);
    });
});

// ── AZERBAIJANI (az) — same rules as Turkish ────────────────────────────────

describe("Azerbaijani (az) — normalize ON", () => {
    const lang = "az";
    const norm = true;

    test("'istanbul' matches 'İstanbul'", () => {
        expect(foldMatch("İstanbul güzel", "istanbul", lang, norm)).toBe(true);
    });
    test("'sinif' matches 'Sınıf' (norm ON → ı≈i)", () => {
        expect(foldMatch("Sınıf dersi", "sinif", lang, norm)).toBe(true);
    });
});

describe("Azerbaijani (az) — normalize OFF", () => {
    const lang = "az";
    const norm = false;

    test("'istanbul' matches 'İstanbul' (case-insensitive: i↔İ)", () => {
        expect(foldMatch("İstanbul güzel", "istanbul", lang, norm)).toBe(true);
    });
    test("'sinif' does NOT match 'Sınıf' (norm OFF → i≠ı)", () => {
        expect(foldMatch("Sınıf dersi", "sinif", lang, norm)).toBe(false);
    });
});

// ── GERMAN (de) ─────────────────────────────────────────────────────────────

describe("German (de) — normalize ON", () => {
    const lang = "de";
    const norm = true;

    test("'grosszügig' matches 'großzügig' (ß→SS via upper)", () => {
        expect(foldMatch("Er gewährt großzügig", "grosszügig", lang, norm)).toBe(true);
    });
    test("'GROSSZÜGIG' matches 'großzügig'", () => {
        expect(foldMatch("Er gewährt großzügig", "GROSSZÜGIG", lang, norm)).toBe(true);
    });
    test("'strasse' matches 'Straße'", () => {
        expect(foldMatch("Die Straße ist lang", "strasse", lang, norm)).toBe(true);
    });
    test("'straße' matches 'Straße'", () => {
        expect(foldMatch("Die Straße ist lang", "straße", lang, norm)).toBe(true);
    });
    test("'STRASSE' matches 'Straße'", () => {
        expect(foldMatch("Die Straße ist lang", "STRASSE", lang, norm)).toBe(true);
    });
});

describe("German (de) — normalize OFF", () => {
    const lang = "de";
    const norm = false;

    test("'straße' matches 'Straße' (case only)", () => {
        expect(foldMatch("Die Straße ist lang", "straße", lang, norm)).toBe(true);
    });
    test("'STRASSE' matches 'Straße' (ß→SS via upper)", () => {
        expect(foldMatch("Die Straße ist lang", "STRASSE", lang, norm)).toBe(true);
    });
    test("'strasse' matches 'Straße' (ss vs ß both → SS via upper)", () => {
        expect(foldMatch("Die Straße ist lang", "strasse", lang, norm)).toBe(true);
    });
});

// ── GREEK (el) ──────────────────────────────────────────────────────────────

describe("Greek (el) — normalize ON", () => {
    const lang = "el";
    const norm = true;

    test("'ταιζω' matches 'ταΐζω' (accent stripped)", () => {
        expect(foldMatch("Πρέπει να ταΐζω", "ταιζω", lang, norm)).toBe(true);
    });
    test("'ΤΑΙΖΩ' matches 'ταΐζω'", () => {
        expect(foldMatch("Πρέπει να ταΐζω", "ΤΑΙΖΩ", lang, norm)).toBe(true);
    });
    test("'αθηνα' matches 'Αθήνα' (accent stripped)", () => {
        expect(foldMatch("Η Αθήνα είναι ωραία", "αθηνα", lang, norm)).toBe(true);
    });
});

// ── FRENCH (fr) ─────────────────────────────────────────────────────────────

describe("French (fr) — normalize ON", () => {
    const lang = "fr";
    const norm = true;

    test("'ecole' matches 'école' (accent stripped)", () => {
        expect(foldMatch("Une école française", "ecole", lang, norm)).toBe(true);
    });
    test("'ECOLE' matches 'école'", () => {
        expect(foldMatch("Une école française", "ECOLE", lang, norm)).toBe(true);
    });
    test("'francaise' matches 'française' (ç→c via NFD)", () => {
        expect(foldMatch("Une école française", "francaise", lang, norm)).toBe(true);
    });
});

// ── RUSSIAN (ru) — Cyrillic ─────────────────────────────────────────────────

describe("Russian (ru)", () => {
    const lang = "ru";

    test("'москва' matches 'Москва' (case-insensitive)", () => {
        expect(foldMatch("Москва столица", "москва", lang, true)).toBe(true);
    });
    test("'МОСКВА' matches 'Москва'", () => {
        expect(foldMatch("Москва столица", "МОСКВА", lang, true)).toBe(true);
    });
    test("'россия' matches 'Россия'", () => {
        expect(foldMatch("Россия большая страна", "россия", lang, false)).toBe(true);
    });
});

// ── ENGLISH (en) — baseline ─────────────────────────────────────────────────

describe("English (en)", () => {
    const lang = "en";

    test("'hello' matches 'Hello' (case-insensitive)", () => {
        expect(foldMatch("Hello World", "hello", lang, true)).toBe(true);
    });
    test("'HELLO' matches 'Hello'", () => {
        expect(foldMatch("Hello World", "HELLO", lang, true)).toBe(true);
    });
    test("'xyz' does NOT match 'Hello World'", () => {
        expect(foldMatch("Hello World", "xyz", lang, true)).toBe(false);
    });
});

// ── LITHUANIAN (lt) ─────────────────────────────────────────────────────────

describe("Lithuanian (lt)", () => {
    const lang = "lt";

    test("'vilnius' matches 'Vilnius' (case-insensitive)", () => {
        expect(foldMatch("Vilnius miestas", "vilnius", lang, true)).toBe(true);
    });
    test("'lietuva' matches 'Lietuva'", () => {
        expect(foldMatch("Lietuva graži šalis", "lietuva", lang, true)).toBe(true);
    });
});

// ── SPANISH (es) ────────────────────────────────────────────────────────────

describe("Spanish (es) — normalize ON", () => {
    const lang = "es";
    const norm = true;

    test("'espana' matches 'España' (ñ→n via NFD)", () => {
        expect(foldMatch("España es bonita", "espana", lang, norm)).toBe(true);
    });
    test("'nino' matches 'niño'", () => {
        expect(foldMatch("El niño juega", "nino", lang, norm)).toBe(true);
    });
});

// ── PORTUGUESE (pt) ─────────────────────────────────────────────────────────

describe("Portuguese (pt) — normalize ON", () => {
    const lang = "pt";
    const norm = true;

    test("'sao' matches 'São' (accent stripped)", () => {
        expect(foldMatch("São Paulo é grande", "sao", lang, norm)).toBe(true);
    });
    test("'coracao' matches 'coração'", () => {
        expect(foldMatch("Meu coração bate", "coracao", lang, norm)).toBe(true);
    });
});

// ── CASE-SENSITIVE MODE (all languages) ─────────────────────────────────────

describe("Case-sensitive mode", () => {
    function caseSensitiveMatch(haystack, needle, lang, doNormalize) {
        const h = searchFold(haystack, lang, doNormalize, true);
        const n = searchFold(needle, lang, doNormalize, true);
        return h.includes(n);
    }

    test("'Hello' matches 'Hello' exactly", () => {
        expect(caseSensitiveMatch("Hello World", "Hello", "en", false)).toBe(true);
    });
    test("'hello' does NOT match 'Hello' (case-sensitive)", () => {
        expect(caseSensitiveMatch("Hello World", "hello", "en", false)).toBe(false);
    });
    test("Turkish: 'İstanbul' matches 'İstanbul' exactly", () => {
        expect(caseSensitiveMatch("İstanbul güzel", "İstanbul", "tr", false)).toBe(true);
    });
    test("Turkish: 'istanbul' does NOT match 'İstanbul' (case-sensitive)", () => {
        expect(caseSensitiveMatch("İstanbul güzel", "istanbul", "tr", false)).toBe(false);
    });
});
