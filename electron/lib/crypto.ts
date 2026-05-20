/**
 * Pure cryptographic primitives — no Electron imports so this module is
 * fully testable in a Node.js vitest environment.
 *
 * Ciphertext wire format: base64( IV[12] || encrypted_data || authTag[16] )
 */

import { createDecipheriv, createCipheriv, randomBytes } from 'crypto';
import { argon2id } from '@noble/hashes/argon2';
import { validateBundle } from '../../src/utils/schema';
import type { KdfParams, DecryptResult, DecryptedWallet, SaveEncryptedRequest, WalletBundle } from '../../src/types/wallet';

const SUPPORTED_ALGORITHM = 'argon2id-aes256gcm';
const AES_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const MIN_CIPHERTEXT_BYTES = GCM_IV_BYTES + 1 + GCM_TAG_BYTES;

export function deriveKey(
  password: string,
  saltBase64: string,
  kdf: KdfParams
): Uint8Array {
  const salt = Buffer.from(saltBase64, 'base64');
  const pwd = new TextEncoder().encode(password);

  const key = argon2id(pwd, salt, {
    t: kdf.iterations,
    m: kdf.memory,
    p: kdf.parallelism,
    dkLen: AES_KEY_BYTES,
  });

  // Zero password bytes — key derivation is the only consumer
  pwd.fill(0);
  return key;
}

export function aesGcmDecrypt(
  key: Uint8Array,
  ciphertextBase64: string,
  aad?: Buffer,
  encoding: BufferEncoding = 'utf8',
): string {
  const raw = Buffer.from(ciphertextBase64, 'base64');

  if (raw.length < MIN_CIPHERTEXT_BYTES) {
    throw new Error('Ciphertext is too short to be valid');
  }

  const iv = raw.subarray(0, GCM_IV_BYTES);
  const authTag = raw.subarray(raw.length - GCM_TAG_BYTES);
  const encrypted = raw.subarray(GCM_IV_BYTES, raw.length - GCM_TAG_BYTES);

  const keyBuf = Buffer.from(key);
  let plaintext: Buffer;

  try {
    const decipher = createDecipheriv('aes-256-gcm', keyBuf, iv);
    decipher.setAuthTag(authTag);
    if (aad) decipher.setAAD(aad);
    plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    keyBuf.fill(0);
    throw new Error('Decryption failed: incorrect password or corrupted data');
  } finally {
    keyBuf.fill(0);
  }

  const result = plaintext.toString(encoding);
  plaintext.fill(0);
  return result;
}

export function aesGcmEncrypt(key: Uint8Array, plaintext: string): string {
  const iv = randomBytes(GCM_IV_BYTES);
  const keyBuf = Buffer.from(key);

  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  keyBuf.fill(0);

  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

export async function decryptBundle(bundleJson: string, password: string): Promise<DecryptResult> {
  let bundle;
  try {
    const parsed = JSON.parse(bundleJson) as unknown;
    bundle = validateBundle(parsed);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid bundle format' };
  }

  if (bundle.algorithm !== SUPPORTED_ALGORITHM) {
    return { ok: false, error: `Unsupported algorithm: ${bundle.algorithm}` };
  }

  const results: DecryptedWallet[] = [];

  for (const wallet of bundle.wallets) {
    let key: Uint8Array | null = null;
    try {
      key = deriveKey(password, wallet.salt, bundle.kdf);
      // v2 bundles (NimbusMint exports) encrypt the raw 32-byte secp256k1 scalar
      // with AAD = lowercase address. v1 bundles encrypt a UTF-8 hex string with no AAD.
      const isV2 = bundle.version === 2;
      const aad = isV2 ? Buffer.from(wallet.address.toLowerCase()) : undefined;
      const privateKey = aesGcmDecrypt(key, wallet.ciphertext, aad, isV2 ? 'hex' : 'utf8');
      results.push({ walletId: wallet.walletId, name: wallet.name, address: wallet.address, privateKey });
    } catch (err) {
      // Clear any keys already derived
      if (key) key.fill(0);
      // Blank private keys already pushed — can't zero strings but remove references
      for (const r of results) {
        (r as unknown as Record<string, unknown>).privateKey = '';
      }
      results.length = 0;
      return { ok: false, error: err instanceof Error ? err.message : 'Decryption failed' };
    } finally {
      if (key) key.fill(0);
    }
  }

  return { ok: true, wallets: results };
}

export function encryptBundle(req: SaveEncryptedRequest): string {
  const { wallets, password, kdf } = req;

  const encryptedWallets = wallets.map(w => {
    const salt = randomBytes(kdf.saltLen);
    const saltBase64 = salt.toString('base64');

    let key: Uint8Array | null = null;
    try {
      key = deriveKey(password, saltBase64, kdf);
      const ciphertext = aesGcmEncrypt(key, w.privateKey);
      return {
        walletId: w.walletId,
        name: w.name,
        address: w.address,
        salt: saltBase64,
        ciphertext,
      };
    } finally {
      if (key) key.fill(0);
    }
  });

  const bundle: WalletBundle = {
    version: 1,
    algorithm: 'argon2id-aes256gcm',
    createdAt: new Date().toISOString(),
    walletCount: encryptedWallets.length,
    kdf,
    wallets: encryptedWallets,
  };

  return JSON.stringify(bundle, null, 2);
}

export function formatWalletsTxt(
  wallets: Array<{ name: string; address: string; privateKey: string }>
): string {
  const lines = [
    '# NimbusMint Wallet Export — KEEP THIS FILE SECURE',
    `# Exported: ${new Date().toISOString()}`,
    `# Wallets: ${wallets.length}`,
    '#',
    '# WARNING: Anyone with these private keys can drain your wallets.',
    '# Never share this file. Delete it securely when no longer needed.',
    '',
  ];

  for (const w of wallets) {
    lines.push(`Name:        ${w.name}`);
    lines.push(`Address:     ${w.address}`);
    lines.push(`Private Key: ${w.privateKey}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatWalletsCsv(
  wallets: Array<{ name: string; address: string; privateKey: string }>
): string {
  const rows = ['"Name","Address","Private Key"'];
  for (const w of wallets) {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    rows.push([escape(w.name), escape(w.address), escape(w.privateKey)].join(','));
  }
  return rows.join('\n');
}
