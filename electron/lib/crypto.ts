/**
 * Pure cryptographic primitives — no Electron imports so this module is
 * fully testable in a Node.js vitest environment.
 *
 * Ciphertext wire format: base64( IV[12] || encrypted_data || authTag[16] )
 */

import { createDecipheriv, createCipheriv, randomBytes } from 'crypto';
import { argon2id } from '@noble/hashes/argon2';
import { validateBundle } from '../../src/utils/schema';
import type {
  KdfParams,
  DecryptResult,
  DecryptedApiKey,
  DecryptedWallet,
  EncryptedApiKey,
  SaveEncryptedRequest,
  SaveTextRequest,
  WalletBundle,
} from '../../src/types/wallet';

const SUPPORTED_ALGORITHM = 'argon2id-aes256gcm';
const AES_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const MIN_CIPHERTEXT_BYTES = GCM_IV_BYTES + 1 + GCM_TAG_BYTES;
const API_KEY_AAD_PREFIX = 'apikey:';

/**
 * AAD for a wallet's private key in a v2 bundle: the lowercase address.
 */
export function privateKeyAad(address: string): Buffer {
  return Buffer.from(address.toLowerCase(), 'utf8');
}

/**
 * AAD for an entry in a wallet's `apiKeys` array: `"apikey:" + lowercase address`.
 * Deliberately different from the private key's AAD, so a ciphertext cannot be
 * moved from one field to the other even though both use the same derived key.
 * Used for every bundle version: apiKeys did not exist before this format.
 */
export function apiKeyAad(address: string): Buffer {
  return Buffer.from(API_KEY_AAD_PREFIX + address.toLowerCase(), 'utf8');
}

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

export function aesGcmEncrypt(key: Uint8Array, plaintext: string, aad?: Buffer): string {
  const iv = randomBytes(GCM_IV_BYTES);
  const keyBuf = Buffer.from(key);

  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
  if (aad) cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  keyBuf.fill(0);

  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

/** Blank every decrypted secret string we still reference. Strings cannot be
 *  zeroed in V8; this drops the references so nothing returns them. */
function blankDecrypted(wallets: DecryptedWallet[]): void {
  for (const r of wallets) {
    (r as unknown as Record<string, unknown>).privateKey = '';
    if (r.apiKeys) blankApiKeys(r.apiKeys);
  }
  wallets.length = 0;
}

function blankApiKeys(keys: DecryptedApiKey[]): void {
  for (const k of keys) {
    (k as unknown as Record<string, unknown>).apiKey = '';
  }
  keys.length = 0;
}

export type KeyDeriver = (password: string, saltBase64: string, kdf: KdfParams) => Uint8Array;

/**
 * Decrypt an already-validated bundle. Below the schema layer so tests can
 * exercise v2 semantics without paying for the 256 MiB v2 KDF floor.
 *
 * Fails closed: if ANY ciphertext (private key or API key) fails to
 * authenticate, nothing is returned and every secret decrypted so far is blanked.
 *
 * Derived keys are cached for the duration of this call, keyed by the salt
 * string and the kdf params. Some NimbusMint exporters (developer-keygen) use
 * ONE salt for every wallet in a bundle; each entry still has its own IV and
 * address-bound AAD. Without the cache a 100-wallet bundle at 256 MiB would run
 * 100 identical Argon2id derivations. Bundles with a distinct salt per wallet
 * (customer exports from the signer) derive once per wallet, exactly as before.
 * Every cached key is zeroed before this function returns, success or failure.
 *
 * `derive` is injectable for tests only.
 */
export function decryptValidatedBundle(
  bundle: WalletBundle,
  password: string,
  derive: KeyDeriver = deriveKey,
): DecryptResult {
  if (bundle.algorithm !== SUPPORTED_ALGORITHM) {
    return { ok: false, error: `Unsupported algorithm: ${bundle.algorithm}` };
  }

  const results: DecryptedWallet[] = [];
  const keyCache = new Map<string, Uint8Array>();
  const kdfId = `${bundle.kdf.algorithm}:${bundle.kdf.memory}:${bundle.kdf.iterations}:${bundle.kdf.parallelism}`;

  const keyFor = (saltBase64: string): Uint8Array => {
    const id = `${kdfId}|${saltBase64}`;
    let key = keyCache.get(id);
    if (!key) {
      key = derive(password, saltBase64, bundle.kdf);
      keyCache.set(id, key);
    }
    return key;
  };

  try {
    for (const wallet of bundle.wallets) {
      const apiKeys: DecryptedApiKey[] = [];
      try {
        // The same key covers the private key and every apiKeys entry (they
        // share the wallet's salt and the bundle kdf).
        const key = keyFor(wallet.salt);
        // v2 bundles (NimbusMint exports) encrypt the raw 32-byte secp256k1 scalar
        // with AAD = lowercase address. v1 bundles encrypt a UTF-8 hex string with no AAD.
        const isV2 = bundle.version === 2;
        const aad = isV2 ? privateKeyAad(wallet.address) : undefined;
        const privateKey = aesGcmDecrypt(key, wallet.ciphertext, aad, isV2 ? 'hex' : 'utf8');

        // API keys: UTF-8 plaintext, AAD = "apikey:" + lowercase address.
        for (const entry of wallet.apiKeys ?? []) {
          const apiKey = aesGcmDecrypt(key, entry.ciphertext, apiKeyAad(wallet.address), 'utf8');
          const out: DecryptedApiKey = { name: entry.name, apiKey };
          if (entry.expiresAt !== undefined) out.expiresAt = entry.expiresAt;
          apiKeys.push(out);
        }

        const decrypted: DecryptedWallet = {
          walletId: wallet.walletId,
          name: wallet.name,
          address: wallet.address,
          privateKey,
        };
        if (apiKeys.length > 0) decrypted.apiKeys = apiKeys;
        results.push(decrypted);
      } catch (err) {
        // Blank secrets already decrypted — can't zero strings but remove references
        blankApiKeys(apiKeys);
        blankDecrypted(results);
        return { ok: false, error: err instanceof Error ? err.message : 'Decryption failed' };
      }
    }

    return { ok: true, wallets: results };
  } finally {
    // Zero every derived key, on success and on failure.
    for (const key of keyCache.values()) key.fill(0);
    keyCache.clear();
  }
}

export async function decryptBundle(bundleJson: string, password: string): Promise<DecryptResult> {
  let bundle;
  try {
    const parsed = JSON.parse(bundleJson) as unknown;
    bundle = validateBundle(parsed);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid bundle format' };
  }

  return decryptValidatedBundle(bundle, password);
}

export function encryptBundle(req: SaveEncryptedRequest): string {
  const { wallets, password, kdf } = req;

  const encryptedWallets = wallets.map(w => {
    const salt = randomBytes(kdf.saltLen);
    const saltBase64 = salt.toString('base64');

    let key: Uint8Array | null = null;
    try {
      const walletKey = deriveKey(password, saltBase64, kdf);
      key = walletKey;
      const ciphertext = aesGcmEncrypt(walletKey, w.privateKey);
      const out: WalletBundle['wallets'][number] = {
        walletId: w.walletId,
        name: w.name,
        address: w.address,
        salt: saltBase64,
        ciphertext,
      };
      if (w.apiKeys && w.apiKeys.length > 0) {
        // Same derived key as the private key; fresh IV per entry (aesGcmEncrypt).
        out.apiKeys = w.apiKeys.map((k): EncryptedApiKey => {
          const entry: EncryptedApiKey = {
            name: k.name,
            ciphertext: aesGcmEncrypt(walletKey, k.apiKey, apiKeyAad(w.address)),
          };
          if (k.expiresAt !== undefined) entry.expiresAt = k.expiresAt;
          return entry;
        });
      }
      return out;
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

type TextExportWallet = SaveTextRequest['wallets'][number];

export function formatWalletsTxt(wallets: TextExportWallet[]): string {
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
    for (const k of w.apiKeys ?? []) {
      lines.push(`API Key (${k.name}): ${k.apiKey}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Escape the separators of the `api_keys` cell's inner `name=key;name=key` list. */
function escapeApiKeyPart(s: string): string {
  return s.replace(/[\\;=]/g, (c) => `\\${c}`);
}

/**
 * CSV export. The `api_keys` column is added only when at least one wallet
 * carries API keys, so an export of a bundle without them is byte-identical
 * to what this app produced before the column existed.
 *
 * `api_keys` cell: `name=key` pairs joined with `;`; a `\`, `;` or `=` inside a
 * name or key is backslash-escaped. The whole cell is then CSV-quoted.
 */
export function formatWalletsCsv(wallets: TextExportWallet[]): string {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const withApiKeys = wallets.some(w => (w.apiKeys?.length ?? 0) > 0);

  const rows = [withApiKeys ? '"Name","Address","Private Key","api_keys"' : '"Name","Address","Private Key"'];
  for (const w of wallets) {
    const cells = [escape(w.name), escape(w.address), escape(w.privateKey)];
    if (withApiKeys) {
      const joined = (w.apiKeys ?? [])
        .map(k => `${escapeApiKeyPart(k.name)}=${escapeApiKeyPart(k.apiKey)}`)
        .join(';');
      cells.push(escape(joined));
    }
    rows.push(cells.join(','));
  }
  return rows.join('\n');
}
