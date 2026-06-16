"use client";
import { useRef, useState } from "react";

export interface UploadedItem {
  path: string;
  url: string;
}

// Drag/drop or tap uploader. Posts to /api/uploads and returns the stored path + signed preview URL.
export function Uploader({
  label,
  hint,
  onUploaded,
}: {
  label: string;
  hint?: string;
  onUploaded: (item: UploadedItem) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      onUploaded(json as UploadedItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function onFiles(files: FileList | null) {
    if (files && files[0]) upload(files[0]);
  }

  return (
    <div>
      <button
        type="button"
        className="tile"
        data-selected={dragOver}
        style={{ width: "100%", padding: 28, borderStyle: "dashed", textAlign: "center" }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{busy ? "Uploading..." : label}</div>
        {hint && <div className="muted" style={{ fontSize: 13 }}>{hint}</div>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
