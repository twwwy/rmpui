// lib-ui.js - the library bar and drawer for a page that keeps one type of asset (layout.html, font.html).
// The sketch editor has its own copy of this in sketch.html.
//   const ui = libUI({ type: "layout", noun: "layout", bar: element to fill, current: () => id,
//                      open: async (id) => {}, create: async () => {}, duplicate: async (asset) => {}, save: async () => {} });
//   ui.refresh()  after the current asset changed name, thumb or time;  ui.show(true | false)
import * as LIB from "./lib.js";

const CSS = `
.libbar { display: flex; gap: 8px; align-items: center; margin: 10px 10px 0; padding: 6px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel2); cursor: pointer; }
.libbar img { width: 40px; height: 40px; object-fit: contain; background: #000; image-rendering: pixelated; border-radius: 3px; }
.libbar .lbn { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.libbar .lbn b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.libbar .lbn span { color: var(--dim); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }   /* one line: "saving…" / "saved …" mustn't change the bar's height */
.ldrawer { position: fixed; z-index: 30; left: 0; top: 48px; bottom: 0; width: 380px; background: var(--panel); border-right: 1px solid var(--line); box-shadow: 8px 0 24px #0008; overflow: auto; }
.ldrawer .dh { display: flex; align-items: center; gap: 6px; padding: 10px 12px; }
.ldrawer .dh a { color: var(--dim); text-decoration: none; }
.ldrawer .ldim { color: var(--dim); font-size: 12px; }
.ldrawer .lrow { display: flex; gap: 6px; padding: 0 12px 8px; align-items: center; }
.ldrawer .ltags { display: flex; gap: 4px; flex-wrap: wrap; padding: 6px 12px; }
.ldrawer input.lq { flex: 1; background: var(--panel2); color: var(--text); border: 1px solid var(--line); border-radius: 4px; padding: 4px 6px; font: inherit; }
.lchip { border: 1px solid var(--line); border-radius: 10px; padding: 0 8px; font-size: 11px; color: var(--dim); cursor: pointer; background: none; }
.lchip.on { border-color: var(--sel); color: var(--sel); }
.lcards { display: grid; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 8px; padding: 0 12px 12px; }
.lcard { border: 1px solid var(--line); border-radius: 6px; padding: 6px; background: var(--panel2); cursor: pointer; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.lcard:hover { border-color: var(--accent); }
.lcard.cur { border-color: var(--sel); }
.lcard img { width: 100%; aspect-ratio: 2; object-fit: contain; background: #000; image-rendering: pixelated; border-radius: 3px; }
.lcard .cn { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lcard .ct { color: var(--dim); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lcard .ca { display: flex; gap: 2px; }
.lico { background: none; border: 1px solid transparent; border-radius: 4px; cursor: pointer; color: var(--dim); font-size: 13px; padding: 0 3px; line-height: 18px; }
.lico:hover { border-color: var(--line); }`;

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export function ago(t) { const s = (Date.now() - t) / 1000; return s < 50 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : new Date(t).toLocaleDateString(); }

export function libUI(o) {
  if (!document.getElementById("libui-css")) document.head.append(Object.assign(document.createElement("style"), { id: "libui-css", textContent: CSS }));
  const plural = o.noun + "s";
  o.bar.className = "libbar"; o.bar.title = `This ${o.noun} in the library: click for all of them`;
  o.bar.innerHTML = `<img alt=""><div class="lbn"><b>…</b><span></span></div><button class="btn sm">📚 Library</button>`;
  const [thumb, nameEl, savedEl, btn] = [o.bar.querySelector("img"), o.bar.querySelector("b"), o.bar.querySelector(".lbn span"), o.bar.querySelector("button")];
  const dr = document.createElement("div"); dr.className = "ldrawer"; dr.hidden = true;
  dr.innerHTML = `<div class="dh"><b>Library · ${plural}</b> <span class="ldim" data-r="count"></span><span style="flex:1"></span><a href="#" data-r="x" title="Close (Esc)">✕</a></div>
    <div class="lrow"><input class="lq" data-r="q" placeholder="Search names and tags"></div>
    <div class="ltags" data-r="tags"></div>
    <div class="lrow"><button class="btn sm" data-r="new">+ New ${o.noun}</button><button class="btn sm" data-r="dup">⧉ Duplicate this one</button></div>
    <div class="lcards" data-r="cards"></div>
    <div class="lrow" style="border-top:1px solid var(--line);padding-top:8px"><button class="btn sm" data-r="exp" title="Everything (sketches, layouts, fonts) as one file">⬇ Export library</button><button class="btn sm" data-r="imp" title="Merge a library file in: new items are added, newer copies replace older ones, nothing is deleted">⬆ Import…</button></div>
    <div class="ldim" data-r="bk" style="padding:0 12px 12px"></div>`;
  document.body.append(dr);
  const R = (k) => dr.querySelector(`[data-r=${k}]`);
  let tag = null;
  async function render() {
    const all = await LIB.list(o.type), cur = o.current();
    const tags = [...new Set(all.flatMap((a) => a.tags || []))].sort();
    if (tag && !tags.includes(tag)) tag = null;
    R("tags").innerHTML = tags.map((g) => `<button class="lchip ${g === tag ? "on" : ""}" data-tag="${esc(g)}">${esc(g)}</button>`).join("");
    R("tags").querySelectorAll("[data-tag]").forEach((b) => (b.onclick = () => { tag = tag === b.dataset.tag ? null : b.dataset.tag; render(); }));
    const q = R("q").value.trim().toLowerCase();
    const shown = all.filter((a) => (!tag || (a.tags || []).includes(tag)) && (!q || a.name.toLowerCase().includes(q) || (a.tags || []).some((g) => g.toLowerCase().includes(q))));
    const le = LIB.lastExport();
    R("bk").innerHTML = `Kept in this browser only. Last exported: <b>${le ? ago(le) : "never"}</b>${!le || Date.now() - le > 7 * 864e5 ? " · export now and then as a backup" : ""}.`;
    R("count").textContent = `${all.length}${shown.length < all.length ? ` · ${shown.length} shown` : ""}`;
    const box = R("cards"); box.innerHTML = "";
    for (const a of shown) {
      const c = document.createElement("div"); c.className = "lcard" + (a.id === cur ? " cur" : ""); c.title = `${a.name}\nchanged ${new Date(a.updated).toLocaleString()}`;
      c.innerHTML = `<img src="${a.thumb || ""}" alt=""><span class="cn">${esc(a.name)}</span><span class="ct">${(a.tags || []).length ? esc(a.tags.join(", ")) : ago(a.updated)}</span>
        <span class="ca"><button class="lico" data-a="ren" title="Rename">✎</button><button class="lico" data-a="tag" title="Tags">🏷</button><button class="lico" data-a="dup" title="Duplicate">⧉</button><button class="lico" data-a="del" title="Delete">✕</button></span>`;
      c.onclick = async () => { await o.open(a.id); refresh(); render(); };
      c.querySelectorAll("[data-a]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); act(b.dataset.a, a); }));
      box.append(c);
    }
    if (!shown.length) box.innerHTML = `<div class="ldim">${all.length ? "Nothing matches." : `No ${plural} yet.`}</div>`;
  }
  async function act(a, m) {
    const isCur = m.id === o.current();
    if (isCur && o.save) await o.save();
    if (a === "ren") {
      const n = prompt(`${o.noun[0].toUpperCase() + o.noun.slice(1)} name`, m.name); if (!n || n.trim() === m.name) return;
      const full = await LIB.get(m.id); await LIB.put({ ...full, name: await LIB.freeName(o.type, n.trim(), m.id), keepTime: true });
      if (isCur && o.renamed) await o.renamed();
    } else if (a === "tag") {
      const n = prompt("Tags, separated by commas", (m.tags || []).join(", ")); if (n == null) return;
      const full = await LIB.get(m.id); await LIB.put({ ...full, tags: [...new Set(n.split(",").map((s) => s.trim()).filter(Boolean))], keepTime: true });
    } else if (a === "dup") await o.duplicate(await LIB.get(m.id));
    else if (a === "del") {
      if (!confirm(`Delete the ${o.noun} "${m.name}" from the library? This can't be undone.`)) return;
      await LIB.del(m.id);
      if (isCur) { const rest = await LIB.list(o.type); if (rest.length) await o.open(rest[0].id); else await o.create(); }
    }
    refresh(); render();
  }
  async function refresh() {
    const a = await LIB.get(o.current());
    if (!a) return;
    nameEl.textContent = a.name; savedEl.textContent = "saved " + ago(a.updated); thumb.src = a.thumb || "";
  }
  function show(on) { dr.style.top = (document.querySelector("header")?.offsetHeight || 48) + "px"; dr.hidden = !on; btn.classList.toggle("on", on); if (on) { render(); R("q").focus(); } }
  o.bar.onclick = (e) => { if (e.target.tagName !== "B") show(dr.hidden); };
  nameEl.ondblclick = (e) => { e.stopPropagation(); LIB.get(o.current()).then((a) => a && act("ren", a)); };
  R("x").onclick = (e) => { e.preventDefault(); show(false); };
  R("q").oninput = render;
  R("exp").onclick = async () => { if (o.save) await o.save(); const n = await LIB.exportFile(); R("bk").textContent = `Exported ${Object.entries(n).map(([t, k]) => `${k} ${t}${k === 1 ? "" : t === "sketch" ? "es" : "s"}`).join(", ")}.`; };
  R("imp").onclick = async () => {
    try {
      if (o.save) await o.save();
      const r = await LIB.importFile(); if (!r) return;
      if (r.ids.includes(o.current()) && o.reload) await o.reload(o.current());
      await render(); refresh(); R("bk").textContent = "Imported: " + LIB.importSummary(r) + ".";
    } catch (e) { R("bk").textContent = "Import failed: " + e.message; }
  };
  R("new").onclick = async () => { await o.create(); refresh(); render(); };
  R("dup").onclick = async () => { if (o.save) await o.save(); const a = await LIB.get(o.current()); if (a) await o.duplicate(a); refresh(); render(); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !dr.hidden) show(false); });
  LIB.onChange((m) => { if (m.type === o.type) { if (!dr.hidden) render(); if (m.id === o.current()) refresh(); } });
  setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  return { refresh, show, render, saving: () => (savedEl.textContent = "saving…"), failed: (msg) => (savedEl.textContent = "not saved: " + msg) };
}
