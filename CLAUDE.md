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
window.electronAPI.theme.initial()                        // → 'light' | 'dark'  (SYNC)
window.electronAPI.theme.set(theme)                       // → void
```

`theme.initial()` is the only synchronous channel in the app. The renderer
reads it during its first render so the window never paints the wrong theme
and then flips; see `electron/ipc/theme.ts`.

Defined in `electron/preload.ts` via `contextBridge.exposeInMainWorld`. Types are in `src/types/wallet.ts` and augmented onto `Window` there.

### Ciphertext wire format

`base64( randomIV[12] || AES-256-GCM(plaintext) || authTag[16] )`

Decoding in `electron/lib/crypto.ts:aesGcmDecrypt`.

### App state machine (`src/App.tsx`)

`idle → file-loaded → decrypting → unlocked ↔ locked`

- Crypto runs in the main process; the renderer holds decrypted `string` keys in React state.
- Lock clears `wallets` state (`setWallets([])`); the encrypted `bundleJson` stays so the user can re-enter their password.
- Auto-lock is triggered by `useAutoLock` (5-min inactivity timer, events: mousemove/keydown/mousedown/touchstart/wheel).

## Theming

Light/dark is a class on `<html>`, ported from nimbus-fe's ThemeProvider.
`src/hooks/useTheme.ts` is the only writer of that class; every colour in
`src/index.css` is a `var(--token)`, and the `.dark` block near the top of that
file redefines the tokens rather than patching component rules. The preference
persists to `preferences.json` in Electron's userData — localStorage is banned
in the renderer (see below) — and `nimbus-atmosphere` gets it as `<AtmosphereLayer dark>`.

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


---

## Cross-repo work — the agent team

This repo is one of eight under `~/nimbus`. The couplings between them that
**nothing enforces** — no compiler, no test, no type — are written down in
`~/nimbus/nimbus-tools/docs/CONTRACTS.md`. Break one and nothing goes red; the
system just starts being quietly wrong in production.

### What this repo depends on

`nimbus-atmosphere` is vendored via `"file:./nimbus-atmosphere"`. **This copy is
1.0.0; upstream is 1.0.1** — contract **C3**. Editing the vendored directory does
not change upstream, and `npm update` will never propagate a fix.

**This app is offline by design.** Everything runs on the user's machine — no
servers, no internet, no accounts. **Any new dependency or code path that can
reach the network is a security regression**, not a style question. Check
transitively, and take it to `security-sentinel`.

**Ask `contract-guard` before merging anything touching the paths above.** The
full roster and the 14-stage pipeline are in `~/nimbus/nimbus-tools/docs/TEAM.md`
and `PIPELINE.md`; `docs/OPERATIONS.md` records what CI and the environments
actually do.
