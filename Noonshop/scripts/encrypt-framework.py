#!/usr/bin/env python3
"""
Encrypt the Noonshop content framework HTML for internal-only access.

Reads:  content-framework.source.html  (the editable source — gitignored)
Writes: content-framework.html         (the encrypted distributable)

The body of the source HTML is encrypted with AES-256-GCM. A password prompt
runs client-side using Web Crypto API; the page only renders after a correct
password decrypts the body in the browser.

Usage:
    python3 scripts/encrypt-framework.py "your-password"

The password is shared out-of-band with the intended audience (Felipe + Prakash).
"""

import sys
import os
import base64
import secrets
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

PBKDF2_ITERATIONS = 250_000  # OWASP recommended minimum (2024) for SHA-256
SALT_LEN = 16
IV_LEN = 12  # AES-GCM standard


def derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
    )
    return kdf.derive(password.encode("utf-8"))


def encrypt_body(body: str, password: str) -> dict:
    salt = secrets.token_bytes(SALT_LEN)
    iv = secrets.token_bytes(IV_LEN)
    key = derive_key(password, salt)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(iv, body.encode("utf-8"), None)
    return {
        "salt": base64.b64encode(salt).decode(),
        "iv": base64.b64encode(iv).decode(),
        "ciphertext": base64.b64encode(ciphertext).decode(),
        "iterations": PBKDF2_ITERATIONS,
    }


def build_encrypted_html(payload: dict, original_head: str, original_title: str) -> str:
    """Produce a self-contained encrypted HTML page."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>{original_title}</title>
<style>
*, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ height: 100%; }}
body {{
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  background: #080808;
  color: #e8e0d4;
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px;
  -webkit-font-smoothing: antialiased;
}}
.gate {{
  width: 100%;
  max-width: 420px;
  text-align: center;
}}
.gate-mark {{
  font-family: 'Bebas Neue', 'Helvetica Neue', sans-serif;
  font-size: 11px;
  letter-spacing: .36em;
  text-transform: uppercase;
  color: #c8b89a;
  margin-bottom: 18px;
}}
.gate-title {{
  font-family: 'Bebas Neue', 'Helvetica Neue', sans-serif;
  font-weight: 400;
  font-size: 36px;
  letter-spacing: .04em;
  color: #f5f0ea;
  margin-bottom: 8px;
}}
.gate-sub {{
  font-size: 14px;
  font-style: italic;
  color: rgba(245,240,234,.55);
  margin-bottom: 36px;
  line-height: 1.5;
}}
.gate-form {{
  display: flex; flex-direction: column; gap: 12px;
}}
.gate-input {{
  width: 100%;
  background: #0d0d0d;
  border: 1px solid rgba(200,184,154,.3);
  color: #e8e0d4;
  padding: 14px 16px;
  font-size: 15px;
  font-family: ui-monospace, monospace;
  letter-spacing: .05em;
  border-radius: 4px;
  outline: none;
  transition: border-color .2s;
}}
.gate-input:focus {{ border-color: #c8b89a; }}
.gate-button {{
  background: #c8b89a;
  color: #080808;
  border: 0;
  padding: 14px 16px;
  font-family: 'Bebas Neue', 'Helvetica Neue', sans-serif;
  font-size: 13px;
  letter-spacing: .22em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 4px;
  transition: background .15s, transform .15s;
}}
.gate-button:hover {{ background: #d8c9a9; }}
.gate-button:active {{ transform: translateY(1px); }}
.gate-button[disabled] {{ opacity: .5; cursor: not-allowed; }}
.gate-error {{
  font-size: 12px;
  color: #c47878;
  min-height: 18px;
  margin-top: 4px;
  letter-spacing: .04em;
}}
.gate-foot {{
  font-size: 10px;
  letter-spacing: .22em;
  text-transform: uppercase;
  color: rgba(200,184,154,.35);
  margin-top: 36px;
}}
.spinner {{
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid rgba(8,8,8,.3); border-top-color: #080808;
  border-radius: 50%;
  animation: spin .6s linear infinite;
  vertical-align: -3px;
  margin-right: 8px;
}}
@keyframes spin {{ to {{ transform: rotate(360deg); }} }}
</style>
</head>
<body>
<div class="gate" id="gate">
  <div class="gate-mark">HelloIT Pros · Internal</div>
  <h1 class="gate-title">Restricted Access</h1>
  <p class="gate-sub">This document is internal to Noonshop and HelloIT Pros.<br>Enter the access password to continue.</p>
  <form class="gate-form" id="gateForm" autocomplete="off">
    <input class="gate-input" id="passwordInput" type="password" placeholder="Password" autocomplete="off" autofocus>
    <button class="gate-button" id="submitBtn" type="submit">Unlock</button>
    <div class="gate-error" id="errorMsg" aria-live="polite"></div>
  </form>
  <div class="gate-foot">v1.0 · Apr 2026</div>
</div>

<script>
const PAYLOAD = {{
  salt: "{payload['salt']}",
  iv: "{payload['iv']}",
  ciphertext: "{payload['ciphertext']}",
  iterations: {payload['iterations']}
}};

function b64ToBytes(b64) {{
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}}

async function deriveKey(password, salt, iterations) {{
  const enc = new TextEncoder();
  const passKey = await crypto.subtle.importKey(
    "raw", enc.encode(password), {{ name: "PBKDF2" }}, false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {{ name: "PBKDF2", salt, iterations, hash: "SHA-256" }},
    passKey,
    {{ name: "AES-GCM", length: 256 }},
    false,
    ["decrypt"]
  );
}}

async function decryptAndRender(password) {{
  const salt = b64ToBytes(PAYLOAD.salt);
  const iv = b64ToBytes(PAYLOAD.iv);
  const ct = b64ToBytes(PAYLOAD.ciphertext);
  const key = await deriveKey(password, salt, PAYLOAD.iterations);
  const plaintext = await crypto.subtle.decrypt({{ name: "AES-GCM", iv }}, key, ct);
  const html = new TextDecoder().decode(plaintext);

  // Try to remember the password for this browser session (sessionStorage)
  try {{ sessionStorage.setItem('noonshop-fw-pw', password); }} catch(e) {{}}

  // Replace the entire document with the decrypted content. We rebuild the
  // <html>/<head>/<body> via document.open/write so that the original page's
  // styles and scripts run as intended.
  document.open();
  document.write(html);
  document.close();
}}

const form = document.getElementById('gateForm');
const input = document.getElementById('passwordInput');
const btn = document.getElementById('submitBtn');
const err = document.getElementById('errorMsg');

async function attempt(password) {{
  err.textContent = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Decrypting…';
  try {{
    await decryptAndRender(password);
  }} catch (e) {{
    btn.disabled = false;
    btn.innerHTML = 'Unlock';
    err.textContent = 'Incorrect password.';
    input.value = '';
    input.focus();
  }}
}}

form.addEventListener('submit', (e) => {{
  e.preventDefault();
  const pw = input.value;
  if (!pw) return;
  attempt(pw);
}});

// Try cached session password (so a refresh during a session doesn't re-prompt)
(async () => {{
  try {{
    const cached = sessionStorage.getItem('noonshop-fw-pw');
    if (cached) await attempt(cached);
  }} catch(e) {{}}
}})();
</script>
</body>
</html>
"""


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/encrypt-framework.py <password>", file=sys.stderr)
        sys.exit(1)

    password = sys.argv[1]
    if len(password) < 8:
        print("Password must be at least 8 characters.", file=sys.stderr)
        sys.exit(1)

    here = Path(__file__).resolve().parent.parent  # Noonshop/
    src = here / "content-framework.source.html"
    dst = here / "content-framework.html"

    if not src.exists():
        print(f"Source file not found: {src}", file=sys.stderr)
        print("Move the editable HTML to content-framework.source.html before running.", file=sys.stderr)
        sys.exit(1)

    body = src.read_text(encoding="utf-8")

    # Pull out the title for a nicer locked-page <title>
    title = "Noon Shop — Restricted"
    import re
    m = re.search(r"<title>(.*?)</title>", body, re.IGNORECASE | re.DOTALL)
    if m:
        title = m.group(1).strip()

    payload = encrypt_body(body, password)
    out = build_encrypted_html(payload, "", title)
    dst.write_text(out, encoding="utf-8")

    src_size = len(body)
    dst_size = len(out)
    print(f"Encrypted: {src} ({src_size:,} chars) → {dst} ({dst_size:,} chars)")
    print(f"Password length: {len(password)} chars · Iterations: {PBKDF2_ITERATIONS:,}")
    print("Done. Share the password with Prakash out-of-band (1Password, Signal, etc.).")


if __name__ == "__main__":
    main()
