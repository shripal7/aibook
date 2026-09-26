# Adding a book (no redeploy)

Book content lives in the **CONTENT KV namespace**, and the Worker reads it at request time.
Adding, editing, or removing a book is just writing/deleting KV keys — **you do not redeploy
the Worker** (you only redeploy when you change Worker *code*). New/updated content is visible
within ~60s (a small per-isolate cache TTL), and immediately on a cold isolate.

## KV key layout
| Key | Value |
|-----|-------|
| `meta:<id>` | the catalog entry (Title JSON) — exists for every title, including locked/decorative ones |
| `book:<id>` | the full `BookData` blob (beats, chat_qa, visuals, visual_bible, recap_quiz, personas, opportunities, audit_seed, vault_bytes) — **unlocked titles only** |
| `media:<path>` | raw image bytes; `<path>` is what follows `/media/` (e.g. `econ-basics/bible/cover.png`) |

The catalog is built by listing `meta:` keys, so a title appears as soon as its `meta:` key exists.

## The easy way (recommended)
1. Author the book under `src/data/<id>/`:
   `beats.json`, `chat_qa.json`, `visuals.json`, `visual_bible.json`, `recap_quiz.json`,
   `personas.json` (and optional `opportunities.json`, `audit_seed.json`).
2. Add its art under `public/media/<id>/…` (cover + scenes + visual-bible refs). See
   `scripts/` for how the demo art was generated, or reuse another title's paths.
3. Add a catalog entry to `src/data/titles.json` (`id`, `title`, `author`, `year`, `cover`,
   `locked: false`, `category`, `rights.vault_bytes`, `reader_state.beat_position`).
4. Upload just that book (and its media) to KV:
   ```bash
   python3 scripts/upload-content.py <id>
   ```
   Re-run with no arguments to upload everything.

That's it — the Android, iOS, and web clients show it on next launch. No `wrangler deploy`.

## Locked/decorative titles
Give them only a `meta:<id>` (with `locked: true`) and a cover under `media:`. With no
`book:<id>`, the data endpoints correctly 404 and the app shows a "Coming soon" tile.

## Removing a book
```bash
wrangler kv key delete --namespace-id <CONTENT id> "meta:<id>"
wrangler kv key delete --namespace-id <CONTENT id> "book:<id>"
# plus any media:<id>/... keys
```

## Notes
- Content-only changes never need a deploy; **Worker code changes do** (`npm run deploy`).
- `src/data/` and `public/media/` are the human-editable source of truth; KV is what the Worker
  reads. Keep them in sync by re-running the upload script.
