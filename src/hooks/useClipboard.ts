import { useState, useRef, useCallback } from 'react';

interface ClipboardState {
  countdown: number | null;
  copyWithAutoClear: (text: string, seconds?: number) => Promise<void>;
  cancelClear: () => void;
}

export function useClipboard(): ClipboardState {
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cancelClear = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCountdown(null);
    // Overwrite clipboard with empty string
    navigator.clipboard.writeText('').catch(() => {});
  }, []);

  const copyWithAutoClear = useCallback(async (text: string, seconds = 30) => {
    // Cancel any previous countdown first
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    await navigator.clipboard.writeText(text);
    setCountdown(seconds);

    let remaining = seconds;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        navigator.clipboard.writeText('').catch(() => {});
        setCountdown(null);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, []);

  return { countdown, copyWithAutoClear, cancelClear };
}
