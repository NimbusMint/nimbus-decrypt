import { ipcMain } from 'electron';
import { decryptBundle, encryptBundle } from '../lib/crypto';
import type { DecryptResult, SaveEncryptedRequest } from '../../src/types/wallet';

export function registerCryptoHandlers(): void {
  ipcMain.handle(
    'decrypt:wallets',
    async (_event, bundleJson: string, password: string): Promise<DecryptResult> => {
      return decryptBundle(bundleJson, password);
    }
  );

  ipcMain.handle(
    'file:encrypt-bundle',
    async (_event, req: SaveEncryptedRequest): Promise<{ ok: boolean; bundle?: string; error?: string }> => {
      try {
        const bundle = encryptBundle(req);
        return { ok: true, bundle };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Encryption failed' };
      }
    }
  );
}
