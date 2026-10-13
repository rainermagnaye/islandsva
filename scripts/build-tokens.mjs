// Generates app/tokens.css from design/tokens.json (the Islands VA design system export).
// Run: npm run tokens. Never edit app/tokens.css by hand.
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = new URL("../design/tokens.json", import.meta.url);
const TARGET = new URL("../app/tokens.css", import.meta.url);

const tokens = JSON.parse(readFileSync(SOURCE, "utf8"));
const [primaryTheme, ...otherThemes] = tokens.color.themes.map((t) => t.id);

// "{action-secondary}" → "var(--action-secondary)"
const resolve = (value) =>
  typeof value === "string" ? value.replace(/^\{(.+)\}$/, "var(--$1)") : value;
const valueFor = (token, theme) =>
  resolve(typeof token.value === "string" ? token.value : (token.value[theme] ?? token.value[primaryTheme]));
const rem = (px) => `${parseFloat(px) / 16}rem`;

const themed = [...tokens.color.tokens, ...tokens.shadow.tokens];
const fixed = [...tokens.spacing.tokens, ...tokens.layout.tokens, ...tokens.zIndex.tokens];

const lines = [
  "/* Islands VA — generated from design/tokens.json by scripts/build-tokens.mjs. Do not edit. */",
  "",
  ":root {",
  "  color-scheme: light dark;",
  ...themed.map((t) => `  --${t.name}: ${valueFor(t, primaryTheme)};`),
  ...fixed.map((t) => `  --${t.name}: ${t.value};`),
  `  --font-display: var(--font-alegreya), ${tokens.type.families.display.replace(/^"Alegreya",\s*/, "")};`,
  `  --font-sans: var(--font-figtree), ${tokens.type.families.sans.replace(/^"Figtree",\s*/, "")};`,
  `  --font-mono: ${tokens.type.families.mono};`,
  "}",
];

// The theme follows the visitor's browser/OS setting (prefers-color-scheme) — no script, no stored choice.
// Day is the default; the night theme overrides it when the browser prefers dark.
for (const theme of otherThemes) {
  lines.push("", "@media (prefers-color-scheme: dark) {", "  :root {");
  for (const t of themed) {
    if (typeof t.value === "object" && t.value[theme] && t.value[theme] !== t.value[primaryTheme]) {
      lines.push(`    --${t.name}: ${valueFor(t, theme)};`);
    }
  }
  lines.push("  }", "}");
}

// Tailwind v4 theme: only brand values exist, so off-system colours, radii and shadows can't be used.
lines.push(
  "",
  "@theme inline {",
  "  --color-*: initial;",
  ...tokens.color.tokens.map((t) => `  --color-${t.name}: var(--${t.name});`),
  "  --font-*: initial;",
  "  --font-display: var(--font-alegreya), Georgia, serif;",
  "  --font-sans: var(--font-figtree), system-ui, sans-serif;",
  `  --font-mono: ${tokens.type.families.mono};`,
  "  --shadow-*: initial;",
  "}",
  "",
  "@theme {",
  "  --radius-*: initial;",
  ...tokens.radius.tokens.map((t) => `  --radius-${t.name.replace(/^radius-/, "")}: ${t.value};`),
  "  --text-*: initial;",
  ...tokens.breakpoint.tokens.map((t) => `  --breakpoint-${t.name.replace(/^bp-/, "")}: ${t.value};`),
  "}",
);

// Elevation follows the theme, so it is a utility over the themed variable.
for (const t of tokens.shadow.tokens) {
  lines.push("", `@utility elevation-${t.name.replace(/^shadow-/, "")} {`, `  box-shadow: var(--${t.name});`, "}");
}

// One utility per text style: type-display-xl, type-body, type-eyebrow …
for (const group of tokens.type.groups) {
  for (const style of group.styles) {
    const fluid = style.usage?.match(/clamp\([^)]*\)/)?.[0];
    const size = fluid ?? rem(style.fontSize);
    const lineHeight = (parseFloat(style.lineHeight) / parseFloat(style.fontSize)).toFixed(3).replace(/0+$/, "");
    lines.push(
      "",
      `@utility type-${style.name} {`,
      `  font-family: var(--font-${group.family});`,
      `  font-size: ${size};`,
      `  line-height: ${lineHeight};`,
      `  font-weight: ${style.fontWeight};`,
      ...(style.letterSpacing ? [`  letter-spacing: ${style.letterSpacing};`] : []),
      ...(style.name === "eyebrow" ? ["  text-transform: uppercase;"] : []),
      "}",
    );
  }
}

writeFileSync(TARGET, `${lines.join("\n")}\n`);
console.log(`Wrote ${TARGET.pathname}`);
