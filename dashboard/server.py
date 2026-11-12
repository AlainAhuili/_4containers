"""Dashboard: serves the UI and reports the health of the other containers."""
import json
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SERVICES = {
    "paint": os.environ.get("PAINT_URL", "http://paint:80/"),
    "console": os.environ.get("CONSOLE_URL", "http://console:7681/"),
    "whiteboard": os.environ.get("WHITEBOARD_URL", "http://whiteboard:80/"),
}
STARTED = time.time()
HERE = os.path.dirname(os.path.abspath(__file__))


def probe(item):
    name, url = item
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=2) as r:
            ok = 200 <= r.status < 400
            code = r.status
    except Exception as e:  # noqa: BLE001 - any failure means "down"
        return name, {"up": False, "error": type(e).__name__, "ms": None}
    return name, {"up": ok, "code": code, "ms": round((time.perf_counter() - t0) * 1000)}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/api/status"):
            with ThreadPoolExecutor(len(SERVICES)) as ex:
                results = dict(ex.map(probe, SERVICES.items()))
            results["dashboard"] = {"up": True, "uptime_s": round(time.time() - STARTED)}
            self._send(200, json.dumps(results).encode(), "application/json")
        elif self.path in ("/", "/index.html"):
            with open(os.path.join(HERE, "index.html"), "rb") as f:
                self._send(200, f.read(), "text/html; charset=utf-8")
        elif self.path == "/healthz":
            self._send(200, b"ok", "text/plain")
        else:
            self._send(404, b"not found", "text/plain")

    def log_message(self, fmt, *args):
        if not self.path.startswith("/api/status"):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    print("dashboard listening on :8080")
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
