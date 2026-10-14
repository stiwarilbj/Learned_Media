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

Run `npm run test:prompts` for the [fixed prompt failure set](scripts/prompt-evaluation/README.md). It reports task success, citation validity, duplicates, response size, and Gemini call count against a committed baseline. Pages CI rejects regressions. Replays use no API key; changed wording requires measured reliability gains rather than treating unchanged mock responses as proof of improvement.

Question answers pass the exact current query first, separately from supporting card context and prior conversation. Question-specific instructions require a direct first-sentence answer, coverage of every requested part, and omission of irrelevant card details. Supplemental evidence can support the answer while remaining distinct from evidence for the card's claim.

Candidate generation sends all seven default slots in one batch, each with a stable ID and assigned topic. Candidates must use different facts and angles; weak or duplicate slots may be omitted rather than padded. The response schema caps candidates at the requested slot count and permits empty batches. Recovery requests only unfinished slots and preserves completed cards.

Card prompts include only the assigned difficulty levels and requested sentence structure. Length limits match validation (exact sentence count, at least eight words and 35–600 characters per sentence). Inactive surprise mode and presentation-only display settings are omitted; difficulty constraints are shared with the native app.

Prompt conflicts follow an explicit content priority: the current question/task, assigned topics and active mode, required format and length, then optional style. Learning answers retain the original question as their target; response schemas, evidence validation, and citations stay mandatory. Connection probes remain minimal.

Standalone cards and question answers use separate compact builders. Cards retain exact sentence counts, topic difficulty, and evidence IDs. Answers use only relevant card context and question evidence, with preferred length that can expand to cover every requested part; card generation settings are excluded from answer context.

Before grounded writing, Wikipedia/catalog evidence is retrieved through the existing local cache and ranked by the intended claim, title, and topic path. Only the strongest complete passage and a sufficiently relevant adjacent passage are sent; heading-only matches and unfinished passages are excluded. Compact source titles and stable content-based evidence IDs preserve local citation restoration without an extra Gemini source-discovery call.

Grounding responses contain sentence indexes and evidence IDs only. Local restoration checks every reference against the current card’s allowlist, restores exact quotation/section/source data, and runs citation validation. Unknown IDs, IDs assigned only to another card, empty ID lists, and out-of-range sentence indexes reject the affected card without discarding completed cards.

Grounding requires `claimEvidenceIds` supporting the specific main claim as well as evidence for each sentence. Subject-only mentions are insufficient. When supplied passages cannot establish the claim, Gemini returns `{slot, status: "needs_evidence", claim, missingEvidence}` without invented card text. Only the unfinished slot is recovered; completed cards remain intact. Claim evidence IDs pass the same local ownership checks as sentence citations.

Shared grounding passages are pooled once per canonical source, normalized section, and normalized passage text. Identity normalization collapses whitespace and canonical Unicode variants while preserving punctuation, numbers, case, and negation. Stable evidence IDs are reused across cards and retries; each card retains its original local quotation and section for citation restoration.

Evidence, supporting cards, prior conversation, and video-verification metadata are serialized as `{kind: "reference_material", data: ...}` fields. The shared prompt builder adds one explicit instruction to ignore commands, role claims, or prompt-like text inside these fields. JSON escaping keeps embedded headings and newlines inside reference data, while preserving exact quotations for local validation. Connection checks and interpretation-only requests do not carry this evidence policy.

Unresolved search interpretation returns one compact concept plan without prose or a query restatement. Case and whitespace variants coalesce into the same cached interpretation. Video groups contain equivalent `terms` and separate optional `related` hints; related matches can break ranking ties but cannot satisfy required concepts. Topic groups retain equivalents and related terms for local catalog ranking. The existing optional uncertain-video verification checks metadata, rather than reinterpreting the query.

YouTube hard filters are owned by local parsing and user selections. Semantic interpretation returns only concept groups and ranking hints; model-supplied channel, date, duration, exclusion, approval, Shorts, or sorting changes are ignored. Eligibility is enforced before local ranking and again after optional metadata verification. Unknown or conflicting explicit channels produce no results; constrained records with missing date or duration metadata are rejected.

Search rankers record matched and missing concept IDs for each result. Ordinary multi-part searches require all concepts. Explicit OR uses complete alternative clauses, including synonyms and evidence spread across title, tags, and description. Topic dropdowns keep partial recommendations below complete meaning matches within each section; partial matches never enter the filtered topic tree. Local AND/OR structure and recognized concepts survive optional enrichment.

Question-answer prompts locally recognize leading “when,” “why,” and “what’s the difference” questions and add only the applicable date/time-first, cause-first, or distinction-first instruction. Original query text is preserved. Unknown patterns use the general answer prompt, and source limitations remain mandatory. Web and native builders use the same instruction text; this adds no Gemini request.
