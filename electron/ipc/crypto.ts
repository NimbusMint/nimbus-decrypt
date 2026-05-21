import { ipcMain } from 'electron';
import { Worker } from 'worker_threads';
import path from 'path';
import { encryptBundle } from '../lib/crypto';
import type { DecryptResult, SaveEncryptedRequest } from '../../src/types/wallet';

function runDecryptInWorker(bundleJson: string, password: string): Promise<DecryptResult> {
  return new Promise<DecryptResult>((resolve) => {
    const worker = new Worker(path.join(__dirname, 'crypto.worker.js'), {
      workerData: { bundleJson, password },
    });
    worker.once('message', (result: DecryptResult) => resolve(result));
    worker.once('error', (err) => resolve({ ok: false, error: err.message }));
    worker.once('exit', (code) => {
      if (code !== 0) resolve({ ok: false, error: `Crypto worker exited with code ${code}` });
    });
  });
}

export function registerCryptoHandlers(): void {
  ipcMain.handle(
    'decrypt:wallets',
    (_event, bundleJson: string, password: string): Promise<DecryptResult> =>
      runDecryptInWorker(bundleJson, password)
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
