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
// phones. Where there is no island, the spacer has no height.

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

export default IslandSpacer;
