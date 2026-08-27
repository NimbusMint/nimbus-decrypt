import { contextBridge, ipcRenderer } from 'electron';
import type { DecryptResult, SaveTextRequest, SaveEncryptedRequest } from '../src/types/wallet';
import type { ThemePreference } from '../src/types/theme';

contextBridge.exposeInMainWorld('electronAPI', {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    onMaximizeChange: (cb: (maximized: boolean) => void) =>
      ipcRenderer.on('window:maximized', (_e, v: boolean) => cb(v)),
  },

  theme: {
    // Synchronous: the renderer needs this before its first paint. See the
    // 'theme:get-sync' handler in electron/ipc/theme.ts.
    initial: (): ThemePreference => ipcRenderer.sendSync('theme:get-sync'),
    set: (theme: ThemePreference): Promise<void> => ipcRenderer.invoke('theme:set', theme),
  },

  decrypt: {
    wallets: (bundleJson: string, password: string): Promise<DecryptResult> =>
      ipcRenderer.invoke('decrypt:wallets', bundleJson, password),
  },

  file: {
    openBundle: (): Promise<{ content: string; name: string } | null> =>
      ipcRenderer.invoke('file:open-bundle'),

    saveText: (req: SaveTextRequest): Promise<boolean> =>
      ipcRenderer.invoke('file:save-text', req),

    saveEncrypted: (req: SaveEncryptedRequest): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('file:save-encrypted', req),
  },
});
