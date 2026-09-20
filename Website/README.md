# Learned Media Website

Live site: [stiwarilbj.github.io/Learned_Media](https://stiwarilbj.github.io/Learned_Media/)

## Launch

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To build the GitHub Pages version locally, run `npm run build:github-pages`. It writes the static site to `out/`.

## Use

1. Open **Settings**, paste a Gemini API key, and press **Connect Gemini**
2. Select topics and press **Start learning**
3. Use **Learn more** or ask questions on generated fact cards

No demo facts are included. Facts appear only after Gemini successfully generates them. The key stays in browser session memory; the Settings page links directly to [Google AI Studio](https://aistudio.google.com/app/apikey).

On GitHub Pages, Gemini and Wikipedia requests run directly in your browser. Your key is sent only to Google, held in memory for the session, and is never committed to GitHub.
