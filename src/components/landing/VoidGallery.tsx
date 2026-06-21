"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Image } from "@react-three/drei";
import { useScroll } from "framer-motion";
import * as THREE from "three";

// The signature moment: a scroll-driven travel through floating editorial photographs in 3D space,
// to show our range. A single persistent canvas, textures lazy-loaded, the frame loop PAUSED when the
// section is off-screen (IntersectionObserver -> frameloop). Driven by the section's own scroll
// progress (framer-motion useScroll), so it cooperates with the page/Lenis scroll. A static gallery
// fallback (VoidGalleryFallback) renders under reduced-motion or when WebGL is unavailable.

const SPACING = 7;

function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

interface Placed { url: string; pos: [number, number, number]; scale: [number, number]; }

function layout(urls: string[]): Placed[] {
  // Deterministic scatter so the composition is intentional, not random noise. Alternating sides,
  // gentle vertical drift, receding in z.
  return urls.map((url, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (1.7 + ((i * 37) % 9) / 9 * 1.4);
    const y = Math.sin(i * 1.3) * 1.4;
    const z = -i * SPACING;
    const tall = i % 3 !== 0;
    return { url, pos: [x, y, z], scale: tall ? [3, 4] : [4, 3] };
  });
}

function Photo({ p }: { p: Placed }) {
  const ref = useRef<THREE.Mesh>(null);
  const seed = useMemo(() => Math.random() * 10, []);
  useFrame((state) => {
    if (ref.current) ref.current.position.y = p.pos[1] + Math.sin(state.clock.elapsedTime * 0.5 + seed) * 0.08;
  });
  // drei <Image> renders a textured plane with correct transparency + rounded corners.
  return <Image ref={ref} url={p.url} position={p.pos} scale={p.scale} transparent radius={0.08} />;
}

function Rig({ progress, count }: { progress: React.MutableRefObject<number>; count: number }) {
  const { camera } = useThree();
  const end = -(count - 1) * SPACING - 5;
  useFrame(() => {
    const p = progress.current;
    camera.position.z = THREE.MathUtils.lerp(8, end, p);
    camera.position.x = Math.sin(p * Math.PI * 1.6) * 1.2;
    camera.position.y = Math.cos(p * Math.PI * 1.2) * 0.4;
  });
  return null;
}

export function VoidGallery({ urls, fallback }: { urls: string[]; fallback: React.ReactNode }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [inView, setInView] = useState(false);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  useEffect(() => scrollYProgress.on("change", (v) => { progress.current = v; }), [scrollYProgress]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setEnabled(!reduce && supportsWebGL());
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const placed = useMemo(() => layout(urls.slice(0, 12)), [urls]);

  // Until we know, and whenever disabled, render the static fallback (also the reduced-motion content).
  if (enabled === false) return <>{fallback}</>;

  return (
    <section ref={sectionRef} style={{ position: "relative", height: "320vh" }} aria-label="Editorial gallery">
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
        {/* Overlaid type, the graphic statement over the void */}
        <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", display: "grid", placeItems: "center" }}>
          <div style={{ textAlign: "center", mixBlendMode: "difference" }}>
            <p className="mono" style={{ fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase", color: "#fff" }}>The range</p>
            <h2 className="display" style={{ fontSize: "clamp(40px, 9vw, 140px)", lineHeight: 0.95, color: "#fff", margin: "8px 0 0" }}>A house<br />without<br />walls</h2>
          </div>
        </div>
        {enabled && (
          <Canvas
            frameloop={inView ? "always" : "never"}
            camera={{ position: [0, 0, 8], fov: 55 }}
            gl={{ antialias: true, alpha: true }}
            style={{ position: "absolute", inset: 0 }}
            dpr={[1, 1.6]}
          >
            <ambientLight intensity={1} />
            <Rig progress={progress} count={placed.length} />
            {placed.map((p) => <Photo key={p.url} p={p} />)}
          </Canvas>
        )}
      </div>
    </section>
  );
}
