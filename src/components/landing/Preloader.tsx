"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Wordmark } from "@/components/ui/Wordmark";

// A branded pre-loader tied to actual critical-asset load: the wordmark + a refined progress strip,
// revealing the experience only when the hero imagery is decoded. A real luxury moment, not a fake
// spinner. Honors reduced-motion (instant), and never blocks longer than a hard timeout.
export function Preloader({ assets }: { assets: string[] }) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setDone(true); return; }
    let loaded = 0;
    const total = assets.length || 1;
    let cancelled = false;
    const bump = () => { loaded += 1; if (!cancelled) setProgress(Math.round((loaded / total) * 100)); if (loaded >= total) finish(); };
    const finish = () => { if (!cancelled) setTimeout(() => setDone(true), 350); };
    assets.forEach((src) => { const img = new Image(); img.onload = bump; img.onerror = bump; img.src = src; });
    const hard = setTimeout(finish, 3500); // never hang
    return () => { cancelled = true; clearTimeout(hard); };
  }, [assets]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "var(--surface-base)", display: "grid", placeItems: "center" }}
        >
          <div style={{ display: "grid", gap: 22, justifyItems: "center", width: "min(420px, 80vw)" }}>
            <Wordmark size="lg" />
            <div style={{ width: "100%", height: 1, background: "var(--border-subtle)", position: "relative", overflow: "hidden" }}>
              <motion.div animate={{ width: `${progress}%` }} transition={{ ease: "linear" }} style={{ position: "absolute", inset: 0, right: "auto", background: "var(--accent-default)" }} />
            </div>
            <span className="mono" style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--text-muted)" }}>PREPARING THE STUDIO, {progress}%</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
