import { ipcMain, nativeTheme, app, BrowserWindow } from 'electron';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import {
  DEFAULT_THEME,
  isThemePreference,
  THEME_BACKGROUND,
  type ThemePreference,
} from '../../src/types/theme';

/**
 * Persistence for the light/dark preference.
 *
 * The file holds nothing but the theme name. Wallet data, passwords and
 * bundles never reach it — the app writes secrets only where the user points a
 * save dialog (see fileio.ts).
 */
function preferencesPath(): string {
  return path.join(app.getPath('userData'), 'preferences.json');
}

/**
 * The theme to start in: the stored choice, or the OS setting the first time
 * the app runs. Must be called after `app.whenReady()` — `getPath` needs it.
 */
export function readTheme(): ThemePreference {
  try {
    const parsed = JSON.parse(readFileSync(preferencesPath(), 'utf8')) as { theme?: unknown };
    if (isThemePreference(parsed.theme)) return parsed.theme;
  } catch {
    // No file yet, or it is unreadable/corrupt. Either way, fall through to
    // the OS preference rather than failing a launch over a cosmetic setting.
  }
  return nativeTheme.shouldUseDarkColors ? 'dark' : DEFAULT_THEME;
}

function writeTheme(theme: ThemePreference): void {
  try {
    writeFileSync(preferencesPath(), JSON.stringify({ theme }), { encoding: 'utf8' });
  } catch {
    // Read-only or full disk. The preference still applies for this session;
    // it simply will not survive a restart.
  }
}

export function registerThemeHandlers(getWindow: () => BrowserWindow | null): void {
  // Put the native chrome in the app's theme from the start, not just from the
  // first toggle — otherwise a stored 'light' preference on a dark desktop
  // opens dark file dialogs in front of a light app.
  nativeTheme.themeSource = readTheme();

  /*
   * Synchronous on purpose, and the only sendSync channel in the app.
   *
   * The renderer reads this in its first render pass, before React paints
   * anything, so an async round-trip would mean rendering the app light and
   * then flipping it — exactly the flash nimbus-fe's inline boot script exists
   * to prevent. The handler does a single small file read; there is no
   * meaningful block.
   */
  ipcMain.on('theme:get-sync', (event) => {
    event.returnValue = readTheme();
  });

  ipcMain.handle('theme:set', (_event, theme: unknown): void => {
    if (!isThemePreference(theme)) return;
    writeTheme(theme);
    // Native chrome the renderer cannot style: the file dialogs, and the
    // window's own ground behind the page during a resize.
    nativeTheme.themeSource = theme;
    getWindow()?.setBackgroundColor(THEME_BACKGROUND[theme]);
  });
}
