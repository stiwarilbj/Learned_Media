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

The demo feed works without a key. Gemini summaries and questions require `GEMINI_API_KEY`.
