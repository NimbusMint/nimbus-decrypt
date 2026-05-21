import { useState, useCallback, useEffect } from 'react';
import { AtmosphereLayer } from 'nimbus-atmosphere';
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

function WinMinimizeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <line x1="1" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function WinMaximizeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <rect x="0.75" y="0.75" width="9.5" height="9.5" stroke="currentColor" strokeWidth="1.4" rx="1" />
    </svg>
  );
}

function WinRestoreIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <rect x="2.5" y="0.75" width="7.75" height="7.75" stroke="currentColor" strokeWidth="1.4" rx="1" />
      <path d="M0.75 2.5v7.75h7.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function WinCloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <line x1="1.5" y1="1.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="9.5" y1="1.5" x2="1.5" y2="9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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

  const [isMaximized, setIsMaximized] = useState(false);
  useEffect(() => {
    window.electronAPI.window.isMaximized().then(setIsMaximized);
    window.electronAPI.window.onMaximizeChange(setIsMaximized);
  }, []);

  return (
    <>
    <AtmosphereLayer />
    <div className="app">

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
          {/* Window controls */}
          <div className="wc-divider" aria-hidden="true" />
          <button
            className="wc-btn"
            onClick={() => window.electronAPI.window.minimize()}
            aria-label="Minimize"
          >
            <WinMinimizeIcon />
          </button>
          <button
            className="wc-btn"
            onClick={() => window.electronAPI.window.toggleMaximize()}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <WinRestoreIcon /> : <WinMaximizeIcon />}
          </button>
          <button
            className="wc-btn wc-btn--close"
            onClick={() => window.electronAPI.window.close()}
            aria-label="Close"
          >
            <WinCloseIcon />
          </button>
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
    </>
  );
}
