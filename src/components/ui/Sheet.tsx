"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { spring } from "@/lib/motion";

// Drawer / sheet that slides in from an edge, with a scrim. Glass only here (overlay). Dual-mode.
export function Sheet({
  open,
  onClose,
  side = "right",
  width = 420,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  side?: "right" | "left" | "bottom";
  width?: number;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  const reduce = useReducedMotion();
  const bottom = side === "bottom";
  const off = side === "left" ? { x: "-100%" } : side === "right" ? { x: "100%" } : { y: "100%" };
  const panelStyle: React.CSSProperties = bottom
    ? { left: 0, right: 0, bottom: 0, maxHeight: "85vh", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }
    : { top: 0, bottom: 0, [side]: 0, width: "min(92vw, " + width + "px)" };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ position: "fixed", inset: 0, background: "color-mix(in oklab, var(--surface-sunken) 55%, transparent)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 60 }}
        >
          <motion.div
            className="glass"
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? { opacity: 0 } : off}
            animate={reduce ? { opacity: 1 } : { x: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : off}
            transition={spring}
            style={{
              position: "absolute",
              background: "var(--surface-raised)",
              borderColor: "var(--border-subtle)",
              boxShadow: "var(--shadow-3)",
              padding: 24,
              overflowY: "auto",
              ...panelStyle,
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
