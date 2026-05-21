import { contextBridge, ipcRenderer } from 'electron';
import type { DecryptResult, SaveTextRequest, SaveEncryptedRequest } from '../src/types/wallet';

contextBridge.exposeInMainWorld('electronAPI', {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    onMaximizeChange: (cb: (maximized: boolean) => void) =>
      ipcRenderer.on('window:maximized', (_e, v: boolean) => cb(v)),
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
