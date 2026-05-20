import { contextBridge, ipcRenderer } from 'electron';
import type { DecryptResult, SaveTextRequest, SaveEncryptedRequest } from '../src/types/wallet';

contextBridge.exposeInMainWorld('electronAPI', {
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
