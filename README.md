# Nimbus Decrypt

A standalone, fully-offline desktop decryptor for [NimbusMint](https://github.com/NimbusMint/Oculus-GUI) wallet export bundles.

> **Security first**: No network requests. No telemetry. No auto-update. Private keys never leave your machine unless you explicitly choose to export them.

---

## Features

- Drag-and-drop `.json` wallet bundle import
- Argon2id key derivation + AES-256-GCM decryption (matching NimbusMint's export format)
- Per-wallet private key reveal (hold-to-reveal or toggle)
- Clipboard copy with 30-second auto-clear and countdown
- Export as re-encrypted JSON bundle, plaintext TXT, or CSV (with explicit confirmation)
- Inactivity auto-lock (5 minutes)
- Dark and light mode (follows OS preference)
- Works fully offline on Windows, macOS, and Linux

---

## Security

Read [SECURITY.md](./SECURITY.md) for the full threat model, cryptographic design, and known limitations before using this tool with real private keys.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm 10 or later

### Install & run

```bash
git clone https://github.com/NimbusMint/nimbus-decrypt.git
cd nimbus-decrypt
npm install
npm run dev
```

### Run tests

```bash
npm test
```

### Build for distribution

```bash
npm run build
```

Packaged apps are written to `release/`. Supported targets:

| Platform | Output                    |
|----------|---------------------------|
| Windows  | NSIS installer + ZIP      |
| macOS    | DMG + ZIP                 |
| Linux    | AppImage + DEB            |

---

## Usage

1. **Open a bundle** — drag a `.json` NimbusMint wallet export onto the drop zone, or click to browse.
2. **Enter your export password** — the password you set when exporting from NimbusMint.
3. **View your wallets** — each card shows the wallet name, address, and a masked private key.
4. **Reveal / Copy** — hold the "Hold to reveal" button to momentarily display a key, or copy it to clipboard (auto-clears in 30s).
5. **Export** — click "Export" in the toolbar to save a re-encrypted bundle or a plaintext file to a location you choose.
6. **Lock** — click "Lock" or walk away; the session auto-locks after 5 minutes of inactivity.

---

## Wallet Bundle Format

Nimbus Decrypt reads bundles produced by NimbusMint. The expected JSON schema:

```json
{
  "version": 1,
  "algorithm": "argon2id-aes256gcm",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "walletCount": 1,
  "kdf": {
    "algorithm": "argon2id",
    "memory": 65536,
    "iterations": 3,
    "parallelism": 2,
    "saltLen": 16
  },
  "wallets": [
    {
      "walletId": "...",
      "name": "Main",
      "address": "0x...",
      "salt": "<base64>",
      "ciphertext": "<base64: IV[12] || ciphertext || authTag[16]>"
    }
  ]
}
```

---

## Architecture

```
electron/
  main.ts          — BrowserWindow, CSP, IPC registration
  preload.ts       — contextBridge (only IPC surface exposed to renderer)
  lib/crypto.ts    — Pure Argon2id + AES-GCM functions (testable, no Electron dependency)
  ipc/
    crypto.ts      — IPC handler: decrypt:wallets
    fileio.ts      — IPC handlers: file:open-bundle, file:save-text, file:save-encrypted

src/
  types/wallet.ts  — Shared TypeScript types
  utils/schema.ts  — JSON schema validation
  App.tsx          — App state machine (idle → loaded → decrypting → unlocked → locked)
  components/      — React UI components
  hooks/           — useAutoLock, useClipboard

tests/
  crypto.test.ts   — Unit tests: key derivation, encryption round-trip, wrong password, corruption
  schema.test.ts   — Unit tests: bundle validation edge cases
```

All crypto runs in the Electron **main process** (Node.js). The renderer never has `nodeIntegration` and communicates only through the typed `contextBridge` preload bridge.

---

## Development

```bash
npm run dev        # Start Vite dev server + Electron
npm test           # Run vitest unit tests
npm run typecheck  # Type-check both renderer and electron source
npm run lint       # ESLint (includes no-eval, no-localStorage rules)
```

---

## Contributing

Pull requests are welcome. For security-sensitive changes please open a Security Advisory (private) rather than a public issue.

---

## License

MIT — see [LICENSE](./LICENSE).
