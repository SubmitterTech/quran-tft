import { useEffect, useMemo, useRef } from 'react';

// On a desktop the edges of a verse stand in for the swipe: resting the mouse on the left edge
// slides the card aside to show the bookmark, the right edge shows the copy action, and a click
// there acts. Opening the card the moment the mouse crossed an edge made every verse it passed over
// slide out and back in turn, and a mouse left on an edge while the page scrolled opened whichever
// verse arrived under it, where it stayed open because the mouse never moved.
//
// So an edge opens for a hand that has moved onto it and come to rest: the mouse stays within
// HOVER_INTENT_TOLERANCE_PX of where it last stopped for a short rest. Any wait after the mouse has
// stopped reads as the page hanging, so the rest is short, but never shorter than a frame (about
// 17ms at 60Hz), or a mouse moving steadily would look still between two of its moves.
//
// A short rest cannot tell a hand that has arrived from one that is turning back: at the top and
// bottom of an up and down sweep the mouse really does stop, for 50 to 100ms, and at that moment it
// is where an arrival would be and as still. What tells them apart that soon is the way the mouse
// came. A hand going to an edge to copy or bookmark comes across, from the text; a sweep runs up
// and down along the edges. So the rest follows the direction of the last stretch of movement:
// HOVER_INTENT_REST_MS after moving across, HOVER_INTENT_SWEEP_REST_MS after moving up or down,
// which outlasts the turn of a sweep at an ordinary pace, and a blend of the two in between.
//
// A hand that never quite settles still opens the edge HOVER_INTENT_LIMIT_MS after it started
// moving there. An edge that slides under a mouse that has not moved, as when the page scrolls or
// lifts at its end, does nothing until the mouse moves, so the page only has to close an open edge
// when it starts to scroll, and a turn of the wheel over an edge closes it at once.

export const HOVER_INTENT_REST_MS = 32;
export const HOVER_INTENT_SWEEP_REST_MS = 96;
export const HOVER_INTENT_TOLERANCE_PX = 2;
export const HOVER_INTENT_LIMIT_MS = 600;
// How long a stretch of movement keeps counting toward its direction.
const SWEEP_MEMORY_MS = 70;
// Up to this share of up and down movement the mouse came across; from the next one, along.
const SWEEP_ACROSS = 0.35;
const SWEEP_ALONG = 0.65;

export const createSweep = () => ({ x: 0, y: 0, at: 0 });

/**
 * Adds one mouse move to the movement so far, older movement fading over SWEEP_MEMORY_MS. The
 * sweep is updated in place. Fading the totals rather than looking at the last move keeps a sweep a
 * sweep through the slow end of its turn, where the moves are single pixels in any direction.
 */
export const followSweep = (sweep, dx, dy, at) => {
    const fade = Math.exp(-Math.max(0, at - sweep.at) / SWEEP_MEMORY_MS);
    sweep.x = sweep.x * fade + Math.abs(dx);
    sweep.y = sweep.y * fade + Math.abs(dy);
    sweep.at = at;
};

/**
 * How much of the recent movement went up or down: 0 across, 1 along the edges.
 */
export const sweepVerticality = (sweep) => {
    const total = sweep.x + sweep.y;
    return total > 0 ? sweep.y / total : 0;
};

/**
 * The rest an edge waits for after movement of the given verticality.
 */
export const hoverIntentRest = (verticality) => {
    const along = Math.min(1, Math.max(0, (verticality - SWEEP_ACROSS) / (SWEEP_ALONG - SWEEP_ACROSS)));
    return HOVER_INTENT_REST_MS + along * (HOVER_INTENT_SWEEP_REST_MS - HOVER_INTENT_REST_MS);
};

export const createHoverIntent = () => ({
    phase: 'idle', side: null, x: 0, y: 0, rest: HOVER_INTENT_REST_MS, armedAt: 0, movedAt: 0,
});

/**
 * The moment an armed edge opens unless the mouse moves on before it.
 */
export const hoverIntentDueAt = (intent) => Math.min(
    intent.movedAt + intent.rest,
    intent.armedAt + HOVER_INTENT_LIMIT_MS,
);

/**
 * Folds one event into the intent. The intent is updated in place, so following the mouse
 * allocates nothing.
 *
 * @param {{ phase: 'idle'|'armed'|'open', side: string|null, x: number, y: number, rest: number, armedAt: number, movedAt: number }} intent
 * @param {{ type: 'move'|'tick'|'commit'|'leave'|'cancel', at: number, side?: string, x?: number, y?: number, moved?: boolean, verticality?: number }} event
 *     `moved` is false for a mouse event the hand did not make; `verticality` is how much of the
 *     movement leading to it went up or down, 0 when left out.
 * @returns 'reveal' when the edge opens, 'conceal' when it closes, otherwise null.
 */
export const followHoverIntent = (intent, event) => {
    const wasOpen = intent.phase === 'open';
    const previousSide = intent.side;

    switch (event.type) {
        case 'move':
            if (intent.phase === 'idle' || intent.side !== event.side) {
                if (!event.moved) {
                    break;
                }
                intent.phase = 'armed';
                intent.side = event.side;
                intent.x = event.x;
                intent.y = event.y;
                intent.rest = hoverIntentRest(event.verticality ?? 0);
                intent.armedAt = event.at;
                intent.movedAt = event.at;
            } else if (intent.phase === 'armed') {
                const dx = event.x - intent.x;
                const dy = event.y - intent.y;
                if (dx * dx + dy * dy > HOVER_INTENT_TOLERANCE_PX * HOVER_INTENT_TOLERANCE_PX) {
                    intent.x = event.x;
                    intent.y = event.y;
                    intent.rest = hoverIntentRest(event.verticality ?? 0);
                    intent.movedAt = event.at;
                }
            }
            break;
        case 'tick':
            if (intent.phase === 'armed' && event.at >= hoverIntentDueAt(intent)) {
                intent.phase = 'open';
            }
            break;
        case 'commit':
            intent.phase = 'open';
            intent.side = event.side;
            break;
        case 'leave':
        case 'cancel':
            intent.phase = 'idle';
            break;
        default:
            break;
    }

    const isOpen = intent.phase === 'open';
    if (isOpen && (!wasOpen || intent.side !== previousSide)) {
        return 'reveal';
    }
    if (wasOpen && !isOpen) {
        return 'conceal';
    }
    return null;
};

// A sweep is one movement of the mouse however many verses it runs through, so its direction is
// kept once for all of them. It holds three numbers and no reference to any verse.
const sweep = createSweep();

const now = () => performance.now();

// When the hand made a move. The browser hands mouse moves over just before it draws the next
// frame, up to a frame after the hand made them, and the event keeps the earlier time. A stamp
// from another clock, as some test environments give, is not used.
const timeOfMove = (event) => {
    const current = now();
    const stamp = event.timeStamp;
    return stamp > 0 && stamp <= current && current - stamp < 1000 ? stamp : current;
};

/**
 * Drives the edges of one verse. Only one edge can be under the mouse, so there is at most one
 * timer: it is set when an edge arms and, rather than being set again on every mouse move, finds
 * out when it fires whether the mouse has rested long enough and waits out the rest if not.
 *
 * Touch screens wide enough to show the edges send a mouse event after a tap; those keep opening
 * the card at once, as they always have, and the swipe is left alone.
 *
 * @param {{ onReveal: (side: string) => void, onConceal: () => void }} options
 */
export const useHoverIntent = ({ onReveal, onConceal }) => {
    const intentRef = useRef(null);
    if (intentRef.current === null) {
        intentRef.current = createHoverIntent();
    }
    const timerRef = useRef(null);
    const pointerTypeRef = useRef('mouse');
    const handlersRef = useRef(null);
    handlersRef.current = { onReveal, onConceal };

    const controls = useMemo(() => {
        const follow = (event) => {
            const intent = intentRef.current;
            const change = followHoverIntent(intent, event);

            if (intent.phase !== 'armed') {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            } else if (timerRef.current === null) {
                timerRef.current = setTimeout(() => {
                    timerRef.current = null;
                    follow({ type: 'tick', at: now() });
                }, Math.max(0, hoverIntentDueAt(intent) - now()));
            }

            if (change === 'reveal') {
                handlersRef.current.onReveal(intent.side);
            } else if (change === 'conceal') {
                handlersRef.current.onConceal();
            }
        };

        const bind = (side) => ({
            onPointerEnter: (event) => {
                pointerTypeRef.current = event.pointerType;
            },
            onMouseEnter: () => {
                if (pointerTypeRef.current !== 'mouse') {
                    handlersRef.current.onReveal(side);
                }
            },
            onMouseMove: (event) => {
                if (pointerTypeRef.current !== 'mouse') {
                    return;
                }
                const at = timeOfMove(event);
                followSweep(sweep, event.movementX, event.movementY, at);
                follow({
                    type: 'move',
                    side,
                    x: event.clientX,
                    y: event.clientY,
                    moved: event.movementX !== 0 || event.movementY !== 0,
                    verticality: sweepVerticality(sweep),
                    at,
                });
            },
            onMouseLeave: () => {
                if (pointerTypeRef.current !== 'mouse') {
                    handlersRef.current.onConceal();
                    return;
                }
                follow({ type: 'leave', at: now() });
            },
            // A turn of the wheel means scrolling, not choosing an action.
            onWheel: () => {
                follow({ type: 'cancel', at: now() });
            },
        });
        const edges = { left: bind('left'), right: bind('right') };

        return {
            bindHoverIntent: (side) => edges[side],
            cancelHoverIntent: () => follow({ type: 'cancel', at: now() }),
            commitHoverIntent: (side) => follow({ type: 'commit', side, at: now() }),
            isMousePointer: () => pointerTypeRef.current === 'mouse',
        };
    }, []);

    useEffect(() => {
        return () => {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        };
    }, []);

    return controls;
};
