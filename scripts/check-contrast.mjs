/* WCAG 2.2 contrast verification on the REAL resolved token values, both themes. Fails the gate if
 * any required pair is below threshold. Run after build-tokens.mjs. */
import { readFileSync } from "node:fs";
import { wcagContrast } from "culori";

const T = JSON.parse(readFileSync("src/app/_tokens.json", "utf8"));

// [foregroundToken, backgroundToken, minRatio, label]
const required = [
  ["--text-primary", "--surface-base", 4.5, "body text"],
  ["--text-secondary", "--surface-base", 4.5, "secondary text"],
  ["--text-muted", "--surface-base", 3.0, "muted/large text"],
  ["--accent-contrast", "--accent-default", 4.5, "text on accent fill"],
  ["--accent-default", "--surface-base", 3.0, "accent as UI/large text"],
  ["--text-primary", "--surface-raised", 4.5, "body on raised card"],
];

let failed = 0;
for (const theme of ["light", "dark"]) {
  console.log(`\n${theme.toUpperCase()}`);
  for (const [fg, bg, min, label] of required) {
    const ratio = wcagContrast(T[theme][fg], T[theme][bg]);
    const ok = ratio >= min;
    if (!ok) failed++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${ratio.toFixed(2)}:1  (need ${min})  ${label}  [${T[theme][fg]} on ${T[theme][bg]}]`);
  }
}

if (failed) {
  console.error(`\n${failed} contrast requirement(s) failed.`);
  process.exit(1);
}
console.log("\nAll required contrast ratios pass WCAG 2.2 in both themes.");
