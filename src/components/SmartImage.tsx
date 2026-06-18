"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Renders a private storage object via a fresh signed URL, and auto-refreshes on expiry (403 /
// load error) so previews never break. Pass the storage `path`; the component fetches the signed
// URL from /api/media. (Fixes v1's broken previews when signed URLs expired.)

export function SmartImage({
  path,
  alt,
  isVideo,
  className,
  style,
}: {
  path: string;
  alt: string;
  isVideo?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const retries = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/media?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      setUrl(json.url as string);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [path]);

  useEffect(() => {
    retries.current = 0;
    refresh();
  }, [refresh]);

  function onError() {
    if (retries.current < 2) {
      retries.current += 1;
      refresh();
    } else {
      setFailed(true);
    }
  }

  if (failed) {
    return (
      <div className={className} style={{ display: "grid", placeItems: "center", background: "var(--ink-soft)", color: "var(--fog)", fontSize: 12, ...style }}>
        Preview unavailable
      </div>
    );
  }
  if (!url) {
    return <div className={`skeleton ${className ?? ""}`} style={style} aria-busy="true" />;
  }
  if (isVideo) {
    return <video src={url} className={className} style={style} muted playsInline onError={onError} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} style={style} onError={onError} />;
}
