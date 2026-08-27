import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DEFAULT_THEME, isThemePreference, type ThemePreference } from '../types/theme';

/**
 * Owns the light/dark preference and keeps `.dark` on <html> in sync with it.
 *
 * Ported from nimbus-fe's ThemeProvider (app/components/ThemeProvider.tsx). It
 * is a hook rather than a context because this app has exactly one consumer —
 * App, which needs `isDark` for the atmosphere anyway — so a provider would be
 * ceremony around a single call.
 *
 * The two differences from the web version both come from being a desktop app:
 * the stored value arrives synchronously over IPC instead of from localStorage,
 * so it can seed useState directly and there is no hydration mismatch to dodge;
 * and there are no public routes, so the preference always applies.
 */

function readInitialTheme(): ThemePreference {
  try {
    const stored = window.electronAPI.theme.initial();
    if (isThemePreference(stored)) return stored;
  } catch {
    // Main process unreachable (or the app is running outside Electron in a
    // test harness). The default stands and the session is still switchable.
  }
  return DEFAULT_THEME;
}

export interface Theme {
  theme: ThemePreference;
  isDark: boolean;
  setTheme: (next: ThemePreference) => void;
  toggleTheme: () => void;
}

export function useTheme(): Theme {
  const [theme, setThemeState] = useState<ThemePreference>(readInitialTheme);
  const isDark = theme === 'dark';

  // Frame handle for the transition suppression below, so a rapid double-toggle
  // cannot let the first flip's cleanup re-enable transitions mid-way through
  // the second one.
  const unsuppressFrame = useRef<number | null>(null);

  // Layout effect, not effect: this runs after the DOM is mutated but before
  // the browser paints, so the first frame of app content is already in the
  // right theme. The frames before React mounts at all are covered by the
  // window's own backgroundColor (see electron/ipc/theme.ts).
  useLayoutEffect(() => {
    const el = document.documentElement;

    // Kill transitions BEFORE the class flip, in the same synchronous block.
    // Both are class changes on the same element, so the browser computes
    // style once — and by then transitions are already off, which is what
    // makes the whole window change colour on one frame instead of every
    // transitioned card, button and border easing in behind the rest.
    el.classList.add('theme-switching');
    el.classList.toggle('dark', isDark);
    // Tells the browser to render form controls and scrollbars in the matching
    // scheme. Without it a dark page keeps a white scrollbar gutter.
    el.style.colorScheme = isDark ? 'dark' : 'light';

    // Two frames, not one: the first runs before the next paint, the second
    // after the paint that carries the new colours. Restoring on the first
    // would put transitions back while that paint is still pending, which is
    // the bug this is preventing.
    if (unsuppressFrame.current !== null) cancelAnimationFrame(unsuppressFrame.current);
    unsuppressFrame.current = requestAnimationFrame(() => {
      unsuppressFrame.current = requestAnimationFrame(() => {
        unsuppressFrame.current = null;
        el.classList.remove('theme-switching');
      });
    });

    return () => {
      if (unsuppressFrame.current !== null) {
        cancelAnimationFrame(unsuppressFrame.current);
        unsuppressFrame.current = null;
      }
      // Never leave the page with transitions disabled if this unmounts
      // mid-flip.
      el.classList.remove('theme-switching');
    };
  }, [isDark]);

  // Persist separately from applying, so a failed write never blocks the flip.
  // Skipped on mount: the value came from the file, writing it back is noise.
  const persisted = useRef(theme);
  useEffect(() => {
    if (persisted.current === theme) return;
    persisted.current = theme;
    try {
      void window.electronAPI.theme.set(theme).catch(() => {
        // Disk write failed. The theme still applies for this session.
      });
    } catch {
      // Main process unreachable — same fallback as readInitialTheme.
    }
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => setThemeState(next), []);

  const toggleTheme = useCallback(
    () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
    [],
  );

  return { theme, isDark, setTheme, toggleTheme };
}
