// Auth screens: ink background, porcelain card, Fraunces headline (Section 7.2).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--ink)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>{children}</div>
    </main>
  );
}
