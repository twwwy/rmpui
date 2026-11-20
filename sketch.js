// sketch.js - freehand keyframes -> clean 1-bit frames for an rmpui "frames" element.
// A sketch is a cell (w x h pixels) and keys (a param value 0..127 each) holding shapes. Each freehand stroke is fitted to
// a shape (line, arc, circle, rect, poly, free) snapped to the pixel grid; a shape keeps its id across keys, so the frames
// between two keys interpolate it (a line about a fixed end rotates, a moved shape slides rigidly, sizes ease).
// The output is plain bitmaps: what the designer previews is what the Rytm shows. Coordinates: pixel i's centre is i.

export const KINDS = ["line", "arc", "circle", "rect", "poly", "free", "pixels"];   // pixels: drawn with the pencil, pixel by pixel
const TAU = Math.PI * 2;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const half = (v) => Math.round(v * 2) / 2;
// a radius that suits the centre: whole on a pixel centre, x.5 between pixels (no one-pixel tips)
const rsnap = (c, r) => Math.max(1, c[0] % 1 !== 0 ? Math.floor(r) + 0.5 : Math.round(r));
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- fitting
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  if (!L) return dist(p, a);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
export function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  let im = 0, dm = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i], pts[0], pts[pts.length - 1]); if (d > dm) { dm = d; im = i; } }
  if (dm <= eps) return [pts[0], pts[pts.length - 1]];
  const l = rdp(pts.slice(0, im + 1), eps), r = rdp(pts.slice(im), eps);
  return l.slice(0, -1).concat(r);
}
function smooth(pts) {
  if (pts.length < 5) return pts.slice();
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    const a = pts[i - 1], b = pts[i + 1];
    return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4];
  });
}
const pathLen = (pts) => pts.reduce((s, p, i) => (i ? s + dist(p, pts[i - 1]) : 0), 0);
export function fitCircle(pts) {   // Kasa least squares
  let n = pts.length, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  for (const [x, y] of pts) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
  const M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], R = [-sxz, -syz, -sz];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D0 = det(M);
  if (Math.abs(D0) < 1e-9) return null;
  const col = (k) => det(M.map((row, i) => row.map((v, j) => (j === k ? R[i] : v))));
  const D = col(0) / D0, E = col(1) / D0, F = col(2) / D0, cx = -D / 2, cy = -E / 2, r2 = cx * cx + cy * cy - F;
  if (!(r2 > 0)) return null;
  const r = Math.sqrt(r2);
  const rms = Math.sqrt(pts.reduce((s, p) => s + (dist(p, [cx, cy]) - r) ** 2, 0) / n);
  return { c: [cx, cy], r, rms };
}
function sweepOf(pts, c) {
  let tot = 0, prev = Math.atan2(pts[0][1] - c[1], pts[0][0] - c[0]);
  const a0 = prev;
  for (let i = 1; i < pts.length; i++) {
    const a = Math.atan2(pts[i][1] - c[1], pts[i][0] - c[0]);
    let d = a - prev;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    tot += d; prev = a;
  }
  return { a0, sw: tot };
}
// snap a point to an existing handle under it (a half-pixel circle centre), else to the pixel grid
function snapPt(p, anchors) {
  let best = null, bd = 0.75;   // only when right on it: with coordinates shown, exact pixels beat joining
  for (const a of anchors || []) { const d = dist(p, a); if (d < bd) { bd = d; best = a; } }
  if (best) p = best;   // a half-pixel anchor (an even circle's centre): the pixel on the stroke's side
  return [Math.round(p[0]), Math.round(p[1])];
}
// straighten a line to 0 / 45 / 90 degrees or a 2:1 pixel slope when it is within 5 degrees of one
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1], [2, 1], [2, -1], [1, 2], [1, -2]];
function snapAngle(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  if (L < 2) return b;
  let best = null, bc = Math.cos((5 * Math.PI) / 180);
  for (const u of DIRS) {
    const ul = Math.hypot(u[0], u[1]), c = Math.abs((dx * u[0] + dy * u[1]) / (L * ul));
    if (c > bc) { bc = c; best = u; }
  }
  if (!best) return b;
  const k = Math.round((dx * best[0] + dy * best[1]) / (best[0] ** 2 + best[1] ** 2));
  return [a[0] + k * best[0], a[1] + k * best[1]];
}

// stroke (pixel-space points) -> shape; force: one of KINDS to override the guess
export function fit(raw, anchors, force) {
  const pts = smooth(raw), first = pts[0], last = pts[pts.length - 1], L = pathLen(pts);
  if (pts.length < 2 || L < 0.8) { const p = snapPt(first, anchors); return { kind: "poly", pts: [p], closed: false }; }
  const closed = dist(first, last) < Math.max(1.5, L * 0.15);
  const mkLine = () => { const a = snapPt(first, anchors); let b = snapPt(last, anchors); if (!anchors?.some((q) => dist(q, b) < 0.01)) b = snapAngle(a, b); return { kind: "line", a, b }; };
  const mkPoly = (eps, kind) => {
    let s = rdp(pts, eps).map((p) => snapPt(p, anchors));
    if (closed && s.length > 2 && dist(s[0], s[s.length - 1]) < 1.6) s = s.slice(0, -1);
    s = s.filter((p, i) => i === 0 || dist(p, s[i - 1]) > 0);
    // after snapping, drop corners that sit on a straight line (or double back) between their neighbours
    for (let again = 1; again && s.length > 2;) {
      again = 0;
      const n = s.length;
      for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
        const p = s[(i + n - 1) % n], c = s[i], q = s[(i + 1) % n];
        const cr = (c[0] - p[0]) * (q[1] - c[1]) - (c[1] - p[1]) * (q[0] - c[0]), dot = (c[0] - p[0]) * (q[0] - c[0]) + (c[1] - p[1]) * (q[1] - c[1]);
        if (same(p, c) || (cr === 0 && dot >= 0)) { s.splice(i, 1); again = 1; break; }
      }
    }
    return { kind, pts: s, closed: closed && s.length > 2 };
  };
  const mkCircle = (c) => { const cc = [half(c.c[0]), half(c.c[1])]; if (cc[0] % 1 !== cc[1] % 1) cc[1] = Math.round(c.c[1] - (cc[0] % 1)) + (cc[0] % 1); return { kind: "circle", c: cc, r: rsnap(cc, c.r) }; };
  const mkArc = (c) => { const { a0, sw } = sweepOf(pts, c.c); return { kind: "arc", c: [half(c.c[0]), half(c.c[1])], r: Math.max(1, half(c.r)), a0, sw }; };
  const mkRect = () => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { kind: "rect", x0: Math.round(Math.min(...xs)), y0: Math.round(Math.min(...ys)), x1: Math.round(Math.max(...xs)), y1: Math.round(Math.max(...ys)), rad: 0 };
  };
  const c = fitCircle(pts);
  if (force) {
    if (force === "line") return mkLine();
    if (force === "circle" && c) return mkCircle(c);
    if (force === "arc" && c) return mkArc(c);
    if (force === "rect") return mkRect();
    if (force === "free") return mkPoly(0.6, "free");
    return mkPoly(0.6, "poly");   // chosen as a polygon: keep short sides
  }
  const dmax = Math.max(...pts.map((p) => segDist(p, first, last)));
  if (!closed && dmax <= Math.max(0.7, L * 0.05)) return mkLine();
  if (c && c.r > 1.2 && c.rms < Math.max(0.35, c.r * 0.1)) {
    const { sw } = sweepOf(pts, c.c);
    if (closed || Math.abs(sw) > 5.6) return mkCircle(c);
    if (Math.abs(sw) > 0.6 && c.r < 4 * Math.max(...pts.map((p) => Math.abs(dist(p, c.c))))) return mkArc(c);
  }
  if (closed) {   // a rectangle: every point near the bounding box's edges, 4 corners
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const tol = Math.max(0.9, 0.08 * Math.min(x1 - x0, y1 - y0));
    const near = pts.every((p) => Math.min(Math.abs(p[0] - x0), Math.abs(p[0] - x1), Math.abs(p[1] - y0), Math.abs(p[1] - y1)) <= tol);
    if (near && x1 - x0 >= 2 && y1 - y0 >= 2) return mkRect();
  }
  const s = mkPoly(1.0, "poly");
  if (s.pts.length > 8) return mkPoly(0.6, "free");
  return s;
}

// ---------- rasterising: a shape -> [[x, y], ...] pixels (ordered for strokes)
function bres(a, b, out) {
  let [x0, y0] = a.map(Math.round), [x1, y1] = b.map(Math.round);   // whole pixels: with a fraction the walk would never meet its end
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
function dedupe(p, closed) {
  const o = p.filter((q, i) => i === 0 || q[0] !== p[i - 1][0] || q[1] !== p[i - 1][1]);
  if (closed && o.length > 1 && o[0][0] === o[o.length - 1][0] && o[0][1] === o[o.length - 1][1]) o.pop();
  return o;
}
// "pixel perfect": drop the corner pixel of an L (its neighbours touch diagonally)
function unL(p, closed) {
  const o = [];
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const a = o.length ? o[o.length - 1] : closed ? p[n - 1] : null, b = p[i], c = i + 1 < n ? p[i + 1] : closed ? (o.length ? o[0] : p[0]) : null;
    if (a && c && Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1 && (a[0] === b[0] || a[1] === b[1]) && (c[0] === b[0] || c[1] === b[1])) continue;
    o.push(b);
  }
  return o;
}
// thin and 8-way symmetric: walk each axis up to 45 degrees, snapping the other to pixel centres (a half-pixel centre
// makes an even-width circle)
function circlePath(cx, cy, r) {
  const hx = cx % 1 !== 0, hy = cy % 1 !== 0, lim = r / Math.SQRT2 + 0.5;
  const snap = (v, h) => (h ? Math.floor(v) + 0.5 : Math.round(v));
  const seen = new Set(), out = [];
  const put = (dx, dy) => { for (const sx of [1, -1]) for (const sy of [1, -1]) { const x = cx + sx * dx, y = cy + sy * dy, k = x + "," + y; if (!seen.has(k)) { seen.add(k); out.push([x, y]); } } };
  for (let dx = hx ? 0.5 : 0; dx <= lim; dx++) put(dx, snap(Math.sqrt(Math.max(0, r * r - dx * dx)), hy));
  for (let dy = hy ? 0.5 : 0; dy <= lim; dy++) put(snap(Math.sqrt(Math.max(0, r * r - dy * dy)), hx), dy);
  return out;
}
function arcPath(c, r, a0, sw) {
  const n = Math.max(4, Math.ceil(Math.abs(sw) * r * 2)), out = [];
  for (let i = 0; i <= n; i++) { const t = a0 + (sw * i) / n; out.push([Math.round(c[0] + r * Math.cos(t)), Math.round(c[1] + r * Math.sin(t))]); }
  return unL(dedupe(out, false), false);
}
function rboxPix(x, y, w, h, r, filled) {
  const out = [];
  if (w < 1 || h < 1) return out;
  r = Math.min(r, w >> 1, h >> 1);
  const ins = (j) => (j < r ? r - j : j > h - 1 - r ? r - (h - 1 - j) : 0);
  for (let j = 0; j < h; j++) {
    const a = ins(j);
    if (filled || j === 0 || j === h - 1) { for (let xx = x + a; xx <= x + w - 1 - a; xx++) out.push([xx, y + j]); continue; }
    const nb = ins(j < h >> 1 ? j - 1 : j + 1), b = Math.max(nb - 1, a);
    for (let xx = a; xx <= b; xx++) { out.push([x + xx, y + j]); out.push([x + w - 1 - xx, y + j]); }
  }
  return out;
}
function inPoly(x, y, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function raster(s) {
  let path = [], fillPx = [];
  switch (s.kind) {
    case "line": bres(s.a, s.b, path); break;
    case "circle":
      path = circlePath(s.c[0], s.c[1], s.r);
      if (s.fill) for (let y = Math.floor(s.c[1] - s.r); y <= Math.ceil(s.c[1] + s.r); y++) for (let x = Math.floor(s.c[0] - s.r); x <= Math.ceil(s.c[0] + s.r); x++)
        if ((x - s.c[0]) ** 2 + (y - s.c[1]) ** 2 <= s.r * s.r) fillPx.push([x, y]);
      break;
    case "arc": path = arcPath(s.c, s.r, s.a0, s.sw); break;
    case "rect": {
      const x0 = Math.min(s.x0, s.x1), y0 = Math.min(s.y0, s.y1);
      path = rboxPix(x0, y0, Math.abs(s.x1 - s.x0) + 1, Math.abs(s.y1 - s.y0) + 1, s.rad || 0, !!s.fill);
      break;
    }
    case "pixels": path = s.pts.map((p) => p.slice()); break;
    default: {   // poly, free
      const P = s.pts;
      if (P.length === 1) { path = [P[0].slice()]; break; }
      for (let i = 1; i < P.length; i++) bres(P[i - 1], P[i], path);
      if (s.closed) bres(P[P.length - 1], P[0], path);
      path = dedupe(path, s.closed);
      if (s.kind === "free") path = unL(path, s.closed);
      if (s.fill && s.closed) {
        const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
        for (let y = Math.min(...ys); y <= Math.max(...ys); y++) for (let x = Math.min(...xs); x <= Math.max(...xs); x++) if (inPoly(x, y, P)) fillPx.push([x, y]);
      }
    }
  }
  if (s.dotted) path = s.kind === "rect" ? path.filter(([x, y]) => ((x + y) & 1) === 0) : path.filter((_, i) => (i & 1) === 0);
  return path.concat(fillPx);
}

// the points a user can drag
export function handles(s) {
  switch (s.kind) {
    case "line": return [s.a, s.b];
    case "circle": return [s.c, [s.c[0] + s.r, s.c[1]]];
    case "arc": return [s.c, [s.c[0] + s.r * Math.cos(s.a0), s.c[1] + s.r * Math.sin(s.a0)], [s.c[0] + s.r * Math.cos(s.a0 + s.sw), s.c[1] + s.r * Math.sin(s.a0 + s.sw)]];
    case "rect": return [[s.x0, s.y0], [s.x1, s.y1]];
    case "pixels": return [];
    default: return s.pts;
  }
}
export function setHandle(s, i, p) {
  const P = [Math.round(p[0]), Math.round(p[1])];
  switch (s.kind) {
    case "line": if (i === 0) s.a = P; else s.b = P; break;
    case "circle": if (i === 0) { const h = s.c[0] % 1; s.c = [Math.round(p[0] - h) + h, Math.round(p[1] - h) + h]; } else s.r = rsnap(s.c, dist(s.c, p)); break;
    case "arc": {
      if (i === 0) { s.c = [half(p[0]), half(p[1])]; break; }
      const a = Math.atan2(p[1] - s.c[1], p[0] - s.c[0]);
      s.r = Math.max(1, half(dist(s.c, p)));
      if (i === 1) { const end = s.a0 + s.sw; s.a0 = a; s.sw = wrapNear(end - a, s.sw); }
      else s.sw = wrapNear(a - s.a0, s.sw);
      break;
    }
    case "rect": if (i === 0) { s.x0 = P[0]; s.y0 = P[1]; } else { s.x1 = P[0]; s.y1 = P[1]; } break;
    default: s.pts[i] = P;
  }
}
const wrapNear = (d, ref) => { while (d - ref > Math.PI) d -= TAU; while (d - ref < -Math.PI) d += TAU; return d; };
export function moveShape(s, dx, dy) {
  switch (s.kind) {
    case "line": s.a = [s.a[0] + dx, s.a[1] + dy]; s.b = [s.b[0] + dx, s.b[1] + dy]; break;
    case "circle": case "arc": s.c = [s.c[0] + dx, s.c[1] + dy]; break;
    case "rect": s.x0 += dx; s.x1 += dx; s.y0 += dy; s.y1 += dy; break;
    default: s.pts = s.pts.map((p) => [p[0] + dx, p[1] + dy]);
  }
}

// ---------- in-betweens
const lerp = (a, b, t) => a + (b - a) * t;
const same = (p, q) => p[0] === q[0] && p[1] === q[1];
// the turn from angle a to b: spin "cw" (clockwise on the screen, y down), "ccw", or the shortest way
const angDiff = (a, b, spin) => {
  let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
  if (spin === "cw" && d < 0) d += TAU; else if (spin === "ccw" && d > 0) d -= TAU;
  return d;
};
// ---------- morphing: any two shapes, as outlines of N points matched up and blended
const NM = 64;
function resample(P, n, closed) {   // n points evenly along a polyline
  const Q = closed ? P.concat([P[0]]) : P, cum = [0];
  for (let i = 1; i < Q.length; i++) cum.push(cum[i - 1] + dist(Q[i], Q[i - 1]));
  const L = cum[cum.length - 1];
  if (!L) return Array.from({ length: n }, () => Q[0].slice());
  const out = [];
  for (let k = 0, j = 1; k < n; k++) {
    const d = (L * k) / (closed ? n : n - 1);
    while (j < Q.length - 1 && cum[j] < d) j++;
    const f = (d - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
    out.push([lerp(Q[j - 1][0], Q[j][0], f), lerp(Q[j - 1][1], Q[j][1], f)]);
  }
  return out;
}
export function outline(s) {
  switch (s.kind) {
    case "line": return { pts: [s.a, s.b], closed: false };
    case "circle": return { pts: Array.from({ length: 48 }, (_, i) => [s.c[0] + s.r * Math.cos((i / 48) * TAU), s.c[1] + s.r * Math.sin((i / 48) * TAU)]), closed: true };
    case "arc": return { pts: Array.from({ length: 33 }, (_, i) => [s.c[0] + s.r * Math.cos(s.a0 + (s.sw * i) / 32), s.c[1] + s.r * Math.sin(s.a0 + (s.sw * i) / 32)]), closed: false };
    case "rect": return { pts: [[s.x0, s.y0], [s.x1, s.y0], [s.x1, s.y1], [s.x0, s.y1]], closed: true };
    default: return { pts: s.pts, closed: !!s.closed };
  }
}
export function morph(A, B, t) {
  const oa = outline(A), ob = outline(B), closed = oa.closed && ob.closed;
  const pa = resample(oa.pts, NM, closed);
  let pb = resample(ob.pts, NM, closed);
  const cost = (q) => q.reduce((c, p, i) => c + dist(p, pa[i]), 0);
  if (closed) {   // the start point and direction that move the points least
    let best = pb, bc = Infinity;
    for (const dir of [pb, pb.slice().reverse()]) for (let k = 0; k < NM; k += 1) {
      const q = dir.slice(k).concat(dir.slice(0, k)), c = cost(q);
      if (c < bc) { bc = c; best = q; }
    }
    pb = best;
  } else if (cost(pb.slice().reverse()) < cost(pb)) pb = pb.slice().reverse();
  let pts = pa.map((p, i) => [Math.round(lerp(p[0], pb[i][0], t)), Math.round(lerp(p[1], pb[i][1], t))]);
  pts = pts.filter((p, i) => i === 0 || !same(p, pts[i - 1]));
  // rounding detours: drop a point whose neighbours already touch (A B A, or a pixel poking out of a run)
  const touch = (p, q) => Math.abs(p[0] - q[0]) <= 1 && Math.abs(p[1] - q[1]) <= 1;
  for (let again = 1; again && pts.length > 3;) {
    again = 0;
    const n = pts.length;
    for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
      const p = pts[(i + n - 1) % n], q = pts[(i + 1) % n];
      if (touch(p, q)) { pts.splice(i, 1); again = 1; break; }
    }
  }
  const n = pts.length;
  for (let i = 0; i < n; i++) {   // one-pixel bumps on a straight run: flatten into the run
    const p = pts[(i + n - 1) % n], c = pts[i], q = pts[(i + 1) % n];
    if (!closed && (i === 0 || i === n - 1)) continue;
    if (p[1] === q[1] && Math.abs(p[0] - q[0]) === 2 && Math.abs(c[1] - p[1]) === 1) c[1] = p[1];
    else if (p[0] === q[0] && Math.abs(p[1] - q[1]) === 2 && Math.abs(c[0] - p[0]) === 1) c[0] = p[0];
  }
  const o = clone(t < 0.5 ? A : B);
  for (const k of ["a", "b", "c", "r", "a0", "sw", "x0", "y0", "x1", "y1", "rad", "raw"]) delete o[k];
  return Object.assign(o, { kind: "free", pts, closed, fill: closed && (A.fill || B.fill) && t < 0.5 ? A.fill : B.fill });
}

export function interp(A, B, t) {
  if (t <= 0) return A;
  if (t >= 1) return B;
  if (A.kind === "pixels" || B.kind === "pixels") {   // pencil drawings slide when moved, else switch halfway
    if (A.kind !== B.kind || A.pts.length !== B.pts.length) return t < 0.5 ? A : B;
  } else if (A.kind !== B.kind) return morph(A, B, t);
  const o = clone(t < 0.5 ? A : B);
  switch (A.kind) {
    case "line": {
      const da = [B.a[0] - A.a[0], B.a[1] - A.a[1]], db = [B.b[0] - A.b[0], B.b[1] - A.b[1]];
      const rot = (P, PA, PB) => {   // swing about a fixed end
        const aA = Math.atan2(PA[1] - P[1], PA[0] - P[0]), aB = Math.atan2(PB[1] - P[1], PB[0] - P[0]);
        const a = aA + angDiff(aA, aB, A.spin) * t, l = lerp(dist(P, PA), dist(P, PB), t);
        return [Math.round(P[0] + l * Math.cos(a)), Math.round(P[1] + l * Math.sin(a))];
      };
      if (same(da, db)) { const d = [Math.round(da[0] * t), Math.round(da[1] * t)]; o.a = [A.a[0] + d[0], A.a[1] + d[1]]; o.b = [A.b[0] + d[0], A.b[1] + d[1]]; }
      else if (same(A.a, B.a)) { o.a = A.a.slice(); o.b = rot(A.a, A.b, B.b); }
      else if (same(A.b, B.b)) { o.b = A.b.slice(); o.a = rot(A.b, A.a, B.a); }
      else { o.a = A.a.map((v, k) => Math.round(lerp(v, B.a[k], t))); o.b = A.b.map((v, k) => Math.round(lerp(v, B.b[k], t))); }
      break;
    }
    case "circle": { const h = A.c[0] % 1; o.c = [Math.round(lerp(A.c[0], B.c[0], t) - h) + h, Math.round(lerp(A.c[1], B.c[1], t) - h) + h]; o.r = rsnap(o.c, lerp(A.r, B.r, t)); break; }
    case "arc":
      o.c = [half(lerp(A.c[0], B.c[0], t)), half(lerp(A.c[1], B.c[1], t))]; o.r = half(lerp(A.r, B.r, t));
      o.a0 = A.a0 + angDiff(A.a0, B.a0, A.spin) * t; o.sw = lerp(A.sw, B.sw, t);
      break;
    case "rect": {   // per axis: an edge the keys share stays put (a growing bar); else position and size apart (a sliding knob keeps its width)
      const ax = (a0, a1, b0, b1) => {
        if (a0 === b0) return [a0, Math.round(lerp(a1, b1, t))];
        if (a1 === b1) return [Math.round(lerp(a0, b0, t)), a1];
        const p = Math.round(lerp(a0, b0, t));
        return [p, p + Math.round(lerp(a1 - a0, b1 - b0, t))];
      };
      [o.x0, o.x1] = ax(A.x0, A.x1, B.x0, B.x1); [o.y0, o.y1] = ax(A.y0, A.y1, B.y0, B.y1);
      o.rad = Math.round(lerp(A.rad || 0, B.rad || 0, t));
      break;
    }
    default: {
      if (A.pts.length !== B.pts.length) return morph(A, B, t);
      const d0 = [B.pts[0][0] - A.pts[0][0], B.pts[0][1] - A.pts[0][1]];
      if (A.pts.every((p, i) => B.pts[i][0] - p[0] === d0[0] && B.pts[i][1] - p[1] === d0[1])) {
        const d = [Math.round(d0[0] * t), Math.round(d0[1] * t)];
        o.pts = A.pts.map((p) => [p[0] + d[0], p[1] + d[1]]);
      } else o.pts = A.pts.map((p, i) => [Math.round(lerp(p[0], B.pts[i][0], t)), Math.round(lerp(p[1], B.pts[i][1], t))]);
    }
  }
  return o;
}

// ---------- objects: sk.objs lists every shape id in drawing order with its settings:
// { id, name, linked (edits go to every key), appear ("grow" | "draw" | "pop": how it comes out of nothing / goes),
//   into (an object id it morphs into when this one ends where that one starts) }
export const APPEAR = ["grow", "draw", "pop"];
export function objs(sk) {
  if (!sk.objs) sk.objs = [];
  const have = new Set(sk.objs.map((o) => o.id));
  for (const k of sk.keys) for (const s of k.shapes) if (!have.has(s.id)) { have.add(s.id); sk.objs.push({ id: s.id, name: `${s.kind} ${s.id}`, linked: false, appear: "grow" }); }
  sk.next = Math.max(sk.next || 1, ...sk.objs.map((o) => o.id + 1));
  return sk.objs;
}
export const objOf = (sk, id) => objs(sk).find((o) => o.id === id);
export function ordered(sk, shapes) {
  const at = new Map(objs(sk).map((o, i) => [o.id, i]));
  return shapes.slice().sort((a, b) => (at.get(a.id) ?? 1e9) - (at.get(b.id) ?? 1e9));
}

// a shape part way into existence: f 0 (nothing) .. 1 (whole)
const centroid = (P) => [P.reduce((a, p) => a + p[0], 0) / P.length, P.reduce((a, p) => a + p[1], 0) / P.length];
export function appearShape(s, f, mode) {
  if (f >= 1) return s;
  if (f <= 0) return null;
  if (mode === "pop" || s.kind === "pixels") return f >= 0.5 ? s : null;
  const ol = outline(s), o = clone(s);
  if (mode !== "draw") o.kind = s.kind;
  for (const k of ["a", "b", "c", "r", "a0", "sw", "x0", "y0", "x1", "y1", "rad", "raw"]) delete o[k];
  o.kind = s.kind === "rect" || s.kind === "poly" || s.kind === "line" ? "poly" : "free";   // straight edges keep sharp corners
  if (mode === "draw") {   // drawn on along its outline
    const n = 64, P = resample(ol.pts, n, ol.closed);
    if (ol.closed) P.push(P[0]);
    o.pts = P.slice(0, Math.max(1, Math.round(f * P.length))).map((p) => [Math.round(p[0]), Math.round(p[1])]).filter((p, i, A) => i === 0 || !same(p, A[i - 1]));
    o.closed = false; o.fill = 0;
    return o;
  }
  // grow from its centre: the shape itself scaled (corners, ends, radius), so it stays crisp
  const g = clone(s), c = s.kind === "circle" || s.kind === "arc" ? s.c : centroid(handles(s));
  const sc = (p) => [Math.round(c[0] + (p[0] - c[0]) * f), Math.round(c[1] + (p[1] - c[1]) * f)];
  switch (s.kind) {
    case "line": g.a = sc(s.a); g.b = sc(s.b); break;
    case "circle": case "arc": { const r = s.r * f; if (r < 0.5) return { ...g, kind: "poly", pts: [[Math.round(c[0]), Math.round(c[1])]], closed: false }; g.r = rsnap(s.c, r); break; }
    case "rect": { const [x0, y0] = sc([s.x0, s.y0]), [x1, y1] = sc([s.x1, s.y1]); Object.assign(g, { x0, y0, x1, y1 }); break; }
    default: g.pts = s.pts.map(sc).filter((p, i, A) => i === 0 || !same(p, A[i - 1])); if (g.pts.length > 1 && same(g.pts[0], g.pts[g.pts.length - 1])) g.pts.pop(); if (g.pts.length < 3) g.closed = false;
  }
  return g;
}

// the shapes at a param value (keys sorted by v). An object in both neighbouring keys interpolates; one that ends
// where another starts morphs into it (its "into", or with sk.morph the unmatched ones paired in drawing order);
// the rest come out of nothing / go to nothing by their "appear" style.
export function shapesAt(sk, v) {
  const K = sk.keys.slice().sort((a, b) => a.v - b.v);
  if (v <= K[0].v) return ordered(sk, K[0].shapes);
  if (v >= K[K.length - 1].v) return ordered(sk, K[K.length - 1].shapes);
  let i = 0;
  while (v > K[i + 1].v) i++;
  const lo = K[i], hi = K[i + 1], t = (v - lo.v) / (hi.v - lo.v);
  const loOnly = lo.shapes.filter((a) => !hi.shapes.some((b) => b.id === a.id)), hiOnly = hi.shapes.filter((b) => !lo.shapes.some((a) => a.id === b.id));
  const pairs = new Map(), taken = new Set();
  for (const a of loOnly) { const o = objOf(sk, a.id), b = o && o.into != null && hiOnly.find((x) => x.id === o.into); if (b && !taken.has(b.id)) { pairs.set(a.id, b); taken.add(b.id); } }
  if (sk.morph === true) { const freeB = hiOnly.filter((b) => !taken.has(b.id)); loOnly.filter((a) => !pairs.has(a.id)).forEach((a, k) => { if (freeB[k]) { pairs.set(a.id, freeB[k]); taken.add(freeB[k].id); } }); }
  const out = [], mode = (id) => objOf(sk, id)?.appear || "grow";
  for (const a of lo.shapes) {
    const b = hi.shapes.find((s) => s.id === a.id) || pairs.get(a.id);
    const r = b ? interp(a, b, t) : appearShape(a, 1 - t, mode(a.id));
    if (r) out.push(b && b.id !== a.id ? Object.assign(r, { id: a.id }) : r);
  }
  for (const b of hiOnly) if (!taken.has(b.id)) { const r = appearShape(b, t, mode(b.id)); if (r) out.push(r); }
  return ordered(sk, out);
}

// shapes -> w*h bits (ink 0 shapes erase)
export function draw(shapes, w, h) {
  const g = new Uint8Array(w * h);
  for (const s of shapes) for (const [x, y] of raster(s)) if (x >= 0 && y >= 0 && x < w && y < h) g[y * w + x] = s.ink === 0 ? 0 : 1;
  return g;
}
export const frameValue = (i, n) => (n <= 1 ? 0 : Math.round((i * 127) / (n - 1)));
export function frames(sk) {
  const out = [];
  for (let i = 0; i < sk.steps; i++) out.push(draw(shapesAt(sk, frameValue(i, sk.steps)), sk.w, sk.h));
  return out;
}
// rmpui bitmap: rows padded to bytes, MSB = leftmost
export function toHex(g, w, h) {
  const rb = (w + 7) >> 3, b = new Uint8Array(rb * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y * w + x]) b[y * rb + (x >> 3)] |= 0x80 >> (x & 7);
  return Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
}
export function exportBitmap(sk) {
  const F = frames(sk);
  return { w: sk.w, h: sk.h, frames: F.map((g) => toHex(g, sk.w, sk.h)) };
}

// a starting example: a ring dial whose needle swings about the centre (3 keys)
export function demo() {
  const ring = { id: 1, kind: "circle", c: [10, 10], r: 9 }, dot = { id: 3, kind: "circle", c: [10, 10], r: 1, fill: 1 };
  const needle = (b) => ({ id: 2, kind: "line", a: [10, 10], b });
  return {
    w: 21, h: 21, steps: 16, next: 4,
    objs: [{ id: 1, name: "ring", linked: true, appear: "grow" }, { id: 2, name: "needle", linked: false, appear: "grow", spin: "cw" }, { id: 3, name: "hub", linked: true, appear: "grow" }],
    keys: [{ v: 0, shapes: [ring, needle([5, 15]), dot] }, { v: 64, shapes: [ring, needle([10, 3]), dot] }, { v: 127, shapes: [ring, needle([15, 15]), dot] }].map(clone),
  };
}
