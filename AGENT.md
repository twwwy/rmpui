# Designing Rytm screens with the user: rmpUI for agents

rmpUI is the screen designer for Sidecar plugins: 1-bit drawings for the Rytm's 128×64 screen. You drive it with
`tools/rmpui.py`. Every command runs **in the user's open browser page**, so they watch you work, can undo any
change of yours, edit the same drawing themselves, answer your questions and send you notes. Design *with* them: show
early, ask with concrete choices, read the inbox often.

## Setup

```sh
python3 serve.py               # once; serves http://127.0.0.1:8004 (this machine only)
# the user opens http://127.0.0.1:8004/sketch.html  (the 🤖 button in its header shows the link: green dot = on)
tools/rmpui.py status          # what's open; fails with a clear message if no page is open
```

Everything stays on this machine. The library lives in the user's browser (IndexedDB); the server only passes
messages. Never paste the user's designs anywhere else.

## The loop

1. `status`, `list`: see what exists. `get NAME`: read a sketch as JSON.
2. Make or change something: `new NAME --from FILE`, `put FILE`, `lib-put layout NAME FILE`. Give each a `--note`
   in plain words ("thinner ring, needle stops at 5 o'clock"): it's what the user reads in the panel.
3. Look at it: `render --ascii` (text art, no image viewer needed), `render -o x.png`, `render --strip`,
   `render --screen` (the sketch placed on the whole 128×64 screen), `layout-render NAME`.
4. Ask: `ask "Which needle?" --options "thin,thick,dot"` waits for the click (default 15 min) and prints
   `{"answer": ...}`. Free text: `ask "..." --input`. If it times out, a late answer arrives in the inbox.
5. Listen: `inbox` (or `inbox --wait 300` to wait for something) gives the user's notes (`kind: "note"`), edits
   (`edit`, with the sketch's name: `get` it again before you change it, so you don't overwrite their work),
   undos of your changes (`undo`), `paused` / `resumed`, and late answers (`answer`).
6. `say "..."` for short updates. Keep them few and useful.

**Answer a note at once.** The panel marks a note "✓ read" when your `inbox` returns it and shows "the agent is
thinking" until your next `say`, change or question. If the work will take more than a few seconds, `say` a one-line
plan first ("On it: a loop instead of taps, as a new sketch"), so the user isn't left watching dots.

If the user pauses the link, every command fails with "paused": stop, and `inbox --wait` until `resumed`.

**Keep listening.** The panel shows the user whether an agent is listening (a command, an `ask` or an `inbox --wait`
in progress). When you're not running a command, keep an `inbox --wait 3600` going (in the background, if your tool
can tell you when it finishes) so their notes reach you at once instead of waiting until you happen to look.

## Sketches: animated 1-bit drawings driven by one parameter

A sketch is a cell `w`×`h` (4..128 × 4..64) and **keys**: drawings at parameter values 0..127. The tool makes
`steps` frames (2..128, usually 16) between them; the plugin shows frame `floor(v * steps / 128)` for the knob's
value v. Shapes keep their `id` across keys, so they move smoothly from one key to the next.

```json
{ "w": 21, "h": 21, "steps": 16,
  "objs": [ { "id": 1, "name": "ring", "linked": true }, { "id": 2, "name": "needle" } ],
  "keys": [
    { "v": 0,   "shapes": [ { "id": 1, "kind": "arc", "c": [10, 10], "r": 9, "a0": 2.36, "sw": 4.71 },
                            { "id": 2, "kind": "line", "a": [10, 10], "b": [4, 16], "spin": "cw" } ] },
    { "v": 127, "shapes": [ { "id": 1, "kind": "arc", "c": [10, 10], "r": 9, "a0": 2.36, "sw": 4.71 },
                            { "id": 2, "kind": "line", "a": [10, 10], "b": [16, 16] } ] } ] }
```

Coordinates are pixels; pixel i's centre is i (0..w-1), y goes **down**. Shapes (`kind`):

| kind | fields | notes |
|---|---|---|
| `line` | `a: [x,y]`, `b: [x,y]` | between keys it rotates about an end that stays put |
| `circle` | `c`, `r`, `fill` | `c` on .5 with an x.5 `r` for an even width |
| `arc` | `c`, `r`, `a0`, `sw` | radians; 0 = right, positive = clockwise on screen. 270° dial: `a0` 2.36, `sw` 4.71 |
| `rect` | `x0 y0 x1 y1`, `rad` 0..3, `fill` | corners inclusive |
| `poly` | `pts: [[x,y],...]`, `closed`, `fill` | straight segments |
| `free` | same as poly | a drawn curve (no L-corners) |
| `pixels` | `pts` | exact pixels; don't morph, they pop |

Any shape: `ink: 0` erases (cuts out of what's under it), `dotted: 1`. A line or arc: `spin: "cw" | "ccw"` (on the
lower key's shape) picks which way it turns to the next key; without it, the short way.

`objs` (optional) names the shapes and says how they behave: `name`, `linked` (the same in every key: put it in
every key), `appear` (`grow` | `draw` | `pop`: how a shape missing from the next key comes and goes), `into` (an id:
this shape, gone in the next key, morphs into that one, which is new there), `group` (a group id; `groups:
[{id, name}]` names them). Drawing order is the `objs` order (later = in front).

Tips: draw the extremes as keys at 0 and 127, plus a key at 64 if the middle needs help. Render the strip and look
at every frame: 1-bit in-betweens can wobble or break; fix them with a key there. Keep `steps` modest (16 is plenty
for a knob; each frame costs `ceil(w/8)*h` bytes).

`new`/`put` take the sketch JSON (or `{ "sketch": ... }` as `get` prints it). A sketch exports a bitmap named by its
`export_name` (the sketch's name, sanitised): layouts use it by that name.

## Sizes and the screen

The stock Rytm page: header y 0..8, knob row A..D graphics y 10..24 with labels y 26..30, row E..H graphics y 33..45
with labels 48..52, status bar y 55..63; eight 32-px columns (x 0, 32, 64, 96). Typical cells: dial 21×21, knob
graphic 28×11 to 28×15, a wide graphic over four knobs 116×15 (x 4). `render --screen` shows where the sketch sits
and says if it fits its slot. Text: the built-in fonts are 3×5 (`font 0`), 5×7 (`1`), 10×14 (`2`), bold (`3`, `4`).

## Layouts: a whole page, several parameters

A layout is the plugin's page: elements, each tied to a parameter `p` (1..32). `lib-put layout NAME FILE` with:

```json
{ "format": "rmpui-1", "name": "verb", "pages": { "1": [
  { "type": "text", "x": 2, "y": 1, "text": "MY VERB", "font": 1 },
  { "type": "frames", "x": 4, "y": 12, "p": 5, "bmp": "verb_decay" },
  { "type": "env", "x": 36, "y": 10, "w": 88, "h": 15, "a": 3, "d": 5, "s": 0, "mode": "ad", "frame": true, "guides": true },
  { "type": "value", "x": 4, "y": 48, "w": 24, "p": 5, "align": "center", "font": 0 } ] } }
```

| type | what | fields |
|---|---|---|
| `text` | a label | `text`, `font`, `align`, `w`, `rule` |
| `value` | the parameter as text | `fmt` num / list / sign, `min`/`max` (num), `items` (list), `suffix`, `index` |
| `bar` | a level bar | `w h`, `dir: "v"`, `ticks`, `round`, `frame` |
| `dial` | a 270° dial | `w`, `ring` |
| `switch` | OFF / ON at 64 | `off`, `on` |
| `toggle` | a switch drawn as a pill | `steps` |
| `env` | **one graphic from several parameters** | `a d s r` = parameter numbers (`s`/`r` optional), `mode` ad / adsr, `guides`, `nodes` |
| `wave` | a waveform shaped by `p` | `shape` sine / tri / saw / pulse / harm / fm, `cycles` |
| `frames` | a sketch, by its export name | `bmp`, `blend: "or"` |
| `rect`, `box`, `line` | frames, rules | `fill` outline / solid / dither, `radius`, `x2 y2` (line) |

Any element: `inv` (white on black), `dotted`, `frame`, `if: {p, min, max}` (shown only while that parameter is in
range). Fonts: 0..4, or a library font's name. `frames` and named fonts come from the library by name, so a layout
always shows the newest sketch. `layout-render NAME --values 64,10,...` draws page 1 with P1, P2... (default 64);
check the `warnings`.

A sketch follows **one** parameter. A graphic that several knobs shape at once (an envelope, a filter curve) is
drawn by code from all their values: use `env`, or ask for a new element type.

## Boards: one plugin's whole set of knobs

`board.html` (the user opens it beside the sketch editor) holds one plugin's parameters, from its `manifest.json`,
on its real pages: 8 per page, two rows of four 32-px slots, each with its label; a parameter without a graphic
shows its value. Work on the set there, not knob by knob: the user judges the pages as a whole.

```sh
tools/rmpui.py board-new path/to/manifest.json          # once per plugin
tools/rmpui.py board-get                                 # each P: short name, slot (1A..2D), export name, state
tools/rmpui.py board-set 3 --bmp pdly_time --note "..."  # which sketch draws P3 (by its export name)
tools/rmpui.py board-render --page 1 --ascii             # the real page; --values 64,10,... per parameter
tools/rmpui.py board-save-layout                         # the pages as a layout in the library
```

A parameter's suggested export name is `<plugin>_<short>` (e.g. `verb_pdly`); `new` a sketch and set its
`export_name` to match, or `board-set --bmp` to whatever it exports. States: empty (no sketch), draft, done (the
user marks done). Graphics should fit 28×18 to sit in a slot (24×15 leaves room around it).

**Banner mode** (`board-banners both|top|bottom|none`, or the board's banner menu): the plugin keeps the Rytm's stock
top banner (rows 0..8: page title, pattern, tempo) and/or bottom banner (rows 55..63: name, level bar, position) and
draws only the band between, on every page it draws. With the top banner kept the board drops its own title line;
with the bottom one the slots pack into rows 9..54 (graphics up to 32×16, labels under them; the bottom banner shows
no knob names, so keep the labels). The preview greys the banners, `validate` flags anything under them, and the
export carries `"banners"` in the layout and a `<NAME>_KEEP` define in the C header: the plugin's draw returns
`r | <NAME>_KEEP` when the host sets `RMP_DRAW_BANNERS` in flags (`r` from `rmpui_draw`, if nonzero), plain `r`
otherwise.

## Design rules for the Rytm

- 1 bit, 128×64, seen at arm's length on a small OLED: thick enough (no lone 1-px details that flicker between
  frames), high contrast, nothing touching the slot edges.
- The knob's motion should read at a glance: what grows, turns or fills as you turn it right.
- Match the stock pages: header, two knob rows, short uppercase labels (3..4 letters, `font 0`).
- Show it before polishing: one rough version, then ask, then refine.
- Don't copy Elektron's artwork; draw your own.
