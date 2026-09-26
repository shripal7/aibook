# aiBook — Android app

Native **Kotlin + Jetpack Compose** client for aiBook, at full feature parity with the web demo:
library catalog, an auto-advancing narrated **beats feed**, grounded **chat with citations and a
spoiler gate**, on-demand/auto **visualize**, live **agent personas**, an end-of-read **recap
quiz**, and the **RPG receipts** audit drawer.

It talks to the aiBook **Cloudflare Worker** (`../aibook-worker`), which serves both `/api/*` and
the `/media/*` images from one origin.

## Architecture

- **UI:** Jetpack Compose (Material 3), Navigation-Compose (`catalog` → `reader/{titleId}`).
- **State:** MVVM — `CatalogViewModel`, `ReaderViewModel` (mirrors the web `session.ts` + feed
  state). The RPG audit log accumulates client-side from the `audit_entry` returned by each
  chat/visualize/agent call.
- **Networking:** Retrofit + OkHttp + kotlinx.serialization (`AiBookApi`, `AiBookRepository`).
- **Images:** Coil; `MediaUrl.resolve()` turns server-relative `/media/...` paths into absolute
  URLs against the configured base URL.
- **DI:** Hilt (`NetworkModule`).

## Configure the backend URL

The base URL comes from `BuildConfig.API_BASE_URL`:

- **Debug** build (default): `http://10.0.2.2:8787` — the Android emulator's route to the host
  running `wrangler dev` (see `../aibook-worker`). Cleartext to `10.0.2.2` is allowed via
  `res/xml/network_security_config.xml`.
- **Release** build: reads `AIBOOK_API_BASE_URL` from `gradle.properties`. Set it to your deployed
  Worker, e.g. `https://aibook-api.<subdomain>.workers.dev`.

Override per build without editing files:
```bash
./gradlew assembleRelease -PAIBOOK_API_BASE_URL=https://aibook-api.your-subdomain.workers.dev
```

## Build & run

1. Start the backend: `cd ../aibook-worker && npm install && npm run dev`.
2. Open `aibook-android/` in **Android Studio** (Ladybug or newer) and let it sync — this
   provisions the Gradle wrapper and SDK. Then Run on an emulator (API 26+).
   - CLI alternative (once an Android SDK + `local.properties` with `sdk.dir` exist and the wrapper
     jar is generated via `gradle wrapper`): `./gradlew assembleDebug`.

## Notes / parity

- Personas are gated exactly like the web app: `narrator` and `opportunity` are always available;
  the rest unlock when `GET /api/agents/status` reports `ollama_reachable: true` (the Worker
  reports Workers-AI availability under that field name).
- Auto-advance reveals the next beat every 4s; toggle it off in the progress header for manual
  "Continue" pacing (here: the timer simply pauses and you send/scroll manually).
- `franklin` is the complete hero title (all art present). `harness` / `ai-engineering` reference
  images that aren't shipped, so their visuals fall back to "No scene available."
