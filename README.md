# Learned Media

Learned Media is available as both a website and a standalone macOS application.

## Website

Live site: [stiwarilbj.github.io/Learned_Media](https://stiwarilbj.github.io/Learned_Media/)

```bash
cd Website
npm install
npm run dev
```

Open http://localhost:3000, go to Settings, paste a Gemini API key, connect it, choose topics, and press Start. For Videos, add your own YouTube Data API v3 key in the separate YouTube settings panel. The key fields are entered in the app; no Gemini or YouTube environment file is needed.

GitHub Pages deploys automatically from `main` through the workflow in `.github/workflows/pages.yml`. The hosted build makes Gemini and Wikipedia requests directly in your browser, so you do not need to run a server.

## Mac application

Download the repository ZIP, unzip it, open App, and double-click Learned Media.app. Open Settings to paste a Gemini key. The app stores learning data in macOS Application Support and remembers API keys securely in this Mac’s Keychain.

The App folder includes source and rebuild scripts. Google sign-in remains available when the dedicated Supabase provider is configured; Gemini generation works locally without sign-in.

## Videos

Videos is a separate workspace limited to the approved creator and individual-video catalog. Ordinary search, topic filters, saved videos, history, and playback work from the imported local catalog. Smart search uses the Gemini key. A YouTube key is required to import the catalog; Settings links to Google Cloud project creation, YouTube Data API v3, and Credentials with the exact setup steps.

While connected, overdue creator sources refresh once a day and **Refresh videos** starts an immediate scan. 3Blue1Brown is limited to the two approved Neural Networks and Statistics playlists; new playlist additions are picked up automatically.

Smart video search first retrieves weighted matches from titles, descriptions, tags, and topic metadata, then asks Gemini to verify relevance. It can expand the search once when the first pass is too small, keeps channel/topic filters active, and explains why each accepted result matches. The approved catalog includes Jabroni Baseball (`UCfBXZotQqPlpDWXTbRbi2qA`).
