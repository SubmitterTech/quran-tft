import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
    HOVER_INTENT_LIMIT_MS,
    HOVER_INTENT_REST_MS,
    HOVER_INTENT_SWEEP_REST_MS,
    HOVER_INTENT_TOLERANCE_PX,
    createHoverIntent,
    createSweep,
    followHoverIntent,
    followSweep,
    hoverIntentRest,
    sweepVerticality,
    useHoverIntent,
} from '../hooks/HoverIntent';

// The mouse on the right edge of a verse, `y` pixels down it, `at` milliseconds in; `verticality`
// says how it got there, 0 across from the text, 1 along the edges.
const move = (at, y, { side = 'right', moved = true, verticality = 0 } = {}) => ({
    type: 'move', side, x: 600, y, moved, verticality, at,
});
const tick = (at) => ({ type: 'tick', at });
const inOrder = (...events) => events.sort((a, b) => a.at - b.at);

const play = (events) => {
    const intent = createHoverIntent();
    return events.map((event) => {
        followHoverIntent(intent, event);
        return intent.phase;
    });
};

describe('hover intent on the verse edges', () => {
    test('a mouse passing down the edges never opens them', () => {
        // A frame's worth of travel just past the tolerance, the timer looking in between frames.
        const passing = [];
        for (let at = 0; at <= 320; at += 16) {
            passing.push(move(at, (at / 16) * (HOVER_INTENT_TOLERANCE_PX + 2), { verticality: 1 }), tick(at + 8));
        }
        const phases = play(inOrder(...passing, { type: 'leave', at: 330 }));

        expect(phases).not.toContain('open');
        expect(phases[phases.length - 1]).toBe('idle');
    });

    test('a mouse that comes to rest opens the edge after the rest', () => {
        expect(play([
            move(0, 100),
            tick(HOVER_INTENT_REST_MS - 1),
            tick(HOVER_INTENT_REST_MS),
        ])).toEqual(['armed', 'armed', 'open']);
    });

    test('the turn of a sweep along the edges does not open them, a stop after moving along them does', () => {
        // Stopping at the top of a sweep, then heading back down past the tolerance.
        expect(play([
            move(0, 100, { verticality: 1 }),
            tick(HOVER_INTENT_REST_MS),
            move(HOVER_INTENT_SWEEP_REST_MS - 10, 100 + HOVER_INTENT_TOLERANCE_PX + 1, { verticality: 1 }),
            { type: 'leave', at: HOVER_INTENT_SWEEP_REST_MS + 20 },
        ])).toEqual(['armed', 'armed', 'armed', 'idle']);

        // A hand that stops on an edge after moving along it still gets the card, a little later.
        expect(play([
            move(0, 100, { verticality: 1 }),
            tick(HOVER_INTENT_SWEEP_REST_MS - 1),
            tick(HOVER_INTENT_SWEEP_REST_MS),
        ])).toEqual(['armed', 'armed', 'open']);
    });

    test('the rest runs from across to along the edges', () => {
        expect(hoverIntentRest(0)).toBe(HOVER_INTENT_REST_MS);
        expect(hoverIntentRest(0.2)).toBe(HOVER_INTENT_REST_MS);
        expect(hoverIntentRest(0.5)).toBeCloseTo((HOVER_INTENT_REST_MS + HOVER_INTENT_SWEEP_REST_MS) / 2);
        expect(hoverIntentRest(0.9)).toBe(HOVER_INTENT_SWEEP_REST_MS);
        expect(hoverIntentRest(1)).toBe(HOVER_INTENT_SWEEP_REST_MS);
    });

    test('a sweep stays a sweep through the slow end of its turn, and a move across soon is not one', () => {
        const sweep = createSweep();
        for (let at = 0; at <= 160; at += 16) {
            followSweep(sweep, 0, 12, at);
        }
        // The turn: single pixels, one of them across.
        followSweep(sweep, 1, 1, 176);
        followSweep(sweep, 1, 0, 192);
        expect(sweepVerticality(sweep)).toBeGreaterThan(0.65);

        // Later, across from the text to an edge: a few frames are enough.
        for (let at = 400; at <= 448; at += 16) {
            followSweep(sweep, 14, 1, at);
        }
        expect(sweepVerticality(sweep)).toBeLessThan(0.35);
    });

    test('a nudge past the tolerance starts the rest again instead of cancelling it', () => {
        const nudgedAt = HOVER_INTENT_REST_MS / 2;
        expect(play([
            move(0, 100),
            move(nudgedAt, 100 + HOVER_INTENT_TOLERANCE_PX + 2),
            tick(HOVER_INTENT_REST_MS),
            tick(nudgedAt + HOVER_INTENT_REST_MS - 1),
            tick(nudgedAt + HOVER_INTENT_REST_MS),
        ])).toEqual(['armed', 'armed', 'armed', 'armed', 'open']);

        expect(play([
            move(0, 100),
            move(nudgedAt, 100 + HOVER_INTENT_TOLERANCE_PX),
            tick(HOVER_INTENT_REST_MS),
        ])).toEqual(['armed', 'armed', 'open']);
    });

    test('a mouse that never settles still opens the edge at the limit', () => {
        // Moving on past the tolerance twice in every rest, the timer looking in between moves.
        const step = HOVER_INTENT_REST_MS / 2;
        const drifting = [];
        for (let at = 0, y = 100; at < HOVER_INTENT_LIMIT_MS; at += step, y += HOVER_INTENT_TOLERANCE_PX + 5) {
            drifting.push(move(at, y));
            if (at + step / 2 < HOVER_INTENT_LIMIT_MS - 1) {
                drifting.push(tick(at + step / 2));
            }
        }
        const phases = play([
            ...drifting,
            tick(HOVER_INTENT_LIMIT_MS - 1),
            tick(HOVER_INTENT_LIMIT_MS),
        ]);

        expect(phases.slice(0, -1)).not.toContain('open');
        expect(phases[phases.length - 1]).toBe('open');
    });

    test('an edge that slides under a still mouse does not open', () => {
        expect(play([
            move(0, 100, { moved: false }),
            tick(HOVER_INTENT_REST_MS),
            tick(HOVER_INTENT_LIMIT_MS),
        ])).toEqual(['idle', 'idle', 'idle']);
    });

    test('a wheel turn closes the edge, and the next move of the hand starts the rest over', () => {
        const turned = HOVER_INTENT_REST_MS + 10;
        expect(play([
            move(0, 100),
            tick(HOVER_INTENT_REST_MS),
            { type: 'cancel', at: turned },
            tick(turned + 5),
            move(turned + 20, 100),
            tick(turned + 20 + HOVER_INTENT_REST_MS),
        ])).toEqual(['armed', 'open', 'idle', 'idle', 'armed', 'open']);
    });

    test('a click opens at once; leaving, a wheel turn or the other edge closes it', () => {
        const intent = createHoverIntent();

        expect(followHoverIntent(intent, { type: 'commit', side: 'left', at: 0 })).toBe('reveal');
        expect(followHoverIntent(intent, { type: 'commit', side: 'left', at: 5 })).toBeNull();
        expect(followHoverIntent(intent, { type: 'leave', at: 10 })).toBe('conceal');
        expect(intent.phase).toBe('idle');

        followHoverIntent(intent, { type: 'commit', side: 'left', at: 20 });
        expect(followHoverIntent(intent, { type: 'cancel', at: 30 })).toBe('conceal');

        followHoverIntent(intent, { type: 'commit', side: 'left', at: 40 });
        expect(followHoverIntent(intent, move(50, 100, { side: 'right' }))).toBe('conceal');
        expect(intent).toMatchObject({ phase: 'armed', side: 'right' });
    });
});

describe('useHoverIntent', () => {
    let container;
    let root;

    beforeEach(() => {
        jest.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        container.remove();
        jest.useRealTimers();
    });

    const Edge = ({ onReveal = () => {}, onConceal = () => {} }) => {
        const { bindHoverIntent } = useHoverIntent({ onReveal, onConceal });
        return <div data-edge="right" {...bindHoverIntent('right')} />;
    };

    // jsdom has no movementX, so React works it out from screenX between two mouse moves.
    const moveTo = (edge, x) => {
        edge.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true, clientX: x, clientY: 40, screenX: x, screenY: 40,
        }));
    };

    test('opens once the mouse has rested, with a single timer', () => {
        const onReveal = jest.fn();
        act(() => {
            root.render(<Edge onReveal={onReveal} />);
        });
        const edge = container.querySelector('[data-edge]');

        act(() => {
            moveTo(edge, 500);
            moveTo(edge, 503);
            moveTo(edge, 520);
        });
        expect(jest.getTimerCount()).toBe(1);

        act(() => {
            jest.advanceTimersByTime(HOVER_INTENT_REST_MS);
        });
        expect(onReveal).toHaveBeenCalledWith('right');
        expect(jest.getTimerCount()).toBe(0);

        act(() => {
            root.unmount();
        });
    });

    test('leaves no timer behind when the verse goes away mid-rest', () => {
        const onReveal = jest.fn();
        act(() => {
            root.render(<Edge onReveal={onReveal} />);
        });
        const edge = container.querySelector('[data-edge]');

        act(() => {
            moveTo(edge, 500);
            moveTo(edge, 504);
        });
        expect(jest.getTimerCount()).toBe(1);

        act(() => {
            root.unmount();
        });
        expect(jest.getTimerCount()).toBe(0);

        jest.advanceTimersByTime(HOVER_INTENT_LIMIT_MS);
        expect(onReveal).not.toHaveBeenCalled();
    });

    test('a tap on a touch screen wide enough for the edges still opens the card at once', () => {
        const onReveal = jest.fn();
        const onConceal = jest.fn();
        act(() => {
            root.render(<Edge onReveal={onReveal} onConceal={onConceal} />);
        });
        const edge = container.querySelector('[data-edge]');

        act(() => {
            const touch = new MouseEvent('pointerover', { bubbles: true });
            Object.defineProperty(touch, 'pointerType', { value: 'touch' });
            edge.dispatchEvent(touch);
            edge.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });
        expect(onReveal).toHaveBeenCalledWith('right');
        expect(jest.getTimerCount()).toBe(0);

        act(() => {
            edge.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
        });
        expect(onConceal).toHaveBeenCalled();

        act(() => {
            root.unmount();
        });
    });
});
