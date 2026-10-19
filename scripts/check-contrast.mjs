// Checks WCAG 2.1 contrast of the design tokens in src/app/globals.css.
// Usage: node scripts/check-contrast.mjs   (exits 1 if a text pair is below AA)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CSS_PATH = fileURLToPath(new URL("../src/app/globals.css", import.meta.url));

// [foreground, background, minimum ratio, what the pair is used for]
export const PAIRS = [
  ["text", "background", 4.5, "Үндсэн текст / хуудас"],
  ["text", "surface", 4.5, "Үндсэн текст / карт"],
  ["text-muted", "background", 4.5, "Туслах текст / хуудас"],
  ["text-muted", "surface", 4.5, "Туслах текст / карт"],
  ["primary-foreground", "primary", 4.5, "Үндсэн товчны бичвэр"],
  ["primary", "background", 4.5, "Холбоос / брэнд / хуудас"],
  ["primary", "surface", 4.5, "Холбоос / карт"],
  ["success", "surface", 4.5, "Хэрэглэсэн үг, Санасан"],
  ["improve", "surface", 4.5, "Засвар (Илүү зөв)"],
  ["danger", "surface", 4.5, "Системийн алдаа"],
  // WCAG 1.4.11: input boundaries need 3:1 against every background they sit on.
  ["input-border", "background", 3, "Input хүрээ / хуудас"],
  ["input-border", "surface", 3, "Input хүрээ / карт"],
  // Informational: decorative borders are exempt; input borders need 3:1 (WCAG 1.4.11).
  ["border", "background", 0, "Хүрээ / хуудас (мэдээллийн)"],
  ["border", "surface", 0, "Хүрээ / карт (мэдээллийн)"],
];

export function readTokens(css, scheme) {
  const block = css.match(new RegExp(`/\\* @tokens ${scheme} \\*/([\\s\\S]*?)/\\* @end \\*/`));
  if (!block) throw new Error(`Token block "${scheme}" not found`);
  const tokens = {};
  for (const [, name, hex] of block[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[name] = hex;
  }
  return tokens;
}

function luminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

export function checkContrast(css = readFileSync(CSS_PATH, "utf8")) {
  const rows = [];
  for (const scheme of ["light", "dark"]) {
    const tokens = readTokens(css, scheme);
    for (const [fg, bg, min, usage] of PAIRS) {
      if (!tokens[fg] || !tokens[bg]) throw new Error(`Missing token ${fg} or ${bg} (${scheme})`);
      const ratio = contrastRatio(tokens[fg], tokens[bg]);
      rows.push({ scheme, fg, bg, ratio, min, usage, pass: ratio >= min });
    }
  }
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = checkContrast();
  for (const r of rows) {
    const status = r.min === 0 ? "info" : r.pass ? "pass" : "FAIL";
    console.log(
      `${r.scheme.padEnd(5)} ${`${r.fg} / ${r.bg}`.padEnd(32)} ${r.ratio.toFixed(2).padStart(6)}:1  ${status.padEnd(4)}  ${r.usage}`,
    );
  }
  const failed = rows.filter((r) => !r.pass);
  if (failed.length > 0) {
    console.error(`${failed.length} pair(s) below WCAG AA`);
    process.exit(1);
  }
}
