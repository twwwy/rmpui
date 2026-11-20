#!/usr/bin/env python3
"""rmpui.py - drive the rmpui designer open in the user's browser (see AGENT.md).

Needs `python3 serve.py` running and http://127.0.0.1:8004/sketch.html open. Every change shows up in that page
as you make it, in its 🤖 Agent panel with a ↩ to undo it; the user can edit too, and talk back (ask / inbox).

  rmpui.py status                                   what's open: the sketch, its size, keys, objects
  rmpui.py list [sketch|layout|font|part|screen]    the library
  rmpui.py get [NAME] [-o FILE]                     a sketch as JSON (the open one without NAME)
  rmpui.py open NAME                                show that sketch in the editor
  rmpui.py new NAME [--size 28x11] [--steps 16] [--from FILE] [--note TEXT]
  rmpui.py put FILE [--name NAME] [--note TEXT]     replace a sketch's drawing (the open one without --name)
  rmpui.py render [NAME] [--value V | --strip | --screen] [-o PNG] [--ascii] [--scale N]
  rmpui.py lib-get TYPE NAME [-o FILE]              any library item's data (a layout: {"src": "<layout JSON>"})
  rmpui.py lib-put TYPE NAME FILE [--note TEXT]     add / replace one (a layout FILE may be the layout JSON itself)
  rmpui.py layout-render NAME [--page 1] [--values 64,64,...] [-o PNG] [--ascii]
  rmpui.py board-list                               plugin boards (board.html: one plugin's knobs on its real pages)
  rmpui.py board-new MANIFEST [--name NAME] [--note TEXT]   a board from a plugin's manifest.json
  rmpui.py board-get [--board NAME]                 its parameters: slot, export name, sketch, state
  rmpui.py board-set P [--board NAME] [--bmp EXPORT] [--status draft|done] [--note TEXT]
  rmpui.py board-render [--board NAME] [--page N] [--values 64,64,...] [-o PNG] [--ascii] [--scale N]
  rmpui.py board-save-layout [--board NAME]         save its pages as a layout in the library
  rmpui.py board-lang FILE [--board NAME]           add / replace a design language: {name, rule, bmps: {P: export name}}
  rmpui.py board-view [work|compare|LANGUAGE] [--board NAME]   what the board shows
  rmpui.py board-order 2,1,3,... [--board NAME]     the parameters' slot order (the plugin's knob order must match)
  rmpui.py board-renumber 1:2,2:1 [--board NAME]   the plugin renumbered parameters (old:new); languages follow
  rmpui.py board-model machine|sendfx [--board NAME]   page model: a machine's SRC/SMPL pages, or an effect's SEND FX pages
  rmpui.py board-use LANGUAGE [--board NAME]        make a design language the working set
  rmpui.py board-export DIR [--board NAME] [--lang LANGUAGE]   layout.json (bitmaps embedded), <plugin>_ui.h, page PNGs, values.json, slots.json
  rmpui.py say TEXT                                 a message in the user's Agent panel
  rmpui.py ask TEXT [--options a,b,c] [--input] [--timeout 900]   wait for the user's answer
  rmpui.py inbox [--wait SECONDS]                   the user's notes and edits since you last looked
"""
import argparse, base64, json, os, sys, urllib.request

URL = os.environ.get("RMPUI_URL", "http://127.0.0.1:8004")


def call(path, body, timeout):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout + 15) as r:
            return json.loads(r.read())
    except urllib.error.URLError as e:
        sys.exit(f"rmpui: can't reach {URL} ({e.reason}): start it with  python3 serve.py")


def cmd(op, timeout=60, **args):
    r = call("/api/cmd", {"op": op, "args": {k: v for k, v in args.items() if v is not None}, "timeout": timeout}, timeout)
    if isinstance(r, dict) and r.get("error"):
        sys.exit("rmpui: " + r["error"])
    return r


def out(obj, path=None):
    s = json.dumps(obj, indent=1)
    if path:
        open(path, "w").write(s + "\n")
        print(f"wrote {path}")
    else:
        print(s)


def image(r, a):
    if a.ascii or not a.o:
        print(r.get("ascii", ""))
    if a.o:
        open(a.o, "wb").write(base64.b64decode(r["png"].split(",", 1)[1]))
        print(f"wrote {a.o} ({r.get('w')}x{r.get('h')} px{', ' + r['note'] if r.get('note') else ''})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="c", required=True)
    sp.add_parser("status")
    p = sp.add_parser("list"); p.add_argument("type", nargs="?", default="sketch")
    p = sp.add_parser("get"); p.add_argument("name", nargs="?"); p.add_argument("-o")
    p = sp.add_parser("open"); p.add_argument("name")
    p = sp.add_parser("new"); p.add_argument("name"); p.add_argument("--size"); p.add_argument("--steps", type=int)
    p.add_argument("--from", dest="src"); p.add_argument("--note")
    p = sp.add_parser("put"); p.add_argument("file"); p.add_argument("--name"); p.add_argument("--note")
    p = sp.add_parser("render"); p.add_argument("name", nargs="?"); p.add_argument("--value", type=int)
    p.add_argument("--strip", action="store_true"); p.add_argument("--screen", action="store_true")
    p.add_argument("-o"); p.add_argument("--ascii", action="store_true"); p.add_argument("--scale", type=int)
    p = sp.add_parser("lib-get"); p.add_argument("type"); p.add_argument("name"); p.add_argument("-o")
    p = sp.add_parser("lib-put"); p.add_argument("type"); p.add_argument("name"); p.add_argument("file"); p.add_argument("--note")
    p = sp.add_parser("layout-render"); p.add_argument("name"); p.add_argument("--page", type=int, default=1)
    p.add_argument("--values"); p.add_argument("-o"); p.add_argument("--ascii", action="store_true"); p.add_argument("--scale", type=int)
    sp.add_parser("board-list")
    p = sp.add_parser("board-new"); p.add_argument("manifest"); p.add_argument("--name"); p.add_argument("--note")
    p = sp.add_parser("board-get"); p.add_argument("--board")
    p = sp.add_parser("board-set"); p.add_argument("p", type=int); p.add_argument("--board"); p.add_argument("--bmp")
    p.add_argument("--status", choices=["draft", "done"]); p.add_argument("--note")
    p = sp.add_parser("board-render"); p.add_argument("--board"); p.add_argument("--page", type=int, default=1)
    p.add_argument("--values"); p.add_argument("-o"); p.add_argument("--ascii", action="store_true"); p.add_argument("--scale", type=int)
    p.add_argument("--lang")
    p = sp.add_parser("board-save-layout"); p.add_argument("--board")
    p = sp.add_parser("board-lang"); p.add_argument("file"); p.add_argument("--board")
    p = sp.add_parser("board-renumber"); p.add_argument("map"); p.add_argument("--board")
    p = sp.add_parser("board-model"); p.add_argument("model", choices=["machine", "sendfx"]); p.add_argument("--board")
    p = sp.add_parser("board-use"); p.add_argument("lang"); p.add_argument("--board")
    p = sp.add_parser("board-export"); p.add_argument("dir"); p.add_argument("--board"); p.add_argument("--lang")
    p = sp.add_parser("board-order"); p.add_argument("order"); p.add_argument("--board")
    p = sp.add_parser("board-view"); p.add_argument("view", nargs="?", default="work"); p.add_argument("--board")
    p = sp.add_parser("say"); p.add_argument("text")
    p = sp.add_parser("ask"); p.add_argument("text"); p.add_argument("--options"); p.add_argument("--input", action="store_true")
    p.add_argument("--timeout", type=float, default=900)
    p = sp.add_parser("inbox"); p.add_argument("--wait", type=float, default=0)
    a = ap.parse_args()

    if a.c == "status":
        out({**cmd("status"), "server": call("/api/status", {}, 5)})
    elif a.c == "list":
        out(cmd("list", type=a.type)["items"])
    elif a.c == "get":
        out(cmd("get", name=a.name), a.o)
    elif a.c == "open":
        out(cmd("open", name=a.name))
    elif a.c == "new":
        sk = json.load(open(a.src)) if a.src else None
        w = h = None
        if a.size:
            w, h = (int(v) for v in a.size.lower().split("x"))
        out(cmd("new", name=a.name, sketch=sk, w=w, h=h, steps=a.steps, note=a.note))
    elif a.c == "put":
        sk = json.load(open(a.file))
        out(cmd("put", name=a.name, sketch=sk.get("sketch", sk), note=a.note))
    elif a.c == "render":
        what = "screen" if a.screen else "strip" if a.strip else "frame"
        image(cmd("render", name=a.name, what=what, value=a.value, scale=a.scale), a)
    elif a.c == "lib-get":
        out(cmd("lib_get", type=a.type, name=a.name), a.o)
    elif a.c == "lib-put":
        data = json.load(open(a.file))
        if a.type == "layout" and "src" not in data:   # the layout JSON itself
            data = {"src": json.dumps(data, indent=1)}
        out(cmd("lib_put", type=a.type, name=a.name, data=data, note=a.note))
    elif a.c == "layout-render":
        vals = [int(v) for v in a.values.split(",")] if a.values else None
        image(cmd("layout_render", name=a.name, page=a.page, values=vals, scale=a.scale), a)
    elif a.c == "board-list":
        out(cmd("board_list")["items"])
    elif a.c == "board-new":
        out(cmd("board_new", manifest=json.load(open(a.manifest)), name=a.name, note=a.note))
    elif a.c == "board-get":
        out(cmd("board_get", name=a.board))
    elif a.c == "board-set":
        out(cmd("board_set", name=a.board, p=a.p, bmp=a.bmp, status=a.status, note=a.note))
    elif a.c == "board-render":
        vals = [int(v) for v in a.values.split(",")] if a.values else None
        image(cmd("board_render", name=a.board, page=a.page, values=vals, scale=a.scale, lang=a.lang), a)
    elif a.c == "board-save-layout":
        out(cmd("board_save_layout", name=a.board))
    elif a.c == "board-lang":
        out(cmd("board_lang_put", name=a.board, lang=json.load(open(a.file))))
    elif a.c == "board-renumber":
        out(cmd("board_renumber", name=a.board, map={int(o): int(n) for o, n in (kv.split(":") for kv in a.map.split(","))}))
    elif a.c == "board-model":
        out(cmd("board_model", name=a.board, model=a.model))
    elif a.c == "board-use":
        out(cmd("board_use_lang", name=a.board, lang=a.lang))
    elif a.c == "board-export":
        r = cmd("board_export", name=a.board, lang=a.lang)
        os.makedirs(a.dir, exist_ok=True)
        files = {"layout.json": json.dumps(r["layout"], indent=1) + "\n", f"{r['id']}_ui.h": r["c"],
                 "values.json": json.dumps({"p": r["values"], "note": "P1..P32 (0..127) the page PNGs were drawn at"}) + "\n",
                 "slots.json": json.dumps({"board": r["name"], "model": r["model"], "plugin_order_differs": r["plugin_order_differs"], "slots": r["slots"],
                                           "cost": r["cost"], "warnings": r["warnings"], "missing": r["missing"]}, indent=1) + "\n"}
        for k, v in files.items():
            open(os.path.join(a.dir, k), "w").write(v)
        for i, png in enumerate(r["pngs"]):
            open(os.path.join(a.dir, f"page{i + 1}.png"), "wb").write(base64.b64decode(png.split(",", 1)[1]))
        print(f"wrote {a.dir}: {', '.join(list(files) + [f'page{i + 1}.png' for i in range(len(r['pngs']))])}")
        if r["missing"] or r["warnings"]:
            print("warnings:", r["missing"] and f"no graphic: {r['missing']}", r["warnings"])
    elif a.c == "board-order":
        out(cmd("board_order", name=a.board, order=[int(v) for v in a.order.split(",")]))
    elif a.c == "board-view":
        out(cmd("board_view", name=a.board, view=a.view))
    elif a.c == "say":
        cmd("say", text=a.text)
    elif a.c == "ask":
        opts = [o.strip() for o in a.options.split(",")] if a.options else None
        r = cmd("ask", timeout=a.timeout, text=a.text, options=opts, input=a.input or not opts)
        out(r)
    elif a.c == "inbox":
        out(call("/api/inbox", {"wait": a.wait}, a.wait)["items"])


if __name__ == "__main__":
    main()
