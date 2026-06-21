"use client";
import { useEffect, useRef } from "react";

// The "alive" mesh-gradient background (Stripe-style), a real animated GLSL fragment shader in
// Oviya's palette, drawn on a lightweight full-bleed WebGL canvas. Paused when off-screen and under
// prefers-reduced-motion; if WebGL is unavailable it simply renders nothing and the CSS
// `.alive-wash` scaffold (Phase 1) shows through behind it. Reads the live oxblood/indigo tokens so
// it is correct in both light and dark.

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_a; // accent (oxblood)
uniform vec3 u_b; // indigo
uniform vec3 u_base; // surface base
// simple value noise
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
  vec2 u=f*f*(3.-2.*f);
  return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;
}
float fbm(vec2 p){ float v=0.,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy/u_res;
  vec2 p = uv*2.4;
  float t = u_time*0.04;
  float n = fbm(p + vec2(fbm(p+t), fbm(p-t)));
  float m = fbm(p*1.7 - t);
  vec3 col = u_base;
  col = mix(col, u_a, smoothstep(0.35,0.95,n)*0.55);
  col = mix(col, u_b, smoothstep(0.45,1.0,m)*0.4);
  gl_FragColor = vec4(col, 1.0);
}`;

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

function readVar(name: string): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // Expect a resolved color; use a canvas to parse any css color to rgb.
  const c = document.createElement("canvas").getContext("2d")!;
  c.fillStyle = v || "#111";
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

export function AliveMesh() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) return;

    const compile = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uA = gl.getUniformLocation(prog, "u_a");
    const uB = gl.getUniformLocation(prog, "u_b");
    const uBase = gl.getUniformLocation(prog, "u_base");

    let raf = 0, running = true;
    const setColors = () => {
      gl.uniform3fv(uA, readVar("--accent-default"));
      gl.uniform3fv(uB, readVar("--indigo"));
      gl.uniform3fv(uBase, readVar("--surface-base"));
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    setColors(); resize();
    window.addEventListener("resize", resize);
    // Re-read colors when the theme class flips.
    const mo = new MutationObserver(setColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    // Pause when scrolled far off-screen.
    const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) loop(); });
    io.observe(canvas);

    const start = performance.now();
    const loop = () => {
      if (!running) return;
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); running = false; window.removeEventListener("resize", resize); mo.disconnect(); io.disconnect(); };
  }, []);

  return <canvas ref={ref} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />;
}
