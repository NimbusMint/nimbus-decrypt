import type { ThemePreference } from './theme';

export interface KdfParams {
  algorithm: 'argon2id';
  memory: number;
  iterations: number;
  parallelism: number;
  saltLen: number;
}

/**
 * An encrypted API key belonging to a wallet (e.g. the OpenSea developer key
 * registered to that wallet). Optional — customer wallet exports never carry it.
 *
 * Encrypted under the SAME Argon2id key as the wallet's private key (same
 * per-wallet salt, same bundle kdf params). AAD is the UTF-8 bytes of
 * `"apikey:" + address.toLowerCase()`, which differs from the private key's AAD
 * so a ciphertext cannot be moved between the two fields. Plaintext is UTF-8.
 */
export interface EncryptedApiKey {
  /** Plaintext label, not secret. */
  name: string;
  /** Optional RFC3339 expiry, plaintext. */
  expiresAt?: string;
  /** base64-encoded (IV[12] || ciphertext || authTag[16]) */
  ciphertext: string;
}

export interface EncryptedWallet {
  walletId: string;
  name: string;
  address: string;
  /** base64-encoded salt (per-wallet) */
  salt: string;
  /** base64-encoded (IV[12] || ciphertext || authTag[16]) */
  ciphertext: string;
  /** Optional; absent or empty behaves exactly like a bundle without it. */
  apiKeys?: EncryptedApiKey[];
}

export interface WalletBundle {
  /** 1 = legacy (64 MiB Argon2id); 2 = hardened (256 MiB Argon2id) */
  version: 1 | 2;
  algorithm: 'argon2id-aes256gcm';
  createdAt: string;
  walletCount: number;
  kdf: KdfParams;
  wallets: EncryptedWallet[];
}

export interface DecryptedApiKey {
  name: string;
  expiresAt?: string;
  apiKey: string;
}

export interface DecryptedWallet {
  walletId: string;
  name: string;
  address: string;
  privateKey: string;
  /** Present only when the bundle wallet carried a non-empty apiKeys array. */
  apiKeys?: DecryptedApiKey[];
}

export type DecryptResult =
  | { ok: true; wallets: DecryptedWallet[] }
  | { ok: false; error: string };

export interface SaveTextRequest {
  wallets: Array<{ name: string; address: string; privateKey: string; apiKeys?: DecryptedApiKey[] }>;
  format: 'txt' | 'csv';
}

export interface SaveEncryptedRequest {
  wallets: Array<{
    walletId: string;
    name: string;
    address: string;
    privateKey: string;
    apiKeys?: DecryptedApiKey[];
  }>;
  password: string;
  kdf: KdfParams;
}

/** Global type augmentation for the contextBridge-exposed API */
declare global {
  interface Window {
    electronAPI: {
      window: {
        minimize: () => void;
        toggleMaximize: () => void;
        close: () => void;
        isMaximized: () => Promise<boolean>;
        onMaximizeChange: (cb: (maximized: boolean) => void) => void;
      };
      theme: {
        initial: () => ThemePreference;
        set: (theme: ThemePreference) => Promise<void>;
      };
      decrypt: {
        wallets: (bundleJson: string, password: string) => Promise<DecryptResult>;
      };
      file: {
        openBundle: () => Promise<{ content: string; name: string } | null>;
        saveText: (req: SaveTextRequest) => Promise<boolean>;
        saveEncrypted: (req: SaveEncryptedRequest) => Promise<{ ok: boolean; error?: string }>;
      };
    };
  }
}
