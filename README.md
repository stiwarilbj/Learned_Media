# Learned Media

The complete website is in [`Website/`](./Website).

## Quick launch

```bash
cd Website
npm install
cp .env.example .env.local
# add GEMINI_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), choose topics, and press **Start learning**.

The demo feed works without a key. You can paste a session key in **Settings → Gemini API key** and use the built-in [Google AI Studio key page](https://aistudio.google.com/app/apikey). Gemini summaries and questions require a key.
