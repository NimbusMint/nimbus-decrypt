import { useState, useCallback, type CSSProperties } from 'react';
import { DropZone } from './components/DropZone';
import { PasswordForm } from './components/PasswordForm';
import { WalletCard } from './components/WalletCard';
import { LockScreen } from './components/LockScreen';
import { ExportModal } from './components/ExportModal';
import { useAutoLock } from './hooks/useAutoLock';
import { validateBundle } from './utils/schema';
import type { DecryptedWallet, WalletBundle } from './types/wallet';

type Phase = 'idle' | 'file-loaded' | 'decrypting' | 'unlocked' | 'locked';

const AUTO_LOCK_MS = 5 * 60 * 1000;

/* ─── SVG icons ─── */
function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
        fill="rgba(255,255,255,0.25)" />
      <path d="M12 6l-5 9h10L12 6z" fill="white" fillOpacity="0.9" />
      <path d="M12 10l3 5H9l3-5z" fill="white" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function LockClosedIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

/* ─── Cloud SVGs — matching nimbus-fe clouds.tsx exactly ─── */
function Cloud({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
      <ellipse cx="70" cy="60" rx="60" ry="30" fill="currentColor" />
      <ellipse cx="120" cy="55" rx="50" ry="35" fill="currentColor" />
      <ellipse cx="50" cy="65" rx="40" ry="22" fill="currentColor" />
      <ellipse cx="100" cy="40" rx="35" ry="28" fill="currentColor" />
      <ellipse cx="140" cy="62" rx="35" ry="20" fill="currentColor" />
    </svg>
  );
}

function CloudSmall({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
      <ellipse cx="40" cy="35" rx="35" ry="18" fill="currentColor" />
      <ellipse cx="70" cy="30" rx="30" ry="22" fill="currentColor" />
      <ellipse cx="55" cy="25" rx="20" ry="16" fill="currentColor" />
    </svg>
  );
}

/* ─── Cloud decoration — 6 clouds matching nimbus-fe page.tsx layout ─── */
function CloudDecoration() {
  const base: CSSProperties = {
    position: 'absolute',
    animation: 'drift 120s linear infinite',
  };

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      {/* top 8%, left 5%, w-48, sky-200/70 — no delay */}
      <Cloud style={{ ...base, top: '8%', left: '5%', width: 192, color: 'rgba(186, 230, 253, 0.70)' }} />
      {/* top 15%, right 10%, w-28, sky-200/60 — 3s delay */}
      <CloudSmall style={{ ...base, top: '15%', right: '10%', width: 112, color: 'rgba(186, 230, 253, 0.60)', animationDelay: '3s' }} />
      {/* bottom 12%, right 3%, w-56, sky-100/60 — 5s delay */}
      <Cloud style={{ ...base, bottom: '12%', right: '3%', width: 224, color: 'rgba(224, 242, 254, 0.60)', animationDelay: '5s' }} />
      {/* bottom 25%, left 8%, w-32, sky-200/50 — 8s delay */}
      <CloudSmall style={{ ...base, bottom: '25%', left: '8%', width: 128, color: 'rgba(186, 230, 253, 0.50)', animationDelay: '8s' }} />
      {/* top 45%, left 2%, w-24, sky-100/50 — 2s delay */}
      <CloudSmall style={{ ...base, top: '45%', left: '2%', width: 96, color: 'rgba(224, 242, 254, 0.50)', animationDelay: '2s' }} />
      {/* top 5%, right 30%, w-40, sky-200/40 — 1s delay */}
      <Cloud style={{ ...base, top: '5%', right: '30%', width: 160, color: 'rgba(186, 230, 253, 0.40)', animationDelay: '1s' }} />
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [bundleJson, setBundleJson] = useState('');
  const [bundle, setBundle] = useState<WalletBundle | null>(null);
  const [fileName, setFileName] = useState('');
  const [wallets, setWallets] = useState<DecryptedWallet[]>([]);
  const [decrypting, setDecrypting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const handleLock = useCallback(() => {
    setWallets([]);
    setPhase('locked');
    setExportOpen(false);
  }, []);

  useAutoLock(handleLock, phase === 'unlocked' ? AUTO_LOCK_MS : 0);

  const handleFileLoaded = useCallback((content: string, name: string) => {
    setError(null);
    try {
      const parsed = JSON.parse(content) as unknown;
      const validated = validateBundle(parsed);
      setBundleJson(content);
      setBundle(validated);
      setFileName(name);
      setPhase('file-loaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid wallet bundle file.');
    }
  }, []);

  const handleFileError = useCallback((msg: string) => setError(msg), []);

  const handleBrowse = async () => {
    const result = await window.electronAPI.file.openBundle();
    if (result) handleFileLoaded(result.content, result.name);
  };

  const handleDecrypt = useCallback(async (password: string) => {
    if (!bundleJson) return;
    setDecrypting(true);
    setError(null);
    setPhase('decrypting');

    const result = await window.electronAPI.decrypt.wallets(bundleJson, password);

    setDecrypting(false);
    if (result.ok) {
      setWallets(result.wallets);
      setPhase('unlocked');
    } else {
      setPhase('file-loaded');
      setError(result.error);
    }
  }, [bundleJson]);

  const handleUnlock = useCallback(async (password: string) => {
    if (!bundleJson) return;
    setUnlocking(true);
    setError(null);

    const result = await window.electronAPI.decrypt.wallets(bundleJson, password);

    setUnlocking(false);
    if (result.ok) {
      setWallets(result.wallets);
      setPhase('unlocked');
      setError(null);
    } else {
      setError(result.error);
    }
  }, [bundleJson]);

  const handleReset = useCallback(() => {
    setPhase('idle');
    setBundleJson('');
    setBundle(null);
    setFileName('');
    setWallets([]);
    setError(null);
    setDecrypting(false);
  }, []);

  const isUnlocked = phase === 'unlocked';

  return (
    <div className="app">
      <CloudDecoration />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header__logo">
          <div className="header__logo-icon">
            <LogoIcon />
          </div>
          <span className="header__title">
            Nimbus <span>Decrypt</span>
          </span>
        </div>

        <div className="header__spacer" />

        <div className="header__actions">
          <div className="header__offline-badge">
            <span className="header__offline-dot" />
            Offline
          </div>

          {isUnlocked && (
            <>
              <button className="btn btn--ghost btn--sm" onClick={() => setExportOpen(true)}>
                <UploadIcon />
                Export
              </button>
              <button
                className="btn btn--ghost btn--sm"
                onClick={handleLock}
                title="Lock session"
              >
                <LockClosedIcon />
                Lock
              </button>
              <button
                className="btn btn--icon btn--sm"
                onClick={handleReset}
                title="Close file"
                aria-label="Close file"
              >
                <CloseIcon size={13} />
              </button>
            </>
          )}

          {phase === 'file-loaded' && (
            <button
              className="btn btn--icon btn--sm"
              onClick={handleReset}
              title="Close file"
              aria-label="Close file"
            >
              <CloseIcon size={13} />
            </button>
          )}
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className={`main${phase === 'idle' || phase === 'file-loaded' || phase === 'decrypting' ? ' main--centered' : ''}`}>

        {/* Idle — file picker */}
        {phase === 'idle' && (
          <>
            {error && (
              <div className="idle-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}
            <DropZone onFileLoaded={handleFileLoaded} onError={handleFileError} />
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>or</span>
              <button className="browse-link" onClick={handleBrowse}>
                browse via file picker
              </button>
            </div>
          </>
        )}

        {/* File loaded — password entry */}
        {phase === 'file-loaded' && bundle && (
          <PasswordForm
            fileName={fileName}
            walletCount={bundle.walletCount}
            algorithm={bundle.algorithm}
            decrypting={decrypting}
            error={error}
            onSubmit={handleDecrypt}
            onReset={handleReset}
          />
        )}

        {/* Decrypting — animated state */}
        {phase === 'decrypting' && (
          <div className="decrypt-state">
            <div className="decrypt-state__icon">
              <div className="decrypt-state__ring-slow" />
              <div className="decrypt-state__ring" />
              <div className="decrypt-state__badge">
                <ShieldIcon />
              </div>
            </div>
            <div className="decrypt-state__title">Decrypting wallets…</div>
            <div className="decrypt-state__sub">argon2id · aes-256-gcm</div>
          </div>
        )}

        {/* Unlocked — wallet grid */}
        {phase === 'unlocked' && (
          <>
            <div className="wallet-toolbar">
              <div className="wallet-toolbar__meta">
                <span className="wallet-toolbar__count">
                  <span className="wallet-count-badge">{wallets.length}</span>
                  {' '}{wallets.length === 1 ? 'wallet' : 'wallets'} decrypted
                </span>
                {bundle && (
                  <>
                    <span className="wallet-toolbar__sep">·</span>
                    <span className="wallet-toolbar__file">{fileName}</span>
                  </>
                )}
              </div>
            </div>

            <div className="wallet-grid">
              {wallets.map((w, i) => (
                <WalletCard key={w.walletId} wallet={w} index={i} />
              ))}
            </div>
          </>
        )}
      </main>

      {/* ── Lock screen overlay ──────────────────────────────────────────── */}
      {phase === 'locked' && bundle && (
        <LockScreen
          walletCount={bundle.walletCount}
          onUnlock={handleUnlock}
          unlocking={unlocking}
          error={error}
        />
      )}

      {/* ── Export modal ─────────────────────────────────────────────────── */}
      {exportOpen && bundle && wallets.length > 0 && (
        <ExportModal
          wallets={wallets}
          bundleKdf={bundle.kdf}
          onClose={() => setExportOpen(false)}
        />
      )}

    </div>
  );
}
