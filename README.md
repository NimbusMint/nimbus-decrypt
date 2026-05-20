```
  _   _ _           _                 ____                             _
 | \ | (_)_ __ ___ | |__  _   _ ___  |  _ \  ___  ___ _ __ _   _ _ __| |_
 |  \| | | '_ ` _ \| '_ \| | | / __| | | | |/ _ \/ __| '__| | | | '_ \ __|
 | |\  | | | | | | | |_) | |_| \__ \ | |_| |  __/ (__| |  | |_| | |_) | |_
 |_| \_|_|_| |_| |_|_.__/ \__,_|___/ |____/ \___|\___|_|   \__, | .__/ \__|
                                                             |___/|_|
```

[![GitHub Release](https://img.shields.io/github/v/release/NimbusMint/nimbus-decrypt?label=latest)](https://github.com/NimbusMint/nimbus-decrypt/releases/latest)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![Offline](https://img.shields.io/badge/network-offline%20only-green)

**Nimbus Decrypt** is a secure desktop utility for accessing and restoring wallet files exported from NimbusMint. Everything runs on your machine — no servers, no internet connection, no accounts.

---

## Getting Started in 30 Seconds

1. Go to [**Releases**](https://github.com/NimbusMint/nimbus-decrypt/releases/latest)
2. Download the file for your OS (see table below)
3. Open it and run it — no installation required for AppImage/ZIP builds

| OS | Recommended download |
|----|----------------------|
| Windows | `nimbus-decrypt-*-windows-setup.exe` |
| macOS | `nimbus-decrypt-*-macos.dmg` |
| Linux (most distros) | `nimbus-decrypt-*-linux.AppImage` |
| Linux (Debian / Ubuntu) | `nimbus-decrypt-*-linux.deb` |

> **macOS note:** Right-click the app and choose **Open** the first time — macOS will warn about unsigned apps from the internet.
>
> **Linux AppImage note:** Make the file executable before running: `chmod +x nimbus-decrypt-*.AppImage`

---

## Features

- Drag-and-drop `.json` NimbusMint wallet bundle import
- Argon2id key derivation + AES-256-GCM decryption
- Per-wallet private key reveal (hold-to-reveal or toggle)
- Clipboard copy with 30-second auto-clear and countdown
- Export as re-encrypted bundle, plaintext TXT, or CSV
- Inactivity auto-lock after 5 minutes
- Dark / light mode (follows OS preference)
- Fully offline — works without any internet connection

---

## How to Use It

1. **Open a bundle** — drag your `.json` NimbusMint export onto the window, or click to browse for the file.
2. **Enter your password** — the export password you set when generating the bundle in NimbusMint.
3. **View your wallets** — each card shows the wallet name, address, and a hidden private key.
4. **Reveal / Copy** — hold the "Hold to reveal" button to briefly show a key, or copy it to clipboard (auto-clears in 30 seconds).
5. **Export** — click **Export** in the toolbar to save a re-encrypted bundle or a plaintext file anywhere you choose.
6. **Lock** — click **Lock** or walk away; the session auto-locks after 5 minutes of inactivity.

---

## Security

- Runs entirely on your local machine — no outbound network requests, ever
- No telemetry, no crash reporting, no auto-updates
- Decrypted keys are held only in memory for the active session; locking or closing the app clears them
- The password is never stored or written to disk
- Clipboard contents are cleared automatically after 30 seconds

See [SECURITY.md](./SECURITY.md) for the full threat model and cryptographic design details.

---

## FAQ

**Does this upload my wallet file or keys anywhere?**
No. There is no network code in the application at all.

**Is it safe to use offline / air-gapped?**
Yes, that is the intended use case. It requires no internet access to function.

**What file format does it support?**
Encrypted `.json` bundles exported by NimbusMint, using Argon2id + AES-256-GCM.

**Why does macOS warn me about the app?**
The builds are not code-signed with an Apple developer certificate. Right-click → Open to bypass the Gatekeeper prompt on first launch.

**Can I verify the download is genuine?**
Yes — every release includes a `checksums.txt` file with SHA-256 hashes. Compare the hash of your downloaded file against the published list.

---

## Build from Source

If you prefer to build the app yourself:

```bash
# Prerequisites: Node.js 20+, npm 10+
git clone https://github.com/NimbusMint/nimbus-decrypt.git
cd nimbus-decrypt
npm install
npm run dev        # dev mode (Vite + Electron live-reload)
npm run build      # production build → release/
```

Run tests:

```bash
npm test           # vitest unit tests
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint
```

---

## Architecture (for developers)

```
electron/
  main.ts          — BrowserWindow, CSP, IPC registration
  preload.ts       — contextBridge (only surface exposed to renderer)
  lib/crypto.ts    — Pure Argon2id + AES-GCM functions (no Electron dependency)
  ipc/
    crypto.ts      — IPC handler: decrypt:wallets
    fileio.ts      — IPC handlers: file:open-bundle, file:save-*

src/
  types/wallet.ts  — Shared TypeScript types
  utils/schema.ts  — JSON schema validation
  App.tsx          — State machine: idle → loaded → decrypting → unlocked → locked
  components/      — React UI components
  hooks/           — useAutoLock, useClipboard
```

All cryptographic operations run in the Electron **main process** (Node.js). The renderer has no `nodeIntegration` and communicates only through the typed `contextBridge` preload bridge.

---

## Contributing

Pull requests are welcome. For security-sensitive issues please open a [Security Advisory](https://github.com/NimbusMint/nimbus-decrypt/security/advisories/new) (private) rather than a public issue.

---

## License

MIT — see [LICENSE](./LICENSE).
