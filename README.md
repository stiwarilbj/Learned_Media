# Learned Media

Learned Media is a learning workspace available as a Next.js website and a native macOS app. It creates Wikipedia-grounded learning cards with Gemini and includes a curated YouTube video workspace.

## What it includes

- Topic-based learning with generated facts, sources, and follow-up explanations
- Questions and “Learn more” prompts for each fact card
- A Videos workspace with approved creators and individually approved videos
- Search, topic filters, saved videos, history, playback, and Gemini-powered smart search
- Optional Google sign-in through Supabase for syncing workspace data

## Website

[Open Learned Media on GitHub Pages](https://stiwarilbj.github.io/Learned_Media/)

### Run locally

\`\`\`bash
cd Website
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000).

To build the static GitHub Pages site locally:

\`\`\`bash
npm run build:github-pages
\`\`\`

The generated site is written to \`Website/out/\`. Pushes to \`main\` deploy automatically through [\`.github/workflows/pages.yml\`](.github/workflows/pages.yml).

### API keys and privacy

Open **Settings** to connect the services you want to use:

- **Gemini** is required for fresh facts, explanations, questions, and smart search.
- **YouTube Data API v3** is required to import or refresh the approved video catalog.

On the website, API keys are remembered in encrypted, device-local browser storage. They are not synced to your Google account or committed to GitHub. Workspace data can sync only after you sign in; keys and the YouTube catalog remain on the device.

On GitHub Pages, requests to Gemini, Wikipedia, and YouTube run directly from your browser.

## Videos

The Videos workspace stays inside the approved catalog. It supports:

- Ordinary search, channel and topic filters, saved videos, history, and playback
- Gemini-powered smart search that ranks approved videos by meaning and explains each match
- Daily refreshes for overdue creator sources, plus an immediate **Refresh videos** action
- 3Blue1Brown videos from the approved Neural Networks and Statistics playlists, including future additions

## macOS app

Open [\`App/Learned Media.app\`](App/Learned%20Media.app) to launch the bundled app, or rebuild it from source:

\`\`\`bash
cd App

# Build for the current Mac
./script/build_app.sh

# Build a universal arm64 + x86_64 app
./script/build_universal.sh
\`\`\`

The build scripts create an ad-hoc signed app bundle and require macOS 13 or later. The app stores learning data in macOS Application Support and keeps API keys in the Mac’s Keychain. Google sign-in is available when the Supabase provider is configured; Gemini generation works without sign-in.

See the [website README](Website/README.md) and [macOS app README](App/README.md) for client-specific details.
