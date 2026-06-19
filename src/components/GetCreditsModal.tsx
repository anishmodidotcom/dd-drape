"use client";
import { useState } from "react";

// Payments stub (Section 9). No live checkout in v1.
export function GetCreditsModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Get more credits
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(22,22,22,0.55)", display: "grid", placeItems: "center", padding: 24, zIndex: 50 }}
          onClick={() => setOpen(false)}
        >
          <div className="card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 22, marginBottom: 8 }}>Payments are coming soon</h3>
            <p className="muted" style={{ marginBottom: 16 }}>
              You started with 400 free credits to validate quality. Want more credits to test, or
              bulk pricing for your catalogue? Contact us and we will set you up.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <a className="btn btn-primary" href="mailto:hello@drape.studio?subject=Oviya%20Studio%20credits">
                Contact us
              </a>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
