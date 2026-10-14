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
4. Open **Videos**, add a YouTube Data API v3 key in Settings, and import the approved creator library

No demo facts are included. Facts appear only after Gemini successfully generates them. The key stays in browser session memory; the Settings page links directly to [Google AI Studio](https://aistudio.google.com/app/apikey).

On GitHub Pages, Gemini and Wikipedia requests run directly in your browser. Your key is sent only to Google, held in memory for the session, and is never committed to GitHub.

The Videos workspace uses the same session-only rule for its YouTube key. Settings includes direct links to create a Google Cloud project, enable YouTube Data API v3, and create a restricted API key. The imported catalog is kept in IndexedDB and only approved creators and individually approved videos are used.

While connected, overdue creator sources refresh once a day. Use **Refresh videos** for an immediate scan. 3Blue1Brown is limited to the approved Neural Networks and Statistics playlists, including future additions.

### Prompt instructions

`lib/prompts.ts` builds one instruction block per operation, followed by labeled task data. `lib/prompt-instructions.json` is the shared source for connection, card, answer, and search rules. Empty optional fields and identical rules/fields are omitted; evidence and user text retain their exact content. Catalog versions remain in request cache keys rather than model prompts.

After editing shared instructions, run `npm run generate:prompts` to update the native Swift instructions. `npm run test:generation` checks that the generated copy is current and verifies prompt isolation, citations, and request counts.

Question answers pass the exact current query first, separately from supporting card context and prior conversation. Question-specific instructions require a direct first-sentence answer, coverage of every requested part, and omission of irrelevant card details. Supplemental evidence can support the answer while remaining distinct from evidence for the card's claim.

Candidate generation sends all seven default slots in one batch, each with a stable ID and assigned topic. Candidates must use different facts and angles; weak or duplicate slots may be omitted rather than padded. The response schema caps candidates at the requested slot count and permits empty batches. Recovery requests only unfinished slots and preserves completed cards.
