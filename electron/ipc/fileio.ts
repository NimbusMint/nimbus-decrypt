import { ipcMain, dialog, BrowserWindow } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { formatWalletsTxt, formatWalletsCsv, encryptBundle } from '../lib/crypto';
import type { SaveTextRequest, SaveEncryptedRequest } from '../../src/types/wallet';

export function registerFileHandlers(): void {
  ipcMain.handle('file:open-bundle', async (): Promise<{ content: string; name: string } | null> => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win ?? new BrowserWindow(), {
      title: 'Open NimbusMint Wallet Bundle',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const content = await readFile(filePath, { encoding: 'utf8' });
    return { content, name: path.basename(filePath) };
  });

  ipcMain.handle('file:save-text', async (_event, req: SaveTextRequest): Promise<boolean> => {
    const win = BrowserWindow.getFocusedWindow();

    const isCSV = req.format === 'csv';
    const result = await dialog.showSaveDialog(win ?? new BrowserWindow(), {
      title: 'Save Wallet Export',
      defaultPath: isCSV ? 'wallets-export.csv' : 'wallets-export.txt',
      filters: isCSV
        ? [{ name: 'CSV Files', extensions: ['csv'] }]
        : [{ name: 'Text Files', extensions: ['txt'] }],
    });

    if (result.canceled || !result.filePath) return false;

    const content = isCSV
      ? formatWalletsCsv(req.wallets)
      : formatWalletsTxt(req.wallets);

    await writeFile(result.filePath, content, { encoding: 'utf8' });
    return true;
  });

  ipcMain.handle(
    'file:save-encrypted',
    async (_event, req: SaveEncryptedRequest): Promise<{ ok: boolean; error?: string }> => {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showSaveDialog(win ?? new BrowserWindow(), {
        title: 'Save Encrypted Wallet Bundle',
        defaultPath: 'wallets-encrypted.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePath) return { ok: false };

      try {
        const bundle = encryptBundle(req);
        await writeFile(result.filePath, bundle, { encoding: 'utf8' });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Save failed' };
      }
    }
  );
}
