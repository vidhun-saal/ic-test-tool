import { useCallback, useState } from 'react';
import { lms } from '../lib/ipc';
import type { UploadResult } from '../../../electron/shared/types';

interface Props {
  onUploaded: (result: UploadResult) => void;
  onError: (message: string) => void;
}

export function UploadDropzone({ onUploaded, onError }: Props) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFile = useCallback(
    async (filePath: string) => {
      setBusy(true);
      try {
        const r = await lms.uploadZip(filePath);
        if (!r.ok) onError(r.error ?? 'Unknown error');
        onUploaded(r);
      } finally {
        setBusy(false);
      }
    },
    [onUploaded, onError],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const anyFile = file as File & { path?: string };
      if (!anyFile.path) {
        onError('Could not read file path from drop event.');
        return;
      }
      if (!anyFile.path.toLowerCase().endsWith('.zip')) {
        onError('Please drop a .zip file.');
        return;
      }
      await handleFile(anyFile.path);
    },
    [handleFile, onError],
  );

  const onPick = useCallback(async () => {
    const picked = await lms.pickZip();
    if (picked) await handleFile(picked);
  }, [handleFile]);

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="icon">{busy ? '⏳' : '📦'}</div>
      <h2>{busy ? 'Extracting…' : 'Drop a Storyline xAPI zip here'}</h2>
      <p>
        The package will be unzipped to a temporary folder and served from a
        local server. Launch parameters (endpoint, actor, registration) are
        generated automatically.
      </p>
      <button className="primary" onClick={onPick} disabled={busy}>
        {busy ? 'Working…' : 'Browse for zip…'}
      </button>
    </div>
  );
}
