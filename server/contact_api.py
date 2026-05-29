#!/usr/bin/env python3
import json
import os
import ssl
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "0.0.0.0"
PORT = int(os.getenv("CONTACT_API_PORT", "8443"))
ENV_PATH = Path(os.getenv("CONTACT_ENV_PATH", "/opt/trbkwsk_site/.env"))
CERT_PATH = Path(os.getenv("CONTACT_CERT_PATH", "/root/.acme.sh/ultrat0rb.trbkwsk.com_ecc/fullchain.cer"))
KEY_PATH = Path(os.getenv("CONTACT_KEY_PATH", "/root/.acme.sh/ultrat0rb.trbkwsk.com_ecc/ultrat0rb.trbkwsk.com.key"))
ALLOWED_ORIGINS = {
    "https://www.trbkwsk.com",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
}
MAX_BODY_BYTES = 16 * 1024
MAX_FIELD_LENGTH = 4000
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_COUNT = 5
REQUEST_LOG = {}


def load_env(path):
    values = {}
    if path.exists():
        for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


ENV = load_env(ENV_PATH)
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN") or ENV.get("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID") or ENV.get("TELEGRAM_CHAT_ID")


def clean(value):
    return str(value or "").strip()[:MAX_FIELD_LENGTH]


def rate_limited(ip):
    now = time.time()
    bucket = [t for t in REQUEST_LOG.get(ip, []) if now - t < RATE_LIMIT_WINDOW]
    if len(bucket) >= RATE_LIMIT_COUNT:
        REQUEST_LOG[ip] = bucket
        return True
    bucket.append(now)
    REQUEST_LOG[ip] = bucket
    return False


class ContactHandler(BaseHTTPRequestHandler):
    server_version = "TORBContactAPI/1.0"

    def end_headers(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            return self.send_json(200, {"ok": True})
        return self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/api/contact":
            return self.send_json(404, {"error": "Not found"})
        if not BOT_TOKEN or not CHAT_ID:
            return self.send_json(500, {"error": "Contact endpoint is not configured"})
        if rate_limited(self.client_address[0]):
            return self.send_json(429, {"error": "Too many requests"})

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.send_json(400, {"error": "Invalid content length"})
        if length <= 0 or length > MAX_BODY_BYTES:
            return self.send_json(400, {"error": "Invalid request size"})

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError:
            return self.send_json(400, {"error": "Invalid JSON"})

        name = clean(payload.get("name"))
        email = clean(payload.get("email"))
        message = clean(payload.get("message"))
        page = clean(payload.get("page"))
        if not name or not email or not message:
            return self.send_json(400, {"error": "Name, email, and message are required"})

        text = "\n".join(filter(None, [
            "New message from trbkwsk.com",
            "",
            f"Name: {name}",
            f"Email: {email}",
            f"Page: {page}" if page else "",
            "",
            message,
        ]))

        req = urllib.request.Request(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
            data=json.dumps({"chat_id": CHAT_ID, "text": text}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status >= 400:
                    return self.send_json(502, {"error": "Telegram delivery failed"})
        except urllib.error.URLError:
            return self.send_json(502, {"error": "Telegram delivery failed"})

        return self.send_json(200, {"ok": True})

    def log_message(self, fmt, *args):
        print("%s - - [%s] %s" % (self.address_string(), self.log_date_time_string(), fmt % args))


def main():
    httpd = ThreadingHTTPServer((HOST, PORT), ContactHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=str(CERT_PATH), keyfile=str(KEY_PATH))
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    print(f"Contact API listening on https://{HOST}:{PORT}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
