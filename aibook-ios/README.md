# aiBook — iOS app

Native **SwiftUI** client for aiBook, at full feature parity with the Android app and web:
library catalog, an auto-advancing narrated **beats feed** with citations, on-demand
**visualize**, spoiler-gated **chat**, live **agent personas**, an end-of-read **recap quiz**,
and the **RPG receipts** audit drawer. It talks to the same live Cloudflare Worker.

## Requirements
- **Xcode 15+** (iOS 16.0 deployment target). Full Xcode, not just Command Line Tools.

## Run
```bash
open aiBook.xcodeproj      # then pick an iOS Simulator and press Run (⌘R)
```
The project is committed, so this works out of the box. If you change the file list, regenerate
with [XcodeGen](https://github.com/yonaskolb/XcodeGen): `brew install xcodegen && xcodegen generate`.

## Architecture
- **SwiftUI + async/await.** `CatalogView` → `ReaderView` via `NavigationStack`.
- **`APIClient`** — `URLSession` + `JSONDecoder(.convertFromSnakeCase)`; one base URL.
- **`ReaderViewModel`** (`@MainActor ObservableObject`) mirrors the Android reader state: beats,
  auto-advance task, feed items, personas, per-session RPG audit accumulated from each response.
- **`MediaURL`** resolves server-relative `/media/...` paths for `AsyncImage`.

## Backend URL
Set in `aiBook/Sources/Config.swift` (`Config.baseURL`). Defaults to the deployed Worker
`https://aibook-api.shri007modani.workers.dev`, so the app works with nothing else running.
