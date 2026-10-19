# Learned Media

Learn topics with AI-generated, Wikipedia-grounded fact cards and a curated video library. Use the website or the native macOS app.

## Website

[Open Learned Media on GitHub Pages](https://stiwarilbj.github.io/Learned_Media/)

### Get started

1. Open **Settings**, connect Gemini, then choose topics and press **Start learning**.
2. Open **Videos** to browse the approved creator and video catalog.
3. To import or refresh videos, add a YouTube Data API v3 key in Settings.

Gemini is needed for new facts, explanations, questions, and smart video search. The YouTube key is needed to import or refresh the catalog.

Connecting checks only `gemini-3.5-flash-lite` and `gemini-3.1-flash-lite`; both must pass. Facts and questions try the available models once, then recover from temporary failures with two cycles of three alternating Flash Lite pairs followed by the remaining models. Requests run sequentially, honor cooldowns, and stop on success. Invalid credentials, invalid requests, and shared quota limits stop immediately.

### Run locally

```bash
cd Website
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To build the static GitHub Pages site locally, run:

```bash
npm run build:github-pages
```

The build writes the site to `Website/out/`. Pushes to `main` deploy automatically through [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

Large video catalog imports and restoration yield between short processing batches and check cancellation, keeping input and workspace changes responsive. Import pages and their continuation tokens still save atomically.

Workspace saves and imports validate supported formats and required fields before replacing recovery copies. Invalid data keeps the last valid copy; bounded local diagnostics record only failure codes and counts (`LearnedMediaStorageDiagnostics` in the browser, `storageValidation` in Mac diagnostics).

### Keys and privacy

The website remembers API keys in encrypted browser storage. When you sign in with Google, Gemini and YouTube keys sync privately to the same account across devices and sessions, separately from workspace data. Signing out clears account keys from the active session; Remove clears that key from the account too. Offline edits remain saved locally and retry on reconnection. The imported YouTube catalog stays on the device. Keys are never committed to GitHub.

On GitHub Pages, requests to Gemini, Wikipedia, and YouTube run directly from your browser.

Workspace saves keep one active write and only the latest waiting snapshot. New edits and workspace switches preserve active uploads; failed uploads retain their exact revision for retry. Recovery journals wait for local persistence and, when signed in, the corresponding cloud acknowledgment. Older writes cannot clear newer recovery entries.

## Videos

Videos are limited to approved creators and individually approved videos. The workspace includes:

- Search, channel and topic filters, saved videos, history, and playback
- Gemini-powered search that ranks approved videos by meaning and explains each match
- Daily refreshes for overdue creator sources, plus an immediate **Refresh videos** action
- Refreshes reuse unchanged video records and search entries; changed metadata and source permissions still update normally
- Imports save each validated page and continuation token together, so interruptions resume from the last committed page on the website and Mac app
- Catalog refreshes write added or changed videos in batches of at most 100, publish their references atomically, and retire removed records; playback activity is saved separately
- Playback saves compare whole seconds and skip unchanged positions. Pause, seek completion, video changes, and page exit flush changed progress immediately; saving progress does not reload the web player.
- 3Blue1Brown videos from the approved Neural Networks and Statistics playlists, including future additions

## macOS app

Open [`App/Learned Media.app`](App/Learned%20Media.app) to launch the bundled app, or rebuild it from source:

```bash
cd App

# Build for the current Mac
./script/build_app.sh

# Build a universal arm64 + x86_64 app
./script/build_universal.sh
```

The build scripts create an ad-hoc signed app bundle and require macOS 13 or later. The app stores learning data in macOS Application Support and keeps API keys in the Mac’s Keychain. Google sign-in is available when the Supabase provider is configured; Gemini generation works without sign-in.

See the [website README](Website/README.md) and [macOS app README](App/README.md) for client-specific details.
