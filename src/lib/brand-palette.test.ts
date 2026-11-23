import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BRAND_PRESETS,
  DEFAULT_BRAND_COLORS,
  brandPalette,
  brandPaletteCss,
  contrast,
  mix,
} from "./brand-palette";

const DARK_BG = ["#17191a", "#262828", "#2f3131", "#383a3a"];
const LIGHT_BG = ["#efebe4", "#fbfaf7", "#f2efe9", "#e9e5dd"];

test("contrast follows WCAG (black on white is 21, same colour is 1)", () => {
  assert.equal(contrast("#000000", "#ffffff"), 21);
  assert.equal(contrast("#6366f1", "#6366f1"), 1);
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
});

test("every colour pair keeps accent text and button labels readable (AA 4.5:1) in both themes", () => {
  const samples = [
    ...BRAND_PRESETS.map((p) => p.colors),
    { from: "#ffffff", to: "#ffff00" }, // quá sáng
    { from: "#000000", to: "#111111" }, // quá tối
    { from: "#808080", to: "#7f7f7f" },
    { from: "#00ff00", to: "#ff00ff" },
  ];
  for (const c of samples) {
    const { dark, light } = brandPalette(c);
    for (const bg of DARK_BG)
      assert.ok(
        contrast(dark["--accent"], bg) >= 4.5,
        `${c.from} dark on ${bg}`,
      );
    for (const bg of LIGHT_BG)
      assert.ok(
        contrast(light["--accent"], bg) >= 4.5,
        `${c.from} light on ${bg}`,
      );
    assert.ok(
      contrast(dark["--on-primary"], dark["--primary"]) >= 4.5,
      `${c.from} dark button`,
    );
    assert.ok(
      contrast(light["--on-primary"], light["--primary"]) >= 4.5,
      `${c.from} light button`,
    );
    // Nút chính dùng dải màu: chữ trắng phải đọc được ở cả hai đầu dải.
    for (const end of light["--primary-gradient"].match(/#[0-9a-f]{6}/g)!)
      assert.ok(
        contrast("#ffffff", end) >= 4.5,
        `${c.from} button gradient ${end}`,
      );
    assert.equal(
      dark["--brand-gradient"],
      `linear-gradient(135deg, ${c.from}, ${c.to})`,
    );
  }
});

test("globals.css defaults equal brandPalette(DEFAULT_BRAND_COLORS)", () => {
  const css = readFileSync(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const block = (start: string) => {
    const i = css.indexOf(start);
    return css.slice(i, css.indexOf("}", i));
  };
  const { dark, light } = brandPalette(DEFAULT_BRAND_COLORS);
  for (const [tokens, start] of [
    [dark, ":root {"],
    [light, 'html[data-theme="light"] {'],
  ] as const)
    for (const [k, v] of Object.entries(tokens))
      assert.ok(block(start).includes(`${k}: ${v};`), `${start} ${k}: ${v}`);
});

test("override CSS beats the theme selectors and never echoes unchecked input", () => {
  const css = brandPaletteCss({ from: "#14B8A6", to: "#22c55e" });
  assert.match(css, /^html:root\{--brand-from:#14b8a6;/);
  assert.match(css, /html\[data-theme="light"\]:root\{/);
  // Giá trị lạ (chèn CSS) → dùng màu mặc định.
  const evil = brandPaletteCss({
    from: "red}body{display:none",
    to: "#000000",
  });
  assert.ok(!evil.includes("display:none"));
  assert.equal(evil, brandPaletteCss(null));
  assert.ok(brandPaletteCss(null).includes("--brand-from:#6366f1"));
});
