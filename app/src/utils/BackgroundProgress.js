import React, { useEffect, useRef } from 'react';
import { useSpring, animated } from '@react-spring/web';

// The bar under the page stands for all the work the app does in the background: loading a
// translation, building the search indexes, fetching new text. Each task reports on its own and
// they start and finish at their own times, so an average of whatever happens to be running moves
// backwards. A task that starts late joins with little done and pulls the bar down, and one that
// finishes first leaves and takes its full share with it.
//
// So the bar follows a run, from the first task that starts until none is left. A task that has
// finished still counts as done until the run is over, and the bar never shows less than it
// already has: a task that starts late holds the bar where it is until there is progress to show.

export const IDLE_BACKGROUND_RUN = Object.freeze({ tasks: Object.freeze([]), percent: 0 });

/**
 * Folds the state of the tasks into the run so far.
 *
 * @param {{ tasks: string[], percent: number }} run The run as the bar last showed it.
 * @param {Object<string, number|null>} tasks The percent of every task that is running; any other
 *     value marks a task that is not.
 * @returns The run to show; IDLE_BACKGROUND_RUN once nothing is running.
 */
export const followBackgroundRun = (run, tasks) => {
    const running = Object.keys(tasks).filter((task) => typeof tasks[task] === 'number');
    if (running.length === 0) {
        return IDLE_BACKGROUND_RUN;
    }

    const seen = Array.from(new Set([...run.tasks, ...running]));
    const average = seen.reduce(
        (total, task) => total + (running.includes(task) ? tasks[task] : 100),
        0,
    ) / seen.length;
    const percent = Number(Math.max(run.percent, average).toFixed(1));

    if (percent === run.percent && seen.length === run.tasks.length) {
        return run;
    }
    return { tasks: seen, percent };
};

// The work can also report a long step at once, as when the search index finishes and its share
// goes from the estimate to done. So the bar glides to each value it is given instead of being set
// there. A clamped spring never passes its target, and within a run the bar is only ever sent
// forward, so it only ever moves forward.
const FILL_SPRING = { tension: 170, friction: 26, clamp: true };
const FADE = { duration: 250 };

export const BackgroundProgressBar = ({ active, percent, className }) => {
    const [{ width, opacity }, api] = useSpring(() => ({ width: 0, opacity: 0 }));
    const runningRef = useRef(false);

    useEffect(() => {
        if (active) {
            if (!runningRef.current) {
                runningRef.current = true;
                // A run starts from an empty bar, even while the previous one is still fading.
                api.set({ width: 0 });
            }
            api.start({ width: percent, opacity: 0.9, config: FILL_SPRING });
            return;
        }

        if (!runningRef.current) {
            return;
        }

        // When the work is over the bar fills to the end and then fades, instead of vanishing
        // wherever it happened to be.
        runningRef.current = false;
        Promise.all(api.start({ width: 100, opacity: 0.9, config: FILL_SPRING })).then(() => {
            if (!runningRef.current) {
                api.start({ opacity: 0, config: FADE });
            }
        });
    }, [active, percent, api]);

    return (
        <animated.div
            className={className}
            style={{ width: width.to((value) => `${value}%`), opacity }} />
    );
};
