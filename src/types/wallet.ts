export interface KdfParams {
  algorithm: 'argon2id';
  memory: number;
  iterations: number;
  parallelism: number;
  saltLen: number;
}

export interface EncryptedWallet {
  walletId: string;
  name: string;
  address: string;
  /** base64-encoded salt (per-wallet) */
  salt: string;
  /** base64-encoded (IV[12] || ciphertext || authTag[16]) */
  ciphertext: string;
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

export interface DecryptedWallet {
  walletId: string;
  name: string;
  address: string;
  privateKey: string;
}

export type DecryptResult =
  | { ok: true; wallets: DecryptedWallet[] }
  | { ok: false; error: string };

export interface SaveTextRequest {
  wallets: Array<{ name: string; address: string; privateKey: string }>;
  format: 'txt' | 'csv';
}

export interface SaveEncryptedRequest {
  wallets: Array<{ walletId: string; name: string; address: string; privateKey: string }>;
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
