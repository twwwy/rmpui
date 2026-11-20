/* rmp_ui.c - rmpui_draw(): a layout made in rmpui (layout.html / board.html, exported as a C header by rmpui.js
 * toC()) drawn into the RMP draw frame (128 x 64, 1 bit a pixel, row-major, 16 bytes a row, MSB = leftmost, 1 = lit).
 *
 * The same integer algorithm as rmpui.js render() / drawEl(), function for function, so the designer's preview is what
 * the Rytm shows: tests/run.sh checks the two agree pixel for pixel. What the C tables do not carry is not drawn here
 * either: custom fonts (a font >= 5 draws nothing) and "index" detents (a list / frames index is the plain zone).
 * No allocation, no libc, no floating point past reading p[]. */
#include "rmp_ui.h"

enum { W = 128, H = 64, BYTES = 1024 };
enum { T_TEXT = 1, T_VALUE, T_BAR, T_DIAL, T_SWITCH, T_ENV, T_FRAMES, T_RECT, T_LINE, T_BOX, T_TOGGLE, T_WAVE, T_BAND };
enum { FL_INV = 1, FL_CENTER = 2, FL_FRAME = 4, FL_VERT = 8, FL_DOTTED = 16, FL_NODES = 32 };

/* fonts: one byte a column, bit 0 the top row; ASCII 32..95 (rmpui.js F3 / F5) */
static const uint8_t F3[] = {0,0,0,0,23,0,3,0,3,31,10,31,18,21,9,9,4,18,10,21,26,0,3,0,0,14,17,17,14,0,10,4,10,4,14,4,16,8,0,4,4,4,0,16,0,24,4,3,31,17,31,18,31,16,25,21,18,17,21,10,7,4,31,23,21,9,30,21,29,1,29,3,31,21,31,23,21,15,0,10,0,16,10,0,4,10,17,10,10,10,17,10,4,1,21,2,15,17,23,30,5,30,31,21,10,14,17,17,31,17,14,31,21,17,31,5,1,14,17,29,31,4,31,17,31,17,8,16,15,31,4,27,31,16,16,31,6,31,31,1,30,14,17,14,31,5,2,14,25,22,31,5,26,18,21,9,1,31,1,31,16,31,15,16,15,31,12,31,27,4,27,3,28,3,25,21,19,31,17,0,3,4,24,0,17,31,2,1,2,16,16,16};
static const uint8_t F5[] = {0,0,0,0,0,0,0,95,0,0,0,3,0,3,0,20,127,20,127,20,36,42,127,42,18,35,19,8,100,98,54,73,85,34,80,0,0,3,0,0,0,28,34,65,0,0,65,34,28,0,20,8,62,8,20,8,8,62,8,8,0,80,48,0,0,8,8,8,8,8,0,96,96,0,0,32,16,8,4,2,62,81,73,69,62,0,66,127,64,0,66,97,81,73,70,65,73,73,73,54,24,20,18,127,16,39,69,69,69,57,60,74,73,73,48,1,113,9,5,3,54,73,73,73,54,6,73,73,41,30,0,54,54,0,0,0,86,54,0,0,8,20,34,65,0,20,20,20,20,20,0,65,34,20,8,2,1,81,9,6,50,73,121,65,62,126,9,9,9,126,127,73,73,73,54,62,65,65,65,34,127,65,65,34,28,127,73,73,73,65,127,9,9,9,1,62,65,73,73,122,127,8,8,8,127,0,65,127,65,0,32,64,65,63,1,127,8,20,34,65,127,64,64,64,64,127,2,12,2,127,127,4,8,16,127,62,65,65,65,62,127,9,9,9,6,62,65,81,33,94,127,9,25,41,70,70,73,73,73,49,1,1,127,1,1,63,64,64,64,63,31,32,64,32,31,63,64,56,64,63,99,20,8,20,99,3,4,120,4,3,97,81,73,69,67,0,127,65,65,0,2,4,8,16,32,0,65,65,127,0,4,2,1,2,4,64,64,64,64,64};
/* font: 0 small (3x5, advance 4), 1 medium (5x7, 6), 2 large (5x7 x 2, 12), 3 bold (6x7, 7), 4 big bold (x 2, 14) */
typedef struct { uint8_t cols, rows, scale, adv, bold; } font_t;
static const font_t FONTS[5] = {{3, 5, 1, 4, 0}, {5, 7, 1, 6, 0}, {5, 7, 2, 12, 0}, {6, 7, 1, 7, 1}, {6, 7, 2, 14, 1}};

/* a quarter sine, Q12, 256 units a turn */
static const int16_t SIN[65] = {0,101,201,301,401,501,601,700,799,897,995,1092,1189,1285,1380,1474,1567,1660,1751,1842,1931,2019,2106,2191,2276,2359,2440,2520,2598,2675,2751,2824,2896,2967,3035,3102,3166,3229,3290,3349,3406,3461,3513,3564,3612,3659,3703,3745,3784,3822,3857,3889,3920,3948,3973,3996,4017,4036,4052,4065,4076,4085,4091,4095,4096};
static int32_t isin(int32_t a) {
    a &= 255;
    if (a < 64) return SIN[a];
    if (a < 128) return SIN[128 - a];
    if (a < 192) return -SIN[a - 128];
    return -SIN[256 - a];
}
static int32_t icos(int32_t a) { return isin(a + 64); }

static int32_t clampi(int32_t v, int32_t a, int32_t b) { return v < a ? a : v > b ? b : v; }
static int32_t iabs(int32_t v) { return v < 0 ? -v : v; }

/* P (0..127 + fraction / 128) -> 14 bits */
static int32_t q14(float x) {
    if (!(x > 0.0f)) return 0;
    if (x >= 128.0f) return 16383;
    return clampi((int32_t)(x * 128.0f), 0, 16383);
}
static int32_t zone(int32_t q, int32_t n) { return clampi(q * n / 16384, 0, n - 1); }
static int32_t map7(int32_t v7, int32_t min, int32_t max) {
    return max >= min ? min + (v7 * (max - min) + 63) / 127 : max + ((127 - v7) * (min - max) + 63) / 127;
}
static int32_t frac(int32_t v7, int32_t n) { return (v7 * n + 63) / 127; }

/* --- pixels: c 1 set, 0 clear */
static void px(uint8_t *fb, int32_t x, int32_t y, int32_t c) {
    if (x < 0 || x > W - 1 || y < 0 || y > H - 1) return;
    int32_t i = y * 16 + (x >> 3);
    uint8_t m = (uint8_t)(0x80 >> (x & 7));
    if (c == 1) fb[i] |= m; else if (c == 0) fb[i] &= (uint8_t)~m; else fb[i] ^= m;
}
static void hline(uint8_t *fb, int32_t x0, int32_t x1, int32_t y, int32_t c) { for (int32_t x = x0; x <= x1; ++x) px(fb, x, y, c); }
static void vline(uint8_t *fb, int32_t x, int32_t y0, int32_t y1, int32_t c) { for (int32_t y = y0; y <= y1; ++y) px(fb, x, y, c); }
static void box(uint8_t *fb, int32_t x, int32_t y, int32_t w, int32_t h, int32_t c) {
    if (w < 1 || h < 1) return;
    hline(fb, x, x + w - 1, y, c); hline(fb, x, x + w - 1, y + h - 1, c); vline(fb, x, y, y + h - 1, c); vline(fb, x + w - 1, y, y + h - 1, c);
}
static void fill(uint8_t *fb, int32_t x, int32_t y, int32_t w, int32_t h, int32_t c, int32_t dither) {
    for (int32_t j = 0; j < h; ++j) for (int32_t i = 0; i < w; ++i) if (!dither || ((x + i + y + j) & 1) == 0) px(fb, x + i, y + j, c);
}
static void line(uint8_t *fb, int32_t x0, int32_t y0, int32_t x1, int32_t y1, int32_t c, int32_t dotted) {
    int32_t dx = iabs(x1 - x0), dy = -iabs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy, k = 0;
    for (;;) {
        if (!dotted || (k & 1) == 0) px(fb, x0, y0, c);
        ++k;
        if (x0 == x1 && y0 == y1) break;
        int32_t e2 = 2 * e;
        if (e2 >= dy) { e += dy; x0 += sx; }
        if (e2 <= dx) { e += dx; y0 += sy; }
    }
}

/* --- text (built-in fonts 0..4; a custom font, >= 5, has no tables here: nothing drawn, width 0) */
static int32_t slen(const char *s) { int32_t n = 0; while (s[n]) ++n; return n; }
static int32_t glyph_code(char ch) {
    int32_t c = (uint8_t)ch;
    if (c >= 97 && c <= 122) c -= 32;
    return c >= 32 && c <= 95 ? c - 32 : 31;   /* '?' for the rest */
}
static int32_t text_width(const char *s, int32_t font) {
    if (font < 0 || font > 4) return 0;
    int32_t n = slen(s);
    return n ? n * FONTS[font].adv - FONTS[font].scale : 0;
}
static int32_t font_height(int32_t font) { return font < 0 || font > 4 ? 0 : FONTS[font].rows * FONTS[font].scale; }
static void text(uint8_t *fb, int32_t x, int32_t y, int32_t w, const char *s, int32_t font, int32_t align, int32_t c) {
    if (font < 0 || font > 4) return;
    const font_t *f = &FONTS[font];
    const uint8_t *data = font == 0 ? F3 : F5;
    int32_t tw = text_width(s, font), x0 = x, n = slen(s);
    if (align == 1) x0 = x + (w - tw) / 2; else if (align == 2) x0 = x + w - tw;
    for (int32_t k = 0; k < n; ++k) {
        int32_t g = glyph_code(s[k]) * f->cols, gx = x0 + k * f->adv;
        for (int32_t i = 0; i < f->cols; ++i) {
            int32_t col = f->bold ? (i < 5 ? F5[(g / 6) * 5 + i] : 0) | (i > 0 ? F5[(g / 6) * 5 + i - 1] : 0) : data[g + i];
            for (int32_t j = 0; j < f->rows; ++j) if ((col >> j) & 1)
                for (int32_t a = 0; a < f->scale; ++a) for (int32_t b = 0; b < f->scale; ++b) px(fb, gx + i * f->scale + a, y + j * f->scale + b, c);
        }
    }
}
/* a rounded rectangle, corner radius r 0..3; fillmode 0 outline (dotted: every other pixel), 1 solid, 2 dither */
static int32_t rins(int32_t j, int32_t r, int32_t h) { return j < r ? r - j : j > h - 1 - r ? r - (h - 1 - j) : 0; }
static void rpx(uint8_t *fb, int32_t x, int32_t y, int32_t c, int32_t dotted) { if (!dotted || ((x + y) & 1) == 0) px(fb, x, y, c); }
static void rbox(uint8_t *fb, int32_t x, int32_t y, int32_t w, int32_t h, int32_t r, int32_t c, int32_t fillmode, int32_t dotted) {
    if (w < 1 || h < 1) return;
    if (r > (w >> 1)) r = w >> 1;
    if (r > (h >> 1)) r = h >> 1;
    for (int32_t j = 0; j < h; ++j) {
        int32_t a = rins(j, r, h), yy = y + j;
        if (fillmode) { for (int32_t xx = x + a; xx <= x + w - 1 - a; ++xx) if (fillmode == 1 || ((xx + yy) & 1) == 0) px(fb, xx, yy, c); continue; }
        if (j == 0 || j == h - 1) { for (int32_t xx = x + a; xx <= x + w - 1 - a; ++xx) rpx(fb, xx, yy, c, dotted); continue; }
        int32_t nb = rins(j < (h >> 1) ? j - 1 : j + 1, r, h), b = nb - 1 > a ? nb - 1 : a;
        for (int32_t xx = a; xx <= b; ++xx) { rpx(fb, x + xx, yy, c, dotted); rpx(fb, x + w - 1 - xx, yy, c, dotted); }
    }
}
static void circle(uint8_t *fb, int32_t cx, int32_t cy, int32_t r, int32_t c) {
    int32_t x = r, y = 0, e = 1 - r;
    while (x >= y) {
        px(fb, cx + x, cy + y, c); px(fb, cx - x, cy + y, c); px(fb, cx + x, cy - y, c); px(fb, cx - x, cy - y, c);
        px(fb, cx + y, cy + x, c); px(fb, cx - y, cy + x, c); px(fb, cx + y, cy - x, c); px(fb, cx - y, cy - x, c);
        ++y;
        if (e < 0) e += 2 * y + 1; else { --x; e += 2 * (y - x) + 1; }
    }
}
/* one cycle of a wave at phase a (256 a turn) -> Q12; v7 shapes it (pulse width, harmonic count, FM index) */
static int32_t wav_at(int32_t shape, int32_t a, int32_t v7) {
    a &= 255;
    switch (shape) {
    case 1: return a < 64 ? a * 64 : a < 192 ? (128 - a) * 64 : (a - 256) * 64;
    case 2: return a < 128 ? a * 32 : (a - 256) * 32;
    case 3: return a < 16 + (v7 * 224) / 127 ? 4096 : -4096;
    case 4: {
        int32_t n = 1 + (v7 * 7) / 127, s = 0, d = 0;
        for (int32_t k = 1; k <= n; ++k) { s += isin(a * k) / k; d += 4096 / k; }
        return s * 4096 / d;
    }
    case 5: return isin(a + ((v7 * isin(a * 2)) >> 12));
    default: return isin(a);
    }
}
static void blit(uint8_t *fb, const uint8_t *bits, uint32_t off, int32_t w, int32_t h, int32_t x0, int32_t y0, int32_t orb) {
    int32_t rb = (w + 7) >> 3;
    for (int32_t y = 0; y < h; ++y) for (int32_t x = 0; x < w; ++x) {
        int32_t on = (bits[off + (uint32_t)(y * rb + (x >> 3))] >> (7 - (x & 7))) & 1;
        if (on) px(fb, x0 + x, y0 + y, 1); else if (!orb) px(fb, x0 + x, y0 + y, 0);
    }
}
/* a signed integer as text */
static void itoa_(int32_t n, char *o) {
    char t[12]; int32_t k = 0, i = 0;
    uint32_t u = n < 0 ? (uint32_t)0 - (uint32_t)n : (uint32_t)n;
    do { t[k++] = (char)('0' + u % 10u); u /= 10u; } while (u);
    if (n < 0) o[i++] = '-';
    while (k) o[i++] = t[--k];
    o[i] = 0;
}
static void scat(char *o, int32_t cap, const char *a) { int32_t n = slen(o); while (*a && n < cap - 1) o[n++] = *a++; o[n] = 0; }

typedef struct { int32_t x, y; } pt_t;
static pt_t dial_pt(int32_t cx, int32_t cy, int32_t ang, int32_t rr) {
    pt_t p = {cx + ((rr * icos(ang) + 2048) >> 12), cy - ((rr * isin(ang) + 2048) >> 12)};
    return p;
}

static void draw_el(const rmpui_layout *L, uint8_t *fb, const rmpui_el *e, const float *p) {
#define PQ(k) ((k) >= 1 && (k) <= 32 ? q14(p[(k) - 1]) : 0)
    if (e->ifp) { int32_t v = PQ(e->ifp) >> 7; if (v < e->ifmin || v > e->ifmax) return; }
    const int32_t q = PQ(e->p), v7 = q >> 7, inv = e->flags & FL_INV;
    const char *str = L->str + e->str;
    switch (e->type) {
    case T_TEXT: case T_VALUE: {
        char s[160]; s[0] = 0;
        if (e->type == T_VALUE) {
            if (e->mode == 1) { if (e->nitems) scat(s, sizeof s, L->str + L->items[e->items + (uint32_t)zone(q, e->nitems)]); scat(s, sizeof s, str); }
            else {
                char num[12]; int32_t n = map7(v7, e->min, e->max);
                if (e->mode == 2 && n > 0) scat(s, sizeof s, "+");
                itoa_(n, num); scat(s, sizeof s, num); scat(s, sizeof s, str);
            }
        } else scat(s, sizeof s, str);
        if (inv) { int32_t tw = e->align ? e->w : text_width(s, e->font); fill(fb, e->x - 1, e->y - 1, tw + 2, font_height(e->font) + 2, 1, 0); }
        text(fb, e->x, e->y, e->w, s, e->font, e->align, inv ? 0 : 1);
        if (e->type == T_TEXT && (e->mode & 1)) {   /* rule: a line each side of the centred label, 2 px clear */
            int32_t tw = text_width(s, e->font), l = e->x + (e->w - tw) / 2, ym = e->y + (font_height(e->font) >> 1);
            if (l - 3 >= e->x) hline(fb, e->x, l - 3, ym, 1);
            if (l + tw + 2 <= e->x + e->w - 1) hline(fb, l + tw + 2, e->x + e->w - 1, ym, 1);
        }
        break;
    }
    case T_BAR: {
        int32_t x = e->x, y = e->y, w = e->w, h = e->h, vert = e->flags & FL_VERT;
        if (e->mode & 1) {   /* ticks: a dotted rail 3 px off each long side */
            if (vert) for (int32_t j = y + 1; j < y + h - 1; j += 2) { px(fb, x - 3, j, 1); px(fb, x + w + 2, j, 1); }
            else for (int32_t i = x + 1; i < x + w - 1; i += 2) { px(fb, i, y - 3, 1); px(fb, i, y + h + 2, 1); }
        }
        if (e->flags & FL_FRAME) {
            if (e->mode & 2) { rbox(fb, x, y, w, h, 2, 1, 0, 0); x += 2; y += 2; w -= 4; h -= 4; }
            else { box(fb, x, y, w, h, 1); ++x; ++y; w -= 2; h -= 2; }
        }
        if (w < 1 || h < 1) break;
        int32_t Ln = vert ? h : w, m = frac(v7, Ln), a = 0, b = m - 1;
        if (e->flags & FL_CENTER) { int32_t mid = Ln / 2; a = m < mid ? m : mid; b = m < mid ? mid : m; if (b > Ln - 1) b = Ln - 1; }
        if (b < a) break;
        if (vert) fill(fb, x, y + h - 1 - b, w, b - a + 1, 1, 0); else fill(fb, x + a, y, b - a + 1, h, 1, 0);
        break;
    }
    case T_DIAL: {   /* 270 degrees, from bottom left (angle 160) clockwise to bottom right (angle -32) */
        int32_t r = (e->w - 1) / 2, cx = e->x + r, cy = e->y + r, rn = r - 2 > 0 ? r - 2 : 0;
        if (e->mode & 1) { circle(fb, cx, cy, r, 1); pt_t t = dial_pt(cx, cy, 160 - frac(v7, 192), rn); line(fb, cx, cy, t.x, t.y, 1, 0); break; }
        for (int32_t a = 0; a <= 192; a += 12) { pt_t t = dial_pt(cx, cy, 160 - a, r); px(fb, t.x, t.y, 1); }
        int32_t av = frac(v7, 192), a0 = e->flags & FL_CENTER ? 96 : 0, lo = av < a0 ? av : a0, hi = av < a0 ? a0 : av;
        for (int32_t a = lo; a <= hi; a += 2) { pt_t t = dial_pt(cx, cy, 160 - a, r); px(fb, t.x, t.y, 1); }
        pt_t t = dial_pt(cx, cy, 160 - av, rn);
        line(fb, cx, cy, t.x, t.y, 1, 0);
        break;
    }
    case T_SWITCH: {   /* on at 64 and up */
        int32_t on = q >= 8192, ty = e->y + (e->h - font_height(e->font)) / 2;
        const char *s = (uint32_t)(on ? 1 : 0) < e->nitems ? L->str + L->items[e->items + (on ? 1u : 0u)] : "";
        if (on) fill(fb, e->x, e->y, e->w, e->h, 1, 0); else box(fb, e->x, e->y, e->w, e->h, 1);
        text(fb, e->x, ty, e->w, s, e->font, 1, on ? 0 : 1);
        break;
    }
    case T_ENV: {   /* ad (attack, decay to s or the floor) / adsr */
        if (e->flags & FL_FRAME) box(fb, e->x, e->y, e->w, e->h, 1);
        int32_t x0 = e->x + 1, Wd = e->w - 2, top = e->y + 1, bot = e->y + e->h - 2, Hh = bot - top;
        if (Wd < 2 || Hh < 1) break;
        int32_t A = PQ(e->a) >> 7, D = PQ(e->d) >> 7, S = e->s ? PQ(e->s) >> 7 : 0, R = PQ(e->r) >> 7, n;
        pt_t pts[5];
        if (e->mode & 1) {
            int32_t seg = Wd / 4, xa = x0 + frac(A, seg), xd = xa + frac(D, seg), ys = bot - frac(S, Hh), xs = xd + seg, xr = xs + frac(R, seg);
            pts[0] = (pt_t){x0, bot}; pts[1] = (pt_t){xa, top}; pts[2] = (pt_t){xd, ys}; pts[3] = (pt_t){xs, ys}; pts[4] = (pt_t){xr, bot}; n = 5;
        } else {
            int32_t seg = Wd / 2, xa = x0 + frac(A, seg), xd = xa + frac(D, seg), ye = bot - frac(S, Hh);
            pts[0] = (pt_t){x0, bot}; pts[1] = (pt_t){xa, top}; pts[2] = (pt_t){xd, ye}; pts[3] = (pt_t){x0 + Wd - 1, ye}; n = 4;
        }
        if (e->mode & 2) for (int32_t k = 1; k < n - 1; ++k) if (pts[k].x > x0 && pts[k].x < x0 + Wd - 1) for (int32_t y = top + 1; y < bot; y += 2) px(fb, pts[k].x, y, 1);
        for (int32_t k = 1; k < n; ++k) line(fb, pts[k - 1].x, pts[k - 1].y, pts[k].x, pts[k].y, 1, e->flags & FL_DOTTED);
        if (e->flags & FL_NODES) for (int32_t k = 1; k < n - 1; ++k) { box(fb, pts[k].x - 1, pts[k].y - 1, 3, 3, 1); px(fb, pts[k].x, pts[k].y, 0); }
        break;
    }
    case T_FRAMES: {   /* a bitmap's frame by the param (zones), frame 0 without one */
        if (e->bmp < 0) break;
        const rmpui_bmp *b = &L->bmps[e->bmp];
        int32_t i = e->p ? zone(q, b->n) : 0;
        blit(fb, L->bits, b->off + (uint32_t)i * (uint32_t)(((b->w + 7) >> 3) * b->h), b->w, b->h, e->x, e->y, e->mode == 1);
        break;
    }
    case T_RECT:
        if (e->mode == 0) box(fb, e->x, e->y, e->w, e->h, inv ? 0 : 1); else fill(fb, e->x, e->y, e->w, e->h, inv ? 0 : 1, e->mode == 2);
        break;
    case T_LINE:   /* w, h = x2, y2 */
        line(fb, e->x, e->y, e->w, e->h, inv ? 0 : 1, e->flags & FL_DOTTED);
        break;
    case T_BOX: {   /* rounded (a = radius 0..3), outline / solid / dither, dotted; a label notched into the top edge */
        rbox(fb, e->x, e->y, e->w, e->h, e->a, inv ? 0 : 1, e->mode, e->flags & FL_DOTTED);
        if (str[0]) {
            int32_t tw = text_width(str, e->font), fh = font_height(e->font), lx = e->x + (e->w - tw) / 2, ly = e->y - (fh >> 1);
            fill(fb, lx - 2, ly, tw + 4, fh, 0, 0);
            text(fb, lx, ly, tw, str, e->font, 0, 1);
        }
        break;
    }
    case T_TOGGLE: {   /* a pill track and a knob; mode = steps (2 off / on, n positions, 0 continuous) */
        int32_t kw = e->h + (e->h >> 1), r = e->h >> 2 > 3 ? 3 : e->h >> 2, span = e->w - 4 - kw;
        rbox(fb, e->x, e->y, e->w, e->h, r + 1, 1, 0, 0);
        int32_t pos = e->mode == 0 ? frac(v7, span) : e->mode == 1 ? 0 : zone(q, e->mode) * span / (e->mode - 1), kx = e->x + 2 + pos;
        rbox(fb, kx, e->y + 2, kw, e->h - 4, r, 1, 1, 0);
        if (e->h >= 8) vline(fb, kx + (kw >> 1), e->y + 4, e->y + e->h - 5, 0);
        break;
    }
    case T_WAVE: {   /* a (cycles) of a shape across w, centred in h; the param shapes it; frame: a rounded box */
        if (e->flags & FL_FRAME) rbox(fb, e->x, e->y, e->w, e->h, 2, 1, 0, 0);
        int32_t fr = e->flags & FL_FRAME ? 2 : 0, x0 = e->x + fr, Wd = e->w - 2 * fr, mid = e->y + (e->h >> 1), A = (e->h >> 1) - fr - 1, ly = 0;
        if (Wd < 2 || A < 1) break;
        for (int32_t i = 0; i < Wd; ++i) {
            int32_t yy = mid - ((wav_at(e->mode, i * 256 * (e->a ? e->a : 1) / Wd, v7) * A + 2048) >> 12);
            if (i) line(fb, x0 + i - 1, ly, x0 + i, yy, 1, e->flags & FL_DOTTED); else px(fb, x0, yy, 1);
            ly = yy;
        }
        break;
    }
    case T_BAND: {   /* a filter's pass band: a = base (high-pass), d = width; the low-pass closes by 127 - base - width
                        (0 = open), as the Sidecar's send FX BASE / WIDTH. frame: a rounded box. A cut edge gets a dotted
                        marker; the band's top runs between the edges and ramps to the floor outside them. */
        if (e->flags & FL_FRAME) rbox(fb, e->x, e->y, e->w, e->h, 2, 1, 0, 0);
        int32_t fr = e->flags & FL_FRAME ? 2 : 0, x0 = e->x + fr + 1, Wd = e->w - 2 * fr - 2, top = e->y + fr + 2, bot = e->y + e->h - fr - 2;
        if (Wd < 4 || bot - top < 2) break;
        int32_t base = PQ(e->a) >> 7, lpa = 127 - base - (PQ(e->d) >> 7), x1 = x0 + Wd - 1, sk = 4;
        if (lpa < 0) lpa = 0;
        int32_t hp = x0 + frac(base, Wd - 1), lp = x1 - frac(lpa, Wd - 1);
        if (lp < hp) lp = hp;
        if (base) line(fb, hp - sk > x0 ? hp - sk : x0, bot, hp, top, 1, 0); else line(fb, x0, top, hp, top, 1, 0);
        line(fb, hp, top, lp, top, 1, 0);
        if (lpa) line(fb, lp, top, lp + sk < x1 ? lp + sk : x1, bot, 1, 0); else line(fb, lp, top, x1, top, 1, 0);
        for (int32_t y = top + 2; y <= bot; y += 2) { if (base) px(fb, hp, y, 1); if (lpa) px(fb, lp, y, 1); }
        break;
    }
    default: break;
    }
#undef PQ
}

int32_t rmpui_draw(const rmpui_layout *L, int32_t page, const float *p, uint8_t *fb) {
    int32_t any = 0;
    for (uint32_t i = 0; i < L->nel; ++i) if (L->els[i].type && L->els[i].page == page) { any = 1; break; }
    if (!any) return 0;
    for (int32_t i = 0; i < BYTES; ++i) fb[i] = 0;
    for (uint32_t i = 0; i < L->nel; ++i) if (L->els[i].type && L->els[i].page == page) draw_el(L, fb, &L->els[i], p);
    return 1;
}
