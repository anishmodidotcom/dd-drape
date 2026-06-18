"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Kind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: Kind;
  message: string;
}

const ToastCtx = createContext<(message: string, kind?: Kind) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: Kind = "info") => {
    setToasts((t) => [...t, { id: Date.now() + Math.random(), kind, message }]);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="toast" data-kind={toast.kind} role="status">
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button onClick={onDone} aria-label="Dismiss" style={{ background: "none", border: "none", color: "var(--fog)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
        ×
      </button>
    </div>
  );
}
