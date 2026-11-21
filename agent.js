// agent.js - the agent link in a page (serve.py's /api): an agent's commands are carried out here, where you can see
// them, and each shows in the 🤖 Agent panel: what it did (with ↩ to undo that change), what it says, what it asks
// (you answer with a click), and a box for your own notes to it. Pause stops it until you let it go on.
//   const ag = startAgent({ ops: { name: async (args, ctx) => result }, button, beforeOpen });
//   ctx.change(label, async () => { undo it })   ctx.say(text)
//   ag.userEdited({ type, name })   tell a waiting agent you changed something (sent at most every 3 s)
//   ag.busy()   true while a command runs (so the page can tell its own edits from the agent's)
const CSS = `
#agentBtn .adot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #555c66; margin-left: 5px; vertical-align: 1px; }
#agentBtn.live .adot { background: #78e68c; }
#agentBtn.busy .adot { background: #5fc8ff; box-shadow: 0 0 6px #5fc8ff; }
#agentBtn.paused .adot { background: #ffb35f; }
#agentBtn .anew { background: #5fc8ff; color: #000; border-radius: 8px; padding: 0 5px; font-size: 10px; margin-left: 4px; font-weight: 700; }
#agentDrawer { display: flex; flex-direction: column; overflow: hidden; box-shadow: none; }
#agentDrawer[hidden] { display: none; }   /* display: flex above would override the hidden attribute */
body.agent-open > main { margin-right: 340px; }   /* the page makes room: the drawer never covers the preview */
#agentDrawer .afeed { flex: 1; overflow: auto; padding: 4px 12px; display: flex; flex-direction: column; gap: 6px; }
#agentDrawer .ait { border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; font-size: 12px; line-height: 1.45; background: var(--panel2); }
#agentDrawer .ait .at { color: var(--dim); font-size: 10px; display: flex; gap: 6px; align-items: center; }
#agentDrawer .ait .at span { flex: 1; }
#agentDrawer .ait.did { border-left: 3px solid #5fc8ff; }
#agentDrawer .ait.said { border-left: 3px solid var(--line); }
#agentDrawer .ait.asked { border: 1px solid var(--sel); border-left-width: 3px; background: #2b241b; }
#agentDrawer .ait.you { border-left: 3px solid #78e68c; margin-left: 24px; }
#agentDrawer .ait.err { border-left: 3px solid #ff8a8a; }
#agentDrawer .ait.undone .ab { text-decoration: line-through; opacity: .6; }
#agentDrawer .ait .aopts { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
#agentDrawer .ait .aopts .btn { white-space: normal; text-align: left; max-width: 100%; height: auto; line-height: 1.35; }   /* long choices wrap inside the panel */
#agentDrawer .ait .aopts input { flex: 1; min-width: 120px; background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 4px; padding: 3px 6px; font: inherit; }
#agentDrawer .ait .apicked { color: #78e68c; margin-top: 4px; }
#agentDrawer .ait pre { white-space: pre-wrap; margin: 4px 0 0; font-size: 11px; }
#agentDrawer .anote { border-top: 1px solid var(--line); padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; }
#agentDrawer .anote textarea { width: 100%; box-sizing: border-box; min-height: 54px; resize: vertical; background: var(--panel2); color: var(--text); border: 1px solid var(--line); border-radius: 5px; padding: 6px; font: inherit; font-size: 12px; }
#agentDrawer .anote .arow { display: flex; gap: 6px; align-items: center; }
#agentDrawer .ait .seen { color: var(--dim); font-size: 10px; margin-top: 2px; }
#agentDrawer .athink { color: var(--dim); font-size: 12px; padding: 2px 2px 6px; }
#agentDrawer .athink i { display: inline-block; width: 4px; height: 4px; border-radius: 2px; background: #5fc8ff; margin-left: 3px; animation: athink 1.2s infinite ease-in-out; }
#agentDrawer .athink i:nth-child(2) { animation-delay: .2s; } #agentDrawer .athink i:nth-child(3) { animation-delay: .4s; }
@keyframes athink { 0%, 80%, 100% { opacity: .2; } 40% { opacity: 1; } }
#agentDrawer .alink { color: var(--dim); font-size: 11px; padding: 0 12px 6px; }`;

const PID = Math.random().toString(36).slice(2, 10);
// the agent link is serve.py on this machine: a copy served from anywhere else (a static host) never looks for it
const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(path, body) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return r.json();
}

export function startAgent(o) {
  if (!document.getElementById("agent-css")) document.head.append(Object.assign(document.createElement("style"), { id: "agent-css", textContent: CSS }));
  const btn = o.button;
  btn.innerHTML = `🤖<span class="adot"></span>`;
  const dr = document.createElement("div"); dr.className = "drawer right"; dr.id = "agentDrawer"; dr.hidden = true;
  dr.innerHTML = `<div class="dh"><b>Agent</b><span class="dim" data-r="state"></span><span style="flex:1"></span>
      <label class="dim" title="While paused, the agent's commands are turned down (it's told you paused it)"><input type="checkbox" data-r="pause"> Pause</label>
      <a href="#" data-r="x" title="Close">✕</a></div>
    <div class="alink" data-r="link"></div>
    <div class="afeed" data-r="feed"></div>
    <div class="anote"><textarea data-r="note" placeholder="A note for the agent: what you like, what to change… (⌘⏎ sends)"></textarea>
      <div class="arow"><span class="dim" data-r="who" style="flex:1;font-size:11px"></span><button class="btn sm" data-r="send">Send</button></div></div>`;
  document.body.append(dr);
  const R = (k) => dr.querySelector(`[data-r=${k}]`);
  let live = false, running = 0, paused = false, unseen = 0, focusT = document.hasFocus() || !document.hidden ? Date.now() : 0;   // a page just opened in view counts as the one in use
  // the feed survives a reload of this page (as text: what was undoable before stays visible, without its ↩)
  const FEED_K = "rmpui-agent-feed:" + location.pathname, items = [];
  try {
    for (const o of JSON.parse(sessionStorage.getItem(FEED_K) || "[]")) items.push({ ...o, t: new Date(o.t), old: true,
      ...(o.ask ? { ask: { answer: o.ask.answer ?? "(not answered before the page reloaded)" } } : {}) });
  } catch (e) {}
  const keep = () => { try { sessionStorage.setItem(FEED_K, JSON.stringify(items.slice(-100).map((it) => ({ kind: it.kind, html: it.html, text: it.text, t: it.t, undone: it.undone, n: it.n, read: it.read, ...(it.ask ? { ask: { answer: it.ask.answer ?? null } } : {}) })))); } catch (e) {} };
  let agentInfo = null, lastReply = 0, readAt = 0;   // the agent's status; its last reply; when it read your last note
  const mark = () => {
    btn.classList.toggle("live", live); btn.classList.toggle("busy", running > 0 || thinking()); btn.classList.toggle("paused", paused);
    btn.title = "Agent panel · " + (!live ? (LOCAL ? "link off: start serve.py" : "link off: run rmpUI locally for the agent link") : paused ? "Agent paused" : running ? "The agent is working…" : "link on: an agent can work in this page (rmpui/tools/rmpui.py)");
    const b = btn.querySelector(".anew"); if (b) b.remove();
    if (unseen && dr.hidden) btn.insertAdjacentHTML("beforeend", `<span class="anew">${unseen}</span>`);
    R("state").textContent = !live ? "· off" : paused ? "· paused" : running ? "· working…" : "· on";
    R("link").innerHTML = live ? "" : LOCAL ? `The agent link is off. Run <code>python3 serve.py</code> (in the rmpui folder) and reload this page.`
      : `The agent link needs rmpUI running on your own computer: clone it, run <code>python3 serve.py</code> and open <code>http://127.0.0.1:8004</code>. The editors work here without it.`;
  };
  for (const ev of ["focus", "pointerdown", "keydown"]) addEventListener(ev, () => (focusT = Date.now()), true);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) focusT = Date.now(); });
  // closing or reloading: the server stops giving this page commands at once (not after its last poll times out)
  addEventListener("pagehide", () => { try { fetch("/api/bye", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: PID }) }); } catch (e) {} });

  // ---- the feed
  function add(it) {
    it.t = new Date(); items.push(it); if (items.length > 200) items.shift();
    if (it.kind !== "you") lastReply = Date.now();
    if (dr.hidden && it.kind !== "you") unseen++;
    render(); mark(); return it;
  }
  function render() {
    keep();
    const box = R("feed"), atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
    box.innerHTML = "";
    if (!items.length) box.innerHTML = `<div class="dim" style="padding:8px 0">Nothing yet. An agent drives this page with <code>rmpui/tools/rmpui.py</code> (see rmpui/AGENT.md); what it does shows here, and you can undo any change.</div>`;
    for (const it of items) {
      const d = document.createElement("div"); d.className = `ait ${it.kind}${it.undone ? " undone" : ""}`;
      const who = { did: "agent did", said: "agent", asked: "agent asks", you: "you", err: "agent: failed" }[it.kind];
      d.innerHTML = `<div class="at"><span>${who} · ${it.t.toLocaleTimeString()}</span></div><div class="ab">${it.html}</div>`;
      if (it.kind === "did" && it.revert && !it.undone) {
        const u = Object.assign(document.createElement("button"), { className: "btn sm", textContent: "↩ Undo", title: "Undo this change" });
        u.onclick = async () => {
          try { await it.revert(); it.undone = true; add({ kind: "you", html: `undid: ${it.html}` }); userEdited({ kind: "undo", what: it.text }); }
          catch (e) { add({ kind: "err", html: "couldn't undo: " + esc(e.message) }); }
        };
        d.querySelector(".at").append(u);
      }
      if (it.kind === "did" && it.undone) d.querySelector(".at").insertAdjacentHTML("beforeend", `<i>undone</i>`);
      if (it.ask) d.append(askBox(it));
      if (it.kind === "you" && it.n) d.insertAdjacentHTML("beforeend", `<div class="seen">${it.read ? "✓ read by the agent" : "sent"}</div>`);
      box.append(d);
    }
    if (thinking()) box.insertAdjacentHTML("beforeend", `<div class="athink">${running ? "the agent is working" : "the agent is thinking"}<i></i><i></i><i></i></div>`);
    if (atEnd) box.scrollTop = box.scrollHeight;
  }
  function askBox(it) {
    const a = it.ask, w = document.createElement("div");
    if (a.answer != null) { w.className = "apicked"; w.textContent = "→ " + a.answer; return w; }
    if (a.expired && !a.late) w.insertAdjacentHTML("beforeend", `<div class="dim" style="font-size:11px">The agent stopped waiting; your answer still reaches it as a note.</div>`);
    const row = document.createElement("div"); row.className = "aopts";
    const give = (ans) => {
      a.answer = ans;
      if (a.expired) post("/api/answer", { question: it.text, answer: ans }).catch(() => {}); else a.resolve({ answer: ans });
      render();
    };
    for (const opt of a.options || []) { const b = Object.assign(document.createElement("button"), { className: "btn sm", textContent: opt }); b.onclick = () => give(opt); row.append(b); }
    if (a.input) {
      const inp = Object.assign(document.createElement("input"), { placeholder: a.options?.length ? "…or type an answer" : "Your answer" });
      const ok = Object.assign(document.createElement("button"), { className: "btn sm on", textContent: "Send" });
      ok.onclick = () => inp.value.trim() && give(inp.value.trim());
      inp.onkeydown = (e) => { if (e.key === "Enter") ok.onclick(); };
      row.append(inp, ok);
    }
    w.append(row); return w;
  }

  // ---- your notes, and your edits (so a waiting agent wakes up)
  async function sendNote() {
    const t = R("note").value.trim(); if (!t) return;
    try { const r = await post("/api/note", { text: t }); R("note").value = ""; add({ kind: "you", n: r.n, html: esc(t) + (agentInfo && agentInfo.listening ? "" : ` <span class="dim">(waiting: no agent is listening)</span>`) }); who(); }
    catch (e) { add({ kind: "err", html: "note not sent: the agent link is off" }); }
  }
  R("send").onclick = sendNote;
  R("note").onkeydown = (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendNote(); } e.stopPropagation(); };
  R("pause").onchange = () => { paused = R("pause").checked; mark(); add({ kind: "you", html: paused ? "paused the agent" : "let the agent go on" }); post("/api/event", { kind: paused ? "paused" : "resumed" }).catch(() => {}); };
  R("x").onclick = (e) => { e.preventDefault(); show(false); };
  function show(on) {
    if (on && o.beforeOpen) o.beforeOpen();
    dr.style.top = (document.querySelector("header")?.offsetHeight || 48) + "px";
    dr.hidden = !on; btn.classList.toggle("on", on);
    if (document.body.classList.contains("agent-open") !== on) { document.body.classList.toggle("agent-open", on); dispatchEvent(new Event("resize")); }
    if (on) { unseen = 0; render(); R("feed").scrollTop = R("feed").scrollHeight; }
    mark();
  }
  btn.onclick = () => show(dr.hidden);
  let lastEdit = 0, editTm = 0, editInfo = null;
  function userEdited(info) {
    if (!live || running) return;
    editInfo = info;
    const send = () => { lastEdit = Date.now(); post("/api/event", { kind: "edit", ...editInfo }).catch(() => {}); };
    clearTimeout(editTm);
    if (Date.now() - lastEdit > 3000) send(); else editTm = setTimeout(send, 3000);
  }

  // whether an agent is listening: a note reaches it at once, or waits in its inbox until it checks. Your notes are
  // marked read when the agent has them; from then until it answers or changes something, it's thinking.
  const pendingNote = () => items.some((it) => it.kind === "you" && it.n && !it.read);
  function thinking() { return !!readAt && readAt > lastReply && Date.now() - readAt < 15 * 60e3; }
  async function who() {
    if (live) try { agentInfo = (await post("/api/status", {})).agent; } catch (e) { agentInfo = null; }
    let fresh = false;
    if (agentInfo) for (const it of items) if (it.kind === "you" && it.n && !it.read && agentInfo.read >= it.n) { it.read = true; fresh = true; }
    if (fresh) { readAt = Date.now(); render(); mark(); }
    const el = R("who"), a = agentInfo, ago = a && a.seen ? (Date.now() / 1000 - a.seen) : 1e9;
    el.innerHTML = !live ? "" : a && a.listening ? `<span style="color:#78e68c">● An agent is listening</span>: it gets your note right away.`
      : `<span style="color:#ffb35f">● No agent is listening</span>${ago < 3600 ? ` (last active ${ago < 90 ? "just now" : Math.round(ago / 60) + " min ago"})` : ""}: your note waits until one checks. Tell your agent in its chat to read the inbox.`;
  }
  // every 5 s; every second while a note is on its way or the agent is thinking about one
  let lastWho = 0;
  setInterval(() => { if (document.hidden) return; const fast = pendingNote() || thinking(); if (fast || Date.now() - lastWho > 4900) { lastWho = Date.now(); who(); } if (!fast && readAt && !thinking()) { readAt = 0; render(); } }, 1000);
  setTimeout(who, 800);

  // ---- the commands every page has
  const base = {
    say: async ({ text }) => { add({ kind: "said", html: esc(text).replace(/\n/g, "<br>"), text }); return { ok: true }; },
    ask: ({ text, options, input }, ctx) => new Promise((resolve) => {
      const it = add({ kind: "asked", html: esc(text).replace(/\n/g, "<br>"), text, ask: { options: (options || []).map(String), input: !!input || !(options || []).length, resolve } });
      if (dr.hidden) show(true);
      const left = ctx.deadline - Date.now() - 1500;
      setTimeout(() => { if (it.ask.answer == null) { it.ask.expired = true; render(); resolve({ error: "no answer yet (the user can still answer: it comes as a note in the inbox)" }); } }, Math.max(1000, left));
    }),
  };
  const ops = { ...base, ...o.ops };

  // ---- the link: wait for a command, carry it out, answer (only where serve.py can be: this machine)
  if (LOCAL) (async () => {
    for (;;) {
      let r;
      if (!live) try { await post("/api/status", {}); live = true; mark(); } catch (e) { await sleep(e.status ? 15000 : 4000); continue; }
      try { r = await post("/api/next", { page: PID, visible: !document.hidden, focus: focusT, title: document.title, ops: Object.keys(ops) }); if (!live) { live = true; mark(); } }
      catch (e) { if (live) { live = false; mark(); } await sleep(e.status ? 15000 : 4000); continue; }
      const c = r && r.cmd; if (!c) continue;
      let result;
      const ctx = {
        deadline: c.deadline,
        change: (label, revert) => add({ kind: "did", html: esc(label), text: label, revert }),
        say: (t) => add({ kind: "said", html: esc(t), text: t }),
      };
      if (paused) result = { error: "the user has paused the agent link (the 🤖 Agent panel): wait, or check the inbox" };
      else if (!ops[c.op]) result = { error: `no such command: ${c.op} (${Object.keys(ops).join(", ")})` };
      else {
        running++; mark();
        try { result = (await ops[c.op](c.args || {}, ctx)) ?? { ok: true }; }
        catch (e) { result = { error: e.message }; add({ kind: "err", html: `${esc(c.op)}: ${esc(e.message)}` }); }
        finally { running--; mark(); }
      }
      try { await post("/api/result", { id: c.id, result }); } catch (e) {}
    }
  })();
  render(); mark();
  return { userEdited, busy: () => running > 0, show, add };
}
