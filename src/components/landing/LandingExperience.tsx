"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import Lenis from "lenis";
import { Preloader } from "./Preloader";
import {
  LandingNav, Hero, VoidGalleryFallback, BeforeAfterGallery, Lookbook, LooksShowcase,
  Intelligence, FidelityGuarantee, Journey, GlobalMessage, Credibility, Pricing, FAQSection, Footer,
  PRELOAD, VOID_URLS,
} from "./sections";

// The WebGL gallery-in-the-void is loaded only on the client (no SSR) and falls back to the static
// editorial gallery while the chunk loads or when WebGL/reduced-motion rules it out.
const VoidGallery = dynamic(() => import("./VoidGallery").then((m) => m.VoidGallery), {
  ssr: false,
  loading: () => <VoidGalleryFallback />,
});

export function LandingExperience({ authed }: { authed: boolean }) {
  // Lenis smooth scroll, disabled under reduced-motion so the OS preference wins.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);

  return (
    <main style={{ position: "relative", zIndex: 1, background: "var(--surface-base)", color: "var(--text-primary)" }}>
      <Preloader assets={PRELOAD} />
      <LandingNav authed={authed} />
      <Hero authed={authed} />
      <VoidGallery urls={VOID_URLS} fallback={<VoidGalleryFallback />} />
      <BeforeAfterGallery />
      <Intelligence />
      <Lookbook />
      <FidelityGuarantee />
      <LooksShowcase />
      <Journey authed={authed} />
      <GlobalMessage />
      <Credibility />
      <Pricing authed={authed} />
      <FAQSection />
      <Footer />
    </main>
  );
}
