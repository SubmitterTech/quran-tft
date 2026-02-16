import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSpring, animated } from '@react-spring/web';

const OVERSCROLL_MAX_DISTANCE = 320;
const OVERSCROLL_TRIGGER_DISTANCE = 220;
const OVERSCROLL_ENGAGE_DISTANCE = 40;
const OVERSCROLL_CONTENT_LIFT_MAX = 56;
const OVERSCROLL_TOUCH_RESISTANCE = 0.92;
const OVERSCROLL_WHEEL_RESISTANCE = 0.62;
const OVERSCROLL_EDGE_TOLERANCE = 2;
const OVERSCROLL_COOLDOWN_MS = 680;
const OVERSCROLL_INDICATOR_REVEAL_MAX = 76;
const OVERSCROLL_LIFT_START_PROGRESS = 0.29;
const OVERSCROLL_LIFT_EASING_POWER = 0.62;
const OVERSCROLL_LIFT_GAIN = 1.28;
const OVERSCROLL_PROGRESS_RANGE = OVERSCROLL_TRIGGER_DISTANCE - OVERSCROLL_ENGAGE_DISTANCE;
const OVERSCROLL_RESET_CONFIG = { tension: 340, friction: 34, mass: 0.95 };
const OVERSCROLL_RESET_FAST_CONFIG = { tension: 520, friction: 36, mass: 0.82 };
const OVERSCROLL_RELEASE_GUARD_MS = 200;

export const NEXT_PAGER_INDICATOR_BOTTOM = 'calc(env(safe-area-inset-bottom) * 0.57 + 3.05rem)';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const useNextPagerController = ({
    scrollContainerRef,
    selectedPage,
    onEndOverscrollNext,
    onOverscrollProgressChange
}) => {
    const wheelReleaseTimeoutRef = useRef(null);
    const overscrollTriggerTimeoutRef = useRef(null);
    const overscrollUnlockTimeoutRef = useRef(null);
    const overscrollReleaseUnlockAtRef = useRef(0);
    const overscrollDistanceRef = useRef(0);
    const overscrollTriggerLockRef = useRef(false);
    const overscrollProgressEmitRef = useRef(-1);
    const touchTrackerRef = useRef({
        active: false,
        lastY: 0,
    });

    const [overscrollAwaitingTap, setOverscrollAwaitingTap] = useState(false);
    const [overscrollProgress, setOverscrollProgress] = useState(0);
    const [{ overscrollPull }, overscrollApi] = useSpring(() => ({ overscrollPull: 0 }));

    const isAtBottom = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) {
            return false;
        }
        return (container.scrollHeight - (container.scrollTop + container.clientHeight)) <= OVERSCROLL_EDGE_TOLERANCE;
    }, [scrollContainerRef]);

    const calculateOverscrollProgress = useCallback((distance) => {
        const effectiveDistance = clamp(distance - OVERSCROLL_ENGAGE_DISTANCE, 0, OVERSCROLL_PROGRESS_RANGE);
        return clamp(effectiveDistance / OVERSCROLL_PROGRESS_RANGE, 0, 1);
    }, []);

    const armOverscrollReleaseGuard = useCallback(() => {
        overscrollReleaseUnlockAtRef.current = Date.now() + OVERSCROLL_RELEASE_GUARD_MS;
    }, []);

    const resetOverscroll = useCallback((immediate = false, mode = 'default') => {
        overscrollDistanceRef.current = 0;
        overscrollReleaseUnlockAtRef.current = 0;
        setOverscrollAwaitingTap(false);
        setOverscrollProgress(0);
        overscrollApi.start({
            overscrollPull: 0,
            immediate,
            config: mode === 'fast' ? OVERSCROLL_RESET_FAST_CONFIG : OVERSCROLL_RESET_CONFIG,
        });
    }, [overscrollApi]);

    const updateOverscroll = useCallback((distance, immediate = false) => {
        const clampedDistance = clamp(distance, 0, OVERSCROLL_MAX_DISTANCE);
        overscrollDistanceRef.current = clampedDistance;
        setOverscrollProgress(calculateOverscrollProgress(clampedDistance));

        overscrollApi.start({
            overscrollPull: clampedDistance,
            immediate,
            config: { tension: 360, friction: 32, mass: 0.95 },
        });
    }, [calculateOverscrollProgress, overscrollApi]);

    const triggerOverscrollTransition = useCallback(() => {
        if (overscrollTriggerLockRef.current || typeof onEndOverscrollNext !== 'function') {
            resetOverscroll(false);
            return;
        }

        overscrollTriggerLockRef.current = true;
        setOverscrollAwaitingTap(false);
        updateOverscroll(OVERSCROLL_TRIGGER_DISTANCE + 12, false);

        clearTimeout(overscrollTriggerTimeoutRef.current);
        overscrollTriggerTimeoutRef.current = setTimeout(() => {
            onEndOverscrollNext();
            resetOverscroll(true);
        }, 95);

        clearTimeout(overscrollUnlockTimeoutRef.current);
        overscrollUnlockTimeoutRef.current = setTimeout(() => {
            overscrollTriggerLockRef.current = false;
        }, OVERSCROLL_COOLDOWN_MS);
    }, [onEndOverscrollNext, resetOverscroll, updateOverscroll]);

    const finalizeOverscrollGesture = useCallback(() => {
        clearTimeout(wheelReleaseTimeoutRef.current);
        if (overscrollAwaitingTap) {
            return;
        }
        if (overscrollDistanceRef.current >= OVERSCROLL_TRIGGER_DISTANCE) {
            setOverscrollAwaitingTap(true);
            setOverscrollProgress(1);
            updateOverscroll(OVERSCROLL_TRIGGER_DISTANCE, false);
        } else {
            resetOverscroll(false);
        }
    }, [overscrollAwaitingTap, resetOverscroll, updateOverscroll]);

    const handleTouchStart = useCallback((event) => {
        if (!event.touches || event.touches.length === 0) {
            return;
        }
        touchTrackerRef.current.active = true;
        touchTrackerRef.current.lastY = event.touches[0].clientY;
    }, []);

    const handleTouchMove = useCallback((event) => {
        if (!touchTrackerRef.current.active || !event.touches || event.touches.length === 0) {
            return;
        }

        const currentY = event.touches[0].clientY;
        const deltaY = touchTrackerRef.current.lastY - currentY;
        touchTrackerRef.current.lastY = currentY;

        if (overscrollAwaitingTap) {
            if (!isAtBottom() || deltaY < -1.2) {
                resetOverscroll(false, 'fast');
            }
            return;
        }

        if (deltaY > 1.2 && isAtBottom()) {
            armOverscrollReleaseGuard();
            updateOverscroll(overscrollDistanceRef.current + (deltaY * OVERSCROLL_TOUCH_RESISTANCE), false);
            return;
        }

        if (overscrollDistanceRef.current > 0) {
            const guardActive = Date.now() < overscrollReleaseUnlockAtRef.current;
            if (guardActive && deltaY > -1.2 && isAtBottom()) {
                return;
            }
            const releaseStep = Math.max(Math.abs(deltaY), 1.5);
            const nextDistance = overscrollDistanceRef.current - releaseStep;
            if (!isAtBottom() || nextDistance <= 0) {
                resetOverscroll(true);
            } else {
                updateOverscroll(nextDistance, false);
            }
        }
    }, [armOverscrollReleaseGuard, isAtBottom, overscrollAwaitingTap, resetOverscroll, updateOverscroll]);

    const handleTouchEnd = useCallback(() => {
        touchTrackerRef.current.active = false;
        finalizeOverscrollGesture();
    }, [finalizeOverscrollGesture]);

    const handleWheel = useCallback((event) => {
        if (overscrollAwaitingTap) {
            if (event.deltaY < -1 || !isAtBottom()) {
                resetOverscroll(false, 'fast');
            }
            return;
        }

        if (event.deltaY <= 0) {
            if (overscrollDistanceRef.current > 0) {
                const guardActive = Date.now() < overscrollReleaseUnlockAtRef.current;
                if (guardActive && Math.abs(event.deltaY) < 3) {
                    return;
                }
                const nextDistance = overscrollDistanceRef.current - Math.abs(event.deltaY);
                if (nextDistance <= 0) {
                    resetOverscroll(true);
                } else {
                    updateOverscroll(nextDistance, false);
                }
            }
            return;
        }

        if (!isAtBottom()) {
            if (overscrollDistanceRef.current > 0) {
                resetOverscroll(true);
            }
            return;
        }

        const normalizedWheel = clamp(event.deltaY, 0, 64);
        const wheelIncrement = Math.sqrt(normalizedWheel) * OVERSCROLL_WHEEL_RESISTANCE;
        armOverscrollReleaseGuard();
        updateOverscroll(overscrollDistanceRef.current + wheelIncrement, false);

        clearTimeout(wheelReleaseTimeoutRef.current);
        wheelReleaseTimeoutRef.current = setTimeout(() => {
            finalizeOverscrollGesture();
        }, 150);
    }, [armOverscrollReleaseGuard, finalizeOverscrollGesture, isAtBottom, overscrollAwaitingTap, resetOverscroll, updateOverscroll]);

    const handleIndicatorTap = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!overscrollAwaitingTap) {
            return;
        }
        triggerOverscrollTransition();
    }, [overscrollAwaitingTap, triggerOverscrollTransition]);

    const handleContainerScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (overscrollAwaitingTap && container && !isAtBottom()) {
            resetOverscroll(false, 'fast');
        } else if (
            overscrollDistanceRef.current > 0 &&
            container &&
            (container.scrollHeight - (container.scrollTop + container.clientHeight)) > OVERSCROLL_EDGE_TOLERANCE
        ) {
            resetOverscroll(true);
        }
    }, [isAtBottom, overscrollAwaitingTap, resetOverscroll, scrollContainerRef]);

    useEffect(() => {
        resetOverscroll(true);
    }, [selectedPage, resetOverscroll]);

    useEffect(() => {
        if (typeof onOverscrollProgressChange !== 'function') {
            return;
        }

        const nextProgress = overscrollAwaitingTap ? 1 : overscrollProgress;
        if (Math.abs(nextProgress - overscrollProgressEmitRef.current) < 0.004) {
            return;
        }
        overscrollProgressEmitRef.current = nextProgress;
        onOverscrollProgressChange(nextProgress);
    }, [onOverscrollProgressChange, overscrollAwaitingTap, overscrollProgress]);

    useEffect(() => {
        return () => {
            if (typeof onOverscrollProgressChange === 'function') {
                onOverscrollProgressChange(0);
            }
        };
    }, [onOverscrollProgressChange]);

    useEffect(() => {
        return () => {
            clearTimeout(wheelReleaseTimeoutRef.current);
            clearTimeout(overscrollTriggerTimeoutRef.current);
            clearTimeout(overscrollUnlockTimeoutRef.current);
        };
    }, []);

    const overscrollProgressAnimated = overscrollPull.to((pull) => calculateOverscrollProgress(pull));

    const overscrollLiftAnimated = overscrollProgressAnimated.to((progress) => {
        const shiftedProgress = clamp(
            (progress - OVERSCROLL_LIFT_START_PROGRESS) / (1 - OVERSCROLL_LIFT_START_PROGRESS),
            0,
            1
        );
        const acceleratedProgress = Math.pow(shiftedProgress, OVERSCROLL_LIFT_EASING_POWER);
        return clamp(
            acceleratedProgress * OVERSCROLL_CONTENT_LIFT_MAX * OVERSCROLL_LIFT_GAIN,
            0,
            OVERSCROLL_CONTENT_LIFT_MAX
        );
    });

    return {
        overscrollPull,
        overscrollAwaitingTap,
        overscrollProgressAnimated,
        overscrollLiftAnimated,
        handleContainerScroll,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleWheel,
        handleIndicatorTap,
    };
};

export const NextPagerIndicator = ({
    colors,
    theme,
    overscrollAwaitingTap,
    overscrollProgressAnimated,
    overscrollPull,
    onTap,
    label,
    bottom = NEXT_PAGER_INDICATOR_BOTTOM,
}) => {
    return (
        <animated.div
            className="pointer-events-none fixed left-1/2 z-[30] mb-5 lg:mb-7"
            style={{
                bottom,
                opacity: overscrollAwaitingTap
                    ? 1
                    : overscrollProgressAnimated.to((progress) => clamp(progress, 0, 1)),
                transform: overscrollPull.to((pull) => {
                    const reveal = overscrollAwaitingTap
                        ? OVERSCROLL_INDICATOR_REVEAL_MAX
                        : clamp(pull * 0.68, 0, OVERSCROLL_INDICATOR_REVEAL_MAX);
                    const y = OVERSCROLL_INDICATOR_REVEAL_MAX - reveal;
                    return `translate(-50%, ${y}px)`;
                }),
            }}>
            <button
                type="button"
                onClick={onTap}
                disabled={!overscrollAwaitingTap}
                className={`pointer-events-auto rounded py-2 px-3 shadow-lg transition-all duration-100 ease-in ${colors[theme]["text-background"]} ${overscrollAwaitingTap ? `cursor-pointer ${colors[theme]["matching-text"]} animate-pulse` : `cursor-default ${colors[theme]["app-text"]}`}`}>
                <span className="text-base lg:text-large whitespace-nowrap">{label}</span>
            </button>
        </animated.div>
    );
};

export const NextPagerProgressRing = ({
    show,
    progress,
    colors,
    theme,
    sizeClassName = 'w-11 h-11 lg:w-[60px] lg:h-[60px]',
    radius = 23,
    viewBoxSize = 52,
    trackStrokeWidth = 1.6,
    strokeWidth = 1.8,
}) => {
    const clampedProgress = clamp(progress ?? 0, 0, 1);
    if (!show || clampedProgress <= 0) {
        return null;
    }

    const center = viewBoxSize / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - clampedProgress);
    const completeOffsetThreshold = Math.max(strokeWidth, 1);
    const isComplete = dashOffset <= completeOffsetThreshold;
    const pulseInsetPx = Math.max(Math.round(strokeWidth), 2);

    return (
        <div className={`absolute pointer-events-none z-0 ${sizeClassName}`}>
            <svg
                viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
                className={`absolute inset-0 w-full h-full ${colors[theme]["matching-text"]} ${isComplete ? `invisible` : ``}`}>
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={trackStrokeWidth}
                    opacity="0.25"
                />
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    transform={`rotate(-90 ${center} ${center})`}
                />
            </svg>
            {isComplete && (
                <div className="absolute inset-0 overflow-hidden rounded-full">
                    <div
                        className={`absolute rounded-full animate-rotate ${colors[theme]["matching-conic"]}`}
                        style={{ inset: 0 }} />
                    <div
                        className={`absolute rounded-full ${colors[theme]["app-background"]}`}
                        style={{ inset: `${pulseInsetPx}px` }} />
                </div>
            )}
        </div>
    );
};
