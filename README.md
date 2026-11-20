# rmpUI

Design the 1-bit screens of [Rytm Sidecar](https://github.com/trigcondition) plugins: animated knob graphics, whole
pages and fonts, in the browser. The preview is pixel for pixel what the Rytm's 128×64 screen shows, and a layout
exports as a C header that `rmp_ui.c` draws in your plugin.

**Try it:** https://twwwy.github.io/rmpui/ (nothing to install; your drawings stay in your browser)

## What's in it

| page | for |
|---|---|
| `index.html` | the landing page: where to start |
| `sketch.html` | the sketch editor: draw a graphic at a few knob values (keys), rmpUI makes the frames between. Best for drawing by hand (an agent can draw here too) |
| `board.html` | a plugin board: load a plugin's `manifest.json`, see every parameter on its real Rytm page, compare design languages, export. Best with an agent, which drafts whole design languages while you pick and steer |
| `layout.html` | the layout preview: text, values, bars, dials, envelopes, waves and sketches, each tied to a parameter |
| `font.html` | the font editor: proportional pixel fonts, with a check that strings fit their box |
| `tutorials.html` | four step-by-step builds |

| file | what |
|---|---|
| `rmpui.js` | the renderer and the layout format (`rmpui-1`), shared by every page; `toC()` writes the C header |
| `rmp_ui.h`, `rmp_ui.c` | the same renderer in C for the plugin: no allocation, no libc |
| `serve.py` | a local server with the agent link (127.0.0.1 only) |
| `tools/rmpui.py` | the agent's command line |
| `AGENT.md`, `skills/rmpui/SKILL.md` | the guide for coding agents, and the same as a skill |
| `tests/run.sh` | checks `rmp_ui.c` against `rmpui.js`, pixel for pixel |

## Run it locally

```sh
git clone https://github.com/twwwy/rmpui.git
cd rmpui
python3 serve.py          # http://127.0.0.1:8004/
```

Python 3 only, no packages. Any static file server works too, but only `serve.py` has the agent link.

## Put it on the Rytm

1. Make the layout: a plugin's pages on the board, or any page in the layout preview.
2. Click **Export C** (on either page) for a C header, `my_ui.h`, with every bitmap in it. An agent can run
   `tools/rmpui.py board-export DIR` instead, which also writes the layout JSON and page PNGs.
3. Add `rmp_ui.c` and `rmp_ui.h` to your plugin and draw from the draw hook:

```c
#include "rmp_ui.h"
#include "my_ui.h"

static int32_t draw(void *st, int32_t page, uint32_t flags, int32_t track, const float *p, uint8_t *fb)
{ (void)st; (void)flags; (void)track; return rmpui_draw(&my_ui, page, p, fb); }
/* rmp_plugin's reserved[RMP_P_DRAW] = RMP_FN(draw) */
```

`p[0..31]` is P1..P32 (value + fraction / 128); `fb` is the 128×64 frame (16 bytes a row, MSB leftmost). It returns
0 for a page the layout leaves alone, so the stock page shows.

Limits today:

- The Sidecar calls a plugin's draw hook for a **user machine's** pages. Send effects can't draw their own pages
  yet; that needs a host change.
- `rmp_ui.c` doesn't draw custom fonts or `index` detents yet. The preview does, so check those on the hardware.

`tests/run.sh [your_layout.json ...]` compares the C and JavaScript renderers on every page over 155 knob settings.
It needs node and a C compiler.

## Design with an agent

With `serve.py` running and a page open, a coding agent can draw in that page while you watch. Every change it makes
shows in the 🤖 panel with an undo, it can ask you questions with buttons, and you can send it notes. Everything stays
on your computer: the server only listens on 127.0.0.1, and your library lives in the browser.

**Claude Code:** install the skill, then ask it to design with rmpUI.

```sh
mkdir -p ~/.claude/skills && ln -s "$PWD/skills/rmpui" ~/.claude/skills/rmpui     # for every project
# or, for one project: copy skills/rmpui into that project's .claude/skills/
```

The skill expects this checkout's path; if it isn't where you cloned it, set `RMPUI_DIR` (see the skill).

**Other agents:** point them at `AGENT.md`. It's plain instructions plus the `tools/rmpui.py` commands.

The hosted copy (GitHub Pages) can't reach an agent: a website can't talk to a server on your computer. Run it
locally for that.

## Your data

Sketches, layouts, fonts and boards live in your browser's storage (IndexedDB) for the site you opened them on, so
the hosted copy and `http://127.0.0.1:8004` keep separate libraries. Use **Save** or the exports to keep a copy or move
work between them.

## Credits and license

MIT, see `LICENSE`. The built-in 3×5 and 5×7 fonts are the Sidecar firmware's (CC0). The tutorials' example graphics
are original drawings (`tools/tutorial_data.py`).

An independent tool for Sidecar plugin developers. Not affiliated with Elektron; Rytm is Elektron's trademark.
