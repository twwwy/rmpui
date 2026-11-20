"""Serve rmpui/ on 127.0.0.1:8004 with caching off (an edited file always reloads), and the agent link.

The agent link: an agent (tools/rmpui.py) sends a command; the sketch page open in your browser carries it out where
you can see it, and answers. The library lives in that browser, so the page does the work and the server only passes
messages:

  POST /api/cmd    {op, args, timeout}  agent -> waits for the page's answer
  POST /api/next   {page, visible, focus}  page -> the next command for it (long poll)
  POST /api/result {id, result}  page -> the answer
  POST /api/note   {text}  page -> a note you typed for the agent
  POST /api/event  {kind, ...}  page -> something you did (an edit), so a waiting agent wakes up
  POST /api/inbox  {wait}  agent -> your notes and edits since it last asked (waits up to `wait` s for one)
  POST /api/status {}  -> the pages that are open and the queue

Only this machine: bound to 127.0.0.1; every API call must be a JSON POST whose Host (and Origin, when a browser sends
one) is this server, so another website can't drive it (a cross-site JSON POST needs a preflight this server never
grants)."""
import functools, http.server, itertools, json, os, threading, time

PORT = 8004
HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}
ORIGINS = {f"http://{h}" for h in HOSTS}

cv = threading.Condition()
queue = []        # commands no page has taken yet: {id, op, args, deadline}
results = {}      # id -> the page's answer
pages = {}        # page id -> {seen, visible, focus, title}
inbox = []        # {n, t, kind: "note" | "edit" | ..., ...}
agent_read = 0    # the agent has seen inbox entries up to this n
agent_seen = 0.0  # when an agent last called
agent_waiting = 0 # agent calls waiting right now (a command, an ask, an inbox --wait): it hears you at once
seq = itertools.count(1)
nseq = itertools.count(1)


def live_pages():
    now = time.time()
    return {k: v for k, v in pages.items() if now - v["seen"] < 40 and not v.get("gone")}


def can(page, op):
    ops = page.get("ops")
    return ops is None or op in ops


def leader(op=None):
    """The page that runs a command: of the pages that know it (the sketch editor, the plugin board...), a visible
    one, the one you used last."""
    live = {k: v for k, v in live_pages().items() if op is None or can(v, op)}
    if not live:
        return None
    return max(live, key=lambda k: (bool(live[k].get("visible")), live[k].get("focus", 0), live[k]["seen"]))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if not str(args[0] if args else "").startswith("POST /api/"):   # the page polls all the time: keep the log quiet
            super().log_message(fmt, *args)

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not self.path.startswith("/api/"):
            return self._json(404, {"error": "not found"})
        if self.headers.get("Host") not in HOSTS:
            return self._json(403, {"error": "wrong host"})
        origin = self.headers.get("Origin")
        if origin is not None and origin not in ORIGINS:
            return self._json(403, {"error": "wrong origin"})
        if not (self.headers.get("Content-Type") or "").startswith("application/json"):
            return self._json(415, {"error": "JSON only"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}") if n else {}
        except Exception:
            return self._json(400, {"error": "bad JSON"})
        fn = getattr(self, "api_" + self.path[5:].split("?")[0], None)
        if not fn:
            return self._json(404, {"error": "no such call"})
        try:
            self._json(200, fn(body))
        except (BrokenPipeError, ConnectionResetError):
            pass

    # ---- the agent
    def api_cmd(self, b):
        global agent_seen, agent_waiting
        with cv:
            agent_seen = time.time(); agent_waiting += 1
        try:
            return self._cmd(b)
        finally:
            with cv:
                agent_seen = time.time(); agent_waiting -= 1

    def _cmd(self, b):
        op, args = str(b.get("op") or ""), b.get("args") or {}
        timeout = max(1.0, min(3600.0, float(b.get("timeout") or 60)))
        with cv:
            end = time.time() + min(6.0, timeout)
            while not live_pages() and time.time() < end:   # a page that just reloaded comes back within a poll
                cv.wait(end - time.time())
            if not live_pages():
                return {"error": f"no rmpui page is open: open http://127.0.0.1:{PORT}/sketch.html in your browser"}
            if not leader(op):
                where = "board.html (the plugin board)" if op.startswith("board_") else "sketch.html (the sketch editor)"
                return {"error": f"no open page does {op}: open http://127.0.0.1:{PORT}/{where}"}
            cid = next(seq)
            queue.append({"id": cid, "op": op, "args": args, "deadline": time.time() + timeout})
            cv.notify_all()
            end = time.time() + timeout
            while cid not in results and time.time() < end:
                cv.wait(end - time.time())
            if cid in results:
                return results.pop(cid)
            queue[:] = [c for c in queue if c["id"] != cid]
            return {"error": f"timed out after {timeout:.0f} s (is the sketch page open, and not paused?)"}

    def api_inbox(self, b):
        global agent_read, agent_seen, agent_waiting
        wait = max(0.0, min(3600.0, float(b.get("wait") or 0)))
        with cv:
            agent_seen = time.time(); agent_waiting += 1
            try:
                return self._inbox(wait)
            finally:
                agent_seen = time.time(); agent_waiting -= 1

    def _inbox(self, wait):
        global agent_read
        if True:
            end = time.time() + wait
            while not any(e["n"] > agent_read for e in inbox) and time.time() < end:
                cv.wait(end - time.time())
            new = [e for e in inbox if e["n"] > agent_read]
            if new:
                agent_read = new[-1]["n"]
            return {"items": new}

    def api_status(self, b):
        with cv:
            lead = leader()
            return {"pages": [{"page": k, **{a: b for a, b in v.items() if a != "ops"}, "leader": k == lead} for k, v in live_pages().items()],
                    "queued": len(queue), "unread": sum(1 for e in inbox if e["n"] > agent_read),
                    "agent": {"listening": agent_waiting > 0, "seen": agent_seen, "read": agent_read}}

    # ---- the page
    def api_next(self, b):
        pid = str(b.get("page") or "")
        if not pid:
            return {"error": "no page id"}
        with cv:
            ops = b.get("ops")
            pages[pid] = {"seen": time.time(), "visible": bool(b.get("visible")), "focus": float(b.get("focus") or 0),
                          "title": str(b.get("title") or "")[:80],
                          "ops": [str(o)[:40] for o in ops][:100] if isinstance(ops, list) else None}
            cv.notify_all()
            end = time.time() + 20
            while True:
                now = time.time()
                if pages[pid].get("gone"):
                    return {"cmd": None}
                queue[:] = [c for c in queue if c["deadline"] > now]
                c = next((c for c in queue if leader(c["op"]) == pid), None)
                if c:
                    queue.remove(c)
                    return {"cmd": {"id": c["id"], "op": c["op"], "args": c["args"], "deadline": c["deadline"] * 1000}}
                if now >= end:
                    return {"cmd": None}
                cv.wait(min(1.0, end - now))
                pages[pid]["seen"] = time.time()

    def api_bye(self, b):   # the page is closing or reloading
        with cv:
            if str(b.get("page")) in pages:
                pages[str(b.get("page"))]["gone"] = True
            cv.notify_all()
        return {"ok": True}

    def api_result(self, b):
        with cv:
            results[int(b.get("id") or 0)] = b.get("result") if isinstance(b.get("result"), dict) else {"value": b.get("result")}
            cv.notify_all()
        return {"ok": True}

    def _post(self, kind, b):
        with cv:
            e = {k: v for k, v in b.items() if k not in ("n", "t", "kind")}
            n = next(nseq)
            inbox.append({"n": n, "t": time.time(), "kind": kind, **e})
            del inbox[:-500]
            cv.notify_all()
        return {"ok": True, "n": n}

    def api_note(self, b):
        return self._post("note", {"text": str(b.get("text") or "")[:4000]})

    def api_event(self, b):
        return self._post(str(b.get("kind") or "edit")[:20], {k: v for k, v in b.items() if k != "kind"})

    def api_answer(self, b):   # an ask answered after the agent stopped waiting: kept for it as a note
        return self._post("answer", b)


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Handler, directory=here))
    srv.daemon_threads = True
    print(f"rmpui on http://127.0.0.1:{PORT}/ (agent link: tools/rmpui.py)")
    srv.serve_forever()
