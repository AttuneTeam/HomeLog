// Parses the --landing-* tokens out of the COMMITTED app/globals.css and measures
// WCAG contrast for every foreground/background pair the landing page will use.
// Reads what shipped rather than what was intended, so a typo cannot pass.
import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");

function block(name) {
  // grab the :root { ... } or .dark { ... } block
  const re = new RegExp(`${name}\\s*\\{`, "g");
  const m = re.exec(css);
  if (!m) throw new Error(`no ${name} block`);
  let depth = 1, i = re.lastIndex;
  while (depth > 0 && i < css.length) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  return css.slice(re.lastIndex, i - 1);
}

function tokens(src) {
  const out = {};
  for (const m of src.matchAll(/--landing-([a-z-]+)\s*:\s*oklch\(([^)]+)\)/g)) {
    const [L, C, H] = m[2].trim().split(/\s+/).map(Number);
    out[m[1]] = [L, C, H];
  }
  return out;
}

const linToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function oklchToRgb([L, C, H]) {
  const h = (H * Math.PI) / 180;
  const A = C * Math.cos(h), B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, linToSrgb(c))));
}

const relLum = ([r, g, b]) =>
  0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);

function contrast(a, b) {
  const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// fg token, bg token, label, minimum ratio
const PAIRS = [
  ["fg", "paper", "body on paper", 4.5],
  ["fg", "warm", "body on warm band", 4.5],
  ["muted", "paper", "muted body on paper", 4.5],
  ["muted", "warm", "muted body on warm band", 4.5],
  ["brass-text", "paper", "eyebrow on paper", 4.5],
  ["brass-text", "warm", "eyebrow on warm band", 4.5],
  // The footer keeps the existing page's light grey, so it takes the paper-ground tokens.
  ["fg", "footer", "body on footer", 4.5],
  ["muted", "footer", "muted body on footer", 4.5],
  ["brass-text", "footer", "eyebrow on footer", 4.5],
  ["hairline", "footer", "hairline rule on footer", 1.4],
  ["on-brass", "brass", "body on brass CTA", 4.5],
  ["hairline", "paper", "hairline rule on paper", 1.4],
];

let failures = 0;
for (const theme of ["light", "dark"]) {
  const t = tokens(block(theme === "light" ? ":root" : "\\.dark"));
  const missing = [...new Set(PAIRS.flatMap(([a, b]) => [a, b]))].filter((k) => !t[k]);
  if (missing.length) {
    console.log(`  MISSING in ${theme}: ${missing.join(", ")}`);
    failures += missing.length;
  }
  console.log(`\n=== ${theme.toUpperCase()} (parsed from app/globals.css) ===`);
  for (const [fg, bg, label, min] of PAIRS) {
    if (!t[fg] || !t[bg]) continue;
    const r = contrast(oklchToRgb(t[fg]), oklchToRgb(t[bg]));
    const ok = r >= min;
    if (!ok) failures++;
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(26)} ${r.toFixed(2).padStart(6)}:1   min ${min}`,
    );
  }
  console.log(`  -- band lightness: ` +
    ["paper", "warm", "brass", "footer"]
      .map((k) => `${k} ${t[k][0].toFixed(3)}`).join("  "));
}

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
