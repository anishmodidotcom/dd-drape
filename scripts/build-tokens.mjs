/* Oviya dual-mode token generator. Single source of truth for the OKLCH color system.
 * Three tiers: primitives (raw OKLCH ramps, with accurate sRGB hex fallbacks computed by culori)
 * -> semantics (theme-switched: light under :root, dark under .dark) -> components + legacy aliases.
 * Components and pages reference ONLY semantics/aliases, never primitives.
 *
 *   node scripts/build-tokens.mjs   ->   src/app/tokens.css
 */
import { writeFileSync } from "node:fs";
import { formatHex, clampChroma } from "culori";

const hex = (l, c, h) => formatHex(clampChroma({ mode: "oklch", l, c, h }, "rgb"));
const ok = (l, c, h) => `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(1)})`;

// ---- PRIMITIVE RAMPS ---------------------------------------------------------------------------
// Warm neutral spine (cream -> warm onyx). Hue held warm (~75), chroma tapers so light cream reads
// warm and the near-black stays a warm onyx, never a cold or pure black.
const NEUTRAL = [
  ["n0", 0.972, 0.011, 78],
  ["n1", 0.945, 0.013, 77],
  ["n2", 0.905, 0.013, 76],
  ["n3", 0.86, 0.012, 75],
  ["n4", 0.78, 0.011, 74],
  ["n5", 0.68, 0.01, 73],
  ["n6", 0.56, 0.009, 72],
  ["n7", 0.45, 0.008, 71],
  ["n8", 0.34, 0.008, 70],
  ["n9", 0.27, 0.007, 68],
  ["n10", 0.23, 0.006, 66],
  ["n11", 0.19, 0.006, 64],
  ["n12", 0.16, 0.005, 62],
  ["n13", 0.13, 0.005, 60],
];

// Accent: OXBLOOD. Deep wine red, hue ~18. Chroma peaks mid-ramp; lighter/more saturated steps
// exist for dark mode so the accent stays confident on a near-black surface.
const ACCENT = [
  ["a0", 0.95, 0.022, 18],
  ["a1", 0.9, 0.045, 18],
  ["a2", 0.82, 0.08, 18],
  ["a3", 0.72, 0.12, 19],
  ["a4", 0.62, 0.145, 20],
  ["a5", 0.52, 0.15, 20],
  ["a6", 0.44, 0.142, 20],
  ["a7", 0.385, 0.13, 19],
  ["a8", 0.32, 0.11, 19],
  ["a9", 0.26, 0.09, 18],
];

// Support intelligence (rationed): indigo/midnight, antique gold (hairline/stipple only), sandstone.
const SUPPORT = [
  ["indigo", 0.42, 0.11, 270],
  ["indigo-light", 0.6, 0.12, 268],
  ["gold", 0.78, 0.072, 88],
  ["gold-deep", 0.66, 0.08, 86],
  ["sand", 0.83, 0.04, 70],
  ["sand-deep", 0.7, 0.045, 68],
];

const ALL = [...NEUTRAL, ...ACCENT, ...SUPPORT];

// ---- SEMANTIC MAPPINGS (which primitive each role points to, per theme) ------------------------
const light = {
  "--surface-base": "n1", // warm cream, never pure white
  "--surface-raised": "n0",
  "--surface-overlay": "n0",
  "--surface-sunken": "n2",
  "--text-primary": "n12", // warm onyx, ~16.5:1 on cream
  "--text-secondary": "n7",
  "--text-muted": "n6",
  "--border-subtle": "n3",
  "--border-strong": "n4",
  "--accent-default": "a6",
  "--accent-hover": "a7",
  "--accent-contrast": "n0", // cream text on oxblood
  "--indigo": "indigo",
  "--gold": "gold-deep",
  "--sand": "sand",
};
const dark = {
  "--surface-base": "n13", // warm onyx
  "--surface-raised": "n12", // elevation by luminance (+L), not shadow
  "--surface-overlay": "n11",
  "--surface-sunken": "n13",
  "--text-primary": "n1", // off-white, never pure white
  "--text-secondary": "n4",
  "--text-muted": "n5",
  "--border-subtle": "n10",
  "--border-strong": "n9",
  "--accent-default": "a4", // shifted lighter + more saturated for near-black
  "--accent-hover": "a3",
  "--accent-contrast": "n13", // onyx text on the brighter dark-mode oxblood
  "--indigo": "indigo-light",
  "--gold": "gold",
  "--sand": "sand-deep",
};

// Component tokens + legacy aliases: var() references to semantics, identical in both themes, so
// the existing studio/landing inherit the new system unchanged.
const SHARED = `
  /* Component tokens */
  --button-bg: var(--accent-default);
  --button-fg: var(--accent-contrast);
  --card-bg: var(--surface-raised);
  --panel-bg: var(--surface-base);
  --overlay-bg: var(--surface-overlay);
  --glow-accent: color-mix(in oklab, var(--accent-default) 38%, transparent);

  /* Legacy aliases (v1-v3 token names map onto the new semantics) */
  --ink: var(--surface-base);
  --ink-soft: var(--surface-raised);
  --surface: var(--surface-raised);
  --surface-2: var(--surface-overlay);
  --surface-3: var(--surface-sunken);
  --porcelain: var(--text-primary);
  --text-soft: var(--text-secondary);
  --fog: var(--text-muted);
  --accent: var(--accent-default);
  --accent-soft: var(--accent-hover);
  --accent-deep: var(--accent-hover);
  --saffron: var(--accent-default);
  --orchid: var(--accent-default);
  --line: var(--border-subtle);
  --line-soft: color-mix(in oklab, var(--border-subtle) 55%, transparent);
  --line-accent: color-mix(in oklab, var(--accent-default) 45%, transparent);
  --glass-line: color-mix(in oklab, var(--text-primary) 14%, transparent);
  --gradient-brand: linear-gradient(135deg, var(--accent-hover), var(--accent-default));
  --success: oklch(0.62 0.13 150);
  --caution: var(--gold);
  --danger: oklch(0.58 0.16 25);
`;

function emitVars(map, indent = "  ") {
  return Object.entries(map)
    .map(([k, prim]) => `${indent}${k}: var(--${prim});`)
    .join("\n");
}
function emitPrimitives(fn, indent = "  ") {
  return ALL.map(([name, l, c, h]) => `${indent}--${name}: ${fn(l, c, h)};`).join("\n");
}

// Semantics + the shared alias layer are emitted in EVERY theme scope so that scoped subtrees
// (e.g. the side-by-side panes on /design) re-resolve var() aliases against the local theme, not
// just the global one.
const lightBlock = `${emitVars(light)}\n${SHARED}`;
const darkBlock = `${emitVars(dark)}\n${SHARED}`;

const css = `/* GENERATED by scripts/build-tokens.mjs - do not edit by hand. */
/* Tier 1 primitives in OKLCH; Tier 2 semantics (themed); Tier 3 components + legacy aliases. */
:root {
  color-scheme: light;
${emitPrimitives(ok)}

  /* light semantics + aliases */
${lightBlock}
}

.light {
  color-scheme: light;
${lightBlock}
}

.dark {
  color-scheme: dark;
${darkBlock}
}

/* sRGB hex fallback for browsers without OKLCH (primitives only; everything else is var()). */
@supports not (color: oklch(0% 0 0)) {
  :root {
${emitPrimitives(hex)}
  }
}
`;

writeFileSync("src/app/tokens.css", css);

// A small machine-readable export of the resolved hex per theme, for the /design swatches + docs.
const resolve = (map) => Object.fromEntries(Object.entries(map).map(([k, p]) => {
  const prim = ALL.find(([n]) => n === p);
  return [k, hex(prim[1], prim[2], prim[3])];
}));
writeFileSync(
  "src/app/_tokens.json",
  JSON.stringify(
    {
      primitives: Object.fromEntries(ALL.map(([n, l, c, h]) => [n, { oklch: ok(l, c, h), hex: hex(l, c, h) }])),
      light: resolve(light),
      dark: resolve(dark),
    },
    null,
    2
  )
);

console.log("wrote src/app/tokens.css and src/app/_tokens.json");
console.log(`primitives: ${ALL.length}  light semantics: ${Object.keys(light).length}  dark: ${Object.keys(dark).length}`);
