"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { Wordmark } from "@/components/ui/Wordmark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Reveal } from "@/components/ui/Reveal";
import { BeforeAfter } from "@/components/BeforeAfter";
import { AliveMesh } from "./AliveMesh";
import { TIERS, FREE_GRANT, CURRENCY, LAUNCH_PRICING, approxOutputs, SUPPORT_EMAIL } from "@/lib/pricing";

/* eslint-disable @next/next/no-img-element */

const HERO_IMG = "/v4/hero/hero-dark.png";
const VOID_IMAGES = [
  "/v4/gallery/g-saree.png", "/v4/gallery/g-medit.png", "/v4/gallery/g-jewellery.png", "/v4/gallery/g-quiet.png",
  "/v4/gallery/g-lehenga.png", "/v4/gallery/g-eastasian.png", "/v4/gallery/g-brutalist.png", "/v4/gallery/g-street.png",
  "/v4/gallery/g-sherwani.png", "/v4/gallery/g-painterly.png", "/v4/gallery/g-accessory.png", "/v4/gallery/g-anarkali.png",
];
export const PRELOAD = [HERO_IMG, "/v4/hero/hero-light.png", ...VOID_IMAGES.slice(0, 4)];
export const VOID_URLS = VOID_IMAGES;

const EDITS = [
  { title: "Heritage", n: "01", items: [["/v4/gallery/g-saree.png", "Kanjivaram"], ["/v4/gallery/g-lehenga.png", "Bridal couture"], ["/v4/gallery/g-anarkali.png", "Festive"], ["/v4/gallery/g-sherwani.png", "Menswear"]] },
  { title: "The Global Eye", n: "02", items: [["/v4/gallery/g-medit.png", "Mediterranean"], ["/v4/gallery/g-eastasian.png", "Minimal studio"], ["/v4/gallery/g-quiet.png", "Quiet luxury"], ["/v4/gallery/g-brutalist.png", "Brutalist set"]] },
  { title: "Fine Things", n: "03", items: [["/v4/gallery/g-jewellery.png", "Fine jewellery"], ["/v4/gallery/g-accessory.png", "Accessories"], ["/v4/gallery/g-macro.png", "Craft macro"], ["/v4/gallery/g-mature.png", "Timeless"]] },
];
const LOOKS = [["/looks/look-red-carpet.png", "Red Carpet"], ["/looks/look-quiet-luxury.png", "Quiet Luxury"], ["/looks/look-sun-drenched.png", "Sun-drenched"], ["/looks/look-noir.png", "Noir"], ["/looks/look-heritage.png", "Heritage"], ["/looks/look-painterly.png", "Painterly"], ["/looks/look-catalog.png", "Catalog"], ["/looks/look-brutalist.png", "Brutalist"]];
const PAIRS = [["/before-after/1-before.png", "/before-after/1-after.png", "Chikankari kurta"], ["/before-after/2-before.png", "/before-after/2-after.png", "Bridal lehenga"], ["/before-after/3-before.png", "/before-after/3-after.png", "Cotton shirt"]];
const ATELIER = ["Reading the garment", "Preserving fabric and drape", "Casting the model", "Setting the light", "Composing the frame", "Final retouch"];
const FAQ = [
  { q: "Will it keep my exact print, colour and embroidery?", a: "Yes. Oviya is reference-locked: your uploaded product is the anchor for every shoot, and a fidelity check compares the result to your original before delivery. We enhance and place your piece, we never reinvent it. If it drifts, you are not charged." },
  { q: "Do I own the images? Can I use them commercially?", a: "The shoots you create are yours, for your catalogue, ads, marketplaces and social. You confirm you hold the rights to the product photos you upload." },
  { q: "What sizes and formats do I get?", a: "Clean, high-resolution files in the aspect you choose: portrait, square, story and landscape, sized for marketplaces and social. Downloads are the full file, not a watermarked preview." },
  { q: "How fast is it?", a: "A still is typically ready in well under a minute. A directed multi-frame shoot or a video takes a little longer. You can keep working while it renders." },
  { q: "How do credits work?", a: "One credit is one cent of generation. A draft still costs a few credits, a hero still a little more, a video more again. Every signup starts with free credits to try real shoots before you spend." },
  { q: "What can it not do yet?", a: "We preserve products we can see; we do not fabricate facet-level detail that is not in your photo, and we are honest when a request is outside our latitude. Video is in beta." },
  { q: "Is my data private?", a: "Your uploads and shoots are private to your account, served over short-lived signed links, with EXIF stripped on upload. We do not sell your data." },
  { q: "Can I keep the same model across my whole catalogue?", a: "Yes. Cast a model once, or upload your own, and reuse the exact face and body across every product." },
];

export function LandingNav({ authed }: { authed: boolean }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px clamp(20px, 5vw, 56px)", background: "color-mix(in oklab, var(--surface-base) 70%, transparent)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--border-subtle)" }}>
      <Link href="/" aria-label="Oviya Studio"><Wordmark size="md" /></Link>
      <nav style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <a href="#pricing" className="appbar-tab" style={{ display: "none" }} data-desktoponly>Pricing</a>
        <ThemeToggle />
        {authed ? (
          <Link href="/app/new" className="btn btn-primary" style={{ padding: "9px 18px" }}>Enter the Studio</Link>
        ) : (
          <>
            <Link href="/login" className="btn btn-ghost" style={{ padding: "9px 16px" }}>Sign in</Link>
            <Link href="/signup" className="btn btn-primary" style={{ padding: "9px 18px" }}>Start your shoot</Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function Hero({ authed }: { authed: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0); const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 120, damping: 20 }); const sy = useSpring(my, { stiffness: 120, damping: 20 });
  const imgX = useTransform(sx, (v) => v * 18); const imgY = useTransform(sy, (v) => v * 18);
  const txtX = useTransform(sx, (v) => v * -10);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const fade = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const lift = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const cta = authed ? { href: "/app/new", label: "Enter the Studio" } : { href: "/signup", label: "Start your shoot" };

  return (
    <section
      ref={ref}
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5); }}
      style={{ position: "relative", minHeight: "100vh", overflow: "hidden", display: "grid", alignItems: "center" }}
    >
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}><AliveMesh /></div>
      <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.5, background: "radial-gradient(120% 80% at 70% 30%, transparent, var(--surface-base))" }} />
      <motion.div style={{ opacity: fade, y: lift, position: "relative", zIndex: 2, display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 40, alignItems: "center", maxWidth: 1240, margin: "0 auto", padding: "0 clamp(20px, 5vw, 56px)", width: "100%" }} className="hero-grid">
        <motion.div style={{ x: txtX }}>
          <p className="mono" style={{ fontSize: 12, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--accent-default)", marginBottom: 20 }}>Every product, a work of art</p>
          <h1 className="display" style={{ fontSize: "clamp(48px, 8vw, 104px)", lineHeight: 0.98, letterSpacing: "-0.02em" }}>
            Your product.<br />Your model.<br /><span className="serif-italic" style={{ color: "var(--accent-default)" }}>Your shoot.</span>
          </h1>
          <p style={{ fontSize: 20, color: "var(--text-secondary)", marginTop: 24, maxWidth: "42ch" }}>
            Oviya turns the product you already sell into a high-fashion editorial. Hand us the garment. We&apos;ll handle the drama.
          </p>
          <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Link href={cta.href} className="btn btn-primary" style={{ fontSize: 16, padding: "16px 30px" }}>{cta.label}</Link>
            {!authed && <span className="muted" style={{ fontSize: 13 }}>Start with {FREE_GRANT} free credits.</span>}
          </div>
        </motion.div>
        <motion.div style={{ x: imgX, y: imgY, position: "relative", borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-3)" }}>
          <img src={HERO_IMG} alt="Oviya editorial" style={{ width: "100%", display: "block", aspectRatio: "4/5", objectFit: "cover" }} />
        </motion.div>
      </motion.div>
      <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 2 }} className="mono" >
        <span style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--text-muted)" }}>SCROLL</span>
      </div>
    </section>
  );
}

export function VoidGalleryFallback() {
  return (
    <section style={{ padding: "clamp(48px, 8vw, 120px) clamp(20px, 5vw, 56px)", maxWidth: 1240, margin: "0 auto" }}>
      <Reveal><p className="mono" style={{ fontSize: 12, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--accent-default)" }}>The range</p>
        <h2 className="display" style={{ fontSize: "clamp(40px, 7vw, 88px)", lineHeight: 0.95, margin: "8px 0 28px" }}>A house without walls</h2></Reveal>
      <div style={{ columnWidth: 240, columnGap: 16 }}>
        {VOID_URLS.map((src, i) => (
          <Reveal key={src} delay={(i % 4) * 0.05}><img src={src} alt="editorial" loading="lazy" style={{ width: "100%", marginBottom: 16, borderRadius: 12, border: "1px solid var(--border-subtle)", display: "block" }} /></Reveal>
        ))}
      </div>
    </section>
  );
}

export function BeforeAfterGallery() {
  return (
    <section style={{ padding: "clamp(48px, 7vw, 110px) clamp(20px, 5vw, 56px)", maxWidth: 1240, margin: "0 auto" }}>
      <Reveal>
        <p className="mono" style={{ fontSize: 12, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--accent-default)" }}>Will it keep my exact product?</p>
        <h2 className="display" style={{ fontSize: "clamp(34px, 5vw, 64px)", margin: "8px 0 10px" }}>Drag to reveal</h2>
        <p className="muted" style={{ maxWidth: "54ch", marginBottom: 30 }}>The same flat-lay you would put on a marketplace, placed on a model with the colour, weave and embroidery intact.</p>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
        {PAIRS.map(([b, a, label], i) => (
          <Reveal key={label} delay={i * 0.08}>
            <BeforeAfter before={b} after={a} alt={label} />
            <p className="muted" style={{ fontSize: 13, marginTop: 10, textAlign: "center" }}>{label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Lookbook() {
  return (
    <section style={{ padding: "clamp(40px, 6vw, 90px) clamp(20px, 5vw, 56px)", maxWidth: 1280, margin: "0 auto", display: "grid", gap: 56 }}>
      <Reveal><h2 className="display" style={{ fontSize: "clamp(34px, 5vw, 64px)" }}>The lookbook, in edits</h2></Reveal>
      {EDITS.map((edit) => (
        <div key={edit.n}>
          <Reveal><div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
            <span className="mono accent" style={{ fontSize: 12 }}>EDIT {edit.n}</span>
            <h3 className="display" style={{ fontSize: "clamp(22px, 3vw, 34px)" }}>{edit.title}</h3>
          </div></Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {edit.items.map(([src, label], i) => (
              <Reveal key={src} delay={i * 0.05}>
                <div style={{ position: "relative", borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                  <img src={src} alt={label} loading="lazy" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
                  <span className="chip glass" style={{ position: "absolute", bottom: 10, left: 10, fontSize: 11, color: "#fff", borderColor: "transparent" }}>{label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function LooksShowcase() {
  return (
    <section style={{ padding: "clamp(40px, 6vw, 90px) clamp(20px, 5vw, 56px)", maxWidth: 1280, margin: "0 auto" }}>
      <Reveal><p className="mono accent" style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase" }}>Editorials</p>
        <h2 className="display" style={{ fontSize: "clamp(30px, 4.5vw, 56px)", margin: "8px 0 24px" }}>Eight signature looks, or describe your own</h2></Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {LOOKS.map(([src, label], i) => (
          <Reveal key={src} delay={i * 0.04}>
            <motion.div whileHover={{ scale: 1.03 }} transition={{ type: "spring", stiffness: 350, damping: 18 }} style={{ position: "relative", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
              <img src={src} alt={label} loading="lazy" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
              <span style={{ position: "absolute", bottom: 8, left: 8, fontFamily: "var(--font-display)", fontSize: 13, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{label}</span>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Intelligence() {
  return (
    <section style={{ padding: "clamp(48px, 7vw, 110px) clamp(20px, 5vw, 56px)", borderTop: "1px solid var(--border-subtle)", maxWidth: 1100, margin: "0 auto" }}>
      <Reveal>
        <p className="mono accent" style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase" }}>The intelligence</p>
        <h2 className="display" style={{ fontSize: "clamp(30px, 4.5vw, 56px)", margin: "8px 0 12px", maxWidth: "18ch" }}>It reads your piece, then works the shoot like a studio.</h2>
        <p className="muted" style={{ maxWidth: "56ch", marginBottom: 36 }}>Oviya understands the photo you upload, understands exactly what you ask for, and runs a real atelier process for every frame, the way a house actually works a shoot.</p>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 2, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--border-subtle)" }}>
        {ATELIER.map((step, i) => (
          <Reveal key={step} delay={i * 0.06}>
            <div style={{ background: "var(--surface-base)", padding: 20, minHeight: 130, display: "grid", alignContent: "space-between" }}>
              <span className="mono accent" style={{ fontSize: 12 }}>{String(i + 1).padStart(2, "0")}</span>
              <span className="display" style={{ fontSize: 18 }}>{step}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function FidelityGuarantee() {
  return (
    <section style={{ padding: "clamp(56px, 9vw, 140px) clamp(20px, 5vw, 56px)", textAlign: "center", maxWidth: 900, margin: "0 auto" }}>
      <Reveal>
        <p className="mono accent" style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase" }}>The guarantee</p>
        <h2 className="display" style={{ fontSize: "clamp(36px, 6vw, 84px)", lineHeight: 1, margin: "14px 0" }}>The exact product,<br />or your credits back.</h2>
        <p className="muted" style={{ maxWidth: "48ch", margin: "0 auto" }}>A fidelity check compares every result against your original. If the colour, print or piece drifts, we do not deliver it and you are not charged. That is the whole point.</p>
      </Reveal>
    </section>
  );
}

export function Journey({ authed }: { authed: boolean }) {
  const steps = [
    { k: "Upload", v: "Your real piece. It becomes the anchor.", img: "/v4/empty/sample-product.png" },
    { k: "Direct", v: "Cast, set the light, pick a look. Or just describe it.", img: "/v4/gallery/g-quiet.png" },
    { k: "Shoot", v: "A premium editorial that keeps every thread.", img: "/v4/gallery/g-saree.png" },
  ];
  return (
    <section style={{ padding: "clamp(40px, 6vw, 90px) clamp(20px, 5vw, 56px)", maxWidth: 1240, margin: "0 auto", borderTop: "1px solid var(--border-subtle)" }}>
      <Reveal><h2 className="display" style={{ fontSize: "clamp(30px, 4.5vw, 56px)", marginBottom: 32 }}>From your shelf to the set</h2></Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
        {steps.map((s, i) => (
          <Reveal key={s.k} delay={i * 0.1}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--border-subtle)", aspectRatio: "4/5" }}>
                <img src={s.img} alt={s.k} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: i === 0 ? "grayscale(0.2)" : "none" }} />
              </div>
              <div><span className="mono accent" style={{ fontSize: 12 }}>{String(i + 1).padStart(2, "0")}</span> <span className="display" style={{ fontSize: 22, marginLeft: 6 }}>{s.k}</span></div>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>{s.v}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal><div style={{ marginTop: 32 }}><Link href={authed ? "/app/new" : "/signup"} className="btn btn-primary" style={{ padding: "14px 26px" }}>{authed ? "Enter the Studio" : "Start your shoot"}</Link></div></Reveal>
    </section>
  );
}

export function GlobalMessage() {
  return (
    <section style={{ position: "relative", overflow: "hidden", padding: "clamp(64px, 10vw, 160px) clamp(20px, 5vw, 56px)", textAlign: "center" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}><AliveMesh /></div>
      <div style={{ position: "absolute", inset: 0, background: "color-mix(in oklab, var(--surface-base) 55%, transparent)" }} />
      <Reveal>
        <div style={{ position: "relative", zIndex: 2, maxWidth: 900, margin: "0 auto" }}>
          <p className="mono accent" style={{ fontSize: 12, letterSpacing: "0.24em", textTransform: "uppercase" }}>Without borders</p>
          <h2 className="display" style={{ fontSize: "clamp(34px, 6vw, 80px)", lineHeight: 1.02, margin: "14px 0" }}>Let your imagination go international.</h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "50ch", margin: "0 auto", fontSize: 18 }}>One studio for a label in Jaipur, a maison in Paris and a boutique in Lagos. The same craft, every culture, every skin tone, every look.</p>
        </div>
      </Reveal>
    </section>
  );
}

export function Credibility() {
  return (
    <section style={{ padding: "clamp(48px, 8vw, 120px) clamp(20px, 5vw, 56px)", maxWidth: 900, margin: "0 auto", textAlign: "center", borderTop: "1px solid var(--border-subtle)" }}>
      <Reveal>
        <p className="serif-italic" style={{ fontSize: "clamp(22px, 3.2vw, 34px)", lineHeight: 1.35, color: "var(--text-primary)" }}>The intelligence behind Oviya is built with veterans from the fashion and photography industry.</p>
        <p className="muted" style={{ marginTop: 16 }}>Editorial taste, reference-locked fidelity. A studio team, in software.</p>
      </Reveal>
    </section>
  );
}

export function Pricing({ authed }: { authed: boolean }) {
  return (
    <section id="pricing" style={{ padding: "clamp(48px, 7vw, 110px) clamp(20px, 5vw, 56px)", maxWidth: 1200, margin: "0 auto", borderTop: "1px solid var(--border-subtle)" }}>
      <Reveal style={{ textAlign: "center", marginBottom: 12 }}>
        <p className="mono accent" style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase" }}>Credits</p>
        <h2 className="display" style={{ fontSize: "clamp(32px, 5vw, 64px)", margin: "8px 0 6px" }}>Buy credits, shoot freely</h2>
        <p className="muted" style={{ maxWidth: "52ch", margin: "0 auto" }}>One credit is one cent of generation. Every account starts with {FREE_GRANT} free. {LAUNCH_PRICING ? "Launch pricing, locked in for early houses." : ""}</p>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, marginTop: 36, alignItems: "start" }}>
        {TIERS.map((t) => {
          const out = approxOutputs(t.credits);
          return (
            <Reveal key={t.id}>
              <div className="card" style={{ display: "grid", gap: 16, position: "relative", borderColor: t.popular ? "var(--accent-default)" : "var(--border-subtle)", boxShadow: t.popular ? "var(--shadow-3)" : "var(--shadow-1)" }}>
                {t.popular && <span className="chip" style={{ position: "absolute", top: -12, left: 20, background: "var(--accent-default)", color: "var(--accent-contrast)", borderColor: "transparent" }}>Most chosen</span>}
                <div>
                  <h3 className="display" style={{ fontSize: 26 }}>{t.name}</h3>
                  <p className="muted" style={{ fontSize: 13, margin: "2px 0 0" }}>{t.tagline}</p>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span className="display" style={{ fontSize: 44, fontWeight: 600 }}>{CURRENCY.symbol}{t.price}</span>
                  <span className="muted" style={{ fontSize: 13 }}>/ {t.credits.toLocaleString()} credits</span>
                </div>
                <div className="panel" style={{ padding: 12, display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 13 }}>About <strong>{out.heroStills.toLocaleString()}</strong> hero stills</span>
                  <span style={{ fontSize: 13 }}>or <strong>{out.draftStills.toLocaleString()}</strong> draft stills</span>
                  <span style={{ fontSize: 13 }}>or <strong>{out.videos.toLocaleString()}</strong> short videos</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 7 }}>
                  {t.perks.map((perk) => <li key={perk} className="muted" style={{ fontSize: 13, display: "flex", gap: 8 }}><span className="accent">✦</span>{perk}</li>)}
                </ul>
                {authed ? (
                  <a href={`mailto:${SUPPORT_EMAIL}?subject=Oviya%20${t.name}%20credits`} className={`btn ${t.popular ? "btn-primary" : "btn-secondary"} btn-block`}>Add the {t.name} pack</a>
                ) : (
                  <Link href="/signup" className={`btn ${t.popular ? "btn-primary" : "btn-ghost"} btn-block`}>Start free, then buy</Link>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>
      <Reveal><p className="muted" style={{ textAlign: "center", fontSize: 12, marginTop: 22 }}>Live checkout is arriving. For now, the packs are arranged by hand, write to us and we set you up same day.</p></Reveal>
    </section>
  );
}

export function FAQSection() {
  return (
    <section style={{ padding: "clamp(48px, 7vw, 110px) clamp(20px, 5vw, 56px)", maxWidth: 820, margin: "0 auto", borderTop: "1px solid var(--border-subtle)" }}>
      <Reveal><h2 className="display" style={{ fontSize: "clamp(30px, 4.5vw, 56px)", marginBottom: 24 }}>Questions, answered</h2></Reveal>
      <div style={{ display: "grid", gap: 12 }}>
        {FAQ.map((f) => (
          <details key={f.q} className="panel">
            <summary>{f.q}</summary>
            <div className="panel-body"><p className="muted" style={{ margin: 0 }}>{f.a}</p></div>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border-subtle)", padding: "44px clamp(20px, 5vw, 56px)", maxWidth: 1240, margin: "0 auto", display: "grid", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>
        <div style={{ display: "grid", gap: 10 }}>
          <Wordmark size="md" />
          <p className="serif-italic" style={{ color: "var(--text-muted)", maxWidth: "34ch" }}>Every product, a work of art.</p>
        </div>
        <div style={{ display: "grid", gap: 6, textAlign: "right" }}>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="muted" style={{ fontSize: 14 }}>{SUPPORT_EMAIL}</a>
          <div style={{ display: "flex", gap: 16, justifyContent: "flex-end" }}>
            <Link href="/terms" className="muted" style={{ fontSize: 13 }}>Terms</Link>
            <Link href="/privacy" className="muted" style={{ fontSize: 13 }}>Privacy</Link>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>Oviya Studio, v4 . Images are created with AI and carry content provenance.</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>Made with veterans from fashion and photography.</span>
      </div>
    </footer>
  );
}
