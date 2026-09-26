#!/usr/bin/env python3
"""Push all aiBook content (title metadata, per-book data, and media) into the CONTENT KV
namespace, so the Worker serves everything dynamically (no redeploy to add a book).

Usage:
    python3 scripts/upload-content.py            # upload everything
    python3 scripts/upload-content.py <id> ...   # upload only these book ids (+ their media)

Reads from src/data/ and public/media/. Requires wrangler (authenticated).
"""
import base64, json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "src", "data")
MEDIA = os.path.join(ROOT, "public", "media")
NAMESPACE_ID = "1483a459d87f4a93943ce02c9d7e4809"  # CONTENT (see wrangler.toml)

def load(path):
    with open(path) as f:
        return json.load(f)

def book_blob(bid, vault_bytes):
    d = os.path.join(DATA, bid)
    opp = os.path.join(d, "opportunities.json")
    seed = os.path.join(d, "audit_seed.json")
    return {
        "vault_bytes": vault_bytes,
        "beats": load(os.path.join(d, "beats.json"))["beats"],
        "chat_qa": load(os.path.join(d, "chat_qa.json")),
        "visuals": load(os.path.join(d, "visuals.json"))["scenes"],
        "visual_bible": load(os.path.join(d, "visual_bible.json")),
        "recap_quiz": load(os.path.join(d, "recap_quiz.json")),
        "personas": load(os.path.join(d, "personas.json"))["personas"],
        "opportunities": load(opp) if os.path.exists(opp) else None,
        "audit_seed": load(seed)["entries"] if os.path.exists(seed) else [],
    }

def main():
    only = set(sys.argv[1:])
    titles = load(os.path.join(DATA, "titles.json"))["titles"]
    entries = []  # {key, value, base64?}

    for t in titles:
        bid = t["id"]
        if only and bid not in only:
            continue
        entries.append({"key": f"meta:{bid}", "value": json.dumps(t)})
        if os.path.isdir(os.path.join(DATA, bid)):  # unlocked -> has data
            vault = (t.get("rights") or {}).get("vault_bytes", 0)
            entries.append({"key": f"book:{bid}", "value": json.dumps(book_blob(bid, vault))})

    # media (all, or only for the selected books)
    for root, _dirs, files in os.walk(MEDIA):
        for fn in files:
            fp = os.path.join(root, fn)
            rel = os.path.relpath(fp, MEDIA)  # e.g. franklin/bible/cover.png
            top = rel.split(os.sep)[0]
            if only and top not in only:
                continue
            with open(fp, "rb") as f:
                entries.append({"key": f"media:{rel}", "value": base64.b64encode(f.read()).decode(), "base64": True})

    print(f"Prepared {len(entries)} KV entries", f"(filter: {sorted(only)})" if only else "(all)")
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
        json.dump(entries, tf)
        bulk = tf.name
    try:
        cmd = ["npx", "wrangler", "kv", "bulk", "put", bulk, "--namespace-id", NAMESPACE_ID]
        r = subprocess.run(cmd, cwd=ROOT, env={**os.environ, "WRANGLER_SEND_METRICS": "false"})
        sys.exit(r.returncode)
    finally:
        os.unlink(bulk)

if __name__ == "__main__":
    main()
