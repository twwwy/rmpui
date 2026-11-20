/* rmp_ui.h - draw a Sidecar user machine's Rytm screens from a layout made in rmpui (layout.html or board.html).
 *
 *   #include "my_layout.h"            (exported by the designer: static const rmpui_layout my_layout)
 *   static int32_t draw(void *st, int32_t page, uint32_t flags, int32_t track, const float *p, uint8_t *fb)
 *   { (void)st; (void)flags; (void)track; return rmpui_draw(&my_layout, page, p, fb); }
 *   ... rmp_plugin's reserved[RMP_P_DRAW] = RMP_FN(draw)
 *
 * page 1..4 (SRC, SMPL, SRC page 2, SMPL page 2), p[0..31] = P1..P32 (value + fraction / 128), fb 1024 bytes
 * (128 x 64, row-major, 16 bytes a row, MSB = leftmost, 1 = lit). Returns 1 drawn, 0 the page has nothing (stock).
 * Same algorithm as rmpui.js render(): the designer's preview is what the Rytm shows. No allocation, no libc. */
#ifndef RMP_UI_H
#define RMP_UI_H
#include <stdint.h>

typedef struct {
    uint8_t type, page, p, mode, flags, font, align, nitems, a, d, s, r, ifp, ifmin, ifmax;
    int16_t x, y, w, h, min, max;
    uint16_t str, items;
    int16_t bmp;
} rmpui_el;
typedef struct { uint16_t w, h, n; uint32_t off; } rmpui_bmp;
typedef struct {
    const rmpui_el *els;
    uint32_t nel;
    const char *str;          /* NUL-terminated strings, by offset */
    const uint16_t *items;    /* list / switch item strings (offsets into str) */
    const rmpui_bmp *bmps;
    const uint8_t *bits;
} rmpui_layout;

int32_t rmpui_draw(const rmpui_layout *L, int32_t page, const float *p, uint8_t *fb);
#endif
