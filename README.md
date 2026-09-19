# Learned Media

Learned Media is available as both a website and a standalone macOS application.

## Website

```bash
cd Website
npm install
npm run dev
```

Open http://localhost:3000, go to Settings, paste a Gemini API key, connect it, choose topics, and press Start. The key is entered in the app; no Gemini environment file is needed.

## Mac application

Download the repository ZIP, unzip it, open App, and double-click Learned Media.app. Open Settings to paste a Gemini key. The app stores learning data in macOS Application Support and keeps the Gemini key in memory only.

The App folder includes source and rebuild scripts. Google sign-in remains available when the dedicated Supabase provider is configured; Gemini generation works locally without sign-in.
