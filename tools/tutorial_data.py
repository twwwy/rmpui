#!/usr/bin/env python3
"""Writes the tutorials' own example data to rmpui/tutorial-data/ (original drawings, safe to publish).

algo.json: 8 algorithm diagrams (25 x 45) for an FM synth with operators A, B1, B2, C, plus a 9 x 11 number.
  Look: each operator a ring (radius 4) with its letter from the Sidecar's
  CC0 3x5 font; feedback a filled 3 x 3 badge at the ring's top right; modulation solid wires; carriers wired to
  the bottom edge: X solid with a 3-px foot, Y dotted.
ratio_font.json: a rounded 3 x 5 digit font (0-9 and ".") for the RATIO tutorial.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "tutorial-data")

# the Sidecar's 3x5 font (rmpui.js F3: 3 column bytes per char from ASCII 32, bit 0 = top row)
F3 = [int(v) for v in re.search(r"const F3 = \[([^\]]*)\]", open(os.path.join(ROOT, "rmpui.js")).read()).group(1).split(",")]
def letter(ch, x0, y0):
    i = (ord(ch) - 32) * 3
    return [[x0 + c, y0 + r] for r in range(5) for c in range(3) if F3[i + c] >> r & 1]

def op(objs, name, cx, cy, r=4):
    objs += [
        {"name": f"{name[0]} white-out", "kind": "circle", "c": [cx, cy], "r": r, "fill": 1, "ink": 0, "tag": "op"},
        {"name": f"{name[0]} ring", "kind": "circle", "c": [cx, cy], "r": r, "tag": "op"},
        {"name": f"letter {name[0]}", "kind": "pixels", "pts": letter(name[0], cx - 1, cy - 2), "tag": "op"},
    ]
def fb(objs, cx, cy):
    objs.append({"name": "feedback", "kind": "rect", "x0": cx + 4, "y0": cy - 6, "x1": cx + 6, "y1": cy - 4, "rad": 0, "fill": 1, "tag": "fb"})
def wire(objs, a, b):
    objs.append({"name": "wire", "kind": "pixels", "pts": [list(a)], "tag": "wire"} if a == b else {"name": "wire", "kind": "line", "a": list(a), "b": list(b), "tag": "wire"})
def out_x(objs, x, y):   # solid to the bottom, with a foot
    objs += [{"name": "output X", "kind": "line", "a": [x, y], "b": [x, 43], "tag": "out"},
             {"name": "output X foot", "kind": "line", "a": [x - 1, 44], "b": [x + 1, 44], "tag": "out"}]
def out_y(objs, pts):    # dotted, along the given corner points
    for a, b in zip(pts, pts[1:]):
        objs.append({"name": "output Y", "kind": "line", "a": list(a), "b": list(b), "dotted": 1, "tag": "out"})

def algos():
    A = []
    # 1: B1 > B2, A > C, B2 > C; X C, Y B2; feedback A
    o = []; fb(o, 6, 20); wire(o, (18, 13), (18, 15)); wire(o, (6, 25), (6, 27)); wire(o, (15, 23), (9, 29))
    out_x(o, 6, 37); out_y(o, [(18, 25), (18, 44)])
    op(o, "B", 18, 8); op(o, "A", 6, 20); op(o, "B", 18, 20); op(o, "C", 6, 32); A.append(o)
    # 2: A > C, B1 > B2; X C, Y B2; feedback B1
    o = []; fb(o, 18, 8); wire(o, (6, 13), (6, 15)); wire(o, (18, 13), (18, 15))
    out_x(o, 6, 25); out_y(o, [(18, 25), (18, 44)])
    op(o, "A", 6, 8); op(o, "B", 18, 8); op(o, "C", 6, 20); op(o, "B", 18, 20); A.append(o)
    # 3: A > C, B1, B2; X C, Y B1 B2; feedback A; the three carriers staggered
    o = []; fb(o, 12, 8); wire(o, (12, 13), (12, 29)); wire(o, (10, 12), (7, 18)); wire(o, (14, 12), (17, 18))
    out_x(o, 5, 27); out_y(o, [(12, 39), (12, 44)]); out_y(o, [(19, 27), (19, 44)])
    op(o, "A", 12, 8); op(o, "C", 5, 22); op(o, "B", 12, 34); op(o, "B", 19, 22); A.append(o)
    # 4: B1 > B2 > A > C; X C, Y B2; feedback B1
    o = []; fb(o, 6, 7); wire(o, (6, 12), (6, 12)); wire(o, (6, 22), (6, 22)); wire(o, (6, 32), (6, 32))
    out_x(o, 6, 42); out_y(o, [(11, 17), (18, 17), (18, 44)])
    op(o, "B", 6, 7); op(o, "B", 6, 17); op(o, "A", 6, 27); op(o, "C", 6, 37); A.append(o)
    # 5: B1 > B2, B1 > A, B2 > A, A > C; X C, Y A; feedback B1
    o = []; fb(o, 6, 8); wire(o, (11, 8), (13, 8)); wire(o, (6, 13), (6, 15)); wire(o, (15, 11), (9, 17))
    out_x(o, 6, 37); out_y(o, [(11, 20), (18, 20), (18, 44)])
    op(o, "B", 6, 8); op(o, "B", 18, 8); op(o, "A", 6, 20); op(o, "C", 6, 32); A.append(o)
    # 6: A > C, A > B2, B1 > B2, B1 > C; X C, Y B2; feedback A
    o = []; fb(o, 6, 8); wire(o, (6, 13), (6, 15)); wire(o, (18, 13), (18, 15)); wire(o, (9, 11), (15, 17)); wire(o, (15, 11), (9, 17))
    out_x(o, 6, 25); out_y(o, [(18, 25), (18, 44)])
    op(o, "A", 6, 8); op(o, "B", 18, 8); op(o, "C", 6, 20); op(o, "B", 18, 20); A.append(o)
    # 7: A > C, B1 > B2; X C, Y A B1 B2; feedback A
    o = []; fb(o, 6, 8); wire(o, (6, 13), (6, 15)); wire(o, (18, 13), (18, 15))
    out_x(o, 6, 25); out_y(o, [(11, 10), (12, 10), (12, 44)]); out_y(o, [(23, 10), (24, 10), (24, 44)]); out_y(o, [(18, 25), (18, 44)])
    op(o, "A", 6, 8); op(o, "B", 18, 8); op(o, "C", 6, 20); op(o, "B", 18, 20); A.append(o)
    # 8: A > C; X C, Y B1 B2; feedback B1
    o = []; fb(o, 18, 8); wire(o, (6, 13), (6, 15))
    out_x(o, 6, 25); out_y(o, [(23, 10), (24, 10), (24, 44)]); out_y(o, [(18, 37), (18, 44)])
    op(o, "A", 6, 8); op(o, "B", 18, 8); op(o, "C", 6, 20); op(o, "B", 18, 32); A.append(o)
    return A

DIGITS = {  # 7 x 11, 2-px strokes; padded to 9 wide
    1: ["...##..", "..###..", ".####..", "...##..", "...##..", "...##..", "...##..", "...##..", "...##..", "...##..", ".######"],
    2: [".#####.", "##...##", ".....##", ".....##", "....##.", "...##..", "..##...", ".##....", "##.....", "##.....", "#######"],
    3: [".#####.", "##...##", ".....##", ".....##", "..####.", ".....##", ".....##", ".....##", ".....##", "##...##", ".#####."],
    4: ["....##.", "...###.", "..####.", ".##.##.", "##..##.", "##..##.", "#######", "....##.", "....##.", "....##.", "....##."],
    5: ["#######", "##.....", "##.....", "######.", ".....##", ".....##", ".....##", ".....##", ".....##", "##...##", ".#####."],
    6: ["..####.", ".##....", "##.....", "##.....", "######.", "##...##", "##...##", "##...##", "##...##", "##...##", ".#####."],
    7: ["#######", ".....##", ".....##", "....##.", "....##.", "...##..", "...##..", "..##...", "..##...", "..##...", "..##..."],
    8: [".#####.", "##...##", "##...##", "##...##", ".#####.", "##...##", "##...##", "##...##", "##...##", "##...##", ".#####."],
}
def digits():
    return [[[x + 1, y] for y, row in enumerate(DIGITS[n]) for x, c in enumerate(row) if c == "#"] for n in range(1, 9)]

RATIO = {  # rounded 3 x 5
    "0": [".#.", "#.#", "#.#", "#.#", ".#."], "1": [".#.", "##.", ".#.", ".#.", ".#."],
    "2": ["##.", "..#", ".#.", "#..", "###"], "3": ["##.", "..#", ".#.", "..#", "##."],
    "4": ["..#", ".##", "#.#", "###", "..#"], "5": ["###", "#..", "##.", "..#", "##."],
    "6": [".##", "#..", "##.", "#.#", ".#."], "7": ["###", "..#", ".#.", ".#.", ".#."],
    "8": [".#.", "#.#", ".#.", "#.#", ".#."], "9": [".#.", "#.#", ".##", "..#", "##."],
    ".": [".", ".", ".", ".", "#"],
}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    note = "rmpui tutorial example data, original drawings (tools/tutorial_data.py)"
    json.dump({"note": note, "algos": algos(), "digits": digits()}, open(os.path.join(OUT, "algo.json"), "w"), separators=(",", ":"))
    json.dump({"note": note, "format": "rmpui-font-1", "name": "ratio", "height": 5, "spacing": 1, "space": 3, "glyphs": RATIO},
              open(os.path.join(OUT, "ratio_font.json"), "w"), indent=1)
    print("wrote", OUT)
