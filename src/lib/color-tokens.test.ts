import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Giữ hệ màu tập trung ở biến: mã màu chỉ được viết trong vùng biến đầu `globals.css`
 * (trước `@end-color-tokens`) và trong `brand-palette.ts` (tính màu thương hiệu).
 * Component dùng biến (`var(--accent)`, `text-muted`, `data-tone="warning"`...).
 */
const root = new URL("..", import.meta.url).pathname; // src/
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FN = /\b(rgba?|hsla?|oklch|lab|lch)\(/;
// Class màu cố định của Tailwind (bg-amber-500, text-indigo-400...). white/black chỉ cho chỗ cần màu tuyệt đối
// (nền mã QR phải trắng để quét được, nền video đen).
const TW =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|decoration|caret|accent|shadow)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/;
const ALLOWED_FILES = ["lib/brand-palette.ts"];

/** Bỏ chú thích và chuỗi mã ký tự HTML (`&#39;`) để không báo nhầm. */
const strip = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/&#\d+;/g, "");

test("colour literals live only in the token block and brand-palette.ts", () => {
  const found: string[] = [];
  for (const file of files(root)) {
    const rel = relative(root, file);
    if (ALLOWED_FILES.includes(rel)) continue;
    let text = readFileSync(file, "utf8");
    if (rel === "app/globals.css") {
      const end = text.indexOf("/* @end-color-tokens");
      assert.ok(end > 0, "globals.css cần dòng @end-color-tokens");
      text = text.slice(text.indexOf("\n", end));
    }
    strip(text)
      .split("\n")
      .forEach((line, i) => {
        if (HEX.test(line) || FN.test(line) || TW.test(line))
          found.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(
    found,
    [],
    "Dùng biến màu thay cho mã màu:\n" + found.join("\n"),
  );
});

test("role tokens in both themes point at the base palette, not raw codes", () => {
  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  const block = (start: string) => {
    const i = css.indexOf(start);
    return css.slice(i, css.indexOf("}", i));
  };
  const roles = [
    "--bg",
    "--panel",
    "--surface",
    "--surface-hover",
    "--text",
    "--muted",
    "--faint",
    "--success",
    "--warning",
    "--danger",
    "--info",
  ];
  for (const start of [":root {", 'html[data-theme="light"] {'])
    for (const role of roles) {
      const m = block(start).match(new RegExp(`\\n  ${role}: ([^;]+);`));
      assert.ok(m, `${start} thiếu ${role}`);
      assert.match(
        m[1],
        /^var\(--(gray|green|amber|red|blue|white|black)(-\d+)?\)$/,
        `${start} ${role}`,
      );
    }
});
