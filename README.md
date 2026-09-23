# Learned Media

Learn topics with AI-generated, Wikipedia-grounded fact cards and a curated video library. Use the website or the native macOS app.

## Website

[Open Learned Media on GitHub Pages](https://stiwarilbj.github.io/Learned_Media/)

### Get started

1. Open **Settings**, connect Gemini, then choose topics and press **Start learning**.
2. Open **Videos** to browse the approved creator and video catalog.
3. To import or refresh videos, add a YouTube Data API v3 key in Settings.

Gemini is needed for new facts, explanations, questions, and smart video search. The YouTube key is needed to import or refresh the catalog.

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

### Keys and privacy

The website keeps API keys in encrypted, device-local browser storage. Keys and the YouTube catalog are not synced to your Google account or committed to GitHub. Workspace data can sync after you sign in with Google.

On GitHub Pages, requests to Gemini, Wikipedia, and YouTube run directly from your browser.

## Videos

Videos are limited to approved creators and individually approved videos. The workspace includes:

- Search, channel and topic filters, saved videos, history, and playback
- Gemini-powered search that ranks approved videos by meaning and explains each match
- Daily refreshes for overdue creator sources, plus an immediate **Refresh videos** action
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
