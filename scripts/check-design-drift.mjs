#!/usr/bin/env node
// Compares the `cssVars:` block in DESIGN.md frontmatter against `:root { ... }` in app/globals.css.
// Reports missing, undocumented, or mismatched CSS custom properties. Exits 1 on any drift.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DESIGN_PATH = resolve(ROOT, "DESIGN.md");
const CSS_PATH = resolve(ROOT, "app/globals.css");

function fail(msg) {
  console.error(`[31m✖ ${msg}[0m`);
  process.exit(1);
}

function parseFrontmatterCssVars(md) {
  const match = md.match(/^---\n([\s\S]*?)\n---/m);
  if (!match) fail("DESIGN.md: YAML frontmatter (--- ... ---) not found");

  const fm = match[1];
  const cssVarsMatch = fm.match(/cssVars:[ \t]*\n((?:[ \t]+[^\n]*\n?|[ \t]*\n)*)/);
  if (!cssVarsMatch) fail("DESIGN.md frontmatter: `cssVars:` block not found");

  const block = cssVarsMatch[1];
  const tokens = new Map();
  const lineRe = /^\s+(--[a-z0-9-]+)\s*:\s*(?:"([^"]*)"|'([^']*)'|([^\s#][^\n#]*?))\s*(?:#.*)?$/gm;
  let m;
  while ((m = lineRe.exec(block)) !== null) {
    const name = m[1];
    const value = (m[2] ?? m[3] ?? m[4] ?? "").trim();
    tokens.set(name, value);
  }
  if (tokens.size === 0) fail("DESIGN.md frontmatter: cssVars block parsed but no tokens found");
  return tokens;
}

function parseCssRoot(css) {
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootMatch) fail("app/globals.css: :root { ... } block not found");

  const block = rootMatch[1];
  const tokens = new Map();
  const lineRe = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = lineRe.exec(block)) !== null) {
    tokens.set(m[1], m[2].trim());
  }
  return tokens;
}

function normalize(v) {
  return v.replace(/\s+/g, " ").trim().toLowerCase();
}

const designTokens = parseFrontmatterCssVars(readFileSync(DESIGN_PATH, "utf8"));
const cssTokens = parseCssRoot(readFileSync(CSS_PATH, "utf8"));

const missingInCss = [];
const undocumented = [];
const mismatched = [];

for (const [name, designVal] of designTokens) {
  if (!cssTokens.has(name)) {
    missingInCss.push(name);
  } else if (normalize(cssTokens.get(name)) !== normalize(designVal)) {
    mismatched.push({ name, design: designVal, css: cssTokens.get(name) });
  }
}
for (const name of cssTokens.keys()) {
  if (!designTokens.has(name)) undocumented.push(name);
}

const issues = missingInCss.length + undocumented.length + mismatched.length;

if (issues === 0) {
  console.log(`[32m✓ design tokens in sync (${designTokens.size} tokens checked)[0m`);
  process.exit(0);
}

console.error("[31m✖ DESIGN.md ↔ app/globals.css drift detected[0m\n");

if (mismatched.length) {
  console.error("Value mismatch:");
  for (const { name, design, css } of mismatched) {
    console.error(`  ${name}`);
    console.error(`    DESIGN.md : ${design}`);
    console.error(`    globals.css: ${css}`);
  }
  console.error("");
}
if (missingInCss.length) {
  console.error("Documented in DESIGN.md but missing from globals.css:");
  for (const n of missingInCss) console.error(`  ${n}`);
  console.error("");
}
if (undocumented.length) {
  console.error("Defined in globals.css but missing from DESIGN.md frontmatter:");
  for (const n of undocumented) console.error(`  ${n}`);
  console.error("");
}

console.error(`Fix: update DESIGN.md frontmatter cssVars or app/globals.css :root so they match.`);
process.exit(1);
