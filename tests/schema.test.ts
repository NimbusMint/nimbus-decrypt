import { describe, it, expect } from 'vitest';
import { validateBundle, isLegacyBundle } from '../src/utils/schema';

const VALID_BUNDLE = {
  version: 1,
  algorithm: 'argon2id-aes256gcm',
  createdAt: '2024-01-01T00:00:00.000Z',
  walletCount: 1,
  kdf: {
    algorithm: 'argon2id',
    memory: 65536,
    iterations: 3,
    parallelism: 2,
    saltLen: 16,
  },
  wallets: [
    {
      walletId: 'abc-123',
      name: 'Main',
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      salt: Buffer.alloc(16).toString('base64'),
      // Minimal valid ciphertext: IV(12) + 1 data byte + tag(16) = 29 bytes
      ciphertext: Buffer.alloc(29).toString('base64'),
    },
  ],
};

describe('validateBundle', () => {
  it('accepts a valid bundle', () => {
    const result = validateBundle(VALID_BUNDLE);
    expect(result.version).toBe(1);
    expect(result.wallets).toHaveLength(1);
  });

  it('rejects null', () => {
    expect(() => validateBundle(null)).toThrow();
  });

  it('rejects a string', () => {
    expect(() => validateBundle('not an object')).toThrow();
  });

  it('rejects unsupported version', () => {
    expect(() => validateBundle({ ...VALID_BUNDLE, version: 99 })).toThrow(/version/i);
  });

  it('accepts version 2 with sufficient memory', () => {
    const v2 = { ...VALID_BUNDLE, version: 2, kdf: { ...VALID_BUNDLE.kdf, memory: 262144 } };
    const result = validateBundle(v2);
    expect(result.version).toBe(2);
    expect(isLegacyBundle(result)).toBe(false);
  });

  it('rejects version 2 with insufficient memory (below 256 MiB)', () => {
    const v2 = { ...VALID_BUNDLE, version: 2, kdf: { ...VALID_BUNDLE.kdf, memory: 65536 } };
    expect(() => validateBundle(v2)).toThrow(/262144|256 MiB/i);
  });

  it('flags version 1 bundles as legacy', () => {
    const result = validateBundle(VALID_BUNDLE);
    expect(isLegacyBundle(result)).toBe(true);
  });

  it('rejects unknown algorithm', () => {
    expect(() => validateBundle({ ...VALID_BUNDLE, algorithm: 'chacha20' })).toThrow(/algorithm/i);
  });

  it('rejects non-array wallets', () => {
    expect(() => validateBundle({ ...VALID_BUNDLE, wallets: {} })).toThrow(/wallets/i);
  });

  it('rejects wallets length mismatch', () => {
    expect(() => validateBundle({ ...VALID_BUNDLE, walletCount: 5 })).toThrow(/walletCount/);
  });

  it('rejects missing KDF', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { kdf: _kdf, ...noBkdf } = VALID_BUNDLE;
    expect(() => validateBundle(noBkdf)).toThrow(/kdf/i);
  });

  it('rejects unsupported KDF algorithm', () => {
    expect(() =>
      validateBundle({ ...VALID_BUNDLE, kdf: { ...VALID_BUNDLE.kdf, algorithm: 'bcrypt' } })
    ).toThrow(/unsupported kdf algorithm/i);
  });

  it('rejects kdf.memory below minimum (v1 floor = 8192 KiB)', () => {
    expect(() =>
      validateBundle({ ...VALID_BUNDLE, kdf: { ...VALID_BUNDLE.kdf, memory: 1024 } })
    ).toThrow(/8192/);
  });

  it('rejects short salt (< 16 bytes)', () => {
    // 8-byte salt → base64 = 12 chars of real data
    const shortSalt = Buffer.alloc(8).toString('base64');
    const bad = { ...VALID_BUNDLE, wallets: [{ ...VALID_BUNDLE.wallets[0], salt: shortSalt }] };
    expect(() => validateBundle(bad)).toThrow(/salt.*16|16.*bytes/i);
  });

  it('rejects kdf.iterations < 1', () => {
    expect(() =>
      validateBundle({ ...VALID_BUNDLE, kdf: { ...VALID_BUNDLE.kdf, iterations: 0 } })
    ).toThrow(/iterations/i);
  });

  it('rejects missing walletId', () => {
    const bad = { ...VALID_BUNDLE, wallets: [{ ...VALID_BUNDLE.wallets[0], walletId: '' }] };
    expect(() => validateBundle(bad)).toThrow(/walletId/);
  });

  it('rejects ciphertext that is too short', () => {
    const bad = {
      ...VALID_BUNDLE,
      wallets: [{ ...VALID_BUNDLE.wallets[0], ciphertext: Buffer.alloc(5).toString('base64') }],
    };
    expect(() => validateBundle(bad)).toThrow(/too short/i);
  });

  it('rejects walletCount > 500', () => {
    expect(() =>
      validateBundle({ ...VALID_BUNDLE, walletCount: 501, wallets: Array(501).fill(VALID_BUNDLE.wallets[0]) })
    ).toThrow(/500/);
  });
});
