# Fixed prompt failure set

Run `npm run test:prompts` from Website before retaining a prompt change. CI runs this gate before the Pages build. It spends no Gemini quota and changes no UI or runtime policy.

Seven fixed scenarios reuse the existing mocked provider, actual response parser, card recovery pipeline, citation restoration, answer cache, and production topic ranker:

- Direct question: answer the original pressure question, cite its source, reuse a capitalization variant without a second call.
- Paraphrase: ground shaking finds Earthquakes without shared keywords.
- Multiple concepts: Japanese earthquakes cover both ideas; Japan alone and earthquakes in other countries do not qualify.
- Weak evidence: a structured needs-evidence result preserves six cards and retries only the unsupported slot.
- Malformed output: a truncated grounding response preserves six complete cards and retries only the unfinished slot.
- Duplicate candidates: an exact repeated candidate is repaired locally; seven distinct published cards still take two calls.
- Unrelated search: no strong matches or visible tree paths; 100 unique Explore more suggestions remain available with zero calls.

## Reports and comparison

```sh
npm run evaluate:prompts -- --output /tmp/candidate.json
npm run evaluate:prompts -- --compare scripts/prompt-evaluation/baseline.json /tmp/candidate.json
```

Reports include prompt-version and fixture hashes and per-case metrics. The committed baseline is an explicit review artifact, never updated by normal checks. To capture another baseline deliberately, use `--capture --output /tmp/baseline.json`; `--capture` bypasses comparison, but still fails if a scenario fails. Do not overwrite the committed baseline to make a regression pass.

- **Task success:** every scenario assertion passes, including expected card/suggestion count, meaning coverage, retry slots, and caching.
- **Citation validity:** published evidence quotations occur in their locally restored source and have a section; answer citations point to supplied sources. The existing generation tests additionally enforce main-claim support, sentence coverage, slot ownership, and difficulty. This metric is structural/source validity, not an independent factual judgment.
- **Duplicate rate:** repeated normalized published card bodies / published cards. Candidate duplicate rate separately records repeated normalized claims within each raw candidate batch, including the intentional injected duplicate.
- **Output size:** UTF-8 bytes of all Gemini response text, including failed/truncated attempts, excluding transport envelopes and connection probes. Prompt bytes use the same scope.
- **Gemini calls:** operation provider attempts, excluding the two connection probes. Wikipedia requests do not consume Gemini quota and are excluded.

Reject any per-case task/citation/duplicate regression or extra Gemini call. Reject prompt or output growth over 10% per case. A changed prompt hash also needs a reliability improvement (success, citation validity, or fewer candidate/published duplicates); shorter text alone does not qualify. Cases and evaluation modes must agree. Local search metrics have no model output or citations, rather than fabricated measurements.

## What replay can establish

These are deterministic regression evaluations, not live Gemini benchmarks. Canned provider outputs deliberately stay fixed when prompt wording changes. Therefore unchanged replay outcomes cannot establish that Gemini follows revised wording better. The all-passing committed baseline deliberately cannot approve a wording-only change without further evidence.

Before keeping a wording change, run paired old/new model evaluations against these same inputs and failure conditions, record outputs and actual attempts, and compare reports with the same metric definitions and fixture identity. Review direct-question relevance, specific-claim support, and paraphrase quality manually as well. Keep live results separate from deterministic-replay reports; never label replay as observed model behavior. Credentials and paid requests are not part of this default suite.

The existing full generation and semantic-search suites remain required; this small set supplements them. When intentionally expanding fixtures, evaluate both old and new prompt versions with that same expanded set; do not compare incompatible fixture hashes.
