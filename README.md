# Learned Media

Learned Media is available as both a website and a standalone macOS application.

## Website

Live site: [stiwarilbj.github.io/Learned_Media](https://stiwarilbj.github.io/Learned_Media/)

```bash
cd Website
npm install
npm run dev
```

Open http://localhost:3000, go to Settings, paste a Gemini API key, connect it, choose topics, and press Start. The key is entered in the app; no Gemini environment file is needed.

GitHub Pages deploys automatically from `main` through the workflow in `.github/workflows/pages.yml`. The hosted build makes Gemini and Wikipedia requests directly in your browser, so you do not need to run a server.

## Mac application

Download the repository ZIP, unzip it, open App, and double-click Learned Media.app. Open Settings to paste a Gemini key. The app stores learning data in macOS Application Support and keeps the Gemini key in memory only.

The App folder includes source and rebuild scripts. Google sign-in remains available when the dedicated Supabase provider is configured; Gemini generation works locally without sign-in.
