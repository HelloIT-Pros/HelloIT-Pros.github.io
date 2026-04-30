# Scripts

## `encrypt-framework.py`

Re-encrypts the content framework page so only Felipe (HelloIT Pros) and Prakash can access it.

### How it works

- **Source of truth:** `Noonshop/content-framework.source.html` — editable plaintext, **gitignored**.
- **Distributable:** `Noonshop/content-framework.html` — committed, encrypted with AES-256-GCM, password-derived key (PBKDF2-HMAC-SHA256, 250,000 iterations).
- A password gate page is shown to anyone opening the URL. Only after the correct password is entered does the browser decrypt the body and render the framework.

### Usage

```bash
# From the Noonshop directory:
python3 scripts/encrypt-framework.py "your-strong-password"
```

### Editing the framework

1. Edit `Noonshop/content-framework.source.html` as normal.
2. Re-run the encryption: `python3 scripts/encrypt-framework.py "your-password"`.
3. Commit the resulting `content-framework.html` (the source is gitignored).

### Password sharing

Share the password **out-of-band only** (1Password, Signal, in-person). Never commit it. Never include it in commit messages, issue titles, or Slack messages.

### Threat model — what this protects against

- **Casual scraping** — anyone visiting the URL sees a password prompt, not the content.
- **Search engine indexing** — `noindex, nofollow` meta + encrypted body = nothing for crawlers to index.
- **View Source** — the HTML source contains only ciphertext + the gate page; the framework content is not visible without the password.

### What this does NOT protect against

- **Brute force on a weak password.** Use a strong passphrase. The PBKDF2 iteration count slows brute force, but a short password is still recoverable.
- **A leaked password.** If the password is shared widely, the encryption is moot. Rotate by re-running the script with a new password and re-distributing.
- **Malware on a recipient's machine.** Once decrypted in the browser, the content is in plain DOM and can be read by anything running on that machine.

### Rotating the password

1. Run `python3 scripts/encrypt-framework.py "new-password"`.
2. Commit the new `content-framework.html`.
3. Distribute the new password to authorised recipients.
