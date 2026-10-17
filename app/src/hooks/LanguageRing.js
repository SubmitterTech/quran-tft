import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { useSpring, useSprings, animated, to } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import languages, { getReadableLanguages } from '../utils/LanguageCatalog';
import { BASE_CONTENT_LANGUAGE, readContentOnce } from '../utils/ContentStore';
import { persistSet } from '../utils/Persist';
import { useHoverIntent } from './HoverIntent';
import { ensureBaseQuran, getBaseQuran } from '../utils/BaseContent';

// A verse read in detail can turn its translation like a ring: swiping the text sideways carries
// it away and brings the next language up from beneath it, and the ring goes round, the last
// language leading back to the first. The verse opens in the language the book is read in and is
// back in it the next time it opens.
//
// The book's language comes first and English second, English being the text every translation is
// made from; when the book is read in English the ring starts with it alone and does not turn. Any
// further languages are the reader's to add, and the ring takes them in the order they were added.
//
// Nothing is read for the ring until it turns. A language's text is read then, for that verse only,
// and kept while the verse stays open. A verse a language has not translated yet comes in English,
// and the ring says so.
//
// The ring is on until the reader turns it off in the settings; then a verse is read as it always
// was, with nothing of the ring on it.

export const RING_STORAGE_KEY = 'qurantft-ring';
export const RING_ON_STORAGE_KEY = 'qurantft-ring-on';
const DEFAULT_RING = [];

// The swipe that turns the ring locks onto its axis as the swipe on a closed verse does, and needs
// the same length to act; a quicker flick turns it from a shorter one.
const RING_LOCK_THRESHOLD_PX = 19;
const RING_TURN_PX = 100;
const RING_FLICK_PX = 40;
const RING_FLICK_SPEED = 0.5;
// The leaving text tilts away as it goes, which is what makes the turn read as a ring. The coming
// one stays out of sight while the finger is down, so the two never show through each other, and
// once the swipe is let go it grows to the surface from a little smaller and out of the dark.
const RING_TILT_DEG = 18;
const RING_BENEATH_SCALE = 0.85;
const RING_BENEATH_SHADE = 0.35;
const RING_SETTLE = { tension: 190, friction: 38 };
// The coming text grows to the surface quickly, so the turn does not linger once the leaving one has
// gone. The verse takes its new height on the same spring and from the same moment, so the height
// keeps step with the text and what is below it moves with it; it is let go of within half a pixel.
const RING_GROW = { tension: 800, friction: 57 };
const RING_RESIZE = { ...RING_GROW, precision: 0.5 };
// With a mouse the text turns from its edges, as a closed verse is bookmarked and copied from
// them: resting on an edge starts the turn by this much, as a swipe would, and a click finishes it.
const RING_PEEK_PX = 36;

/**
 * The languages the reader chose for the ring, or the default when they have not chosen.
 */
export const readRingChoice = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(RING_STORAGE_KEY));
        if (Array.isArray(saved)) {
            return saved.filter((lang) => typeof lang === 'string');
        }
    } catch (error) {
        // A choice that cannot be read counts as none.
    }
    return DEFAULT_RING;
};

/**
 * Whether verses turn through the ring at all: yes, until the reader turns it off.
 */
export const readRingOn = () => {
    try {
        return JSON.parse(localStorage.getItem(RING_ON_STORAGE_KEY)) !== false;
    } catch (error) {
        return true;
    }
};

// A setting is read once and handed to all who follow it, the menu and every verse being read; when
// the reader changes it, they all follow at once.
const keptSetting = (key, read) => {
    let value;
    let isRead = false;
    const listeners = new Set();
    return {
        get: () => {
            if (!isRead) {
                value = read();
                isRead = true;
            }
            return value;
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        save: (next) => {
            value = next;
            isRead = true;
            persistSet(key, JSON.stringify(next));
            listeners.forEach((listener) => listener());
        },
    };
};

const ringChoiceSetting = keptSetting(RING_STORAGE_KEY, readRingChoice);
const ringOnSetting = keptSetting(RING_ON_STORAGE_KEY, readRingOn);

export const getRingChoice = ringChoiceSetting.get;
export const subscribeRingChoice = ringChoiceSetting.subscribe;

/**
 * Keeps the reader's choice of languages for the ring and passes it on to the verses being read.
 */
export const saveRingChoice = (chosen) => ringChoiceSetting.save(chosen.filter((lang) => typeof lang === 'string'));

export const useRingChoice = () => useSyncExternalStore(ringChoiceSetting.subscribe, ringChoiceSetting.get);

/**
 * Turns the ring on or off for every verse.
 */
export const saveRingOn = (on) => ringOnSetting.save(Boolean(on));

export const useRingOn = () => useSyncExternalStore(ringOnSetting.subscribe, ringOnSetting.get);

/**
 * The ring: the book's language, then English, then the languages the reader added, in the order
 * they added them.
 *
 * @param {string} selected the language the book is read in
 * @param {string[]} chosen the languages the reader added, in order
 */
export const verseRingLanguages = (selected, chosen) => (
    [...new Set([selected, BASE_CONTENT_LANGUAGE, ...chosen])]
);

/**
 * The language a turn leads to. A swipe to the left brings the next language, one to the right the
 * one before, and the ring wraps round.
 *
 * @param {number} index the place in the ring now on top
 * @param {number} count the size of the ring
 * @param {number} sign -1 for a swipe to the left, 1 for one to the right
 */
export const turnRing = (index, count, sign) => (index - sign + count) % count;

/**
 * Whether a swipe that ended `mx` pixels away, at `vx` pixels a millisecond, turns the ring.
 */
export const ringSwipeTurns = (mx, vx) => (
    Math.abs(mx) > RING_TURN_PX || (Math.abs(vx) > RING_FLICK_SPEED && Math.abs(mx) > RING_FLICK_PX)
);

const findVerse = (quran, sura, verse) => {
    const pages = Object.values(quran || {});
    for (let i = 0; i < pages.length; i += 1) {
        const text = pages[i]?.sura?.[sura]?.verses?.[verse];
        if (typeof text === 'string') {
            return text;
        }
    }
    return null;
};

// The verses that are the initials alone, A.L.M., H.M. and the others, are written the same in every
// language: the first verse of each of the 29 suras that open with them, and the second of sura 42.
const INITIALS_VERSES = new Set([
    '2:1', '3:1', '7:1', '10:1', '11:1', '12:1', '13:1', '14:1', '15:1', '19:1', '20:1', '26:1', '27:1',
    '28:1', '29:1', '30:1', '31:1', '32:1', '36:1', '38:1', '40:1', '41:1', '42:1', '42:2', '43:1',
    '44:1', '45:1', '46:1', '50:1', '68:1',
]);

/**
 * One verse in one language, with the word that language writes for GOD, or null when there is no
 * such verse. English comes from the base text the app always holds; any other language is read for
 * this verse alone and the rest of its file is let go.
 *
 * A verse its translation has not reached yet is published with the English text in its place. It
 * comes back in English and marked `untranslated`, so that it is written and named as what it is; so
 * does a verse missing from the language altogether. The verses of the initials read the same in
 * every language and are never taken for one.
 */
export const readRingVerse = async (lang, sura, verse) => {
    const english = findVerse(getBaseQuran() || await ensureBaseQuran(), sura, verse);
    if (lang === BASE_CONTENT_LANGUAGE) {
        return english ? { text: english, gw: 'GOD' } : null;
    }
    const [quran, application] = await Promise.all([
        readContentOnce('quran', lang),
        readContentOnce('application', lang).catch(() => null),
    ]);
    const text = findVerse(quran, sura, verse);
    if (text && (text !== english || INITIALS_VERSES.has(`${sura}:${verse}`))) {
        return { text, gw: application?.gw || 'GOD' };
    }
    return english ? { text: english, gw: 'GOD', untranslated: true } : null;
};

// The arrows are drawn in the colour of the panel below them: that colour shows through their
// shape, so each theme's panel colour is theirs too without naming it twice.
const arrowMask = (path) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='${path}'/></svg>`;
    const image = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    return {
        WebkitMaskImage: image,
        maskImage: image,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
    };
};
const ARROW_LEFT = arrowMask('M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18');
const ARROW_RIGHT = arrowMask('M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3');
// The verse leaves a 10px gap between its text and the panel below; the text's own line spacing adds
// a few pixels above it, so the arrows sit a little below the gap's middle to look centred.
const ARROW_TOP = 'calc(100% - 3px)';
// The name of a language other than the book's sits between the arrows on the same line, 8px tall
// and centred where they are. It is cut short rather than run into them, and the pixel it keeps
// above and below for the letters that reach past their line is taken back from its place.
const NAME_TOP = 'calc(100% - 2px)';

const atRest = (onTop) => ({
    x: 0,
    tilt: 0,
    scale: onTop ? 1 : RING_BENEATH_SCALE,
    opacity: onTop ? 1 : 0,
    shade: onTop ? 1 : RING_BENEATH_SHADE,
});

/**
 * The verse's text in reading mode, turned through its ring by a sideways swipe on a touch screen.
 *
 * Two layers take turns. The one on top holds the language being read; the other waits beneath,
 * unseen, with the language the swipe is heading for. When the swipe is let go and the top one has
 * nearly gone, the one beneath grows to the surface and they change places, so neither changes its
 * text while it can be seen, and the
 * height of the verse follows the coming text instead of jumping to it. A language not read yet is
 * read when the ring turns to it; if that takes longer than the leaving text, a small spinner waits
 * in its place.
 *
 * @param {{
 *   ring: string[],
 *   loadLanguage: (lang: string) => Promise<object|null>,
 *   renderLanguage: (lang: string, loaded: object|undefined) => React.ReactNode,
 *   accentClassName?: string,
 *   arrowClassName?: string,
 *   arrowActiveClassName?: string,
 *   nameClassName?: string,
 *   untranslatedNote?: string,
 *   onSwipeStateChange?: (active: boolean) => void,
 * }} props `accentClassName` colours the spinner, `arrowClassName` is the background of the panel
 *     below the text, which the arrows take as their colour, `arrowActiveClassName` the colour an
 *     arrow takes while a mouse rests on its edge, and `nameClassName` colours the name of a language
 *     other than the book's. `untranslatedNote` takes the place of that name, after the language's
 *     code, when the language has not translated the verse yet and it is shown in English.
 */
export const LanguageRingStage = ({ ring, loadLanguage, renderLanguage, accentClassName = '', arrowClassName = '', arrowActiveClassName = arrowClassName, nameClassName = accentClassName, untranslatedNote = '', onSwipeStateChange }) => {
    const count = ring.length;
    const [front, setFront] = useState(0);
    const [beneath, setBeneath] = useState(() => turnRing(0, count, -1));
    const [topLayer, setTopLayer] = useState(0);
    const [moving, setMoving] = useState(false);
    const [heldHeight, setHeldHeight] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loaded, setLoaded] = useState({});
    // The place the text is turning to, from the moment it starts to turn until it is there.
    const [heading, setHeading] = useState(null);
    const containerRef = useRef(null);
    const firstLayerRef = useRef(null);
    const secondLayerRef = useRef(null);
    const turningRef = useRef(false);
    const swipedRef = useRef(false);
    const mountedRef = useRef(true);
    const swipingRef = useRef(false);
    const swipeStateRef = useRef(onSwipeStateChange);
    swipeStateRef.current = onSwipeStateChange;
    const [layers, layersApi] = useSprings(2, (i) => atRest(i === 0));
    const [{ height }, heightApi] = useSpring(() => ({ height: 0 }));

    // The verse is told when a swipe of the text starts and ends, so the page does not take it for
    // its own swipe.
    const reportSwipe = (active) => {
        swipingRef.current = active;
        swipeStateRef.current?.(active);
    };

    // Set again on every mount: in development React mounts the stage twice, and a flag cleared by
    // the first unmount would turn every later read away. A stage that goes in the middle of a swipe,
    // when the ring is changed or turned off, ends the swipe it reported.
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (swipingRef.current) {
                swipingRef.current = false;
                swipeStateRef.current?.(false);
            }
        };
    }, []);

    const layerRef = (i) => (i === 0 ? firstLayerRef : secondLayerRef);
    const shownBy = (i) => (i === topLayer ? front : beneath);
    // The book's own language is always at hand; the others once they have been read.
    const isReady = (index) => index === 0 || loaded[ring[index]] !== undefined;

    const settle = () => {
        layersApi.start((i) => ({ ...atRest(i === topLayer), config: RING_SETTLE }));
        setMoving(false);
    };

    const finish = (target) => {
        const newTop = 1 - topLayer;
        layersApi.set((i) => atRest(i === newTop));
        setTopLayer(newTop);
        setFront(target);
        setHeading(null);
        setBeneath(turnRing(target, count, -1));
        // A height still on its way is let go of when it gets there.
        if (height.idle) {
            setHeldHeight(false);
        }
        setMoving(false);
        turningRef.current = false;
    };

    // Moves one layer and resolves once the move is over for the eye, when `over` says so; the
    // springs settle the last fraction on their own, and waiting for that would leave the reader
    // looking at a gap.
    const moveLayer = (layer, update, over) => new Promise((resolve) => {
        let done = false;
        const end = () => {
            if (!done) {
                done = true;
                resolve();
            }
        };
        Promise.all(layersApi.start((i) => (i === layer
            ? { ...update, onChange: ({ value }) => { if (over(value)) end(); } }
            : undefined))).then(end);
    });

    const growBeneath = (target) => {
        const fromHeight = containerRef.current?.offsetHeight || 0;
        const toHeight = layerRef(1 - topLayer).current?.offsetHeight || fromHeight;
        heightApi.start({
            from: { height: fromHeight },
            to: { height: toHeight },
            config: RING_RESIZE,
            onRest: () => {
                if (mountedRef.current && !turningRef.current) {
                    setHeldHeight(false);
                }
            },
        });
        moveLayer(1 - topLayer, { scale: 1, opacity: 1, shade: 1, config: RING_GROW }, (value) => value.opacity > 0.95).then(() => {
            if (mountedRef.current) {
                finish(target);
            }
        });
    };

    const bringBack = () => {
        layersApi.start((i) => ({ ...atRest(i === topLayer), config: RING_SETTLE }));
        setHeading(null);
        setHeldHeight(false);
        setMoving(false);
        turningRef.current = false;
    };

    const turn = (sign, target) => {
        turningRef.current = true;
        setHeading(target);
        const width = containerRef.current?.offsetWidth || 0;
        heightApi.set({ height: containerRef.current?.offsetHeight || 0 });
        setHeldHeight(true);

        const ready = isReady(target);
        if (!ready) {
            // The coming text arrives unseen and grows in once the leaving one has gone.
            layersApi.start((i) => (i === topLayer ? undefined : { ...atRest(false), immediate: true }));
        }
        const leaving = moveLayer(
            topLayer,
            { x: sign * width, tilt: sign * RING_TILT_DEG, opacity: 0, config: RING_SETTLE },
            (value) => value.opacity < 0.25,
        );

        let read = ready;
        const code = ring[target];
        const reading = ready
            ? Promise.resolve(true)
            : loadLanguage(code).then((result) => {
                if (!result || !mountedRef.current) {
                    return false;
                }
                flushSync(() => setLoaded((current) => ({ ...current, [code]: result })));
                return true;
            }, () => false).finally(() => {
                read = true;
            });

        leaving.then(() => {
            if (mountedRef.current && !read) {
                setBusy(true);
            }
        });
        Promise.all([leaving, reading]).then(([, ok]) => {
            if (!mountedRef.current) {
                return;
            }
            setBusy(false);
            if (ok) {
                growBeneath(target);
            } else {
                bringBack();
            }
        });
    };

    const [preview, setPreview] = useState(null);
    const { bindHoverIntent, cancelHoverIntent } = useHoverIntent({
        onReveal: (side) => {
            if (turningRef.current) {
                return;
            }
            const sign = side === 'right' ? -1 : 1;
            const width = containerRef.current?.offsetWidth || 1;
            setPreview(side);
            setMoving(true);
            layersApi.start((i) => (i === topLayer
                ? { x: sign * RING_PEEK_PX, tilt: ((sign * RING_PEEK_PX) / width) * RING_TILT_DEG, config: RING_SETTLE }
                : undefined));
        },
        onConceal: () => {
            setPreview(null);
            if (!turningRef.current) {
                settle();
            }
        },
    });

    // The right edge leads on to the next language, as a swipe to the left does; the left edge back.
    const turnFromEdge = (side) => {
        if (turningRef.current || count < 2) {
            return;
        }
        const sign = side === 'right' ? -1 : 1;
        const target = turnRing(front, count, sign);
        if (target !== beneath) {
            flushSync(() => setBeneath(target));
        }
        turn(sign, target);
        cancelHoverIntent();
    };

    const bind = useDrag(({ active, movement: [mx, my], velocity: [vx], memo, event }) => {
        if (event.pointerType === 'mouse' || turningRef.current || count < 2) {
            return memo;
        }
        const state = memo || { lock: null };
        if (state.lock === null && (Math.abs(mx) >= RING_LOCK_THRESHOLD_PX || Math.abs(my) >= RING_LOCK_THRESHOLD_PX)) {
            state.lock = Math.abs(mx) >= Math.abs(my) ? 'x' : 'y';
        }
        if (state.lock !== 'x') {
            if (!active && moving) {
                settle();
            }
            reportSwipe(false);
            return state;
        }

        if (event.cancelable) {
            event.preventDefault();
        }
        swipedRef.current = true;
        reportSwipe(active);
        const sign = mx < 0 ? -1 : 1;
        const target = turnRing(front, count, sign);
        if (target !== beneath) {
            setBeneath(target);
        }

        if (active) {
            if (!moving) {
                setMoving(true);
            }
            const width = containerRef.current?.offsetWidth || 1;
            layersApi.start((i) => (i === topLayer
                ? { x: mx, tilt: (mx / width) * RING_TILT_DEG, opacity: 1 - Math.min(0.6, Math.abs(mx) / width), immediate: true }
                : undefined));
        } else if (event.type !== 'touchcancel' && event.type !== 'pointercancel' && ringSwipeTurns(mx, vx)) {
            // A touch the system took over ends the gesture as a lifted finger would, through touch
            // events or pointer events; it does not turn the ring, the text goes back.
            turn(sign, target);
        } else {
            settle();
        }
        return state;
    }, {
        axis: 'x',
        pointer: { touch: true },
        filterTaps: true,
        eventOptions: { passive: false },
    });

    // A language read for the first time is named once it has been read, so that its name never
    // shows for a moment only to give way to the note that it has not translated the verse yet.
    const named = heading ?? front;
    const labelled = named !== 0 && isReady(named);

    return (
        // The whole stage takes the swipe, the edges with it: on a laptop with a touch screen they
        // show, and a swipe may start on them.
        <div
            className="relative"
            {...bind()}
            // A swipe is not a tap: the click that may follow it must not close the verse. A swipe is
            // often followed by no click at all, so the next press clears that, and a click from the
            // keyboard is never one that follows a swipe.
            onPointerDownCapture={() => { swipedRef.current = false; }}
            onTouchStartCapture={() => { swipedRef.current = false; }}
            onClickCapture={(event) => {
                if (swipedRef.current && event.detail !== 0) {
                    event.stopPropagation();
                    swipedRef.current = false;
                }
            }}>
            <animated.div
                ref={containerRef}
                style={heldHeight ? { height } : undefined}
                className={`relative ${moving || heldHeight ? 'overflow-hidden' : ''}`}>
                {layers.map((style, i) => (
                    <animated.div
                        key={i}
                        ref={layerRef(i)}
                        aria-hidden={i !== topLayer}
                        style={{
                            opacity: style.opacity,
                            filter: style.shade.to((shade) => (shade === 1 ? 'none' : `brightness(${shade})`)),
                            transform: to(
                                [style.x, style.tilt, style.scale],
                                // At rest the text carries no transform, so it is drawn exactly as before.
                                (x, tilt, scale) => (x === 0 && tilt === 0 && scale === 1
                                    ? 'none'
                                    : `perspective(800px) translateX(${x}px) rotateY(${tilt}deg) scale(${scale})`),
                            ),
                        }}
                        className={i === topLayer ? 'relative' : 'absolute inset-x-0 top-0 pointer-events-none'}>
                        {renderLanguage(ring[shownBy(i)], loaded[ring[shownBy(i)]])}
                    </animated.div>
                ))}
                {busy && (
                    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${accentClassName}`}>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                )}
            </animated.div>
            {/* The edges a mouse turns the text from, over the text and down over the arrow below it,
                which is where a hand with a mouse goes to turn it. Only where there is a mouse or a
                trackpad: on a touch screen they would stand in the way of the swipe. They are buttons
                named by the language each leads to, so the text can be turned from a keyboard too. */}
            {['left', 'right'].map((side) => {
                const towards = ring[turnRing(front, count, side === 'right' ? -1 : 1)];
                return (
                    <button
                        key={side}
                        type="button"
                        aria-label={languages[towards]?.name || towards}
                        {...bindHoverIntent(side)}
                        onClick={(event) => {
                            // A click on an edge turns the text; it must not close the verse as well.
                            event.stopPropagation();
                            turnFromEdge(side);
                        }}
                        className={`absolute top-0 -bottom-2.5 ${side === 'left' ? 'left-0' : 'right-0'} w-1/12 hidden cursor-pointer sm:[@media(hover:hover)_and_(pointer:fine)]:block`} />
                );
            })}
            {/* An arrow to either side, in the gap between the text and the panel below it and out of
                the flow, so the verse keeps its size. The one on the edge being rested on grows and
                takes the accent. */}
            <span
                aria-hidden="true"
                className={`absolute left-0 h-3 w-3 pointer-events-none transition duration-150 ${preview === 'left' ? `scale-125 ${arrowActiveClassName}` : arrowClassName}`}
                style={{ top: ARROW_TOP, ...ARROW_LEFT }} />
            <span
                aria-hidden="true"
                className={`absolute right-0 h-3 w-3 pointer-events-none transition duration-150 ${preview === 'right' ? `scale-125 ${arrowActiveClassName}` : arrowClassName}`}
                style={{ top: ARROW_TOP, ...ARROW_RIGHT }} />
            {/* The language is named as soon as the text starts to turn to it, not once it is there.
                A verse it has not translated yet says that instead of its name, after its code: short
                enough to fit, and enough to tell apart two languages that both lack the verse. */}
            {labelled && (
                <span
                    className={`absolute inset-x-4 truncate py-px text-center text-[8px] leading-none select-none pointer-events-none ${nameClassName}`}
                    style={{ top: NAME_TOP }}>
                    {loaded[ring[named]]?.untranslated && untranslatedNote
                        ? `${ring[named].toUpperCase()} · ${untranslatedNote}`
                        : <bdi dir={languages[ring[named]]?.dir || 'ltr'}>{languages[ring[named]]?.name || ring[named]}</bdi>}
                </span>
            )}
        </div>
    );
};

/**
 * The verse's text while it is read: turned through the ring when the ring is on and holds more than
 * the book's language, otherwise `children`, the text as it is drawn without one. Only the verses
 * being read follow the reader's settings, and a changed ring starts again from the book's language.
 *
 * @param {{ language: string, children: React.ReactNode }} props and those of LanguageRingStage
 */
export const LanguageRing = ({ language, children, ...stage }) => {
    const on = useRingOn();
    const chosen = useRingChoice();
    const ring = useMemo(() => verseRingLanguages(language, chosen), [language, chosen]);
    if (!on || ring.length < 2) {
        return children;
    }
    return <LanguageRingStage key={ring.join(' ')} ring={ring} {...stage} />;
};

// A language is found by its own name, as the list shows it, or by its code; from the start of a
// word, so "ta" finds Tamil and not Nederlandse Vertaling, and without its accents.
const searchWords = (text) => ` ${String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ı/g, 'i').replace(/[\s()\-–—,.]+/g, ' ').trim()}`;

// Past this many languages the list gets a search box.
const RING_SEARCH_FROM = 12;
// The list fades out at its foot, so on a phone, where no scroll bar shows, it reads as going on. The
// fade is taller than the gap between two names, so some name is always in it, and the list ends
// with as much room, so its last row can still be scrolled clear of it.
const LIST_FADE = 'linear-gradient(to bottom, black calc(100% - 2rem), transparent)';

// The languages with text change only when a content update brings one, which the catalog takes in as
// the app starts; kept from the first read, the menu has its row from the moment it opens instead of
// a moment later.
let ringOffer = null;

/**
 * The ring's part of the settings menu. A switch turns the ring on and off, as the menu's other
 * switches do, and below it a row leads to the languages the reader adds to the ring; the row names
 * the ring's languages besides the book's own, English among them, and like the menu's other rows
 * that hang on a switch it is dimmed and still while the ring is off.
 *
 * The row opens the list in the menu's own place, so the menu keeps its size however many languages
 * there are; the list scrolls within it, and once it is long a search box filters it. Each language
 * shows how much of it has been translated. The book's language and English are always in the ring
 * and are not offered. An added language carries its place in the order it was added, which is the
 * order the ring turns through them, and the list opens with them at the top; while it is open
 * nothing moves under the reader's finger.
 *
 * The box this sits in has to be positioned, as the list covers it.
 *
 * @param {{ bookLanguage: string, switchTitle: string, title: string, searchLabel: string, colors: object, theme: string }} props
 */
export const LanguageRingPicker = ({ bookLanguage, switchTitle, title, searchLabel, colors, theme }) => {
    const on = useRingOn();
    const chosen = useRingChoice();
    const [available, setAvailable] = useState(ringOffer);
    const [order, setOrder] = useState(null);
    const [query, setQuery] = useState('');
    const rowRef = useRef(null);
    const backRef = useRef(null);
    const open = order !== null;

    useEffect(() => {
        let current = true;
        getReadableLanguages().then((codes) => {
            const withText = new Set(codes);
            ringOffer = Object.keys(languages).filter((lang) => withText.has(lang));
            if (current) {
                setAvailable(ringOffer);
            }
        });
        return () => {
            current = false;
        };
    }, []);

    // Whoever opened the list with a keyboard goes on from its first control, and back to the row.
    const wasOpen = useRef(false);
    useEffect(() => {
        if (open) {
            backRef.current?.focus({ preventScroll: true });
        } else if (wasOpen.current) {
            rowRef.current?.focus({ preventScroll: true });
        }
        wasOpen.current = open;
    }, [open]);

    const offered = (available || []).filter((lang) => lang !== bookLanguage && lang !== BASE_CONTENT_LANGUAGE);
    const canOpen = on && offered.length > 0;
    const added = chosen.filter((lang) => offered.includes(lang));
    const others = bookLanguage === BASE_CONTENT_LANGUAGE ? added : [BASE_CONTENT_LANGUAGE, ...added];
    const codes = others.slice(0, 2).map((lang) => lang.toUpperCase()).join(' · ');
    const summary = others.length > 2 ? `${codes} +${others.length - 2}` : codes || '—';
    const searchable = offered.length > RING_SEARCH_FROM;
    const wanted = searchWords(query);
    const listed = (order || []).filter((lang) => offered.includes(lang));
    const shown = searchable && wanted.trim()
        ? listed.filter((lang) => [lang, languages[lang]?.name].some((name) => searchWords(name).includes(wanted)))
        : listed;

    // The whole choice is kept, not just what is offered now: a language that is the book's for the
    // moment stays added for when the book is read in another one again.
    const toggle = (lang) => {
        saveRingChoice(chosen.includes(lang)
            ? chosen.filter((code) => code !== lang)
            : [...chosen.filter((code) => code !== BASE_CONTENT_LANGUAGE), lang]);
    };

    const close = () => {
        setOrder(null);
        setQuery('');
    };

    const chevron = (path) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 flex-none rtl:rotate-180">
            <path strokeLinecap="round" strokeLinejoin="round" d={path} />
        </svg>
    );

    return (
        <>
            <label className={`flex items-center justify-between md:justify-end gap-4 pt-3.5 px-3 pb-2 cursor-pointer`}>
                <span className={`text-base break-words ${on ? colors[theme]["text"]["on-deep"] : colors[theme]["text"]["on-deep-soft"]}`}>{switchTitle}</span>
                <div>
                    <label className='flex cursor-pointer select-none items-center'>
                        <div className='relative'>
                            <input
                                type='checkbox'
                                checked={on}
                                onChange={(e) => saveRingOn(e.target.checked)}
                                className='sr-only'
                            />
                            <div className={`box block h-8 w-14 rounded-full ${on ? colors[theme]["surface"]["top"] : colors[theme]["surface"]["bottom"]}`}></div>
                            <div className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full ${on ? colors[theme]["accent"]["fill"] : colors[theme]["surface"]["middle"]} transition ${on ? 'translate-x-full' : ''}`}></div>
                        </div>
                    </label>
                </div>
            </label>
            <div className={`border-b ${colors[theme]["border"]["soft"]} mx-1 mt-2`} ></div>
            <button
                ref={rowRef}
                type="button"
                disabled={!canOpen}
                aria-expanded={open}
                onClick={() => setOrder([...added, ...offered.filter((lang) => !added.includes(lang))])}
                className={`flex w-full items-center justify-between md:justify-end gap-4 pt-3.5 px-3 pb-2 text-start ${canOpen ? 'cursor-pointer' : 'cursor-default'}`}>
                <span className={`text-base break-words ${on ? colors[theme]["text"]["on-deep"] : `brightness-50 ${colors[theme]["text"]["on-deep-soft"]}`}`}>{title}</span>
                {/* As wide whatever the ring holds, so the title beside it never wraps anew. */}
                <span className={`flex min-h-8 flex-none items-center gap-1 text-sm ${!on ? `brightness-50 ${colors[theme]["text"]["on-deep-soft"]}` : others.length > 0 ? colors[theme]["accent"]["on-deep"] : colors[theme]["text"]["on-deep-soft"]}`}>
                    <span className="w-[4.75rem] truncate text-end">{summary}</span>
                    {chevron('m8.25 4.5 7.5 7.5-7.5 7.5')}
                </span>
            </button>
            {open && (
                // The list covers the menu, so a keyboard stays within it: Tab goes round its own
                // controls and never reaches those beneath, and Escape leads back to the menu, as the
                // row at its top does.
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={title}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            close();
                            return;
                        }
                        if (event.key !== 'Tab') {
                            return;
                        }
                        const controls = [...event.currentTarget.querySelectorAll('button, input')];
                        const first = controls[0];
                        const last = controls[controls.length - 1];
                        if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
                            event.preventDefault();
                            (event.shiftKey ? last : first).focus();
                        }
                    }}
                    className={`absolute inset-0 z-10 flex flex-col ${colors[theme]["surface"]["base"]}`}>
                    <button
                        ref={backRef}
                        type="button"
                        onClick={close}
                        className={`flex flex-none items-center gap-2 px-3 pt-2.5 pb-2 text-start cursor-pointer ${colors[theme]["text"]["on-deep"]}`}>
                        {chevron('M15.75 19.5 8.25 12l7.5-7.5')}
                        <span className="truncate text-base">{title}</span>
                    </button>
                    {searchable && (
                        <input
                            type="text"
                            enterKeyHint="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={`${searchLabel}...`}
                            autoComplete="off"
                            spellCheck={false}
                            // 16px, or a phone zooms in on it.
                            className={`mx-1 mb-2 flex-none rounded px-2 py-1.5 text-base ${colors[theme]["surface"]["base"]} ${colors[theme]["text"]["on-deep"]} ${colors[theme]["text"]["on-deep-placeholder"] ?? ''} ring-1 ${colors[theme]["theme-mode"] === 'light' ? 'ring-black/10' : 'ring-white/10'} focus:outline-none focus:ring-2 ${colors[theme]["effect"]["focus-ring"]}`} />
                    )}
                    <div className={`mx-1 flex-none border-b ${colors[theme]["border"]["soft"]}`} />
                    {/* The rows are drawn as the menu's are, with a line between them and the mark at
                        their end: empty for a language not added, and for one that is, filled like the
                        knob of the menu's switches and holding its place in the ring. A row keeps its
                        size whatever is chosen. */}
                    <div
                        style={{ WebkitMaskImage: LIST_FADE, maskImage: LIST_FADE }}
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-8">
                        {shown.map((lang) => {
                            const place = added.indexOf(lang) + 1;
                            const isAdded = place > 0;
                            const translated = languages[lang]?.comp;
                            return (
                                <button
                                    key={lang}
                                    type="button"
                                    aria-pressed={isAdded}
                                    onClick={() => toggle(lang)}
                                    className={`flex h-11 w-full items-center gap-3 border-b px-2 text-start cursor-pointer last:border-b-0 ${colors[theme]["border"]["soft"]}`}>
                                    {/* Its own script runs its own way; the row keeps the menu's. */}
                                    <span lang={lang} className={`min-w-0 flex-1 truncate text-base ${isAdded ? colors[theme]["text"]["on-deep"] : colors[theme]["text"]["on-deep-soft"]}`}><bdi>{languages[lang]?.name || lang}</bdi></span>
                                    {/* How much of it is translated, the figure the cover's list of
                                        languages gives, in a column of its own. */}
                                    <span className={`w-10 flex-none text-end text-sm tabular-nums ${colors[theme]["text"]["on-deep-soft"]}`}>
                                        {typeof translated === 'number' ? `${Math.floor(translated)}%` : null}
                                    </span>
                                    <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold leading-none transition-colors ${isAdded
                                        ? `text-neutral-900 ${colors[theme]["accent"]["fill"]}`
                                        : `border-2 ${colors[theme]["border"]["soft"]}`}`}>
                                        {isAdded ? place : null}
                                    </span>
                                </button>
                            );
                        })}
                        {shown.length === 0 && (
                            <div className={`py-3 text-center text-sm ${colors[theme]["text"]["on-deep-soft"]}`}>—</div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
