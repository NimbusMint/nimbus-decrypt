/**
 * Theme preference — light or dark — for the decryptor window.
 *
 * Mirrors nimbus-fe's app/lib/theme.ts, minus the route scoping: this app is
 * one window with one surface, so the preference always applies.
 *
 * Where nimbus-fe stores the choice in localStorage, this app cannot: storage
 * is banned in the renderer (see CLAUDE.md, enforced by ESLint), so the value
 * lives in a small JSON file next to the app's user data and is read back over
 * IPC. See electron/ipc/theme.ts.
 */

export type ThemePreference = 'light' | 'dark';

export const DEFAULT_THEME: ThemePreference = 'light';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark';
}

/**
 * The opaque page ground for each theme, as an Electron `backgroundColor`.
 *
 * This is what prevents a flash of the wrong theme at launch. The renderer
 * cannot paint before its bundle loads, so whatever the window was created
 * with is what the user sees for those first frames — and the dark value here
 * matches both `--bg-page` in src/index.css and nimbus-atmosphere's DARK_THEME
 * night sky, so the window, the atmosphere and the page all resolve to one
 * colour. Keep the three in step.
 */
export const THEME_BACKGROUND: Record<ThemePreference, string> = {
  light: '#ffffff',
  dark: '#0b1220',
};
