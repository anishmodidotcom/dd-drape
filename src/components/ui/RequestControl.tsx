"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { easeOut } from "@/lib/motion";

// The reusable escape hatch. Drop it wherever a user might want a control we don't offer yet: a
// tasteful "Can't find what you want?" affordance that opens a small write-to-us field and captures
// their words. Later phases wire onSubmit to persistence; here it captures and acknowledges.
export function RequestControl({
  label = "Can't find the look you want?",
  placeholder = "Describe it in your words. We're listening.",
  context,
  onSubmit,
}: {
  label?: string;
  placeholder?: string;
  /** Where in the product this was asked from, for later routing. */
  context?: string;
  onSubmit?: (text: string, context?: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    await onSubmit?.(text.trim(), context);
    setSent(true);
  }

  if (sent) {
    return (
      <p className="serif-italic" style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
        Noted, and on our list. Thank you for the steer.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--text-muted)", textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: "var(--border-strong)" }}
      >
        {label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={easeOut}
            style={{ overflow: "hidden" }}
          >
            <div style={{ display: "grid", gap: 10, paddingTop: 12 }}>
              <textarea
                className="input"
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder}
                style={{ fontSize: 14 }}
              />
              <div>
                <button className="btn btn-primary" style={{ fontSize: 13, padding: "9px 16px" }} onClick={submit}>
                  Send it to the atelier
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
