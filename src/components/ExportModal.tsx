import { useState, useRef } from 'react';
import type { DecryptedWallet, KdfParams } from '../types/wallet';

type ExportStep = 'choose' | 'plaintext-confirm' | 'encrypted-password';
type ExportFormat = 'txt' | 'csv' | 'encrypted';

const CONFIRM_PHRASE = 'I UNDERSTAND';

interface ExportModalProps {
  wallets: DecryptedWallet[];
  bundleKdf: KdfParams;
  onClose: () => void;
}

/* ─── Icons ─── */
function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="12" y1="9" x2="12" y2="21" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

function WarningIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
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

/* ─── Step indicator ─── */
function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%',
      background: done ? 'var(--accent)' : active ? 'var(--sky-400)' : 'var(--border-strong)',
      transition: 'background 200ms var(--ease)',
    }} />
  );
}

export function ExportModal({ wallets, bundleKdf, onClose }: ExportModalProps) {
  const [step, setStep] = useState<ExportStep>('choose');
  const [format, setFormat] = useState<ExportFormat | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [encPassword, setEncPassword] = useState('');
  const [encPasswordConfirm, setEncPasswordConfirm] = useState('');
  const [showEnc, setShowEnc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const confirmRef = useRef<HTMLInputElement>(null);

  const confirmValid = confirmInput === CONFIRM_PHRASE;
  const encPasswordsMatch = encPassword.length >= 8 && encPassword === encPasswordConfirm;
  const handleChoose = (f: ExportFormat) => {
    setFormat(f);
    setSaveError(null);
    setStep(f === 'encrypted' ? 'encrypted-password' : 'plaintext-confirm');
  };

  const handleSavePlaintext = async () => {
    if (!confirmValid || !format || format === 'encrypted') return;
    setSaving(true);
    setSaveError(null);
    try {
      const req = {
        wallets: wallets.map(w => ({ name: w.name, address: w.address, privateKey: w.privateKey })),
        format: format as 'txt' | 'csv',
      };
      const saved = await window.electronAPI.file.saveText(req);
      if (saved) {
        onClose();
      } else {
        setSaveError('Save was cancelled.');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEncrypted = async () => {
    if (!encPasswordsMatch) return;
    setSaving(true);
    setSaveError(null);
    try {
      const req = {
        wallets: wallets.map(w => ({
          walletId: w.walletId,
          name: w.name,
          address: w.address,
          privateKey: w.privateKey,
        })),
        password: encPassword,
        kdf: bundleKdf,
      };
      const result = await window.electronAPI.file.saveEncrypted(req);
      if (result.ok) {
        onClose();
      } else if (result.error) {
        setSaveError(result.error);
      } else {
        setSaveError('Save was cancelled.');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
      setEncPassword('');
      setEncPasswordConfirm('');
    }
  };

  const goBack = () => {
    setStep('choose');
    setConfirmInput('');
    setEncPassword('');
    setEncPasswordConfirm('');
    setSaveError(null);
  };

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Export wallets">

        {/* Header */}
        <div className="modal__header">
          <div className="modal__title-group">
            <div className="modal__title">Export Wallets</div>
            <div className="modal__subtitle">
              {wallets.length} {wallets.length === 1 ? 'wallet' : 'wallets'} · choose format below
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Step dots */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <StepDot active={step === 'choose'} done={step !== 'choose'} />
              <StepDot active={step === 'plaintext-confirm' || step === 'encrypted-password'} done={false} />
            </div>
            <button className="modal__close" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* ── Step 1: Choose format ───────────────────────────────────── */}
        {step === 'choose' && (
          <div className="modal__section">
            <div className="modal__section-title">Choose export format</div>

            <button className="export-option export-option--safe" onClick={() => handleChoose('encrypted')}>
              <div className="export-option__icon-wrap">
                <LockIcon />
              </div>
              <div>
                <div className="export-option__label">Encrypted JSON Bundle</div>
                <div className="export-option__desc">
                  Re-encrypt all wallets with a new password. Same algorithm as the original — safe for storage and re-import.
                </div>
                <span className="export-risk-tag export-risk-tag--safe">
                  <ShieldIcon />
                  Recommended
                </span>
              </div>
            </button>

            <button className="export-option export-option--danger" onClick={() => handleChoose('txt')}>
              <div className="export-option__icon-wrap">
                <FileTextIcon />
              </div>
              <div>
                <div className="export-option__label">Plaintext TXT</div>
                <div className="export-option__desc">
                  Exports address + private key as plain text. Anyone with this file can drain your wallets.
                </div>
                <span className="export-risk-tag export-risk-tag--danger">
                  <WarningIcon />
                  High risk
                </span>
              </div>
            </button>

            <button className="export-option export-option--danger" onClick={() => handleChoose('csv')}>
              <div className="export-option__icon-wrap">
                <TableIcon />
              </div>
              <div>
                <div className="export-option__label">Plaintext CSV</div>
                <div className="export-option__desc">
                  Spreadsheet format. Same risk as TXT — private keys are fully exposed.
                </div>
                <span className="export-risk-tag export-risk-tag--danger">
                  <WarningIcon />
                  High risk
                </span>
              </div>
            </button>
          </div>
        )}

        {/* ── Step 2a: Plaintext confirmation ────────────────────────── */}
        {step === 'plaintext-confirm' && (
          <>
            <div className="warning-box">
              <div className="warning-box__header">
                <WarningIcon />
                <div className="warning-box__title">
                  You are about to write plaintext private keys to disk
                </div>
              </div>
              <div className="warning-box__list">
                <div className="warning-box__item">Anyone with these keys can drain your wallets instantly.</div>
                <div className="warning-box__item">Never store this file in cloud sync folders (Dropbox, Drive, iCloud).</div>
                <div className="warning-box__item">Delete the file securely when you no longer need it.</div>
                <div className="warning-box__item">NimbusMint cannot help you recover compromised wallets.</div>
              </div>
            </div>

            <div className="confirm-input-wrap" style={{ marginBottom: 16 }}>
              <label className="confirm-input-label" htmlFor="confirm-phrase">
                Type <strong>{CONFIRM_PHRASE}</strong> to acknowledge the risk
              </label>
              <input
                id="confirm-phrase"
                ref={confirmRef}
                className={`confirm-input${confirmValid ? ' confirm-input--valid' : ''}`}
                type="text"
                value={confirmInput}
                onChange={e => setConfirmInput(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                spellCheck={false}
                autoComplete="off"
                autoFocus
              />
              {confirmValid && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--success)' }}>
                  <CheckIcon />
                  Confirmed
                </div>
              )}
            </div>

            {saveError && (
              <div className="password-form__error" style={{ marginBottom: 12 }}>
                <AlertIcon />
                {saveError}
              </div>
            )}

            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={goBack}>
                <ArrowLeftIcon />
                Back
              </button>
              <button
                className="btn btn--danger"
                disabled={!confirmValid || saving}
                onClick={handleSavePlaintext}
              >
                {saving ? (
                  <><SpinnerInline /> Saving…</>
                ) : (
                  `Save ${format?.toUpperCase()} file →`
                )}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2b: Encrypted bundle password ─────────────────────── */}
        {step === 'encrypted-password' && (
          <>
            <div className="modal__section">
              <div className="modal__section-title">Set new export password</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.6 }}>
                Choose a strong password. The resulting bundle uses{' '}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>
                  {bundleKdf.algorithm}
                </span>{' '}
                and can only be opened with this password.
              </p>

              <div className="form-field">
                <label className="form-label" htmlFor="enc-password">
                  New password <span style={{ color: 'var(--text-muted)' }}>(min 8 characters)</span>
                </label>
                <div className="password-form__input-wrap">
                  <input
                    id="enc-password"
                    className="form-input"
                    style={{ paddingRight: 44 }}
                    type={showEnc ? 'text' : 'password'}
                    value={encPassword}
                    onChange={e => setEncPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="password-form__toggle"
                    onClick={() => setShowEnc(v => !v)}
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showEnc ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="enc-password-confirm">Confirm password</label>
                <input
                  id="enc-password-confirm"
                  className="form-input"
                  type={showEnc ? 'text' : 'password'}
                  value={encPasswordConfirm}
                  onChange={e => setEncPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                />
                {encPasswordConfirm.length > 0 && encPasswordsMatch && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--success)' }}>
                    <CheckIcon />
                    Passwords match
                  </div>
                )}
              </div>

              {encPassword.length > 0 && encPasswordConfirm.length > 0 && !encPasswordsMatch && (
                <div className="password-form__error" style={{ marginBottom: 12 }}>
                  <AlertIcon />
                  {encPassword.length < 8
                    ? 'Password must be at least 8 characters.'
                    : 'Passwords do not match.'}
                </div>
              )}

              {saveError && (
                <div className="password-form__error" style={{ marginBottom: 12 }}>
                  <AlertIcon />
                  {saveError}
                </div>
              )}
            </div>

            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={goBack}>
                <ArrowLeftIcon />
                Back
              </button>
              <button
                className="btn btn--primary"
                disabled={!encPasswordsMatch || saving}
                onClick={handleSaveEncrypted}
              >
                {saving ? (
                  <><SpinnerInline /> Encrypting…</>
                ) : (
                  'Choose Save Location →'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
