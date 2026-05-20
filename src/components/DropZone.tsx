import { useState, useCallback, useRef } from 'react';

interface DropZoneProps {
  onFileLoaded: (content: string, name: string) => void;
  onError: (msg: string) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function ShieldLockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <rect x="9" y="11" width="6" height="5" rx="1" />
      <path d="M10 11V9a2 2 0 1 1 4 0v2" />
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

export function DropZone({ onFileLoaded, onError }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      onError('Please select a .json wallet bundle file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      onError('File is too large to be a valid wallet bundle.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result;
      if (typeof content !== 'string') {
        onError('Could not read file contents.');
        return;
      }
      onFileLoaded(content, file.name);
    };
    reader.onerror = () => onError('Failed to read file.');
    reader.readAsText(file, 'utf-8');
  }, [onFileLoaded, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleClick = () => inputRef.current?.click();
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') handleClick();
  };

  return (
    <>
      <div
        className={`drop-zone${dragging ? ' drop-zone--active' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label="Drop wallet bundle JSON file or click to browse"
        style={{ animation: 'fadeUp 0.3s var(--ease) both' }}
      >
        <div className="drop-zone__icon-wrap">
          <ShieldLockIcon />
        </div>

        <div className="drop-zone__title">
          {dragging ? 'Release to load bundle' : 'Drop your wallet bundle here'}
        </div>

        <div className="drop-zone__sub">
          Encrypted <code>.json</code> export from NimbusMint.<br />
          Decryption happens entirely offline — nothing leaves this device.
        </div>

        <div className="drop-zone__footer">
          <span className="btn btn--ghost btn--sm" aria-hidden="true">
            <UploadIcon />
            Browse files
          </span>
          <span className="drop-zone__divider">or drag and drop</span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleInputChange}
        tabIndex={-1}
        aria-hidden="true"
      />
    </>
  );
}
