import { useState, useRef } from 'react';

interface PasswordFormProps {
  fileName: string;
  walletCount: number;
  algorithm: string;
  decrypting: boolean;
  error: string | null;
  onSubmit: (password: string) => void;
  onReset: () => void;
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
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

function ArrowLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function PasswordForm({
  fileName,
  walletCount,
  algorithm,
  decrypting,
  error,
  onSubmit,
  onReset,
}: PasswordFormProps) {
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const password = inputRef.current?.value ?? '';
    if (!password) return;
    onSubmit(password);
  };

  const handleReset = () => {
    if (inputRef.current) inputRef.current.value = '';
    onReset();
  };

  return (
    <div className="password-form">
      {/* Bundle summary card */}
      <div className="bundle-card">
        <div className="bundle-card__header">
          <div className="bundle-card__icon">
            <FileIcon />
          </div>
          <span className="bundle-card__name">{fileName}</span>
        </div>

        <div className="bundle-card__row">
          <span className="bundle-card__label">Wallets</span>
          <span className="bundle-card__value">{walletCount}</span>
        </div>
        <div className="bundle-card__row" style={{ marginTop: 4 }}>
          <span className="bundle-card__label">Encryption</span>
          <span className="bundle-card__algo-badge">
            <ShieldCheckIcon />
            {algorithm}
          </span>
        </div>
      </div>

      {/* Password entry */}
      <form onSubmit={handleSubmit} autoComplete="off">
        <label className="password-form__label" htmlFor="export-password">
          Export password
        </label>

        <div className="password-form__input-wrap">
          <input
            id="export-password"
            ref={inputRef}
            className="password-form__input"
            type={show ? 'text' : 'password'}
            placeholder="Enter your export password"
            autoComplete="off"
            autoFocus
            disabled={decrypting}
            aria-describedby={error ? 'decrypt-error' : undefined}
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
          <div id="decrypt-error" className="password-form__error" role="alert">
            <AlertIcon />
            {error}
          </div>
        )}

        <div className="password-form__actions">
          <button type="button" className="btn btn--ghost" onClick={handleReset} disabled={decrypting}>
            <ArrowLeftIcon />
            Back
          </button>
          <button type="submit" className="btn btn--primary" disabled={decrypting}>
            {decrypting ? (
              <>
                <SpinnerInline />
                Decrypting…
              </>
            ) : (
              'Decrypt Wallets'
            )}
          </button>
        </div>
      </form>
    </div>
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
