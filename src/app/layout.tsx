import type { Metadata } from "next";
import { Bodoni_Moda, Hanken_Grotesk, DM_Mono } from "next/font/google";
import "./tokens.css";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";

// Two voices + a mono, self-hosted by next/font. Display is a high-contrast editorial serif
// (Bodoni Moda, the GT-Sectra/Canela register), body a premium grotesk (Hanken Grotesk,
// Satoshi-adjacent), mono reserved for the atelier process + technical metadata (DM Mono).
const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-bodoni",
  display: "swap",
});
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Oviya Studio. Your product. Your model. Your shoot.",
  description:
    "Every product, a work of art. Oviya Studio turns your product into a high-fashion editorial shoot.",
  openGraph: {
    title: "Oviya Studio",
    description: "Every product, a work of art.",
    siteName: "Oviya Studio",
    images: ["/brand/hero-2.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Oviya Studio",
    description: "Every product, a work of art.",
    images: ["/brand/hero-2.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${bodoni.variable} ${hanken.variable} ${dmMono.variable}`}>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
          <div className="grain" aria-hidden="true" />
        </ThemeProvider>
      </body>
    </html>
  );
}
