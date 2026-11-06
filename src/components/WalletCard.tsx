import { useState, useCallback, useRef } from 'react';
import type { DecryptedWallet } from '../types/wallet';
import { useClipboard } from '../hooks/useClipboard';

interface WalletCardProps {
  wallet: DecryptedWallet;
  index: number;
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

const REVEAL_SECONDS = 15;

/* Short index label: W01, W02, … */
function walletLabel(index: number): string {
  return `W${String(index + 1).padStart(2, '0')}`;
}

interface SecretFieldProps {
  /** Visible field label, e.g. "Private Key" or "API Key · OpenSea". */
  label: string;
  /** Lower-case noun used in titles/aria labels, e.g. "private key". */
  noun: string;
  /** Short word for the copy button, e.g. "Key". */
  copyNoun: string;
  secret: string;
  /** Optional plaintext detail shown under the label (e.g. an expiry). */
  detail?: string;
}

/**
 * One secret value with hold-to-reveal, a 15 s toggle reveal, and copy with a
 * 30 s clipboard auto-clear. Each instance owns its own reveal and clipboard
 * state, so revealing an API key never reveals the private key and vice versa.
 */
function SecretField({ label, noun, copyNoun, secret, detail }: SecretFieldProps) {
  const [revealing, setRevealing] = useState(false);
  const [toggleRevealed, setToggleRevealed] = useState(false);
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);
  const revealIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [copied, setCopied] = useState(false);
  const { countdown, copyWithAutoClear, cancelClear } = useClipboard();

  const isRevealed = revealing || toggleRevealed;

  const startReveal = useCallback(() => setRevealing(true), []);
  const stopReveal = useCallback(() => setRevealing(false), []);

  const clearRevealTimer = useCallback(() => {
    if (revealIntervalRef.current !== null) {
      clearInterval(revealIntervalRef.current);
      revealIntervalRef.current = null;
    }
    setRevealCountdown(null);
  }, []);

  const toggleReveal = useCallback(() => {
    if (toggleRevealed) {
      setToggleRevealed(false);
      setRevealing(false);
      clearRevealTimer();
    } else {
      setToggleRevealed(true);
      setRevealCountdown(REVEAL_SECONDS);
      let remaining = REVEAL_SECONDS;
      revealIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(revealIntervalRef.current!);
          revealIntervalRef.current = null;
          setToggleRevealed(false);
          setRevealCountdown(null);
        } else {
          setRevealCountdown(remaining);
        }
      }, 1000);
    }
  }, [toggleRevealed, clearRevealTimer]);

  const copySecret = async () => {
    if (countdown !== null) {
      cancelClear();
      return;
    }
    try {
      await copyWithAutoClear(secret, 30);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard denied */ }
  };

  const copyClass = [
    'copy-btn',
    copied ? 'copy-btn--copied' : countdown !== null ? 'copy-btn--counting' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="wallet-card__field">
      <div className="wallet-card__field-label">{label}</div>
      {detail && (
        <div className="wallet-card__id" style={{ marginBottom: 6 }}>{detail}</div>
      )}
      <div className="wallet-card__field-row">
        <div
          className={`wallet-card__value${isRevealed ? ' wallet-card__value--revealed' : ' wallet-card__value--masked'}`}
          aria-label={isRevealed ? `${label} visible` : `${label} hidden`}
        >
          {secret}
        </div>
      </div>

      <div className="wallet-card__actions">
        {/* Hold-to-reveal */}
        <button
          className={`reveal-btn${revealing ? ' reveal-btn--active' : ''}`}
          onMouseDown={startReveal}
          onMouseUp={stopReveal}
          onMouseLeave={stopReveal}
          onTouchStart={startReveal}
          onTouchEnd={stopReveal}
          title={`Hold to reveal ${noun}`}
          aria-label={`Hold to reveal ${noun}`}
        >
          <EyeIcon />
          Hold to reveal
        </button>

        {/* Toggle reveal — auto-hides after 15 s */}
        <button
          className={`reveal-btn${toggleRevealed ? ' reveal-btn--active' : ''}`}
          onClick={toggleReveal}
          title={toggleRevealed ? `Hide ${noun}` : `Show ${noun} (15 s max)`}
          aria-label={toggleRevealed ? `Hide ${noun}` : `Show ${noun}`}
        >
          {toggleRevealed ? <EyeOffIcon /> : <EyeIcon />}
          {toggleRevealed
            ? `Hide${revealCountdown !== null ? ` (${revealCountdown}s)` : ''}`
            : 'Show'}
        </button>

        {/* Copy with auto-clear */}
        <button
          className={copyClass}
          onClick={copySecret}
          title={countdown !== null ? 'Click to clear clipboard now' : `Copy ${noun} — auto-clears in 30s`}
          aria-label={`Copy ${noun}`}
        >
          {copied ? (
            <><CheckIcon />Copied!</>
          ) : countdown !== null ? (
            <><TimerIcon />Clear in {countdown}s</>
          ) : (
            <><CopyIcon />Copy {copyNoun}</>
          )}
        </button>
      </div>

      <div
        className="clipboard-hint"
        style={{ marginTop: 8, visibility: countdown !== null && !copied ? 'visible' : 'hidden' }}
      >
        <WarningIcon />
        Clipboard clears in {countdown ?? 30}s — click Copy {copyNoun} to clear now.
      </div>
    </div>
  );
}

export function WalletCard({ wallet, index }: WalletCardProps) {
  const [copiedAddr, setCopiedAddr] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2000);
    } catch { /* clipboard denied */ }
  };

  const cardStyle: React.CSSProperties = { animationDelay: `${index * 55}ms` };

  return (
    <div className="wallet-card" style={cardStyle}>
      {/* Header */}
      <div className="wallet-card__header">
        <div className="wallet-card__identity">
          <div className="wallet-card__avatar" aria-hidden="true">
            {walletLabel(index)}
          </div>
          <div>
            <div className="wallet-card__name">{wallet.name}</div>
            <div className="wallet-card__id">{wallet.walletId}</div>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="wallet-card__field">
        <div className="wallet-card__field-label">Address</div>
        <div className="wallet-card__value selectable">
          {wallet.address}
        </div>
        <div className="wallet-card__actions">
          <button
            className={`copy-btn${copiedAddr ? ' copy-btn--copied' : ''}`}
            onClick={copyAddress}
            title="Copy address"
            aria-label="Copy address"
          >
            {copiedAddr ? <CheckIcon /> : <CopyIcon />}
            {copiedAddr ? 'Copied!' : 'Copy Address'}
          </button>
        </div>
      </div>

      {/* Private key */}
      <SecretField
        label="Private Key"
        noun="private key"
        copyNoun="Key"
        secret={wallet.privateKey}
      />

      {/* API keys (optional; e.g. the OpenSea developer key for this wallet) */}
      {(wallet.apiKeys ?? []).map((k, i) => (
        <SecretField
          key={`${i}-${k.name}`}
          label={`API Key · ${k.name}`}
          noun={`API key ${k.name}`}
          copyNoun="API Key"
          secret={k.apiKey}
          detail={k.expiresAt ? `Expires ${k.expiresAt}` : undefined}
        />
      ))}
    </div>
  );
}
