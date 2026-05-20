import type { WalletBundle, KdfParams, EncryptedWallet } from '../types/wallet';

// Memory floors per bundle version (values are in KiB, matching the kdf.memory field).
// v1 = legacy exports (64 MiB Argon2id was used at creation time; keep a low floor so
// existing user files can still be opened).
// v2 = hardened exports (256 MiB Argon2id); reject anything below this for new bundles.
const V1_MIN_MEMORY_KIB = 8192;    // 8 MiB  — preserve backward compat for old exports
const V2_MIN_MEMORY_KIB = 262144;  // 256 MiB — mandatory floor for v2+ bundles
const MIN_SALT_BYTES = 16;         // RFC 9106 §4 minimum

function assertString(val: unknown, field: string): string {
  if (typeof val !== 'string' || val.length === 0) {
    throw new Error(`Invalid bundle: "${field}" must be a non-empty string`);
  }
  return val;
}

function assertPositiveInt(val: unknown, field: string): number {
  if (typeof val !== 'number' || !Number.isInteger(val) || val < 1) {
    throw new Error(`Invalid bundle: "${field}" must be a positive integer`);
  }
  return val;
}

function validateKdf(kdf: unknown, version: 1 | 2): KdfParams {
  if (!kdf || typeof kdf !== 'object') {
    throw new Error('Invalid bundle: missing "kdf" object');
  }
  const k = kdf as Record<string, unknown>;

  if (k.algorithm !== 'argon2id') {
    throw new Error(`Unsupported KDF algorithm: "${k.algorithm}"`);
  }

  const memory = assertPositiveInt(k.memory, 'kdf.memory');
  const minMemory = version === 2 ? V2_MIN_MEMORY_KIB : V1_MIN_MEMORY_KIB;
  if (memory < minMemory) {
    if (version === 2) {
      throw new Error(
        `Invalid bundle: v2 bundles require kdf.memory >= ${V2_MIN_MEMORY_KIB} KiB (256 MiB); got ${memory} KiB`
      );
    }
    throw new Error(`Invalid bundle: kdf.memory must be at least ${V1_MIN_MEMORY_KIB} KiB`);
  }

  return {
    algorithm: 'argon2id',
    memory,
    iterations: assertPositiveInt(k.iterations, 'kdf.iterations'),
    parallelism: assertPositiveInt(k.parallelism, 'kdf.parallelism'),
    saltLen: assertPositiveInt(k.saltLen, 'kdf.saltLen'),
  };
}

function validateWallet(w: unknown, index: number): EncryptedWallet {
  if (!w || typeof w !== 'object') {
    throw new Error(`Invalid bundle: wallet[${index}] is not an object`);
  }
  const wallet = w as Record<string, unknown>;

  const walletId = assertString(wallet.walletId, `wallet[${index}].walletId`);
  const name = assertString(wallet.name, `wallet[${index}].name`);
  const address = assertString(wallet.address, `wallet[${index}].address`);
  const salt = assertString(wallet.salt, `wallet[${index}].salt`);
  const ciphertext = assertString(wallet.ciphertext, `wallet[${index}].ciphertext`);

  // Verify the salt decodes to at least MIN_SALT_BYTES.
  const saltRaw = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
  if (saltRaw.length < MIN_SALT_BYTES) {
    throw new Error(
      `Invalid bundle: wallet[${index}].salt must be at least ${MIN_SALT_BYTES} bytes (got ${saltRaw.length})`
    );
  }

  // Sanity-check base64 payload is large enough for IV(12) + 1 byte + authTag(16)
  const raw = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  if (raw.length < 29) {
    throw new Error(`Invalid bundle: wallet[${index}].ciphertext is too short`);
  }

  return { walletId, name, address, salt, ciphertext };
}

export function validateBundle(obj: unknown): WalletBundle {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Invalid bundle: expected a JSON object');
  }
  const b = obj as Record<string, unknown>;

  if (b.version !== 1 && b.version !== 2) {
    throw new Error(`Unsupported bundle version: ${b.version}`);
  }
  const version = b.version as 1 | 2;

  if (b.algorithm !== 'argon2id-aes256gcm') {
    throw new Error(`Unsupported algorithm: "${b.algorithm}"`);
  }

  assertString(b.createdAt, 'createdAt');

  const walletCount = assertPositiveInt(b.walletCount, 'walletCount');
  const kdf = validateKdf(b.kdf, version);

  if (!Array.isArray(b.wallets)) {
    throw new Error('Invalid bundle: "wallets" must be an array');
  }
  if (b.wallets.length !== walletCount) {
    throw new Error(
      `Invalid bundle: walletCount (${walletCount}) does not match wallets.length (${b.wallets.length})`
    );
  }
  if (walletCount > 500) {
    throw new Error('Invalid bundle: walletCount exceeds maximum of 500');
  }

  const wallets = b.wallets.map((w, i) => validateWallet(w, i));

  return {
    version,
    algorithm: 'argon2id-aes256gcm',
    createdAt: b.createdAt as string,
    walletCount,
    kdf,
    wallets,
  };
}

/** Returns true when a bundle was created with legacy (v1) parameters.
 *  Callers should surface a visible warning prompting the user to re-export. */
export function isLegacyBundle(bundle: WalletBundle): boolean {
  return bundle.version === 1;
}
