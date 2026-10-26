import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import '../assets/css/Splash.css';
import languages from '../utils/LanguageCatalog';
import { isTamil } from '../utils/Tamil';

// The cover's type is drawn for a 60px title on a phone. One scale, worked out from the height the
// cover has, sizes the title, the translator's lines and the language list: the list keeps at least
// COVER_LIST_SHARE of the height, scrolling within it when it is longer, and the text shares the
// rest. The translator's lines and the list stop shrinking at COVER_READABLE_MIN_SCALE. A line that
// is still wider than the cover at that scale, such as a long version line on a narrow phone, steps
// down further on its own. Phones keep the drawn size at most; from a short side of
// COVER_GROWTH_START up, tablets and desktops may grow the type, up to COVER_MAX_SCALE.
const COVER_MIN_SCALE = 0.55;
const COVER_READABLE_MIN_SCALE = 0.8;
const COVER_MAX_SCALE = 1.4;
const COVER_GROWTH_START = 420;
const COVER_LIST_SHARE = 0.4;
// A cover wider than it is tall puts the languages in a column of their own on the right, so the
// title and the translator's lines have the whole height of the left column, less some air.
const COVER_LANDSCAPE_TEXT_SHARE = 0.88;
const LANGUAGE_DISABILITY_THRESHOLD = 38;

const titleGradient = {
    backgroundImage: 'linear-gradient(45deg, #ECC440, #FFFA8A, #DDAC17, #FFFF95)',
    color: 'transparent',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const readableScaleFor = (scale) => Math.max(COVER_READABLE_MIN_SCALE, scale);

// The cover texts keep the line breaks the translators chose (they are drawn with white-space:
// pre), but a space left at either end of a line would be centred with the line and push the
// letters off the middle, as "SON " did in Turkish.
const trimLines = (text) => String(text || '').split('\n').map((line) => line.trim()).join('\n');

const px = (value) => parseFloat(value) || 0;

const contentWidth = (element) => {
    const style = getComputedStyle(element);
    return element.clientWidth - px(style.paddingLeft) - px(style.paddingRight);
};

const sameFit = (left, right) => left.landscape === right.landscape
    && Math.abs(left.scale - right.scale) < 0.005
    && Object.keys(left.lines).every((key) => Math.abs(left.lines[key] - (right.lines[key] ?? 1)) < 0.005);

const Cover = ({ onCoverSeen, coverData, lang, onChangeLanguage }) => {
    const [fit, setFit] = useState({ scale: 1, lines: {}, landscape: false });
    const fitRef = useRef(fit);
    const rootRef = useRef(null);
    const titleRef = useRef(null);
    const creditRef = useRef(null);
    const direction = (languages[lang] && languages[lang]["dir"]) ? languages[lang]["dir"] : 'ltr';
    // Tamil and Persian letters reach further above and below the line than the Latin capitals the
    // titles were set for. The gradient fill (background-clip: text) paints only inside the heading
    // box, so the tight title line heights cut them off. Tamil titles get line boxes tall enough to
    // hold them, which also keeps their lines apart. In Persian only the big title is cut, so it
    // gets padding inside equal negative margins: the painted box grows, the layout stays as it was.
    const isPersianCover = (lang || '').toLowerCase() === 'fa';
    const quranLineHeight = isTamil(lang) ? 1.25 : 1;
    const titleLineHeight = isTamil(lang) ? 1.25 : 1.1;

    fitRef.current = fit;

    const measureFit = useCallback(() => {
        const root = rootRef.current;
        const title = titleRef.current;
        const credit = creditRef.current;
        if (!root || !title || !credit) {
            return;
        }

        const current = fitRef.current;
        const rootStyle = getComputedStyle(root);
        const height = root.clientHeight - px(rootStyle.paddingTop) - px(rootStyle.paddingBottom);
        const width = root.clientWidth - px(rootStyle.paddingLeft) - px(rootStyle.paddingRight);
        // Nothing to fit until the cover has been laid out; the ResizeObserver calls again once it
        // has a size, and the fit already on the page stays until then.
        if (!(width > 0) || !(height > 0)) {
            return;
        }

        const landscape = width > height;
        const budget = height * (landscape ? COVER_LANDSCAPE_TEXT_SHARE : 1 - COVER_LIST_SHARE);
        const titleHeight = title.offsetHeight / current.scale;
        const creditHeight = credit.offsetHeight / readableScaleFor(current.scale);
        const shortSide = Math.min(window.innerWidth, window.innerHeight);
        const maxScale = Math.min(COVER_MAX_SCALE, Math.max(1, shortSide / COVER_GROWTH_START));
        let scale = current.scale;
        if (titleHeight > 0) {
            scale = budget / (titleHeight + creditHeight);
            if (scale < COVER_READABLE_MIN_SCALE) {
                scale = (budget - creditHeight * COVER_READABLE_MIN_SCALE) / titleHeight;
            }
            scale = clamp(scale, COVER_MIN_SCALE, maxScale);
        }

        const lines = {};
        root.querySelectorAll('[data-cover-line]').forEach((line) => {
            const key = line.dataset.coverLine;
            const block = line.closest('[data-cover-block]');
            const blockScale = (s) => (block.dataset.coverBlock === 'credit' ? readableScaleFor(s) : s);
            const drawn = line.getBoundingClientRect().width / (blockScale(current.scale) * (current.lines[key] ?? 1));
            const available = contentWidth(block);
            lines[key] = drawn > 0 && available > 0
                ? Math.min(1, available / (drawn * blockScale(scale)))
                : current.lines[key] ?? 1;
        });

        // Widths are measured in the layout on the page; after a switch between portrait and
        // landscape the next pass measures them again in the new one.
        const next = { scale, lines, landscape };
        if (!sameFit(next, current)) {
            setFit(next);
        }
    }, []);

    // Measured again after every new fit: a line that steps down changes the height the scale was
    // worked out from, and the second pass settles it.
    useLayoutEffect(() => {
        measureFit();
    }, [measureFit, coverData, lang, fit]);

    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!root) {
            return undefined;
        }

        // The lines are watched as well as the cover: Tamil and Persian come from web fonts, which
        // can land after a language change has been measured, and only the lines change size then.
        const observer = new ResizeObserver(() => measureFit());
        observer.observe(root);
        root.querySelectorAll('[data-cover-line]').forEach((line) => observer.observe(line));
        return () => observer.disconnect();
    }, [measureFit]);

    const lineSize = (key, size) => `${size * (fit.lines[key] ?? 1)}em`;

    return (
        <div
            ref={rootRef}
            className={`cover ${fit.landscape ? 'cover-landscape' : 'cover-portrait'} fixed inset-0 text-center bg-sky-950 text-neutral-200 overflow-hidden`}
        >
            <div
                ref={titleRef}
                data-cover-block="title"
                className="cover-title flex flex-col items-center px-3"
                style={{ fontSize: `${fit.scale}rem`, paddingTop: 'max(0.75em, 3vh)', gap: '0.25em' }}>
                <h1 data-cover-line="quran" className={`w-fit whitespace-pre font-extrabold${isPersianCover ? " py-2 -my-2" : ""}`} style={{
                    ...titleGradient,
                    fontSize: lineSize('quran', 3.75),
                    lineHeight: quranLineHeight,
                    textShadow: '0 2px 2px rgba(0,0,0,0.1), 0 3px 5px rgba(255,215,0,0.19)'
                }}>
                    {trimLines(coverData.quran)}
                </h1>
                <h2 data-cover-line="title" className="w-fit whitespace-pre font-bold" style={{
                    ...titleGradient,
                    fontSize: lineSize('title', 2.25),
                    lineHeight: titleLineHeight,
                    textShadow: '0 1px 1px rgba(0,0,0,0.1), 0 2px 3px rgba(255,215,0,0.19)'
                }}>
                    {trimLines(coverData.title)}
                </h2>
                <h2 data-cover-line="version" className="w-fit whitespace-pre font-bold" style={{ fontSize: lineSize('version', 1.125), lineHeight: 1.5 }}>
                    {trimLines(coverData.version)}
                </h2>
            </div>
            <div
                className="cover-languages min-h-0 w-full flex items-center justify-center py-2"
                style={{ fontSize: `${readableScaleFor(fit.scale)}rem` }}>
                <div className="max-h-full overflow-y-scroll flex flex-col p-2 pr-4 items-end m-2" style={{ gap: '1em' }}>
                    {Object.keys(languages).map((key) => {
                        if (key) {
                            const isSelectedLanguage = lang === key;
                            const isLanguageDisabled = languages[key]["comp"] < LANGUAGE_DISABILITY_THRESHOLD;

                            const languageClass = isLanguageDisabled
                                ? "bg-neutral-500 cursor-not-allowed opacity-50"
                                : "bg-neutral-800 cursor-pointer";

                            return (
                                <div
                                    key={key}
                                    className={`flex-none flex flex-col rounded justify-center ${languageClass} ${isSelectedLanguage ? "ring-1 ring-offset-4 ring-sky-400 ring-offset-sky-950" : ""}`}
                                    style={{ padding: '0.5em' }}
                                    onClick={() => isLanguageDisabled ? null : onChangeLanguage(key)}>
                                    <input
                                        type="radio"
                                        name="theme"
                                        value={key}
                                        disabled={isLanguageDisabled}
                                        checked={isSelectedLanguage}
                                        onChange={(e) => isLanguageDisabled ? null : onChangeLanguage(e.target.value)}
                                        className="hidden"
                                    />
                                    <div className="flex justify-between items-center w-full" style={key === "en" ? { padding: '0.75em 0' } : undefined}>
                                        <span dir={languages[key]["dir"]}>{languages[key]["name"]}</span>
                                    </div>
                                    {key !== "en" && (
                                        <div className="relative w-full rounded bg-neutral-600 font-semibold" style={{ height: '0.875em', marginTop: '0.375em' }}>
                                            <div
                                                className="bg-sky-400 h-full rounded"
                                                style={{ width: `${languages[key]["comp"]}%` }}
                                            ></div>
                                            <span className="absolute inset-0 flex items-center justify-center text-neutral-800" style={{ fontSize: '0.75em' }}>
                                                {languages[key]["comp"]}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>
                <div
                    onClick={() => onCoverSeen()}
                    className="flex-none text-neutral-200 flex items-center justify-center px-3"
                    style={{ paddingTop: '2.5em', paddingBottom: '2.5em' }}>
                    <div className="mb-1 rounded-full ml-2 flex justify-center shadow-lg shadow-neutral-900 animate-pulse bg-sky-700/50 cursor-pointer" style={{ padding: '0.625em' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '3em', height: '3em' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                        </svg>
                    </div>
                </div>
            </div>
            <div
                ref={creditRef}
                data-cover-block="credit"
                className="cover-credit flex flex-col items-center px-3"
                style={{ fontSize: `${readableScaleFor(fit.scale)}rem`, gap: '0.75em', paddingBottom: 'max(0.75em, 2vh)' }}>
                <div className="text-sky-400 flex flex-col items-center">
                    <p data-cover-line="translated" className="w-fit whitespace-pre" style={{ fontSize: lineSize('translated', 1), lineHeight: 1.5 }}>{trimLines(coverData.translated)}</p>
                    <p data-cover-line="author" className="w-fit whitespace-pre" style={{ fontSize: lineSize('author', 1), lineHeight: 1.5 }}>{trimLines(coverData.author)}</p>
                </div>
                <p data-cover-line="edition" dir={direction} className="w-fit whitespace-pre" style={{ fontSize: lineSize('edition', 1), lineHeight: 1.5 }}>{trimLines(coverData.edition) + "  1992"}</p>
            </div>
        </div>
    );
};

export default Cover;
