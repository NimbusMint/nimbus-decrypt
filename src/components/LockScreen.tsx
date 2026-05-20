import { useState, useRef } from 'react';

interface LockScreenProps {
  walletCount: number;
  onUnlock: (password: string) => void;
  unlocking: boolean;
  error: string | null;
}

function LockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function SpinnerInline() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

export function LockScreen({ walletCount, onUnlock, unlocking, error }: LockScreenProps) {
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const password = inputRef.current?.value ?? '';
    if (!password) return;
    onUnlock(password);
  };

  return (
    <div className="lock-overlay" role="dialog" aria-modal="true" aria-label="Session locked">
      <div className="lock-card">
        {/* Lock icon with pulsing ring */}
        <div className="lock-card__icon-wrap">
          <div className="lock-card__icon-ring" />
          <div className="lock-card__icon">
            <LockIcon />
          </div>
        </div>

        <div className="lock-card__title">Session Locked</div>
        <div className="lock-card__sub">
          Re-enter your password to access{' '}
          <strong>{walletCount}</strong>{' '}
          {walletCount === 1 ? 'wallet' : 'wallets'}
        </div>

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="password-form__input-wrap" style={{ marginBottom: 12 }}>
            <input
              ref={inputRef}
              className="password-form__input"
              type={show ? 'text' : 'password'}
              placeholder="Export password"
              autoComplete="off"
              autoFocus
              disabled={unlocking}
              aria-label="Export password"
            />
            <button
              type="button"
              className="password-form__toggle"
              onClick={() => setShow(v => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {show ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {error && (
            <div className="password-form__error" role="alert" style={{ marginBottom: 12 }}>
              <AlertIcon />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn--primary"
            disabled={unlocking}
            style={{ width: '100%' }}
          >
            {unlocking ? (
              <>
                <SpinnerInline />
                Decrypting…
              </>
            ) : (
              'Unlock'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
