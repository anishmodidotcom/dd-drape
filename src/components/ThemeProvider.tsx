"use client";
import { ThemeProvider as NextThemes } from "next-themes";

// Dual-mode theming. Class strategy (.light / .dark on <html>), persisted, with dark as the default
// so the existing app keeps its register until later phases tune the studio/landing for light.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
