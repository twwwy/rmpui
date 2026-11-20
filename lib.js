// lib.js - the asset library every rmpui tool shares: sketches now; fonts, layouts, images and parts next.
// Kept in this browser's IndexedDB (room for images, unlike localStorage's ~5 MB). Each asset:
//   { id, type: "sketch" | "font" | "layout" | "image", name, tags: [], data, thumb (small PNG data URL),
//     created, updated (ms) }
// Other tabs hear about changes through a BroadcastChannel ("rmpui-lib": {op: "put" | "del", id, type}).
const DB = "rmpui-lib", ST = "assets";
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((ok, bad) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore(ST, { keyPath: "id" }); s.createIndex("type", "type"); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  });
  return dbp;
}
const req = (r) => new Promise((ok, bad) => { r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
async function store(mode) { return (await db()).transaction(ST, mode).objectStore(ST); }

let bc = null;
try { bc = new BroadcastChannel("rmpui-lib"); } catch (e) {}
const tell = (m) => { try { bc && bc.postMessage(m); } catch (e) {} };
// fn({op, id, type}) whenever another tab changes the library
export function onChange(fn) { if (bc) bc.addEventListener("message", (e) => fn(e.data)); }

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
// every asset of a type, newest first (without data unless full)
export async function list(type, full) {
  const all = await req((await store("readonly")).index("type").getAll(type));
  all.sort((a, b) => b.updated - a.updated);
  return full ? all : all.map(({ data, ...meta }) => meta);
}
export async function get(id) { return id ? (await req((await store("readonly")).get(id))) || null : null; }
export async function put(a) {
  const now = Date.now();
  a = { tags: [], created: now, ...a, updated: a.keepTime ? a.updated || now : now };
  delete a.keepTime;
  await req((await store("readwrite")).put(a));
  tell({ op: "put", id: a.id, type: a.type });
  return a;
}
export async function del(id) {
  const a = await get(id);
  await req((await store("readwrite")).delete(id));
  tell({ op: "del", id, type: a?.type });
}
// a name not already used by another asset of the type: "dial", "dial 2", "dial 3" ...
export async function freeName(type, want, exceptId) {
  const used = new Set((await list(type)).filter((a) => a.id !== exceptId).map((a) => a.name));
  if (!used.has(want)) return want;
  const base = want.replace(/ \d+$/, "");
  for (let i = 2; ; i++) if (!used.has(`${base} ${i}`)) return `${base} ${i}`;
}
// a 1-bit picture (Uint8Array w*h of 0/1) as a small PNG data URL, for thumbnails
export function thumbOf(g, w, h, max = 96) {
  const s = Math.max(1, Math.floor(max / Math.max(w, h))), c = document.createElement("canvas");
  c.width = w * s; c.height = h * s;
  const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height); x.fillStyle = "#dfeeff";
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[j * w + i]) x.fillRect(i * s, j * s, s, s);
  return c.toDataURL("image/png");
}

// ---------- the whole library as one file (a backup, or to move it to another browser / computer)
const EXPK = "rmpui-lib-exported";
export function lastExport() { try { return +localStorage.getItem(EXPK) || 0; } catch (e) { return 0; } }
export async function exportAll() {
  const assets = [];
  for (const t of ["sketch", "layout", "font", "image", "part", "screen"]) assets.push(...(await list(t, true)));
  return { format: "rmpui-library-1", exported: new Date().toISOString(), assets };
}
export async function exportFile() {
  const lib = await exportAll(), d = new Date(), p = (n) => String(n).padStart(2, "0");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(lib)], { type: "application/json" }));
  a.download = `rmpui-library-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  try { localStorage.setItem(EXPK, String(Date.now())); } catch (e) {}
  const n = {}; for (const x of lib.assets) n[x.type] = (n[x.type] || 0) + 1;
  return n;
}
// merge a library file in: a new asset is added (renamed "x 2" if its name is taken); one already here is replaced
// only if the file's copy is newer. Nothing here is deleted. Returns { added, updated, kept, renamed: [[from, to]], ids }
export async function importAll(lib) {
  if (!lib || lib.format !== "rmpui-library-1" || !Array.isArray(lib.assets)) throw new Error("not an rmpui library file");
  const r = { added: 0, updated: 0, kept: 0, renamed: [], ids: [] };
  for (const a of lib.assets) {
    if (!a || !a.id || !a.type || !a.name || a.data === undefined) continue;
    const have = await get(a.id);
    if (have) {
      if ((a.updated || 0) > (have.updated || 0)) { await put({ ...a, name: await freeName(a.type, a.name, a.id), keepTime: true }); r.updated++; r.ids.push(a.id); } else r.kept++;
    } else {
      const name = await freeName(a.type, a.name, a.id);
      if (name !== a.name) r.renamed.push([a.name, name]);
      await put({ tags: [], ...a, name, keepTime: true }); r.added++; r.ids.push(a.id);
    }
  }
  return r;
}
export function importSummary(r) {
  return `${r.added} added, ${r.updated} updated (newer in the file), ${r.kept} kept (same or newer here)` +
    (r.renamed.length ? `; renamed: ${r.renamed.map(([a, b]) => `“${a}” → “${b}”`).join(", ")}` : "");
}
// asks for a file and merges it; resolves to the result, or null if nothing was picked
export function importFile() {
  return new Promise((ok, bad) => {
    const inp = Object.assign(document.createElement("input"), { type: "file", accept: ".json,application/json" });
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return ok(null); try { ok(await importAll(JSON.parse(await f.text()))); } catch (e) { bad(e); } };
    inp.click();
  });
}
