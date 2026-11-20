// rmpui.js - Rytm screen layouts for Sidecar user machines (RMP draw, docs/um-pages.md "Plugin-drawn screens").
// One layout (JSON, format "rmpui-1") draws a plugin's SRC / SMPL / SRC page 2 / SMPL page 2 screens from P1..P32.
// render() here and rmpui_draw() in rmp_ui.c are the same integer algorithm: they must agree pixel for pixel
// (tests/run.sh). toC() emits the layout as a C header for rmp_ui.c. Fonts: the Sidecar's CC0 3x5 / 5x7 (fonts are
// original glyphs, core/ui/fonts/LICENSE), ASCII 32..95 (lower case drawn as upper case).

export const W = 128, H = 64, BYTES = 1024;

// --- fonts: one byte a column, bit 0 the top row; ASCII 32..95
const F3 = [0,0,0,0,23,0,3,0,3,31,10,31,18,21,9,9,4,18,10,21,26,0,3,0,0,14,17,17,14,0,10,4,10,4,14,4,16,8,0,4,4,4,0,16,0,24,4,3,31,17,31,18,31,16,25,21,18,17,21,10,7,4,31,23,21,9,30,21,29,1,29,3,31,21,31,23,21,15,0,10,0,16,10,0,4,10,17,10,10,10,17,10,4,1,21,2,15,17,23,30,5,30,31,21,10,14,17,17,31,17,14,31,21,17,31,5,1,14,17,29,31,4,31,17,31,17,8,16,15,31,4,27,31,16,16,31,6,31,31,1,30,14,17,14,31,5,2,14,25,22,31,5,26,18,21,9,1,31,1,31,16,31,15,16,15,31,12,31,27,4,27,3,28,3,25,21,19,31,17,0,3,4,24,0,17,31,2,1,2,16,16,16];
const F5 = [0,0,0,0,0,0,0,95,0,0,0,3,0,3,0,20,127,20,127,20,36,42,127,42,18,35,19,8,100,98,54,73,85,34,80,0,0,3,0,0,0,28,34,65,0,0,65,34,28,0,20,8,62,8,20,8,8,62,8,8,0,80,48,0,0,8,8,8,8,8,0,96,96,0,0,32,16,8,4,2,62,81,73,69,62,0,66,127,64,0,66,97,81,73,70,65,73,73,73,54,24,20,18,127,16,39,69,69,69,57,60,74,73,73,48,1,113,9,5,3,54,73,73,73,54,6,73,73,41,30,0,54,54,0,0,0,86,54,0,0,8,20,34,65,0,20,20,20,20,20,0,65,34,20,8,2,1,81,9,6,50,73,121,65,62,126,9,9,9,126,127,73,73,73,54,62,65,65,65,34,127,65,65,34,28,127,73,73,73,65,127,9,9,9,1,62,65,73,73,122,127,8,8,8,127,0,65,127,65,0,32,64,65,63,1,127,8,20,34,65,127,64,64,64,64,127,2,12,2,127,127,4,8,16,127,62,65,65,65,62,127,9,9,9,6,62,65,81,33,94,127,9,25,41,70,70,73,73,73,49,1,1,127,1,1,63,64,64,64,63,31,32,64,32,31,63,64,56,64,63,99,20,8,20,99,3,4,120,4,3,97,81,73,69,67,0,127,65,65,0,2,4,8,16,32,0,65,65,127,0,4,2,1,2,4,64,64,64,64,64];
export const FONT_DATA = { F3, F5 };
// font: 0 small (3x5, advance 4), 1 medium (5x7, advance 6), 2 large (5x7 x 2, advance 12),
// 3 bold (5x7 smeared one column right: 6x7, advance 7), 4 big bold (bold x 2, advance 14)
export const FONTS = [{ cols: 3, rows: 5, scale: 1, adv: 4 }, { cols: 5, rows: 7, scale: 1, adv: 6 }, { cols: 5, rows: 7, scale: 2, adv: 12 },
  { cols: 6, rows: 7, scale: 1, adv: 7, bold: 1 }, { cols: 6, rows: 7, scale: 2, adv: 14, bold: 1 }];
export const FONT_NAMES = ["small", "medium", "large", "bold", "big bold"];

// --- a quarter sine, Q12, 256 units a turn
const SIN = [0,101,201,301,401,501,601,700,799,897,995,1092,1189,1285,1380,1474,1567,1660,1751,1842,1931,2019,2106,2191,2276,2359,2440,2520,2598,2675,2751,2824,2896,2967,3035,3102,3166,3229,3290,3349,3406,3461,3513,3564,3612,3659,3703,3745,3784,3822,3857,3889,3920,3948,3973,3996,4017,4036,4052,4065,4076,4085,4091,4095,4096];
export const SIN_Q12 = SIN;
function isin(a) {
  a &= 255;
  if (a < 64) return SIN[a];
  if (a < 128) return SIN[128 - a];
  if (a < 192) return -SIN[a - 128];
  return -SIN[256 - a];
}
const icos = (a) => isin(a + 64);

// --- element types (the C enum's numbers) and their fields
export const TYPES = { text: 1, value: 2, bar: 3, dial: 4, switch: 5, env: 6, frames: 7, rect: 8, line: 9, box: 10, toggle: 11, wave: 12, band: 13 };
export const WAVES = { sine: 0, tri: 1, saw: 2, pulse: 3, harm: 4, fm: 5 };
export const FL = { inv: 1, center: 2, frame: 4, vert: 8, dotted: 16, nodes: 32 };
const ALIGN = { left: 0, center: 1, right: 2 };
const VFMT = { num: 0, list: 1, sign: 2 };
const FILL = { outline: 0, solid: 1, dither: 2 };

const tr = Math.trunc;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// P (0..127 + fraction / 128) -> 14 bits, 7 bits; n zones as the hosts' list knobs (index = v * n / 128)
export function q14(p) {
  const x = Math.fround(p);
  if (!(x > 0)) return 0;
  return clamp(tr(x * 128), 0, 16383);
}
const zone = (q, n) => clamp(tr((q * n) / 16384), 0, n - 1);
function map7(v7, min, max) {
  return max >= min ? min + tr((v7 * (max - min) + 63) / 127) : max + tr(((127 - v7) * (min - max) + 63) / 127);
}
const frac = (v7, n) => tr((v7 * n + 63) / 127);

// --- pixels: fb row-major, 16 bytes a row, MSB = leftmost, 1 = lit (the RMP draw format)
function px(fb, x, y, c) {
  if (x < 0 || x > 127 || y < 0 || y > 63) return;
  const i = y * 16 + (x >> 3), m = 0x80 >> (x & 7);
  if (c === 1) fb[i] |= m; else if (c === 0) fb[i] &= ~m & 0xff; else fb[i] ^= m;
}
function hline(fb, x0, x1, y, c) { for (let x = x0; x <= x1; x++) px(fb, x, y, c); }
function vline(fb, x, y0, y1, c) { for (let y = y0; y <= y1; y++) px(fb, x, y, c); }
function box(fb, x, y, w, h, c) { if (w < 1 || h < 1) return; hline(fb, x, x + w - 1, y, c); hline(fb, x, x + w - 1, y + h - 1, c); vline(fb, x, y, y + h - 1, c); vline(fb, x + w - 1, y, y + h - 1, c); }
function fill(fb, x, y, w, h, c, dither) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!dither || ((x + i + y + j) & 1) === 0) px(fb, x + i, y + j, c);
}
function line(fb, x0, y0, x1, y1, c, dotted) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy, k = 0;
  for (;;) {
    if (!dotted || (k & 1) === 0) px(fb, x0, y0, c);
    k++;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}

// --- text
function glyphCode(ch) {
  let c = ch.charCodeAt(0);
  if (c >= 97 && c <= 122) c -= 32;
  return c >= 32 && c <= 95 ? c - 32 : 31;   // '?' for the rest
}
// --- custom fonts (a layout's "fonts", made in font.html): format "rmpui-font-1"
//   { name, height, spacing (pixels between glyphs), space (width of a space with no glyph), glyphs: { "A": ["#..", ...] } }
// Proportional: each glyph is as wide as its rows. A missing letter falls back to the other case, else a blank of
// "space" width. In a layout an element's font is a built-in number 0..4 or a custom font's name (FONT_CUSTOM + index).
export const FONT_CUSTOM = 5;
let CF = [];   // the custom fonts of the layout being drawn (compiled)
export function compileFont(f) {
  const g = {};
  for (const [ch, rows] of Object.entries((f && f.glyphs) || {})) {
    const w = Math.max(0, ...rows.map((r) => r.length));
    g[ch] = { w, bits: rows.map((r) => Array.from({ length: w }, (_, i) => (r[i] === "#" ? 1 : 0))) };
  }
  return { h: clamp((f && f.height) | 0, 1, 64), sp: (f && f.spacing) ?? 1, space: (f && f.space) ?? 2, g };
}
const swapCase = (ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase());
const glyphOf = (F, ch) => F.g[ch] || F.g[swapCase(ch)] || null;
export function measure(F, s) {
  let w = 0;
  for (let k = 0; k < s.length; k++) { const gl = glyphOf(F, s[k]); w += (gl ? gl.w : F.space) + (k ? F.sp : 0); }
  return w;
}
function textCustom(fb, x, y, w, s, F, align, c) {
  const tw = measure(F, s);
  let gx = align === 1 ? x + tr((w - tw) / 2) : align === 2 ? x + w - tw : x;
  for (let k = 0; k < s.length; k++) {
    const gl = glyphOf(F, s[k]);
    if (gl) for (let j = 0; j < gl.bits.length; j++) for (let i = 0; i < gl.w; i++) if (gl.bits[j][i]) px(fb, gx + i, y + j, c);
    gx += (gl ? gl.w : F.space) + F.sp;
  }
}
export function textWidth(s, font) {
  if (font >= FONT_CUSTOM) return CF[font - FONT_CUSTOM] ? measure(CF[font - FONT_CUSTOM], s) : 0;
  const f = FONTS[font]; return s.length ? s.length * f.adv - f.scale : 0;
}
function text(fb, x, y, w, s, font, align, c) {
  if (font >= FONT_CUSTOM) { if (CF[font - FONT_CUSTOM]) textCustom(fb, x, y, w, s, CF[font - FONT_CUSTOM], align, c); return; }
  const f = FONTS[font], data = font === 0 ? F3 : F5, tw = textWidth(s, font);
  let x0 = x;
  if (align === 1) x0 = x + tr((w - tw) / 2); else if (align === 2) x0 = x + w - tw;
  for (let k = 0; k < s.length; k++) {
    const g = glyphCode(s[k]) * f.cols, gx = x0 + k * f.adv;
    for (let i = 0; i < f.cols; i++) {
      const col = f.bold ? (i < 5 ? F5[(g / 6) * 5 + i] : 0) | (i > 0 ? F5[(g / 6) * 5 + i - 1] : 0) : data[g + i];
      for (let j = 0; j < f.rows; j++) if ((col >> j) & 1)
        for (let a = 0; a < f.scale; a++) for (let b = 0; b < f.scale; b++) px(fb, gx + i * f.scale + a, y + j * f.scale + b, c);
    }
  }
}
// a rounded rectangle, corner radius r 0..3 (row j's inset); fillmode 0 outline (dotted: every other pixel), 1 solid, 2 dither
function rbox(fb, x, y, w, h, r, c, fillmode, dotted) {
  if (w < 1 || h < 1) return;
  if (r > (w >> 1)) r = w >> 1;
  if (r > (h >> 1)) r = h >> 1;
  const ins = (j) => (j < r ? r - j : j > h - 1 - r ? r - (h - 1 - j) : 0);
  const P = (xx, yy) => { if (!dotted || ((xx + yy) & 1) === 0) px(fb, xx, yy, c); };
  for (let j = 0; j < h; j++) {
    const a = ins(j), yy = y + j;
    if (fillmode) { for (let xx = x + a; xx <= x + w - 1 - a; xx++) if (fillmode === 1 || ((xx + yy) & 1) === 0) px(fb, xx, yy, c); continue; }
    if (j === 0 || j === h - 1) { for (let xx = x + a; xx <= x + w - 1 - a; xx++) P(xx, yy); continue; }
    const nb = ins(j < (h >> 1) ? j - 1 : j + 1), b = nb - 1 > a ? nb - 1 : a;
    for (let xx = a; xx <= b; xx++) { P(x + xx, yy); P(x + w - 1 - xx, yy); }
  }
}
// a circle outline (midpoint), centre cx cy, radius r
function circle(fb, cx, cy, r, c) {
  let x = r, y = 0, e = 1 - r;
  while (x >= y) {
    px(fb, cx + x, cy + y, c); px(fb, cx - x, cy + y, c); px(fb, cx + x, cy - y, c); px(fb, cx - x, cy - y, c);
    px(fb, cx + y, cy + x, c); px(fb, cx - y, cy + x, c); px(fb, cx + y, cy - x, c); px(fb, cx - y, cy - x, c);
    y++;
    if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; }
  }
}
// one cycle of a wave at phase a (256 a turn) -> Q12; v7 the param: pulse width, harmonic count, FM index
function wavAt(shape, a, v7) {
  a &= 255;
  switch (shape) {
    case 1: return a < 64 ? a * 64 : a < 192 ? (128 - a) * 64 : (a - 256) * 64;
    case 2: return a < 128 ? a * 32 : (a - 256) * 32;
    case 3: return a < 16 + tr((v7 * 224) / 127) ? 4096 : -4096;
    case 4: { const n = 1 + tr((v7 * 7) / 127); let s = 0, d = 0; for (let k = 1; k <= n; k++) { s += tr(isin(a * k) / k); d += tr(4096 / k); } return tr((s * 4096) / d); }
    case 5: return isin(a + ((v7 * isin(a * 2)) >> 12));
    default: return isin(a);
  }
}
export const fontHeight = (font) => (font >= FONT_CUSTOM ? (CF[font - FONT_CUSTOM] ? CF[font - FONT_CUSTOM].h : 0) : FONTS[font].rows * FONTS[font].scale);

// --- which list item / frame a param picks. Plain: n equal zones of the knob (index = v * n / 128). "index": {
//   detents: N  the knob's range end to end onto N detents, rounded (0.0 -> 0, 127.0 -> N-1), as Sidecar's detented knobs
//   div: d, mod: m  then index = detent / d (whole part) or detent % m: one param driving two lists (e.g. 19 x 19 pairs) }
const TOP14 = 127 * 128;
function pickIndex(e, q, n) {
  let k;
  if (e.det > 1) { k = tr((q * (e.det - 1) + (TOP14 >> 1)) / TOP14); if (k > e.det - 1) k = e.det - 1; }
  else k = zone(q, e.div > 1 ? n * e.div : n);
  if (e.div > 1) k = tr(k / e.div);
  if (e.mod > 1) k %= e.mod;
  return clamp(k, 0, n - 1);
}
const itoa = (n) => String(n);

// --- bitmaps: { w, h, frames: [hex] }, rows padded to whole bytes, MSB first
export function bmpBytes(b) { return ((b.w + 7) >> 3) * b.h; }
export function hexToBytes(h) { const o = new Uint8Array(h.length >> 1); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(2 * i, 2), 16); return o; }
export function bytesToHex(a) { return Array.from(a, (v) => v.toString(16).padStart(2, "0")).join(""); }
function blit(fb, bits, off, w, h, x0, y0, or) {
  const rb = (w + 7) >> 3;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const on = (bits[off + y * rb + (x >> 3)] >> (7 - (x & 7))) & 1;
    if (on) px(fb, x0 + x, y0 + y, 1); else if (!or) px(fb, x0 + x, y0 + y, 0);
  }
}

// --- one element, normalised (the C struct's fields): t type, x y w h, p, mode, flags, font, align, min max, a d s r,
// str, items[], bmp (index), ifp ifmin ifmax
export function norm(el, bmpIndex, fontIndex) {
  const n = (v, d = 0) => (v === undefined || v === null || v === "" ? d : Number(v) | 0);
  const f = (el.inv ? FL.inv : 0) | (el.center ? FL.center : 0) | (el.frame ? FL.frame : 0) | (el.dir === "v" ? FL.vert : 0) |
    (el.dotted ? FL.dotted : 0) | (el.nodes ? FL.nodes : 0);
  let mode = 0;
  if (el.type === "value") mode = VFMT[el.fmt || "num"] ?? 0;
  else if (el.type === "rect") mode = FILL[el.fill || "outline"] ?? 0;
  else if (el.type === "frames") mode = el.blend === "or" ? 1 : 0;
  else if (el.type === "env") mode = (el.mode === "adsr" ? 1 : 0) | (el.guides ? 2 : 0);
  else if (el.type === "dial") mode = el.ring ? 1 : 0;
  else if (el.type === "bar") mode = (el.ticks ? 1 : 0) | (el.round ? 2 : 0);
  else if (el.type === "text") mode = el.rule ? 1 : 0;
  else if (el.type === "box") mode = FILL[el.fill || "outline"] ?? 0;
  else if (el.type === "toggle") mode = clamp(n(el.steps, 2), 0, 255);
  else if (el.type === "wave") mode = WAVES[el.shape || "sine"] ?? 0;
  let items = [], str = "";
  if (el.type === "text" || el.type === "box") str = String(el.text ?? el.label ?? "");
  else if (el.type === "value") { items = (el.items || []).map(String); str = String(el.suffix ?? ""); }
  else if (el.type === "switch") items = [String(el.off ?? "OFF"), String(el.on ?? "ON")];
  const cond = el.if && n(el.if.p) ? el.if : null;
  return {
    t: TYPES[el.type] || 0, x: n(el.x), y: n(el.y), w: n(el.type === "line" ? el.x2 : el.w), h: n(el.type === "line" ? el.y2 : el.h),
    p: n(el.p), mode, flags: f,
    font: typeof el.font === "string" && isNaN(Number(el.font)) ? (fontIndex && el.font in fontIndex ? FONT_CUSTOM + fontIndex[el.font] : 1) : clamp(n(el.font), 0, 4),
    det: clamp(n(el.index?.detents), 0, 65535), div: clamp(n(el.index?.div), 0, 255), mod: clamp(n(el.index?.mod), 0, 255), align: ALIGN[el.align || "left"] ?? 0,
    min: n(el.min, 0), max: n(el.max, 127), a: n(el.type === "box" ? el.radius : el.type === "wave" ? el.cycles ?? 1 : el.a), d: n(el.d), s: n(el.s), r: n(el.r), str, items,
    bmp: el.type === "frames" && bmpIndex && el.bmp in bmpIndex ? bmpIndex[el.bmp] : -1,
    ifp: cond ? n(cond.p) : 0, ifmin: cond ? clamp(n(cond.min, 0), 0, 127) : 0, ifmax: cond ? clamp(n(cond.max, 127), 0, 127) : 127,
  };
}

// the whole layout, in C order: elements (page-major, then as listed), bitmaps (by name order of first use / listing)
export function compile(layout) {
  const names = Object.keys(layout.bitmaps || {}), bmpIndex = {}, bmps = [];
  let bits = [];
  names.forEach((k, i) => {
    const b = layout.bitmaps[k], nb = bmpBytes(b);
    bmpIndex[k] = i;
    bmps.push({ w: b.w, h: b.h, n: b.frames.length, off: bits.length });
    for (const fr of b.frames) { const a = hexToBytes(fr); for (let j = 0; j < nb; j++) bits.push(a[j] || 0); }
  });
  const fontNames = Object.keys(layout.fonts || {}), fontIndex = {};
  fontNames.forEach((k, i) => (fontIndex[k] = i));
  const fonts = fontNames.map((k) => compileFont(layout.fonts[k]));
  const els = [];
  for (let pg = 1; pg <= 4; pg++) for (const el of (layout.pages && layout.pages[pg]) || []) { const e = norm(el, bmpIndex, fontIndex); e.page = pg; if (e.t) els.push(e); }
  return { els, bmps, bits: Uint8Array.from(bits), fonts, fontNames };
}

function drawEl(fb, e, p, c, bmps, bits) {
  const P = (k) => (k >= 1 && k <= 32 ? q14(p[k - 1]) : 0), V = (k) => P(k) >> 7;
  if (e.ifp) { const v = V(e.ifp); if (v < e.ifmin || v > e.ifmax) return; }
  const q = P(e.p), v7 = q >> 7, inv = e.flags & FL.inv;
  switch (e.t) {
    case 1: case 2: {   // text, value
      let s = e.str;
      if (e.t === 2) {
        if (e.mode === 1) s = (e.items.length ? e.items[pickIndex(e, q, e.items.length)] : "") + e.str;
        else { const n = map7(v7, e.min, e.max); s = (e.mode === 2 && n > 0 ? "+" : "") + itoa(n) + e.str; }
      }
      if (inv) { const tw = e.align ? e.w : textWidth(s, e.font); fill(fb, e.x - 1, e.y - 1, tw + 2, fontHeight(e.font) + 2, 1, 0); }
      text(fb, e.x, e.y, e.w, s, e.font, e.align, inv ? 0 : 1);
      if (e.t === 1 && (e.mode & 1)) {   // rule: a line each side of the centred label, 2 px clear
        const tw = textWidth(s, e.font), l = e.x + tr((e.w - tw) / 2), ym = e.y + (fontHeight(e.font) >> 1);
        if (l - 3 >= e.x) hline(fb, e.x, l - 3, ym, 1);
        if (l + tw + 2 <= e.x + e.w - 1) hline(fb, l + tw + 2, e.x + e.w - 1, ym, 1);
      }
      break;
    }
    case 3: {   // bar
      let x = e.x, y = e.y, w = e.w, h = e.h;
      const vert = e.flags & FL.vert;
      if (e.mode & 1) {   // ticks: a dotted rail 3 px off each long side
        if (vert) for (let j = y + 1; j < y + h - 1; j += 2) { px(fb, x - 3, j, 1); px(fb, x + w + 2, j, 1); }
        else for (let i = x + 1; i < x + w - 1; i += 2) { px(fb, i, y - 3, 1); px(fb, i, y + h + 2, 1); }
      }
      if (e.flags & FL.frame) {   // round: a rounded frame and a 1 px gap round the fill
        if (e.mode & 2) { rbox(fb, x, y, w, h, 2, 1, 0, 0); x += 2; y += 2; w -= 4; h -= 4; } else { box(fb, x, y, w, h, 1); x++; y++; w -= 2; h -= 2; }
      }
      if (w < 1 || h < 1) break;
      const L = vert ? h : w, m = frac(v7, L);
      let a = 0, b = m - 1;
      if (e.flags & FL.center) { const mid = tr(L / 2); a = m < mid ? m : mid; b = m < mid ? mid : m; if (b > L - 1) b = L - 1; }
      if (b < a) break;
      if (vert) fill(fb, x, y + h - 1 - b, w, b - a + 1, 1, 0); else fill(fb, x + a, y, b - a + 1, h, 1, 0);
      break;
    }
    case 4: {   // dial: 270 degrees, from bottom left (angle 160) clockwise to bottom right (angle -32)
      const r = tr((e.w - 1) / 2), cx = e.x + r, cy = e.y + r;
      const pt = (ang, rr) => [cx + ((rr * icos(ang) + 2048) >> 12), cy - ((rr * isin(ang) + 2048) >> 12)];
      if (e.mode & 1) { circle(fb, cx, cy, r, 1); const [x1, y1] = pt(160 - frac(v7, 192), r - 2 > 0 ? r - 2 : 0); line(fb, cx, cy, x1, y1, 1, 0); break; }
      for (let a = 0; a <= 192; a += 12) { const [x, y] = pt(160 - a, r); px(fb, x, y, 1); }
      const av = frac(v7, 192), a0 = e.flags & FL.center ? 96 : 0, lo = av < a0 ? av : a0, hi = av < a0 ? a0 : av;
      for (let a = lo; a <= hi; a += 2) { const [x, y] = pt(160 - a, r); px(fb, x, y, 1); }
      const [x1, y1] = pt(160 - av, r - 2 > 0 ? r - 2 : 0);
      line(fb, cx, cy, x1, y1, 1, 0);
      break;
    }
    case 5: {   // switch: on at 64 and up
      const on = q >= 8192, s = e.items[on ? 1 : 0] || "", ty = e.y + tr((e.h - fontHeight(e.font)) / 2);
      if (on) fill(fb, e.x, e.y, e.w, e.h, 1, 0); else box(fb, e.x, e.y, e.w, e.h, 1);
      text(fb, e.x, ty, e.w, s, e.font, 1, on ? 0 : 1);
      break;
    }
    case 6: {   // envelope: ad (attack, decay to s or the floor) / adsr
      if (e.flags & FL.frame) box(fb, e.x, e.y, e.w, e.h, 1);
      const x0 = e.x + 1, W = e.w - 2, top = e.y + 1, bot = e.y + e.h - 2, Hh = bot - top;
      if (W < 2 || Hh < 1) break;
      const A = V(e.a), D = V(e.d), S = e.s ? V(e.s) : 0, R = V(e.r);
      let pts;
      if (e.mode & 1) {
        const seg = tr(W / 4), xa = x0 + frac(A, seg), xd = xa + frac(D, seg), ys = bot - frac(S, Hh), xs = xd + seg, xr = xs + frac(R, seg);
        pts = [[x0, bot], [xa, top], [xd, ys], [xs, ys], [xr, bot]];
      } else {
        const seg = tr(W / 2), xa = x0 + frac(A, seg), xd = xa + frac(D, seg), ye = bot - frac(S, Hh);
        pts = [[x0, bot], [xa, top], [xd, ye], [x0 + W - 1, ye]];
      }
      if (e.mode & 2) for (let k = 1; k < pts.length - 1; k++) if (pts[k][0] > x0 && pts[k][0] < x0 + W - 1) for (let y = top + 1; y < bot; y += 2) px(fb, pts[k][0], y, 1);
      for (let k = 1; k < pts.length; k++) line(fb, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 1, e.flags & FL.dotted);
      if (e.flags & FL.nodes) for (let k = 1; k < pts.length - 1; k++) { box(fb, pts[k][0] - 1, pts[k][1] - 1, 3, 3, 1); px(fb, pts[k][0], pts[k][1], 0); }
      break;
    }
    case 7: {   // frames: a bitmap's frame by the param (zones), frame 0 without one
      if (e.bmp < 0 || e.bmp >= bmps.length) break;
      const b = bmps[e.bmp], i = e.p ? pickIndex(e, q, b.n) : 0;
      blit(fb, bits, b.off + i * (((b.w + 7) >> 3) * b.h), b.w, b.h, e.x, e.y, e.mode === 1);
      break;
    }
    case 8:   // rect
      if (e.mode === 0) box(fb, e.x, e.y, e.w, e.h, inv ? 0 : 1); else fill(fb, e.x, e.y, e.w, e.h, inv ? 0 : 1, e.mode === 2);
      break;
    case 9:   // line (w, h = x2, y2)
      line(fb, e.x, e.y, e.w, e.h, inv ? 0 : 1, e.flags & FL.dotted);
      break;
    case 10: {   // box: rounded (a = radius 0..3), outline / solid / dither, dotted; a label notched into the top edge
      rbox(fb, e.x, e.y, e.w, e.h, e.a, inv ? 0 : 1, e.mode, e.flags & FL.dotted);
      if (e.str.length) {
        const tw = textWidth(e.str, e.font), fh = fontHeight(e.font), lx = e.x + tr((e.w - tw) / 2), ly = e.y - (fh >> 1);
        fill(fb, lx - 2, ly, tw + 4, fh, 0, 0);
        text(fb, lx, ly, tw, e.str, e.font, 0, 1);
      }
      break;
    }
    case 11: {   // toggle: a pill track and a knob; mode = steps (2 off/on, n positions, 0 continuous)
      const kw = e.h + (e.h >> 1), r = e.h >> 2 > 3 ? 3 : e.h >> 2, span = e.w - 4 - kw;
      rbox(fb, e.x, e.y, e.w, e.h, r + 1, 1, 0, 0);
      const pos = e.mode === 0 ? frac(v7, span) : e.mode === 1 ? 0 : tr((zone(q, e.mode) * span) / (e.mode - 1));
      const kx = e.x + 2 + pos;
      rbox(fb, kx, e.y + 2, kw, e.h - 4, r, 1, 1, 0);
      if (e.h >= 8) vline(fb, kx + (kw >> 1), e.y + 4, e.y + e.h - 5, 0);
      break;
    }
    case 12: {   // wave: a (cycles) of a shape across w, centred in h; the param shapes it; frame: a rounded box
      if (e.flags & FL.frame) rbox(fb, e.x, e.y, e.w, e.h, 2, 1, 0, 0);
      const fr = e.flags & FL.frame ? 2 : 0, x0 = e.x + fr, W = e.w - 2 * fr, mid = e.y + (e.h >> 1), A = (e.h >> 1) - fr - 1;
      if (W < 2 || A < 1) break;
      let ly = 0;
      for (let i = 0; i < W; i++) {
        const yy = mid - ((wavAt(e.mode, tr((i * 256 * (e.a || 1)) / W), v7) * A + 2048) >> 12);
        if (i) line(fb, x0 + i - 1, ly, x0 + i, yy, 1, e.flags & FL.dotted); else px(fb, x0, yy, 1);
        ly = yy;
      }
      break;
    }
    case 13: {   // band: a filter's pass band from two params, a = base (high-pass), d = width; the low-pass closes by
      // 127 - base - width (0 = open), as the Sidecar's send FX BASE / WIDTH. frame: a rounded box. A cut edge gets a
      // dotted marker; the band's top runs between the two edges, ramps down to the floor outside them.
      if (e.flags & FL.frame) rbox(fb, e.x, e.y, e.w, e.h, 2, 1, 0, 0);
      const fr = e.flags & FL.frame ? 2 : 0, x0 = e.x + fr + 1, W = e.w - 2 * fr - 2, top = e.y + fr + 2, bot = e.y + e.h - fr - 2;
      if (W < 4 || bot - top < 2) break;
      const base = V(e.a), lpa = Math.max(0, 127 - base - V(e.d)), x1 = x0 + W - 1;
      const hp = x0 + frac(base, W - 1), lp = Math.max(hp, x1 - frac(lpa, W - 1));
      const sk = 4;   // each cut edge: a short steep skirt to the floor at its cutoff
      if (base) line(fb, Math.max(x0, hp - sk), bot, hp, top, 1, 0); else line(fb, x0, top, hp, top, 1, 0);
      line(fb, hp, top, lp, top, 1, 0);
      if (lpa) line(fb, lp, top, Math.min(x1, lp + sk), bot, 1, 0); else line(fb, lp, top, x1, top, 1, 0);
      for (let y = top + 2; y <= bot; y += 2) { if (base) px(fb, hp, y, 1); if (lpa) px(fb, lp, y, 1); }
      break;
    }
  }
}

// page 1..4, p[0..31] = P1..P32 -> { fb, drawn } (drawn 0: the page has no elements, the plugin declines: stock)
export function render(layout, page, p, compiled) {
  const C = compiled || compile(layout), fb = new Uint8Array(BYTES);
  CF = C.fonts || [];
  let any = 0;
  for (const e of C.els) if (e.page === page) { any = 1; drawEl(fb, e, p, 1, C.bmps, C.bits); }
  return { fb, drawn: any };
}

// --- checks: what the C side would refuse or draw off the screen
export function validate(layout) {
  const errs = [];
  if (layout.format !== "rmpui-1") errs.push('format must be "rmpui-1"');
  for (const [k, b] of Object.entries(layout.bitmaps || {})) {
    if (!(b.w >= 1 && b.w <= 128 && b.h >= 1 && b.h <= 64)) errs.push(`bitmap ${k}: size ${b.w}x${b.h}`);
    if (!b.frames || !b.frames.length) errs.push(`bitmap ${k}: no frames`);
    else if (b.frames.length > 255) errs.push(`bitmap ${k}: more than 255 frames`);
    (b.frames || []).forEach((f, i) => { if (f.length !== 2 * bmpBytes(b)) errs.push(`bitmap ${k} frame ${i}: ${f.length / 2} bytes, want ${bmpBytes(b)}`); });
  }
  for (let pg = 1; pg <= 4; pg++) ((layout.pages || {})[pg] || []).forEach((el, i) => {
    const at = `page ${pg} #${i + 1} (${el.type})`;
    if (!TYPES[el.type]) errs.push(`${at}: unknown type`);
    if (el.p !== undefined && el.p !== "" && !(el.p >= 0 && el.p <= 32)) errs.push(`${at}: p must be 1..32`);
    if (el.type === "frames" && !(el.bmp in (layout.bitmaps || {}))) errs.push(`${at}: no bitmap "${el.bmp}"`);
    if (el.type === "value" && el.fmt === "list" && !(el.items || []).length) errs.push(`${at}: a list value needs items`);
    if (el.type === "band" && !(el.a >= 1 && el.a <= 32 && el.d >= 1 && el.d <= 32)) errs.push(`${at}: a band needs a (base) and d (width) params 1..32`);
    if (el.items && el.items.length > 255) errs.push(`${at}: more than 255 items`);
    if (typeof el.font === "string" && isNaN(Number(el.font)) && !(el.font in (layout.fonts || {}))) errs.push(`${at}: no font "${el.font}"`);
    if (typeof el.font === "string" && el.font in (layout.fonts || {})) {   // characters the font can't draw
      const F = compileFont(layout.fonts[el.font]), miss = new Set();
      for (const t of [el.text, el.suffix, ...(el.items || [])]) for (const ch of String(t ?? "")) if (ch !== " " && !glyphOf(F, ch)) miss.add(ch);
      if (miss.size) errs.push(`${at}: font "${el.font}" has no ${[...miss].map((c) => `"${c}"`).join(" ")}`);
    }
  });
  return errs;
}

// --- the C header for rmp_ui.c
const cstr = (s) => '"' + Array.from(s, (ch) => { const c = ch.charCodeAt(0); return c === 34 || c === 92 ? "\\" + ch : c >= 32 && c < 127 ? ch : "?"; }).join("") + '\\0"';
export function toC(layout, name) {
  const id = String(name || layout.name || "layout").replace(/[^A-Za-z0-9_]/g, "_").replace(/^([0-9])/, "_$1");
  const C = compile(layout);
  const strs = [], soff = new Map();
  let total = 0;
  const S = (s) => { if (!soff.has(s)) { soff.set(s, total); strs.push(s); total += s.length + 1; } return soff.get(s); };
  S("");
  const items = [];
  const rows = C.els.map((e) => {
    const it = items.length;
    for (const s of e.items) items.push(S(s));
    return `  {${e.t}, ${e.page}, ${e.p}, ${e.mode}, ${e.flags}, ${e.font}, ${e.align}, ${e.items.length}, ${e.a}, ${e.d}, ${e.s}, ${e.r}, ` +
      `${e.ifp}, ${e.ifmin}, ${e.ifmax}, ${e.x}, ${e.y}, ${e.w}, ${e.h}, ${e.min}, ${e.max}, ${S(e.str)}, ${it}, ${e.bmp}},`;
  });
  const lines = [
    `/* GENERATED by rmpui (rmpui.js toC) from the layout "${String(layout.name || "").replace(/\*\//g, "")}". */`,
    `#include "rmp_ui.h"`,
    `static const char ${id}_str[] =`, ...(strs.length ? strs.map((s) => "  " + cstr(s)) : ['  ""']), ";",
    `static const uint16_t ${id}_items[] = {${items.join(",") || "0"}};`,
    `static const uint8_t ${id}_bits[] = {${Array.from(C.bits).join(",") || "0"}};`,
    `static const rmpui_bmp ${id}_bmps[] = {${C.bmps.map((b) => `{${b.w}, ${b.h}, ${b.n}, ${b.off}}`).join(", ") || "{0, 0, 0, 0}"}};`,
    `/* type page p mode flags font align nitems a d s r ifp ifmin ifmax x y w h min max str items bmp */`,
    `static const rmpui_el ${id}_els[] = {`, ...(rows.length ? rows : ["  {0}"]), "};",
    `static const rmpui_layout ${id} = {${id}_els, ${C.els.length}, ${id}_str, ${id}_items, ${id}_bmps, ${id}_bits};`,
    "",
  ];
  return lines.join("\n");
}

// the bytes a layout costs in the plugin (tables only; rmp_ui.c's code and fonts are ~3 KB more)
export function cost(layout) {
  const C = compile(layout);
  let strs = new Set([""]), items = 0;
  for (const e of C.els) { strs.add(e.str); for (const s of e.items) strs.add(s); items += e.items.length; }
  let sb = 0; for (const s of strs) sb += s.length + 1;
  return { elements: C.els.length, bytes: C.els.length * 28 + sb + 2 * items + C.bits.length + 8 * C.bmps.length };
}
