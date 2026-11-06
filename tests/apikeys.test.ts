import { describe, it, expect } from 'vitest';
import { createCipheriv, randomBytes } from 'crypto';
import { argon2id } from '@noble/hashes/argon2';
import {
  aesGcmDecrypt,
  decryptBundle,
  decryptValidatedBundle,
  deriveKey,
  encryptBundle,
  formatWalletsCsv,
  formatWalletsTxt,
} from '../electron/lib/crypto';
import { validateBundle } from '../src/utils/schema';
import type { KdfParams, WalletBundle } from '../src/types/wallet';

// ── Fixture construction (independent of the app's own encrypt path) ───────
//
// v2 bundles must carry kdf.memory >= 256 MiB to pass the schema, which is far
// too slow for a unit test in pure-JS argon2id. The v2 tests therefore build a
// WalletBundle object directly and call decryptValidatedBundle (below the
// schema layer) with reduced memory. The schema itself is tested separately,
// and one full JSON path test uses a v1 bundle at the v1 floor.

const FAST_KDF: KdfParams = { algorithm: 'argon2id', memory: 8192, iterations: 1, parallelism: 1, saltLen: 16 };

function kdfKey(password: string, salt: Buffer, kdf: KdfParams): Buffer {
  const k = argon2id(new TextEncoder().encode(password), salt, {
    t: kdf.iterations,
    m: kdf.memory,
    p: kdf.parallelism,
    dkLen: 32,
  });
  return Buffer.from(k);
}

function seal(key: Buffer, plaintext: Buffer, aad?: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  if (aad) c.setAAD(aad);
  const enc = Buffer.concat([c.update(plaintext), c.final()]);
  return Buffer.concat([iv, enc, c.getAuthTag()]).toString('base64');
}

const ADDR = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01';
const PK_HEX = 'a1'.repeat(32);

interface FixtureApiKey { name: string; apiKey: string; expiresAt?: string }

function makeV2Bundle(
  password: string,
  wallets: Array<{ address: string; pkHex: string; apiKeys?: FixtureApiKey[]; salt?: Buffer }>,
): WalletBundle {
  const encWallets = wallets.map((w, i) => {
    const salt = w.salt ?? randomBytes(FAST_KDF.saltLen);
    const key = kdfKey(password, salt, FAST_KDF);
    const out: WalletBundle['wallets'][number] = {
      walletId: `w-${i}`,
      name: `Wallet ${i}`,
      address: w.address,
      salt: salt.toString('base64'),
      // NimbusMint v2: raw 32-byte scalar, AAD = lowercase address
      ciphertext: seal(key, Buffer.from(w.pkHex, 'hex'), Buffer.from(w.address.toLowerCase())),
    };
    if (w.apiKeys) {
      out.apiKeys = w.apiKeys.map(k => ({
        name: k.name,
        ...(k.expiresAt !== undefined ? { expiresAt: k.expiresAt } : {}),
        ciphertext: seal(key, Buffer.from(k.apiKey, 'utf8'), Buffer.from('apikey:' + w.address.toLowerCase())),
      }));
    }
    key.fill(0);
    return out;
  });
  return {
    version: 2,
    algorithm: 'argon2id-aes256gcm',
    createdAt: '2026-11-06T00:00:00Z',
    walletCount: encWallets.length,
    kdf: FAST_KDF,
    wallets: encWallets,
  };
}

// ── Decryption ───────────────────────────────────────────────────────────────

describe('apiKeys decryption (v2 semantics, below the schema layer)', () => {
  it('round-trips the private key and every API key with one derived key', () => {
    const bundle = makeV2Bundle('pw-1', [{
      address: ADDR,
      pkHex: PK_HEX,
      apiKeys: [
        { name: 'OpenSea', apiKey: 'os_live_0123456789abcdef', expiresAt: '2027-01-01T00:00:00Z' },
        { name: 'second', apiKey: 'ünïcødé-key ✓' },
      ],
    }]);
    const res = decryptValidatedBundle(bundle, 'pw-1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.wallets[0].privateKey).toBe(PK_HEX);
    expect(res.wallets[0].apiKeys).toEqual([
      { name: 'OpenSea', expiresAt: '2027-01-01T00:00:00Z', apiKey: 'os_live_0123456789abcdef' },
      { name: 'second', apiKey: 'ünïcødé-key ✓' },
    ]);
  });

  it('rejects a wrong password for a wallet with API keys', () => {
    const bundle = makeV2Bundle('right', [{ address: ADDR, pkHex: PK_HEX, apiKeys: [{ name: 'a', apiKey: 'k' }] }]);
    const res = decryptValidatedBundle(bundle, 'wrong');
    expect(res.ok).toBe(false);
  });

  it('a bundle without apiKeys decrypts exactly as before (no apiKeys property)', () => {
    const bundle = makeV2Bundle('pw', [{ address: ADDR, pkHex: PK_HEX }]);
    const res = decryptValidatedBundle(bundle, 'pw');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.wallets[0]).toEqual({ walletId: 'w-0', name: 'Wallet 0', address: ADDR, privateKey: PK_HEX });
    expect('apiKeys' in res.wallets[0]).toBe(false);
  });

  it('an empty apiKeys array behaves like an absent one', () => {
    const bundle = makeV2Bundle('pw', [{ address: ADDR, pkHex: PK_HEX, apiKeys: [] }]);
    const res = decryptValidatedBundle(bundle, 'pw');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect('apiKeys' in res.wallets[0]).toBe(false);
  });
});

describe('apiKeys AAD separation', () => {
  it('rejects the private-key ciphertext moved into apiKeys', () => {
    const bundle = makeV2Bundle('pw', [{ address: ADDR, pkHex: PK_HEX }]);
    bundle.wallets[0].apiKeys = [{ name: 'moved', ciphertext: bundle.wallets[0].ciphertext }];
    const res = decryptValidatedBundle(bundle, 'pw');
    expect(res.ok).toBe(false);
  });

  it('rejects an API-key ciphertext moved into the private-key field', () => {
    const bundle = makeV2Bundle('pw', [{ address: ADDR, pkHex: PK_HEX, apiKeys: [{ name: 'a', apiKey: 'b'.repeat(32) }] }]);
    bundle.wallets[0].ciphertext = bundle.wallets[0].apiKeys![0].ciphertext;
    const res = decryptValidatedBundle(bundle, 'pw');
    expect(res.ok).toBe(false);
  });

  it('rejects an API key sealed with the private-key AAD (bare address)', () => {
    const salt = randomBytes(16);
    const bundle = makeV2Bundle('pw', [{ address: ADDR, pkHex: PK_HEX, salt }]);
    const key = kdfKey('pw', salt, FAST_KDF);
    bundle.wallets[0].apiKeys = [{ name: 'x', ciphertext: seal(key, Buffer.from('k'), Buffer.from(ADDR.toLowerCase())) }];
    expect(decryptValidatedBundle(bundle, 'pw').ok).toBe(false);
  });

  it('rejects an API key moved to another wallet, even when the derived key is identical', () => {
    // Same salt => same derived key; only the AAD (the address) differs.
    const salt = randomBytes(16);
    const other = '0x' + '22'.repeat(20);
    const bundle = makeV2Bundle('pw', [
      { address: ADDR, pkHex: PK_HEX, salt, apiKeys: [{ name: 'a', apiKey: 'secret-a' }] },
      { address: other, pkHex: 'b2'.repeat(32), salt },
    ]);
    bundle.wallets[1].apiKeys = bundle.wallets[0].apiKeys;
    const res = decryptValidatedBundle(bundle, 'pw');
    expect(res.ok).toBe(false);
  });

  it('a failing API key fails the whole decrypt and returns no secrets', () => {
    const bundle = makeV2Bundle('pw', [
      { address: ADDR, pkHex: PK_HEX, apiKeys: [{ name: 'ok', apiKey: 'fine' }] },
      { address: '0x' + '33'.repeat(20), pkHex: 'c3'.repeat(32), apiKeys: [{ name: 'bad', apiKey: 'x' }] },
    ]);
    const raw = Buffer.from(bundle.wallets[1].apiKeys![0].ciphertext, 'base64');
    raw[14] ^= 0x01;
    bundle.wallets[1].apiKeys![0].ciphertext = raw.toString('base64');
    const res = decryptValidatedBundle(bundle, 'pw');
    expect(res).toEqual({ ok: false, error: expect.any(String) });
  });
});

describe('apiKeys through the full JSON path (v1 floor)', () => {
  it('decryptBundle accepts and decrypts apiKeys on a schema-valid bundle', async () => {
    const salt = randomBytes(16);
    const key = kdfKey('pw', salt, FAST_KDF);
    const json = JSON.stringify({
      version: 1,
      algorithm: 'argon2id-aes256gcm',
      createdAt: '2026-11-06T00:00:00Z',
      walletCount: 1,
      kdf: FAST_KDF,
      wallets: [{
        walletId: 'w', name: 'W', address: ADDR, salt: salt.toString('base64'),
        ciphertext: seal(key, Buffer.from(PK_HEX, 'utf8')),
        apiKeys: [{ name: 'OpenSea', ciphertext: seal(key, Buffer.from('os-key'), Buffer.from('apikey:' + ADDR.toLowerCase())) }],
      }],
    });
    const res = await decryptBundle(json, 'pw');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.wallets[0].apiKeys).toEqual([{ name: 'OpenSea', apiKey: 'os-key' }]);
  });
});

// ── Re-encrypted export ──────────────────────────────────────────────────────

describe('encryptBundle with apiKeys', () => {
  const wallets = [{
    walletId: 'w-0', name: 'W0', address: ADDR, privateKey: PK_HEX,
    apiKeys: [
      { name: 'OpenSea', apiKey: 'same-plaintext', expiresAt: '2027-01-01T00:00:00Z' },
      { name: 'dup', apiKey: 'same-plaintext' },
    ],
  }];

  it('round-trips through decryptBundle', async () => {
    const out = encryptBundle({ wallets, password: 'new-pw', kdf: FAST_KDF });
    const res = await decryptBundle(out, 'new-pw');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.wallets[0].apiKeys).toEqual(wallets[0].apiKeys);
    expect(res.wallets[0].privateKey).toBe(PK_HEX);
  });

  it('uses a fresh IV per entry and the apikey AAD', () => {
    const parsed = JSON.parse(encryptBundle({ wallets, password: 'pw', kdf: FAST_KDF })) as WalletBundle;
    const [a, b] = parsed.wallets[0].apiKeys!;
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(Buffer.from(a.ciphertext, 'base64').subarray(0, 12))
      .not.toEqual(Buffer.from(b.ciphertext, 'base64').subarray(0, 12));

    const key = deriveKey('pw', parsed.wallets[0].salt, FAST_KDF);
    expect(aesGcmDecrypt(key, a.ciphertext, Buffer.from('apikey:' + ADDR.toLowerCase()))).toBe('same-plaintext');
    expect(() => aesGcmDecrypt(key, a.ciphertext)).toThrow();
    expect(() => aesGcmDecrypt(key, a.ciphertext, Buffer.from(ADDR.toLowerCase()))).toThrow();
    key.fill(0);
  });

  it('omits apiKeys for wallets that have none', () => {
    const parsed = JSON.parse(encryptBundle({
      wallets: [{ walletId: 'w', name: 'W', address: ADDR, privateKey: PK_HEX }],
      password: 'pw', kdf: FAST_KDF,
    })) as WalletBundle;
    expect('apiKeys' in parsed.wallets[0]).toBe(false);
  });
});

// ── Plaintext exports ────────────────────────────────────────────────────────

describe('plaintext exports with apiKeys', () => {
  const plain = { name: 'Plain', address: '0x1', privateKey: 'pk1' };
  const withKeys = {
    name: 'Dev', address: '0x2', privateKey: 'pk2',
    apiKeys: [{ name: 'OpenSea', apiKey: 'k1' }, { name: 'a;b=c', apiKey: 'x"y\\z' }],
  };

  it('TXT adds one "API Key (<name>): <key>" line per key', () => {
    const txt = formatWalletsTxt([plain, withKeys]);
    expect(txt).toContain('Private Key: pk2\nAPI Key (OpenSea): k1\nAPI Key (a;b=c): x"y\\z\n');
    expect(txt).toContain('Private Key: pk1\n\n');
  });

  it('CSV has no api_keys column when no wallet has API keys (unchanged format)', () => {
    expect(formatWalletsCsv([plain])).toBe('"Name","Address","Private Key"\n"Plain","0x1","pk1"');
  });

  it('CSV adds an escaped api_keys column when any wallet has API keys', () => {
    const csv = formatWalletsCsv([plain, withKeys]);
    expect(csv.split('\n')).toEqual([
      '"Name","Address","Private Key","api_keys"',
      '"Plain","0x1","pk1",""',
      // inner: OpenSea=k1;a\;b\=c=x"y\\z  -> then CSV-quoted with "" for "
      '"Dev","0x2","pk2","OpenSea=k1;a\\;b\\=c=x""y\\\\z"',
    ]);
  });
});

// ── Schema ───────────────────────────────────────────────────────────────────

const CT = Buffer.alloc(29).toString('base64');
const BASE = {
  version: 1,
  algorithm: 'argon2id-aes256gcm',
  createdAt: '2026-11-06T00:00:00Z',
  walletCount: 1,
  kdf: { algorithm: 'argon2id', memory: 65536, iterations: 3, parallelism: 2, saltLen: 16 },
  wallets: [{
    walletId: 'w', name: 'W', address: ADDR,
    salt: Buffer.alloc(16).toString('base64'),
    ciphertext: CT,
  }],
};
const withApiKeys = (apiKeys: unknown) => ({ ...BASE, wallets: [{ ...BASE.wallets[0], apiKeys }] });

describe('validateBundle apiKeys', () => {
  it('leaves a bundle without apiKeys unchanged', () => {
    const v = validateBundle(BASE);
    expect('apiKeys' in v.wallets[0]).toBe(false);
  });

  it('accepts valid apiKeys on v1 and v2', () => {
    const ok = [{ name: 'OpenSea', ciphertext: CT, expiresAt: '2027-01-01T00:00:00Z' }, { name: 'b', ciphertext: CT }];
    expect(validateBundle(withApiKeys(ok)).wallets[0].apiKeys).toEqual(ok);
    const v2 = { ...withApiKeys(ok), version: 2, kdf: { ...BASE.kdf, memory: 262144 } };
    expect(validateBundle(v2).wallets[0].apiKeys).toHaveLength(2);
  });

  it('accepts exactly 10 entries', () => {
    expect(validateBundle(withApiKeys(Array(10).fill({ name: 'n', ciphertext: CT }))).wallets[0].apiKeys).toHaveLength(10);
  });

  it('normalises an empty array to absent', () => {
    expect('apiKeys' in validateBundle(withApiKeys([])).wallets[0]).toBe(false);
  });

  it('drops unknown fields on an entry', () => {
    const v = validateBundle(withApiKeys([{ name: 'n', ciphertext: CT, extra: 'x' }]));
    expect(v.wallets[0].apiKeys).toEqual([{ name: 'n', ciphertext: CT }]);
  });

  const bad: Array<[string, unknown, RegExp]> = [
    ['not an array', { name: 'n', ciphertext: CT }, /apiKeys" must be an array/],
    ['null', null, /apiKeys" must be an array/],
    ['more than 10 entries', Array(11).fill({ name: 'n', ciphertext: CT }), /maximum of 10/],
    ['entry not an object', ['str'], /apiKeys\[0\] is not an object/],
    ['entry is an array', [[]], /apiKeys\[0\] is not an object/],
    ['empty name', [{ name: '', ciphertext: CT }], /apiKeys\[0\]\.name" must be a non-empty string/],
    ['missing name', [{ ciphertext: CT }], /apiKeys\[0\]\.name/],
    ['missing ciphertext', [{ name: 'n' }], /apiKeys\[0\]\.ciphertext" must be a non-empty string/],
    ['short ciphertext', [{ name: 'n', ciphertext: Buffer.alloc(28).toString('base64') }], /apiKeys\[0\]\.ciphertext is too short/],
    ['non-base64 ciphertext', [{ name: 'n', ciphertext: '!!!not base64!!!' }], /not valid base64/],
    ['numeric expiresAt', [{ name: 'n', ciphertext: CT, expiresAt: 123 }], /expiresAt" must be a string/],
    ['null expiresAt', [{ name: 'n', ciphertext: CT, expiresAt: null }], /expiresAt" must be a string/],
  ];
  for (const [label, apiKeys, re] of bad) {
    it(`rejects apiKeys: ${label}`, () => {
      expect(() => validateBundle(withApiKeys(apiKeys))).toThrow(re);
    });
  }
});
