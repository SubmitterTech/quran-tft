import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

// Keeps the reading screens clear of a camera island at the top of the screen, as on iPhone Duo's
// outer display. utils/WindowGeometry marks the island on the root element as a band: the side it
// is on (data-occlusion-band), how far in from that edge it reaches and where it ends
// (--app-occlusion-band-inset, --app-occlusion-band-bottom).
//
// The screens keep the full width; only what sits beside the island steps aside. A header at the
// top takes padding on the island's side (the island-aside class in index.css), and the content
// after it starts below the island while the page is scrolled to the top (IslandSpacer); scrolled
// further, the text passes under the island the way it passes under the status bar on other
// phones. Where there is no island, the spacer has no height. A screen of boxes and cards, such as
// Magnify's results, takes in only the rows beside the island instead (useIslandAside), so it
// narrows in steps that follow the island.

const readBand = () => {
    const root = document.documentElement;
    const edge = root.dataset.occlusionBand;
    if (edge !== 'left' && edge !== 'right') {
        return null;
    }

    const style = getComputedStyle(root);
    const inset = parseFloat(style.getPropertyValue('--app-occlusion-band-inset')) || 0;
    const bottom = parseFloat(style.getPropertyValue('--app-occlusion-band-bottom')) || 0;
    return inset > 0 && bottom > 0 ? { edge, inset, bottom } : null;
};

// How far a box reaches into the island's strip on the island's side.
const reachIntoBand = (band, rect) => (band.edge === 'right'
    ? rect.right - (window.innerWidth - band.inset)
    : band.inset - rect.left);

// Where a box's top would be with every container around it scrolled to the top. A screen can nest
// a scrolling box in another, so the offsets of all of them are added back.
const topAtScrollStart = (element, rect) => {
    let top = rect.top;
    for (let node = element.parentElement; node; node = node.parentElement) {
        top += node.scrollTop;
    }
    return top;
};

// Pushes what follows below the island while the page is at the top. It measures again when the
// band changes (the root's attributes), when the window resizes, and when its container changes
// size, since what stands above it moves it.
export const IslandSpacer = () => {
    const ref = useRef(null);
    const [height, setHeight] = useState(0);

    const measure = useCallback(() => {
        const element = ref.current;
        const band = typeof document === 'undefined' ? null : readBand();
        if (!element || !band) {
            setHeight(0);
            return;
        }

        const rect = element.getBoundingClientRect();
        if (reachIntoBand(band, rect) <= 0) {
            setHeight(0);
            return;
        }
        setHeight(Math.max(0, Math.ceil(band.bottom - topAtScrollStart(element, rect))));
    }, []);

    useLayoutEffect(() => {
        measure();

        const mutations = new MutationObserver(measure);
        mutations.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-occlusion-band', 'style'],
        });
        const sizes = new ResizeObserver(measure);
        if (ref.current?.parentElement) {
            sizes.observe(ref.current.parentElement);
        }
        window.addEventListener('resize', measure);
        return () => {
            mutations.disconnect();
            sizes.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [measure]);

    return <div ref={ref} aria-hidden="true" className="flex-none" style={{ height: `${height}px` }} />;
};

const markBeside = (row, side) => {
    row.style.setProperty('--beside-island-base', getComputedStyle(row)[side]);
    row.setAttribute('data-beside-island', '');
};

const unmarkBeside = (row) => {
    row.removeAttribute('data-beside-island');
    row.style.removeProperty('--beside-island-base');
};

// Takes in the rows under rootRef that stand beside the island while the screen is at the top, and
// leaves the rows below it at the full width. A row is a child of an element marked data-island-list
// or an element marked data-island-item (such as a sticky header). A row taken in gets
// data-beside-island, and index.css adds the island's width to the margin it has on that side,
// which --beside-island-base keeps.
//
// Rows are judged where they stand with every container scrolled to the top, so scrolling does not
// move the steps; scrolled further, the other rows pass under the island. A row taken in grows
// taller and pushes the rows after it down, so the rows are judged one after another, each against
// the layout the earlier ones left. The rows are judged again when the band changes, the window
// resizes, a font finishes loading, or the content under rootRef changes (text included, since
// hyphenation arriving later rewraps the rows in place) or finishes a transition.
export const useIslandAside = (rootRef) => {
    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!root) {
            return undefined;
        }

        let frame = 0;
        const place = () => {
            frame = 0;
            const band = readBand();
            if (!band) {
                root.querySelectorAll('[data-beside-island]').forEach(unmarkBeside);
                return;
            }

            const side = band.edge === 'right' ? 'marginRight' : 'marginLeft';
            const belowIsland = new Set();
            root.querySelectorAll('[data-island-item], [data-island-list] > *').forEach((row) => {
                const marked = row.hasAttribute('data-beside-island');
                const list = row.parentElement?.hasAttribute('data-island-list') ? row.parentElement : null;
                if (list && belowIsland.has(list)) {
                    if (marked) {
                        unmarkBeside(row);
                    }
                    return;
                }

                const rect = row.getBoundingClientRect();
                if (!rect.width || !rect.height) {
                    return;
                }
                // A sticky header stays where it stood at the top while its container scrolls.
                const top = getComputedStyle(row).position === 'sticky' ? rect.top : topAtScrollStart(row, rect);
                if (top >= band.bottom) {
                    // The rows after this one in its list start lower still.
                    if (list) {
                        belowIsland.add(list);
                    }
                    if (marked) {
                        unmarkBeside(row);
                    }
                    return;
                }

                // Where the row would reach without the margin it was given.
                const extra = marked ? band.inset : 0;
                const full = band.edge === 'right'
                    ? { left: rect.left, right: rect.right + extra }
                    : { left: rect.left - extra, right: rect.right };
                const beside = top + rect.height > 0 && reachIntoBand(band, full) > 0;
                if (beside && !marked) {
                    markBeside(row, side);
                } else if (!beside && marked) {
                    unmarkBeside(row);
                }
            });
        };
        const schedule = () => {
            if (!frame) {
                frame = requestAnimationFrame(place);
            }
        };

        place();
        const bandChanges = new MutationObserver(schedule);
        bandChanges.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-occlusion-band', 'style'],
        });
        // Of the attributes only class: the marks this hook writes would otherwise call it again.
        const contentChanges = new MutationObserver(schedule);
        contentChanges.observe(root, {
            childList: true,
            characterData: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class'],
        });
        const sizes = new ResizeObserver(schedule);
        sizes.observe(root);
        root.addEventListener('transitionend', schedule);
        window.addEventListener('resize', schedule);
        document.fonts?.addEventListener?.('loadingdone', schedule);
        return () => {
            cancelAnimationFrame(frame);
            bandChanges.disconnect();
            contentChanges.disconnect();
            sizes.disconnect();
            root.removeEventListener('transitionend', schedule);
            window.removeEventListener('resize', schedule);
            document.fonts?.removeEventListener?.('loadingdone', schedule);
        };
    }, [rootRef]);
};

export default IslandSpacer;
