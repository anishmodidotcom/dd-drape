"use client";
import { useRef, useState } from "react";
import { parseJsonSafe } from "@/lib/http";
import { maybeDownscale } from "@/lib/imageDownscale";

export interface UploadedItem {
  path: string;
  url: string;
  /** Non-blocking advisory from the server (e.g. small image). */
  warning?: string | null;
}

// Drag/drop or tap uploader. Downscales oversized images in the browser (so the platform body limit
// never returns a non-JSON 413), posts to /api/uploads, and parses the response defensively so a
// non-JSON error can never surface as a raw parse crash (item 9). Small images are accepted with a
// dismissible warning (item 10).
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

  async function upload(rawFile: File) {
    setError(null);
    setBusy(true);
    try {
      const file = await maybeDownscale(rawFile);
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const parsed = await parseJsonSafe<UploadedItem>(res);
      if (!parsed.ok || !parsed.data) {
        setError(parsed.error ?? "Upload failed. Please try again.");
        return;
      }
      onUploaded(parsed.data);
    } catch {
      setError("Upload failed. Please check your connection and try again.");
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
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
