import { useEffect, useRef } from 'react';

export function useAutoLock(onLock: () => void, timeoutMs: number): void {
  const onLockRef = useRef(onLock);
  const timeoutMsRef = useRef(timeoutMs);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onLockRef.current = onLock; }, [onLock]);
  useEffect(() => { timeoutMsRef.current = timeoutMs; }, [timeoutMs]);

  useEffect(() => {
    if (timeoutMs === 0) return;

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onLockRef.current(), timeoutMsRef.current);
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'wheel'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // Deps: intentionally limited — re-register listeners only when enabled/disabled flips.
  // The refs (onLockRef, timeoutMsRef) give us current values without being deps.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- empty array intentional; refs provide current values
  }, [timeoutMs === 0]); // eslint-disable-line
}
