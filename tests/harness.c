/* harness.c: rmpui_draw() over cases.bin (int32 page, 32 float32 P1..P32 each), one "<drawn> <fb hex>" line a case. */
#include <stdio.h>
#include "layout.h"
int main(int argc, char **argv) {
    FILE *f = fopen(argc > 1 ? argv[1] : "cases.bin", "rb");
    if (!f) return 2;
    struct { int32_t page; float p[32]; } c;
    uint8_t fb[1024];
    while (fread(&c, sizeof c, 1, f) == 1) {
        for (int i = 0; i < 1024; ++i) fb[i] = 0x5a;   /* not cleared: rmpui_draw clears what it draws */
        int32_t drawn = rmpui_draw(&L, c.page, c.p, fb);
        printf("%d ", (int)drawn);
        if (drawn) for (int i = 0; i < 1024; ++i) printf("%02x", fb[i]);
        printf("\n");
    }
    fclose(f);
    return 0;
}
