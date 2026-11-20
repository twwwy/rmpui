---
name: rmpui
description: Design Rytm Sidecar plugin screens (1-bit 128x64 knob graphics, pages, fonts) together with the user in rmpUI, the browser designer they have open, and export them as C for rmp_ui.c. Use when the user wants knob graphics, a screen layout or a plugin's whole set of pages for a Sidecar plugin, or mentions rmpui.
---

# rmpUI: design Rytm screens with the user

rmpUI is a browser designer for the Rytm's 128×64 1-bit screen. You drive the page the user has open through
`tools/rmpui.py`: every change appears there as you make it, with an undo for the user. They can edit the same
drawing, answer your questions and send you notes. Design **with** them.

## Find rmpUI and check the link

The checkout is `$RMPUI_DIR` if set, else the folder this skill links to (`<checkout>/skills/rmpui`), else ask the user
where they cloned it. Below, `rmpui.py` means `python3 "$RMPUI_DIR/tools/rmpui.py"`.

```sh
rmpui.py status    # what's open; a clear error if the server or the page isn't there
```

If that fails, ask the user to run `python3 serve.py` in the checkout and open `http://127.0.0.1:8004/sketch.html`
(or `board.html` for a whole plugin). A copy on a website can't talk to you; it has to be the local one.

## Read the guide first

`$RMPUI_DIR/AGENT.md` is the full reference: the sketch format (keys, shapes, objects), the layout element types,
boards, sizes on the stock page, and the design rules. Read it before you draw. The essentials:

- **The loop:** look (`status`, `list`, `get NAME`), change (`new NAME --from FILE`, `put FILE`, `lib-put layout NAME
  FILE`, always with a plain-words `--note`), look at the result (`render --ascii`, `render --strip`, `render
  --screen`, `layout-render NAME`), ask (`ask "Which?" --options "a,b,c"`), listen (`inbox`, `inbox --wait 300`).
- **Answer a note at once:** when `inbox` returns a note, `say` a one-line plan before long work. The panel shows
  the user that you read it and are thinking.
- **Keep listening:** between tasks, keep `inbox --wait 3600` running (in the background if you can) so notes
  reach you at once.
- **Don't overwrite the user's work:** an `edit` in the inbox means they changed a sketch. `get` it again before
  you change it.
- **Paused:** if a command fails with "paused", stop and `inbox --wait` until `resumed`.

## How to design here

- Settle a design language for the whole plugin before polishing single knobs: on a board, offer 2–4 languages
  side by side (`board-lang`, `board-view compare`) and let the user pick.
- Use few keys (0, 64, 127) so the user can edit your drawings by hand instead of describing changes to you.
- Render and look at every frame: 1-bit in-betweens wobble; fix them with a key.
- Show a rough version early, then ask with concrete choices.
- Draw your own artwork. Don't copy other products' screens.

## Putting the screens in the user's plugin

When the user asks for it ("put these screens in my plugin"):

1. Export: `rmpui.py board-export DIR` (a board) writes `<name>_ui.h` with every bitmap embedded, plus the layout
   JSON and page PNGs to check against. For a layout made in the layout preview, ask the user to click **Export C**.
2. Copy `rmp_ui.h`, `rmp_ui.c` (from the checkout) and `<name>_ui.h` into the plugin, and add `rmp_ui.c` to its build.
3. Add the draw hook in the plugin's source and register it:
   ```c
   #include "rmp_ui.h"
   #include "<name>_ui.h"
   static int32_t draw(void *st, int32_t page, uint32_t flags, int32_t track, const float *p, uint8_t *fb)
   { (void)st; (void)flags; (void)track; return rmpui_draw(&<name>_ui, page, p, fb); }
   /* in the rmp_plugin: .reserved[RMP_P_DRAW] = RMP_FN(draw) */
   ```
   `p[0..31]` are P1..P32 as the host passes them; the layout's `p` numbers must match the plugin's parameters.
4. Build the plugin, and if you can, check one page against the exported PNG with the same knob values.

Limits: the host calls the draw hook for user machines' pages (send effects can't draw their own pages yet), and
`rmp_ui.c` doesn't draw custom fonts or `index` detents yet. Tell the user if their design uses either.
