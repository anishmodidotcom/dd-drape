import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Oviya Studio. Your product. Your muse. Your shoot.",
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
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}
