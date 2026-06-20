"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { resolveMedia, invalidateMedia } from "@/lib/mediaCache";

// Renders a private storage object via a signed URL resolved through the session media cache (item
// 11), so reopening a gallery reuses the cached URL (and the browser reuses the bytes) instead of
// re-resolving every time. Auto-refreshes on expiry (403 / load error) so previews never break.

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
      setUrl(await resolveMedia(path));
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
      invalidateMedia(path); // the cached URL expired; drop it so refresh re-mints
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
