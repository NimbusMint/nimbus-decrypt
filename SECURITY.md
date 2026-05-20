# Security Documentation

## Overview

Nimbus Decrypt is a standalone desktop application that decrypts NimbusMint wallet export bundles entirely on-device. This document describes the threat model, security guarantees, and known limitations.

---

## Threat Model

### Trusted

- The user's physical machine and OS kernel.
- The OS clipboard implementation.
- The Node.js and Electron runtimes as provided by the official releases.
- The `@noble/hashes` library (pure TypeScript, audited argon2id implementation).

### Not Trusted

- Network: no requests are made; all crypto is local.
- Other processes running on the machine (see clipboard and memory risks below).
- The filesystem after a plaintext export — files at rest are the user's responsibility.

### Out of Scope

- An OS or hardware-level attacker with kernel access.
- Cold-boot or DMA attacks against RAM.
- Keyloggers or screen-capture malware already installed on the machine.

---

## Cryptographic Design

### KDF: Argon2id

Keys are derived with Argon2id — the [OWASP-recommended](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) algorithm combining Argon2i's resistance to side-channel attacks with Argon2d's resistance to GPU cracking. Default parameters in NimbusMint exports:

| Parameter   | Value  | Notes                                       |
|-------------|--------|---------------------------------------------|
| Memory      | 64 MiB | Minimum enforced by this app: 8 MiB         |
| Iterations  | 3      |                                             |
| Parallelism | 2      |                                             |
| Output len  | 32 B   | 256-bit AES key                             |
| Salt        | 16 B   | Per-wallet, random, stored in bundle        |

### Symmetric Encryption: AES-256-GCM

Each wallet's private key is encrypted with AES-256-GCM. The ciphertext wire format is:

```
base64( IV[12 bytes] || encrypted_data || GCM_auth_tag[16 bytes] )
```

- The IV is 96-bit random per wallet (recommended for GCM).
- The auth tag provides authenticated encryption — any tamper to ciphertext, IV, or associated state causes decryption to throw before any plaintext is produced.
- Wrong password → wrong key → auth tag mismatch → exception. No partial decryption ever occurs.

---

## Electron Security Configuration

| Control                          | Setting          |
|----------------------------------|------------------|
| `nodeIntegration`                | `false`          |
| `contextIsolation`               | `true`           |
| `sandbox`                        | `true`           |
| Renderer ↔ main communication   | Preload contextBridge only |
| External navigation              | Blocked          |
| New windows / popups             | Blocked          |
| Permission requests              | All denied       |
| Second instances                 | Blocked          |
| Content-Security-Policy          | `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'` |

### No eval

- ESLint rule `no-eval` is enforced project-wide.
- CSP `script-src 'self'` blocks inline scripts and eval in the renderer.
- `new Function(...)` is blocked by `no-new-func` lint rule.

---

## Local-Only Guarantees

- **No network stack**: The app makes zero outbound or inbound connections. There is no analytics SDK, no telemetry endpoint, no auto-update HTTP poll, no CDN resource.
- **No auto-update**: `electron-builder` is configured with `publish: null`. No Squirrel framework is included. The binary you install is the binary that runs.
- **No cloud sync**: No localStorage, sessionStorage, IndexedDB, or cookies are used for secrets. No data is written to disk except at explicitly user-chosen export paths.

---

## Memory Limitations of JavaScript Runtimes

JavaScript (V8) uses an immutable string representation. Once a private key is assigned to a JavaScript `string` variable, the raw bytes **cannot be zeroed by application code**. The V8 GC controls when that memory is freed and zeroed by the OS.

**What this app does:**

1. In the main (Node.js) process: intermediate `Buffer` and `Uint8Array` values (derived AES keys, plaintext buffers before `toString()`) are explicitly zeroed with `.fill(0)` after use.
2. The string returned over IPC to the renderer is the minimum surface — it is stored once in React state.
3. On lock or close, React state is cleared (`setWallets([])`). The string is dereferenced; the GC will collect it at an indeterminate later time.

**What this app cannot do:**

- Force V8 to immediately release the memory pages holding a string.
- Prevent V8 or the OS from swapping those pages to disk before GC.
- Prevent a crash dump from containing key material (see below).

**Recommendation**: Run on an encrypted disk. Disable crash reporting. Do not use memory profiling tools while the app has decrypted wallets loaded.

---

## Clipboard Risks

When you copy a private key:

1. The key is written to the OS clipboard.
2. A 30-second countdown timer begins.
3. At expiry, the clipboard is overwritten with an empty string.

**Limitations:**
- Any process with clipboard access (other apps, browser extensions, scripts) can read the key during the 30-second window.
- The clipboard "clear" writes `""`, not a zero-length write — some clipboard managers log history and may retain the key.
- On some operating systems, the clipboard is included in system-level backups (e.g. iCloud clipboard sync on macOS). Disable Handoff/Universal Clipboard when using this feature.

**Recommendation**: Use clipboard copy only when necessary, in a trusted environment.

---

## Disk Persistence Risks

### Plaintext Export

When you choose "Export as TXT" or "Export as CSV":

- You must type `I UNDERSTAND` in a confirmation dialog.
- A native OS save dialog opens — you choose the exact destination.
- The file is written once. This app does not retain a reference or re-write it.
- The file contains plaintext private keys. **It must be treated with the same care as a hardware wallet seed phrase.**

### Re-encrypted Export

Exporting as an encrypted JSON bundle produces a file with the same format as the original NimbusMint export, re-encrypted with a new Argon2id-derived AES-256-GCM key. This is safer for storage, but security depends entirely on the strength of the new password.

### Swap / Hibernate Files

The OS may write memory pages — including those containing keys — to a swap file or hibernation image. This is outside the app's control. Users on sensitive machines should:

- Use full-disk encryption (BitLocker, FileVault, LUKS).
- Disable swap/hibernation where operationally acceptable.

---

## Auto-Lock

After 5 minutes of inactivity (configurable via source), the session locks:

- All decrypted wallet data is removed from React state.
- The encrypted bundle JSON remains in memory so the user can re-enter their password.
- V8 string GC limitations apply to keys that were in state before the lock.

The lock is a best-effort UX protection against unattended access — it is not a cryptographic guarantee of memory erasure.

---

## Supply Chain

This application depends on:

| Package          | Role                          | Audit status                            |
|------------------|-------------------------------|-----------------------------------------|
| `@noble/hashes`  | Argon2id (pure TypeScript)    | Audited by Cure53 (see noble-hashes repo) |
| `electron`       | App runtime                   | Verified via npm lockfile hash          |
| `react`          | UI                            | Meta-maintained                         |
| `vite`           | Build tool (dev only)         | —                                       |

Run `npm audit` before building to verify no known CVEs in the dependency tree.

---

## Reporting Vulnerabilities

To report a security vulnerability, open a GitHub Security Advisory (private disclosure) or email the maintainers. Do not file public issues for security findings.
