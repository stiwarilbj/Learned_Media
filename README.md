# Learned Media

Learned Media is available as both a website and a standalone macOS application.

## Website

Open Website, install dependencies, copy .env.example to .env.local, then run npm run dev. Open http://localhost:3000.

## Mac application

Download the repository ZIP, unzip it, open App, and double-click Learned Media.app. Open Settings to paste a Gemini key. The app stores learning data in macOS Application Support and keeps the Gemini key in memory only.

The included App source and build scripts are in the App folder. Google sign-in is wired to the dedicated Learned Media Supabase project, but the owner still needs to add a Google Cloud OAuth client ID and secret in Supabase Authentication > Providers and allow the callback learnedmedia://auth/callback before using that button.
