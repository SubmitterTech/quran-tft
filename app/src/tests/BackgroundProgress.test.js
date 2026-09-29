import { IDLE_BACKGROUND_RUN, followBackgroundRun } from '../utils/BackgroundProgress';

const play = (steps) => {
    let run = IDLE_BACKGROUND_RUN;
    return steps.map((running) => {
        run = followBackgroundRun(run, running);
        return run.percent;
    });
};

describe('background work bar', () => {
    test('a task that starts late holds the bar instead of pulling it back', () => {
        expect(play([
            { didYouMean: 40 },
            { didYouMean: 42, contentFetch: 2 },
            { didYouMean: 44, contentFetch: 30 },
            { didYouMean: 46, contentFetch: 60 },
        ])).toEqual([40, 40, 40, 53]);
    });

    test('a task that finishes first keeps counting as done', () => {
        expect(play([
            { didYouMean: 50, contentFetch: 90 },
            { didYouMean: 52, contentFetch: 100 },
            { didYouMean: 54 },
            { didYouMean: 80 },
        ])).toEqual([70, 76, 77, 90]);
    });

    test('the bar never goes back, whatever the tasks report', () => {
        const shown = play([
            { translation: 10, didYouMean: null, contentFetch: null },
            { translation: 60, didYouMean: 1, contentFetch: null },
            { translation: 100, didYouMean: 5, contentFetch: null },
            { translation: null, didYouMean: 8, contentFetch: 2 },
            { translation: null, didYouMean: 30, contentFetch: 100 },
            { translation: null, didYouMean: 30, contentFetch: 95 },
            { translation: null, didYouMean: 99, contentFetch: null },
            { translation: null, didYouMean: 100, contentFetch: null },
        ]);
        shown.slice(1).forEach((percent, index) => {
            expect(percent).toBeGreaterThanOrEqual(shown[index]);
        });
        expect(shown[shown.length - 1]).toBe(100);
    });

    test('the run ends when nothing is running and the next one starts afresh', () => {
        let run = followBackgroundRun(IDLE_BACKGROUND_RUN, { didYouMean: 100 });
        expect(run.percent).toBe(100);

        run = followBackgroundRun(run, { didYouMean: null });
        expect(run).toBe(IDLE_BACKGROUND_RUN);

        run = followBackgroundRun(run, { contentFetch: 2 });
        expect(run).toEqual({ tasks: ['contentFetch'], percent: 2 });
    });

    test('an unchanged state gives back the same run', () => {
        const run = followBackgroundRun(IDLE_BACKGROUND_RUN, { translation: 12 });
        expect(followBackgroundRun(run, { translation: 12 })).toBe(run);
    });
});
