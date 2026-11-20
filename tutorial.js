// tutorial.js - what every sketch tutorial page shares: step pictures, "Open in editor", saved progress and scroll,
// the follow-along mode inside the editor (?embed), and the comparison with a private reference (priv/, local only).
import * as K from "./sketch.js";

export const STORE = "rmpui-sketch-v1";
export const clone = (o) => JSON.parse(JSON.stringify(o));
const embedded = new URLSearchParams(location.search).has("embed") || window.parent !== window;
if (embedded) document.body.classList.add("embed");
const store = {
  get(k, d) { try { const t = localStorage.getItem(k); return t == null ? d : JSON.parse(t); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

// hand a sketch to the editor, which keeps it as a new sketch in its library named `name`: inside the editor's guide
// panel by message, else by opening (or reloading) the editor's tab
export function sendToEditor(sk, name) {
  store.set(STORE, sk);
  store.set("rmpui-sketch-from", { name });
  if (window.parent !== window) { parent.postMessage({ type: "rmpui-load-sketch" }, location.origin); return true; }
  window.open("sketch.html", "rmpui-sketch"); return false;
}

export function paint(c, g, s, w, h, colorOf) {
  c.width = w * s; c.height = h * s;
  const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const col = colorOf ? colorOf(i, j) : g[j * w + i] ? "#dfeeff" : null;
    if (col) { x.fillStyle = col; x.fillRect(i * s, j * s, s - (s > 4 ? 1 : 0), s - (s > 4 ? 1 : 0)); }
  }
}

// progress: a "done" tick on every numbered step (h2[data-step]), a bar on top, and the scroll position, kept in the browser
export function progress(id) {
  const PKEY = `rmpui-tut-${id}`, prog = store.get(PKEY, {});
  const steps = [...document.querySelectorAll("h2[data-step]")];
  const bar = document.createElement("div"); bar.className = "progress";
  bar.innerHTML = `<span id="pText"></span><span class="bar"><i id="pBar"></i></span><a href="tutorials.html${embedded ? "?embed" : ""}">All tutorials</a>${embedded ? "" : ` · <a href="sketch.html" target="rmpui-sketch">Editor</a>`}`;
  document.querySelector(".wrap").prepend(bar);
  const showProg = () => {
    const n = steps.filter((h) => prog.done?.[h.dataset.step]).length;
    document.getElementById("pText").textContent = `${n} of ${steps.length} steps done`;
    document.getElementById("pBar").style.width = `${(100 * n) / steps.length}%`;
    steps.forEach((h) => h.classList.toggle("isdone", !!prog.done?.[h.dataset.step]));
  };
  for (const h of steps) {
    const l = document.createElement("label"); l.className = "done";
    const cb = Object.assign(document.createElement("input"), { type: "checkbox", checked: !!prog.done?.[h.dataset.step] });
    cb.onchange = () => { prog.done = { ...(prog.done || {}), [h.dataset.step]: cb.checked }; store.set(PKEY, prog); showProg(); };
    l.append(cb, "done"); h.append(l);
  }
  showProg();
  // come back where you left off
  const y = prog.scroll || 0;
  if (y) requestAnimationFrame(() => scrollTo(0, y));
  let tm = 0;
  addEventListener("scroll", () => { clearTimeout(tm); tm = setTimeout(() => { prog.scroll = scrollY; store.set(PKEY, prog); }, 200); });

}

// cfg: { id, stage(n) -> sketch, last (the final stage), ref (priv/... .json, rows of "#." per value), scale, filmEvery }
export async function setup(cfg) {
  const FINAL = cfg.stage(cfg.last), W = FINAL.w, H = FINAL.h, F = K.frames(FINAL);
  const frameAt = (v) => F[Math.min(FINAL.steps - 1, (v * FINAL.steps) >> 7)];
  const sc = cfg.scale || 8;

  document.querySelectorAll("canvas[data-stage]").forEach((c) => {
    const S = cfg.stage(+c.dataset.stage), v = +(c.dataset.v ?? 127);
    paint(c, K.draw(K.shapesAt(S, v), S.w, S.h), sc, S.w, S.h);
  });
  // "Open in editor": the sketch as it is at the start of that step. Inside the editor's guide panel the editor
  // reloads it; on its own page, the editor opens (or reloads) in its tab.
  document.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => {
    const title = (document.querySelector("h1")?.textContent || document.title).replace(/^Tutorial:\s*/i, "").trim();
    if (sendToEditor(cfg.stage(+b.dataset.open), `${title} · step ${b.dataset.open}`)) { b.textContent = "Loaded ✓"; setTimeout(() => (b.textContent = b.dataset.label), 1500); }
  }));
  document.querySelectorAll("[data-open]").forEach((b) => (b.dataset.label = b.textContent));

  progress(cfg.id);

  // the reference (private captures; only where priv/ exists)
  let REF = null;
  if (cfg.ref) try { const r = await fetch(cfg.ref); if (r.ok) REF = (await r.json()).map((rows) => Uint8Array.from(rows.join("").split(""), (ch) => (ch === "#" ? 1 : 0))); } catch (e) {}
  const $ = (id) => document.getElementById(id);
  const show = (v) => { $("heroV").textContent = v; paint($("heroOurs"), frameAt(v), cfg.heroScale || 10, W, H); if (REF) paint($("heroRef"), REF[v], cfg.heroScale || 10, W, H); };
  if (REF) {
    for (const id of ["heroRefFig", "refFilm"]) if ($(id)) $(id).hidden = false;
    const every = cfg.filmEvery || 4;
    for (let v = every >> 1; v < 128; v += every) {
      if ($("refFilmBox")) { const f = document.createElement("figure"), c = document.createElement("canvas"); c.className = "pix"; paint(c, REF[v], 3, W, H); f.append(c, String(v)); $("refFilmBox").append(f); }
    }
  }
  const slider = $("heroS");
  let auto = true; const t0 = performance.now();
  slider.oninput = () => { auto = false; show(+slider.value); };
  (function tick(t) { if (auto) { const ph = (Math.max(0, t - t0) / 3000) % 2; slider.value = Math.round((ph < 1 ? ph : 2 - ph) * 127); show(+slider.value); } requestAnimationFrame(tick); })(t0);
  show(0);
  return { FINAL, frameAt, REF };
}
