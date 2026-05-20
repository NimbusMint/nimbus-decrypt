# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Vite + Electron together via vite-plugin-electron)
npm test             # Run vitest unit tests (Node environment)
npm run test:watch   # Vitest in watch mode
npm run typecheck    # Type-check renderer (tsc) AND electron source (tsc -p tsconfig.node.json)
npm run lint         # ESLint across electron/, src/, tests/
npm run build        # Production build + electron-builder packaging → release/
npm run build:no-pack # Vite build only (skip electron-builder, for faster iteration)
```

To run a single test file:
```bash
npx vitest run tests/crypto.test.ts
```

## Architecture

Two compiled targets share the same TypeScript source tree:

| Target | Toolchain | Entry | Output |
|--------|-----------|-------|--------|
| Renderer | Vite (browser) | `src/main.tsx` | `dist/` |
| Main + Preload | vite-plugin-electron (Rollup/Node) | `electron/main.ts`, `electron/preload.ts` | `dist-electron/` |

### Key separation principle

`electron/lib/crypto.ts` contains **pure functions only** — no `import from 'electron'`. This makes it fully testable with vitest in Node environment. The IPC wiring lives in `electron/ipc/` which does import Electron and is not directly tested.

### IPC surface (the only bridge between renderer and main)

```typescript
window.electronAPI.decrypt.wallets(bundleJson, password) // → DecryptResult
window.electronAPI.file.openBundle()                      // → {content, name} | null
window.electronAPI.file.saveText(req)                     // → boolean
window.electronAPI.file.saveEncrypted(req)                // → {ok, error?}
```

Defined in `electron/preload.ts` via `contextBridge.exposeInMainWorld`. Types are in `src/types/wallet.ts` and augmented onto `Window` there.

### Ciphertext wire format

`base64( randomIV[12] || AES-256-GCM(plaintext) || authTag[16] )`

Decoding in `electron/lib/crypto.ts:aesGcmDecrypt`.

### App state machine (`src/App.tsx`)

`idle → file-loaded → decrypting → unlocked ↔ locked`

- Crypto runs in the main process; the renderer holds decrypted `string` keys in React state.
- Lock clears `wallets` state (`setWallets([])`); the encrypted `bundleJson` stays so the user can re-enter their password.
- Auto-lock is triggered by `useAutoLock` (5-min inactivity timer, events: mousemove/keydown/mousedown/touchstart/wheel).

## Security constraints

- **No `eval`** — enforced by ESLint `no-eval` + `no-new-func` rules and CSP `script-src 'self'`.
- **No `localStorage`/`sessionStorage`** — ESLint `no-restricted-globals` enforced in `src/`.
- **No `dangerouslySetInnerHTML`** — do not add it.
- **Zero buffers after use** — `Buffer.fill(0)` and `Uint8Array.fill(0)` calls in `electron/lib/crypto.ts` are intentional. Do not remove them.
- **Passwords must not be persisted** — never store passwords in state beyond the duration of a single decrypt call.
- **Do not add network requests** — no fetch, no XHR, no WebSocket anywhere.
- **Do not add `webSecurity: false`** or any other security-weakening Electron options.

## Testing notes

Tests import directly from `electron/lib/crypto.ts` (pure functions) and `src/utils/schema.ts`. The `argon2id` KDF params in tests use `memory: 8192, iterations: 1` for speed — production bundles use much higher values.

The `vitest.config.ts` sets `environment: 'node'` so Node built-ins (`crypto`, `buffer`) are available.
