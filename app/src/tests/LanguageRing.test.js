import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
    LanguageRing,
    LanguageRingPicker,
    LanguageRingStage,
    RING_ON_STORAGE_KEY,
    RING_STORAGE_KEY,
    getRingChoice,
    readRingChoice,
    readRingOn,
    readRingVerse,
    ringSwipeTurns,
    saveRingChoice,
    saveRingOn,
    subscribeRingChoice,
    turnRing,
    verseRingLanguages,
} from '../hooks/LanguageRing';
import { HOVER_INTENT_REST_MS } from '../hooks/HoverIntent';
import * as ContentFiles from '../utils/ContentFiles';
import * as ContentStore from '../utils/ContentStore';
import languages, { getReadableLanguages } from '../utils/LanguageCatalog';
import { colorThemes } from '../utils/Theme';

// Lets the springs run until `check` holds.
const until = async (check, ms = 3000) => {
    const start = Date.now();
    while (!check()) {
        if (Date.now() - start > ms) {
            throw new Error('timed out');
        }
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
        });
    }
};

describe('the ring of languages a verse turns through', () => {
    afterEach(() => {
        localStorage.removeItem(RING_STORAGE_KEY);
        localStorage.removeItem(RING_ON_STORAGE_KEY);
    });

    test('is on until the reader turns it off', () => {
        expect(readRingOn()).toBe(true);

        localStorage.setItem(RING_ON_STORAGE_KEY, 'false');
        expect(readRingOn()).toBe(false);

        localStorage.setItem(RING_ON_STORAGE_KEY, '{not json');
        expect(readRingOn()).toBe(true);
    });

    test('the ring holds English beside the book language until the reader adds more', () => {
        expect(readRingChoice()).toEqual([]);
        expect(verseRingLanguages('tr', readRingChoice())).toEqual(['tr', 'en']);
    });

    test('read in English, the ring holds English alone', () => {
        expect(verseRingLanguages('en', readRingChoice())).toEqual(['en']);
    });

    test('the added languages follow the book language and English in the order they were added', () => {
        localStorage.setItem(RING_STORAGE_KEY, JSON.stringify(['de', 'fa']));

        expect(verseRingLanguages('tr', readRingChoice())).toEqual(['tr', 'en', 'de', 'fa']);
        expect(verseRingLanguages('en', readRingChoice())).toEqual(['en', 'de', 'fa']);
        expect(verseRingLanguages('de', ['en', 'de', 'tr'])).toEqual(['de', 'en', 'tr']);
    });

    test('a choice that cannot be read counts as none', () => {
        localStorage.setItem(RING_STORAGE_KEY, '{not json');

        expect(readRingChoice()).toEqual([]);
    });

    test('a swipe to the left brings the next language, to the right the one before, round and round', () => {
        expect(turnRing(0, 3, -1)).toBe(1);
        expect(turnRing(2, 3, -1)).toBe(0);
        expect(turnRing(0, 3, 1)).toBe(2);
        expect(turnRing(1, 2, 1)).toBe(0);
    });

    test('a long swipe or a quick flick turns the ring, a short slow one does not', () => {
        expect(ringSwipeTurns(-101, 0.1)).toBe(true);
        expect(ringSwipeTurns(99, 0.1)).toBe(false);
        expect(ringSwipeTurns(-50, 0.8)).toBe(true);
        expect(ringSwipeTurns(30, 0.8)).toBe(false);
    });
});

describe('reading one verse for the ring', () => {
    test('a language is read for the verse alone, with its word for GOD', async () => {
        const turkish = await readRingVerse('tr', 19, 3);
        const english = await readRingVerse('en', 19, 3);

        expect(turkish.text).toContain('Rabbine');
        expect(turkish.gw).toBe('TANRI');
        expect(english.text).toContain('He called his Lord');
        expect(english.gw).toBe('GOD');
    });

    test('a verse or a language with no text reads as nothing', async () => {
        await expect(readRingVerse('tr', 19, 999)).resolves.toBeNull();
        await expect(readRingVerse('xx', 19, 3)).rejects.toBeTruthy();
    });

    test('a verse the language has not translated yet comes in English, marked as such', async () => {
        const english = await readRingVerse('en', 114, 4);

        await expect(readRingVerse('nl', 114, 4)).resolves.toEqual({ text: english.text, gw: 'GOD', untranslated: true });
        expect((await readRingVerse('nl', 2, 2)).untranslated).toBeUndefined();
    });

    test('the verses of the initials read the same in every language and are not taken for untranslated', async () => {
        const german = await readRingVerse('de', 2, 1);
        const dutch = await readRingVerse('nl', 42, 2);

        expect(german.text).toBe('A.L.M.*');
        expect(german.untranslated).toBeUndefined();
        expect(dutch.text).toBe('‘A.S.Q.*');
        expect(dutch.untranslated).toBeUndefined();
    });
});

describe('the languages the ring can offer', () => {
    test('are those the build shipped and those a content update brought', async () => {
        const bundled = await ContentStore.getContentLanguages();
        const supported = jest.spyOn(ContentFiles, 'isDownloadSupported').mockReturnValue(true);
        const state = jest.spyOn(ContentFiles, 'getState').mockResolvedValue({ files: { quran_xx: {}, appendices_yy: {} } });

        const readable = await getReadableLanguages();

        expect(readable).toEqual(expect.arrayContaining([...bundled, 'xx']));
        expect(readable).not.toContain('yy');
        supported.mockRestore();
        state.mockRestore();
    });
});

describe('the arrows that show a verse turns sideways', () => {
    const arrowsOf = (ring) => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => {
            root.render(
                <LanguageRingStage
                    ring={ring}
                    loadLanguage={async () => null}
                    renderLanguage={() => 'text'}
                    arrowClassName="bg-neutral-700" />,
            );
        });
        const name = container.querySelector('span.truncate');
        const arrows = [...container.querySelectorAll('span[aria-hidden="true"]')].map((arrow) => ({
            className: arrow.className,
            top: arrow.style.top,
            masked: arrow.style.maskImage.startsWith('url("data:image/svg+xml'),
        }));
        act(() => {
            root.unmount();
        });
        container.remove();
        return Object.assign(arrows, { name });
    };

    test('point left on the left and right on the right, in the colour of the panel below, out of the flow', () => {
        for (const ring of [['tr', 'en'], ['fa', 'en']]) {
            const [left, right] = arrowsOf(ring);

            expect(left.className).toMatch(/\babsolute left-0\b/);
            expect(right.className).toMatch(/\babsolute right-0\b/);
            [left, right].forEach((arrow) => {
                expect(arrow.className).toContain('bg-neutral-700');
                expect(arrow.masked).toBe(true);
                expect(arrow.top).toBe('calc(100% - 3px)');
            });
        }
    });

    test('carry no language name while the verse shows the book language', () => {
        expect(arrowsOf(['tr', 'en']).name).toBeNull();
    });

    test('grow and take the accent while a mouse rests on their edge', () => {
        jest.useFakeTimers();
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => {
            root.render(
                <LanguageRingStage
                    ring={['tr', 'en']}
                    loadLanguage={async () => null}
                    renderLanguage={() => 'text'}
                    arrowClassName="bg-neutral-700"
                    arrowActiveClassName="bg-green-500" />,
            );
        });
        const rightEdge = container.querySelectorAll('button.cursor-pointer')[1];
        const rightArrow = () => [...container.querySelectorAll('span[aria-hidden="true"]')][1].className;
        // jsdom has no movementX, so React works it out from screenX between two mouse moves.
        const moveTo = (x) => rightEdge.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true, clientX: x, clientY: 10, screenX: x, screenY: 10,
        }));

        act(() => {
            moveTo(500);
            moveTo(503);
            moveTo(520);
        });
        act(() => {
            jest.advanceTimersByTime(HOVER_INTENT_REST_MS);
        });
        expect(rightArrow()).toMatch(/\bscale-125\b/);
        expect(rightArrow()).toContain('bg-green-500');
        expect(rightArrow()).not.toContain('bg-neutral-700');

        act(() => {
            rightEdge.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
        });
        expect(rightArrow()).not.toMatch(/\bscale-125\b/);
        expect(rightArrow()).toContain('bg-neutral-700');

        act(() => {
            root.unmount();
        });
        container.remove();
        jest.useRealTimers();
    });

    test('name the language the text turns to as it starts to turn, or say it has not translated the verse yet', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const name = () => container.querySelector('span.truncate')?.textContent ?? null;
        const onTop = () => container.querySelector('[aria-hidden="false"]')?.textContent;
        let loadDutch = null;
        act(() => {
            root.render(
                <LanguageRingStage
                    ring={['tr', 'en', 'nl']}
                    loadLanguage={(lang) => (lang === 'nl' ? loadDutch : Promise.resolve({ text: 'English', gw: 'GOD' }))}
                    renderLanguage={(lang, loaded) => loaded?.text || lang}
                    untranslatedNote="not translated yet" />,
            );
        });
        const nextEdge = () => container.querySelectorAll('button.cursor-pointer')[1];

        await act(async () => {
            nextEdge().click();
        });
        // Named while the book's text is still the one on top.
        expect(name()).toBe('Authorized English Version');
        expect(onTop()).toBe('tr');
        await until(() => onTop() === 'English');

        let readDutch;
        loadDutch = new Promise((resolve) => {
            readDutch = resolve;
        });
        act(() => {
            nextEdge().click();
        });
        // Not named until it has been read, so the name never shows only to give way to the note.
        expect(name()).toBeNull();
        await act(async () => {
            readDutch({ text: 'In English', gw: 'GOD', untranslated: true });
        });
        expect(name()).toBe('NL · not translated yet');
        expect(onTop()).toBe('English');
        await until(() => onTop() === 'In English');
        expect(name()).toBe('NL · not translated yet');

        act(() => {
            root.unmount();
        });
        container.remove();
    });
});

describe("the reader's choice of languages for the ring", () => {
    let container;
    let root;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        saveRingChoice([]);
        saveRingOn(true);
        localStorage.removeItem(RING_STORAGE_KEY);
        localStorage.removeItem(RING_ON_STORAGE_KEY);
    });

    test('is kept and passed on to whoever follows it', () => {
        const heard = jest.fn();
        const stop = subscribeRingChoice(heard);

        saveRingChoice(['de']);
        stop();
        saveRingChoice([]);

        expect(heard).toHaveBeenCalledTimes(1);
        expect(JSON.parse(localStorage.getItem(RING_STORAGE_KEY))).toEqual([]);
        expect(getRingChoice()).toEqual([]);
    });

    const openPicker = async () => {
        await act(async () => {
            root.render(<LanguageRingPicker bookLanguage="tr" switchTitle="Switch" title="Ring" searchLabel="Ara" colors={colorThemes} theme="dark" />);
        });
        const summary = container.querySelector('button[aria-expanded]');
        act(() => {
            summary.click();
        });
        return summary;
    };
    const rows = () => [...container.querySelectorAll('button[aria-pressed]')];
    const row = (name) => rows().find((b) => b.textContent.includes(name));
    const place = (name) => row(name).lastChild.textContent;
    const search = (text) => {
        const input = container.querySelector('input[type="text"]');
        act(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        return rows().map((b) => b.querySelector('[lang]').getAttribute('lang'));
    };

    test('sits behind one row of the menu, which names the ring beside the book language, English first', async () => {
        await act(async () => {
            root.render(<LanguageRingPicker bookLanguage="tr" switchTitle="Switch" title="Ring" colors={colorThemes} theme="dark" />);
        });
        const summary = container.querySelector('button[aria-expanded]');

        expect(summary.textContent).toBe('RingEN');
        expect(rows()).toHaveLength(0);

        act(() => {
            saveRingChoice(['fa']);
        });
        expect(summary.textContent).toBe('RingEN · FA');

        act(() => {
            saveRingChoice(['fa', 'de', 'ru', 'sv']);
        });
        expect(summary.textContent).toBe('RingEN · FA +3');

        act(() => {
            summary.click();
        });
        // The list covers the menu where it is, and leaves its size to it.
        expect(summary.getAttribute('aria-expanded')).toBe('true');
        expect(rows()[0].closest('.absolute').className).toMatch(/\binset-0\b/);
        expect(document.activeElement.textContent).toBe('Ring');

        act(() => {
            document.activeElement.click();
        });
        expect(rows()).toHaveLength(0);
        expect(document.activeElement).toBe(summary);

        // Tab goes round the list's own controls, never to the menu it covers.
        act(() => {
            summary.click();
        });
        const panel = container.querySelector('[role="dialog"]');
        expect(panel.getAttribute('aria-modal')).toBe('true');
        expect(panel.getAttribute('aria-label')).toBe('Ring');
        const controls = [...panel.querySelectorAll('button, input')];
        const tab = (shiftKey) => act(() => {
            document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));
        });
        expect(document.activeElement).toBe(controls[0]);
        tab(true);
        expect(document.activeElement).toBe(controls[controls.length - 1]);
        tab(false);
        expect(document.activeElement).toBe(controls[0]);
        act(() => {
            controls[0].click();
        });

        // Escape leads back as well.
        act(() => {
            summary.click();
        });
        act(() => {
            rows()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
        expect(rows()).toHaveLength(0);
        expect(summary.getAttribute('aria-expanded')).toBe('false');
    });

    test('names no other language for an English book until one is added', async () => {
        await act(async () => {
            root.render(<LanguageRingPicker bookLanguage="en" switchTitle="Switch" title="Ring" colors={colorThemes} theme="dark" />);
        });
        const summary = container.querySelector('button[aria-expanded]');

        expect(summary.textContent).toBe('Ring—');
        act(() => {
            saveRingChoice(['de']);
        });
        expect(summary.textContent).toBe('RingDE');
    });

    test('turns the ring off with its switch, and dims and stills the row of languages', async () => {
        await act(async () => {
            root.render(<LanguageRingPicker bookLanguage="tr" switchTitle="Switch" title="Ring" colors={colorThemes} theme="dark" />);
        });
        const toggle = container.querySelector('input[type="checkbox"]');
        const summary = container.querySelector('button[aria-expanded]');

        expect(toggle.checked).toBe(true);
        expect(summary.disabled).toBe(false);

        act(() => {
            toggle.click();
        });
        expect(toggle.checked).toBe(false);
        expect(localStorage.getItem(RING_ON_STORAGE_KEY)).toBe('false');
        expect(summary.disabled).toBe(true);
        expect(summary.firstChild.className).toContain('brightness-50');

        act(() => {
            summary.click();
        });
        expect(rows()).toHaveLength(0);
    });

    test('offers neither the book language nor English, and numbers the added ones in order', async () => {
        await openPicker();
        const offered = rows().map((b) => b.textContent);

        expect(offered.some((text) => text.includes('Türkçe Tercümesi'))).toBe(false);
        expect(offered.some((text) => text.includes('Authorized English Version'))).toBe(false);
        // A language goes by its own name, with how much of it is translated.
        expect(row('Deutsch Übersetzung').textContent).toBe('Deutsch Übersetzung100%');
        expect(row('Nederlandse Vertaling').textContent).toBe('Nederlandse Vertaling67%');

        act(() => {
            row('Deutsch Übersetzung').click();
        });
        act(() => {
            row('Traduction française').click();
        });
        expect(place('Deutsch Übersetzung')).toBe('1');
        expect(place('Traduction française')).toBe('2');
        expect(getRingChoice()).toEqual(['de', 'fr']);

        act(() => {
            row('Deutsch Übersetzung').click();
        });
        expect(row('Deutsch Übersetzung').getAttribute('aria-pressed')).toBe('false');
        expect(place('Deutsch Übersetzung')).toBe('');
        expect(place('Traduction française')).toBe('1');
        expect(getRingChoice()).toEqual(['fr']);
    });

    test('opens with the added languages on top, in their order, and keeps its order while open', async () => {
        saveRingChoice(['sv', 'az']);
        await openPicker();
        const order = () => rows().map((b) => b.querySelector('[lang]').getAttribute('lang'));

        expect(order().slice(0, 2)).toEqual(['sv', 'az']);
        expect(container.querySelector('input[type="text"]')).toBeNull();

        act(() => {
            row('Svensk översättning').click();
        });
        act(() => {
            row('Русский Перевод').click();
        });
        expect(order().slice(0, 2)).toEqual(['sv', 'az']);
        expect(getRingChoice()).toEqual(['az', 'ru']);
    });

    test('a long list gets a search box that finds a language by its own name or its code', async () => {
        const everyLanguage = jest.spyOn(ContentStore, 'getContentLanguages').mockResolvedValue(Object.keys(languages));
        await openPicker();

        expect(rows()).toHaveLength(Object.keys(languages).length - 2);
        expect(container.querySelector('input[type="text"]').placeholder).toBe('Ara...');
        expect(search('deutsch')).toEqual(['de']);
        expect(search('svensk oversattning')).toEqual(['sv']);
        expect(search('русский')).toEqual(['ru']);
        expect(search('traduction fr')).toEqual(['fr']);
        expect(search('ja')).toEqual(['ja']);
        // From the start of a word: Tamil, not Nederlandse Vertaling.
        expect(search('ta')).toEqual(['ta']);
        // Only by what the list shows: no name in another language finds it.
        expect(search('alman')).toEqual([]);
        expect(search('xyz')).toEqual([]);
        expect(container.textContent).toContain('—');
        expect(search('')).toHaveLength(Object.keys(languages).length - 2);

        everyLanguage.mockRestore();
    });

    test('leaves a verse as it is when the ring holds the book language alone', () => {
        act(() => {
            root.render(<LanguageRing language="en" loadLanguage={async () => null} renderLanguage={() => 'ring'}>plain</LanguageRing>);
        });
        expect(container.textContent).toBe('plain');

        act(() => {
            saveRingChoice(['de']);
        });
        expect(container.textContent).not.toBe('plain');
        expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(2);
    });

    test('leaves a verse as it is while the ring is off, whatever the ring holds', () => {
        saveRingChoice(['de']);
        saveRingOn(false);
        act(() => {
            root.render(<LanguageRing language="tr" loadLanguage={async () => null} renderLanguage={() => 'ring'}>plain</LanguageRing>);
        });
        expect(container.textContent).toBe('plain');
        expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);

        act(() => {
            saveRingOn(true);
        });
        expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(2);
    });
});

describe('turning the text from its edges with a mouse', () => {
    test('a click on the right edge asks for the next language and leaves the verse open', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const loadLanguage = jest.fn(async () => null);
        const closeVerse = jest.fn();

        act(() => {
            root.render(
                <div onClick={closeVerse}>
                    <LanguageRingStage ring={['tr', 'en', 'de']} loadLanguage={loadLanguage} renderLanguage={() => 'text'} />
                </div>,
            );
        });
        const edges = [...container.querySelectorAll('button.cursor-pointer')];
        expect(edges.map((edge) => edge.className.match(/\b(left|right)-0\b/)[1])).toEqual(['left', 'right']);
        // Buttons, so a keyboard reaches them, named by the language each leads to.
        expect(edges.map((edge) => edge.getAttribute('aria-label'))).toEqual(['Deutsch Übersetzung', 'Authorized English Version']);
        edges.forEach((edge) => {
            expect(edge.className).toContain('hidden');
            // Down to the panel below, over the arrow.
            expect(edge.className).toMatch(/\btop-0 -bottom-2\.5\b/);
        });

        await act(async () => {
            edges[1].click();
        });

        expect(loadLanguage).toHaveBeenCalledWith('en');
        expect(closeVerse).not.toHaveBeenCalled();

        act(() => {
            root.unmount();
        });
        container.remove();
    });
});
