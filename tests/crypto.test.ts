import { describe, it, expect } from 'vitest';
import { createCipheriv, randomBytes } from 'crypto';
import { argon2id } from '@noble/hashes/argon2';
import {
  deriveKey,
  aesGcmDecrypt,
  aesGcmEncrypt,
  decryptBundle,
} from '../electron/lib/crypto';
import type { WalletBundle } from '../src/types/wallet';

// ── Test helpers ─────────────────────────────────────────────────────────────

/** Build an encrypted test bundle with minimal KDF params for speed. */
function makeTestBundle(password: string, privateKeys: string[]): WalletBundle {
  const kdf = { algorithm: 'argon2id' as const, memory: 8192, iterations: 1, parallelism: 1, saltLen: 16 };

  const wallets = privateKeys.map((pk, i) => {
    const salt = randomBytes(kdf.saltLen);
    const saltB64 = salt.toString('base64');
    const iv = randomBytes(12);

    const pwd = new TextEncoder().encode(password);
    const key = argon2id(pwd, salt, { t: kdf.iterations, m: kdf.memory, p: kdf.parallelism, dkLen: 32 });
    pwd.fill(0);

    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), iv);
    const encrypted = Buffer.concat([cipher.update(pk, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const ciphertext = Buffer.concat([iv, encrypted, authTag]).toString('base64');

    key.fill(0);

    return {
      walletId: `wallet-${i}`,
      name: `Wallet ${i}`,
      address: `0x${i.toString().padStart(40, '0')}`,
      salt: saltB64,
      ciphertext,
    };
  });

  return {
    version: 1,
    algorithm: 'argon2id-aes256gcm',
    createdAt: new Date().toISOString(),
    walletCount: wallets.length,
    kdf,
    wallets,
  };
}

// ── deriveKey ─────────────────────────────────────────────────────────────────

describe('deriveKey', () => {
  it('produces a 32-byte key', () => {
    const kdf = { algorithm: 'argon2id' as const, memory: 8192, iterations: 1, parallelism: 1, saltLen: 16 };
    const salt = randomBytes(16).toString('base64');
    const key = deriveKey('test-password', salt, kdf);
    expect(key.length).toBe(32);
  });

  it('is deterministic for the same inputs', () => {
    const kdf = { algorithm: 'argon2id' as const, memory: 8192, iterations: 1, parallelism: 1, saltLen: 16 };
    const salt = randomBytes(16).toString('base64');
    const key1 = deriveKey('my-secret', salt, kdf);
    const key2 = deriveKey('my-secret', salt, kdf);
    expect(Buffer.compare(Buffer.from(key1), Buffer.from(key2))).toBe(0);
  });

  it('differs for different passwords', () => {
    const kdf = { algorithm: 'argon2id' as const, memory: 8192, iterations: 1, parallelism: 1, saltLen: 16 };
    const salt = randomBytes(16).toString('base64');
    const key1 = deriveKey('password-a', salt, kdf);
    const key2 = deriveKey('password-b', salt, kdf);
    expect(Buffer.compare(Buffer.from(key1), Buffer.from(key2))).not.toBe(0);
  });

  it('differs for different salts', () => {
    const kdf = { algorithm: 'argon2id' as const, memory: 8192, iterations: 1, parallelism: 1, saltLen: 16 };
    const key1 = deriveKey('same-password', randomBytes(16).toString('base64'), kdf);
    const key2 = deriveKey('same-password', randomBytes(16).toString('base64'), kdf);
    expect(Buffer.compare(Buffer.from(key1), Buffer.from(key2))).not.toBe(0);
  });
});

// ── AES-GCM round-trip ────────────────────────────────────────────────────────

describe('aesGcmDecrypt', () => {
  it('decrypts what aesGcmEncrypt produced', () => {
    const key = new Uint8Array(32).fill(0xab);
    const plaintext = '0x' + 'f'.repeat(64);
    const ct = aesGcmEncrypt(key, plaintext);
    const recovered = aesGcmDecrypt(key, ct);
    expect(recovered).toBe(plaintext);
  });

  it('throws on wrong key', () => {
    const key1 = new Uint8Array(32).fill(0x11);
    const key2 = new Uint8Array(32).fill(0x22);
    const ct = aesGcmEncrypt(key1, 'secret');
    expect(() => aesGcmDecrypt(key2, ct)).toThrow();
  });

  it('throws on corrupted ciphertext (flipped byte)', () => {
    const key = new Uint8Array(32).fill(0xcc);
    const ct = aesGcmEncrypt(key, 'my-private-key');
    const raw = Buffer.from(ct, 'base64');
    // Flip a byte in the encrypted payload (after IV, before auth tag)
    raw[12] ^= 0xff;
    const corrupted = raw.toString('base64');
    expect(() => aesGcmDecrypt(key, corrupted)).toThrow();
  });

  it('throws on truncated ciphertext', () => {
    const key = new Uint8Array(32).fill(0xdd);
    expect(() => aesGcmDecrypt(key, Buffer.alloc(20).toString('base64'))).toThrow();
  });

  it('throws on empty ciphertext', () => {
    const key = new Uint8Array(32).fill(0x00);
    expect(() => aesGcmDecrypt(key, '')).toThrow();
  });
});

// ── decryptBundle ─────────────────────────────────────────────────────────────

describe('decryptBundle', () => {
  it('decrypts a single wallet with the correct password', async () => {
    const pk = '0x' + 'a'.repeat(64);
    const bundle = makeTestBundle('correct-password', [pk]);
    const result = await decryptBundle(JSON.stringify(bundle), 'correct-password');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.wallets).toHaveLength(1);
    expect(result.wallets[0].privateKey).toBe(pk);
    expect(result.wallets[0].name).toBe('Wallet 0');
  });

  it('decrypts multiple wallets', async () => {
    const pks = ['0x' + 'a'.repeat(64), '0x' + 'b'.repeat(64)];
    const bundle = makeTestBundle('multi-pass', pks);
    const result = await decryptBundle(JSON.stringify(bundle), 'multi-pass');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.wallets).toHaveLength(2);
    expect(result.wallets.map(w => w.privateKey)).toEqual(pks);
  });

  it('returns an error for wrong password', async () => {
    const bundle = makeTestBundle('correct', ['0x' + 'c'.repeat(64)]);
    const result = await decryptBundle(JSON.stringify(bundle), 'wrong');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it('returns an error for malformed JSON', async () => {
    const result = await decryptBundle('not json {{{', 'any');
    expect(result.ok).toBe(false);
  });

  it('returns an error for empty JSON string', async () => {
    const result = await decryptBundle('', 'any');
    expect(result.ok).toBe(false);
  });

  it('returns an error when bundle has no wallets array', async () => {
    const bad = JSON.stringify({ version: 1, algorithm: 'argon2id-aes256gcm', walletCount: 0 });
    const result = await decryptBundle(bad, 'any');
    expect(result.ok).toBe(false);
  });

  it('returns an error for corrupted ciphertext', async () => {
    const bundle = makeTestBundle('pass', ['0xdeadbeef']);
    // Corrupt the first wallet's ciphertext
    bundle.wallets[0].ciphertext = Buffer.alloc(50, 0).toString('base64');
    const result = await decryptBundle(JSON.stringify(bundle), 'pass');
    expect(result.ok).toBe(false);
  });

  it('returns an error for unsupported algorithm', async () => {
    const bundle = makeTestBundle('pass', ['0x1234']);
    // @ts-expect-error intentional mutation
    bundle.algorithm = 'aes256-only';
    const result = await decryptBundle(JSON.stringify(bundle), 'pass');
    expect(result.ok).toBe(false);
  });
});
