import React, { useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { LongPressEventType, useLongPress } from 'use-long-press';
import { isNative } from '../utils/Device';

function useComponentWillUnmount(callback) {
  const calledRef = useRef(false);
  React.useEffect(() => {
    return () => {
      if (!calledRef.current) {
        calledRef.current = true;
        callback();
      }
    };
  }, [callback]);
}

const LongPressable = ({
  onLongPress,
  onTap,
  onCancel,
  longPressTime = 1045,
  onTimerUpdate,
  children,
}) => {
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  const updateTimer = useCallback(() => {
    if (onTimerUpdate && startTimeRef.current !== null) {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / longPressTime, 1);
      onTimerUpdate(progress, elapsed);
    }
    timerRef.current = requestAnimationFrame(updateTimer);
  }, [onTimerUpdate, longPressTime]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    updateTimer();
  }, [updateTimer]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
    if (onTimerUpdate) {
      onTimerUpdate(0, 0);
    }
  }, [onTimerUpdate]);

  const handleStart = useCallback(() => {
    startTimer();
  }, [startTimer]);

  const handleLongPress = useCallback((event, meta) => {
    stopTimer();
    onLongPress && onLongPress(event, meta);
  }, [onLongPress, stopTimer]);

  const handleFinish = useCallback(() => {
    stopTimer();
  }, [stopTimer]);

  const handleCancel = useCallback((event, meta) => {
    const elapsed = Date.now() - (startTimeRef.current || Date.now());
    const reason = meta.reason;
    stopTimer();
    if (elapsed <= 570 && reason === 'cancelled-by-release') {
      onTap && onTap(event);
    } else {
      onCancel && onCancel(event);
    }

  }, [onTap, onCancel, stopTimer]);

  const filterEvents = useCallback((event) => {
    if (event.pointerType === 'mouse') {
      return event.button === 0;
    }
    return true;
  }, []);

  const bind = useLongPress(handleLongPress, {
    onStart: handleStart,
    onFinish: handleFinish,
    onCancel: handleCancel,
    threshold: longPressTime,
    cancelOnMovement: false,
    filterEvents: filterEvents,
    captureEvent: true,
    cancelOutsideElement: true,
    detect: isNative() ? LongPressEventType.Touch : LongPressEventType.Pointer
  });

  useComponentWillUnmount(() => {
    stopTimer();
  });

  return (
    <div {...bind()} className="w-full h-full">
      {children}
    </div>
  );
};

LongPressable.propTypes = {
  onLongPress: PropTypes.func,
  onTap: PropTypes.func,
  onCancel: PropTypes.func,
  longPressTime: PropTypes.number,
  onTimerUpdate: PropTypes.func,
  children: PropTypes.node,
};

export default LongPressable;
