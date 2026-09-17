import {
    expandToTamilGraphemes,
    foldTamilViramas,
    getTamilProtectedStems,
    isTamil,
    isTamilInflectionOfProtectedToken,
    splitTamilGraphemes,
    stripTamilArticle,
    stripTamilFinalVirama,
} from '../utils/Tamil';

describe('Tamil helpers', () => {
    test('isTamil only matches Tamil language codes', () => {
        expect(isTamil('ta')).toBe(true);
        expect(isTamil('TA-IN')).toBe(true);
        ['tr', 'az', 'fa', 'en', '', null, undefined].forEach((lang) => {
            expect(isTamil(lang)).toBe(false);
        });
    });

    test('search folding lets the base form find inflected forms', () => {
        const query = foldTamilViramas('கடவுள்');
        expect(foldTamilViramas('கடவுளின் பெயரால்').includes(query)).toBe(true);
        expect(foldTamilViramas('கடவுளுக்கு').includes(query)).toBe(true);
    });

    test('highlight ranges keep vowel signs and viramas with their letter', () => {
        const chars = [...'கடவுளின்'];
        // "கடவுள" ends before the vowel sign ி
        expect(expandToTamilGraphemes(chars, 0, 5)).toEqual([0, 6]);
        // a range starting on a vowel sign moves back to its letter
        expect(expandToTamilGraphemes(chars, 5, 6)).toEqual([4, 6]);
    });

    test('graphemes never start with a vowel sign or virama', () => {
        expect(splitTamilGraphemes('பின் இணைப்புகள்')).toEqual([
            'பி', 'ன்', ' ', 'இ', 'ணை', 'ப்', 'பு', 'க', 'ள்',
        ]);
    });

    test('GOD word stems protect inflections from hyphenation', () => {
        const protectedTokens = new Set(['கடவுள்', 'tanri']);
        expect(stripTamilFinalVirama('கடவுள்')).toBe('கடவுள');
        expect(getTamilProtectedStems(protectedTokens)).toEqual(['கடவுள']);
        expect(isTamilInflectionOfProtectedToken('கடவுளின்', protectedTokens)).toBe(true);
        expect(isTamilInflectionOfProtectedToken('நம்பிக்கை', protectedTokens)).toBe(false);
    });

    test('sura list sort key drops only the article அல்-', () => {
        expect(stripTamilArticle('அல்-பகராஹ்')).toBe('பகராஹ்');
        expect(stripTamilArticle('ஆலி-இம்ரான்')).toBe('ஆலி-இம்ரான்');
        expect(stripTamilArticle('யூனுஸ்')).toBe('யூனுஸ்');
    });
});
