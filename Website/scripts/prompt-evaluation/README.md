# Fixed prompt failure set

Run `npm run test:prompts` from Website before retaining a prompt change. CI runs this gate before the Pages build. It spends no Gemini quota and changes no UI or runtime policy.

Ten fixed scenarios reuse the existing mocked provider, actual response parser, card recovery pipeline, citation restoration, answer cache, and production topic ranker:

- Direct question: answer the original pressure question, include the locally selected cause-first instruction, cite its source, and reuse a capitalization variant without a second call.
- Paraphrase: ground shaking finds Earthquakes without shared keywords.
- Multiple concepts: Japanese earthquakes cover both ideas; Japan alone and earthquakes in other countries do not qualify.
- Weak evidence: a structured needs-evidence result preserves six cards and retries only the unsupported slot.
- Malformed output: a truncated grounding response preserves six complete cards and retries only the unfinished slot.
- Duplicate candidates: an exact repeated candidate is repaired locally; seven distinct published cards still take two calls.
- Unrelated search: no strong matches or visible tree paths; 100 unique Explore more suggestions remain available with zero calls.
- Multi-part question: supply both explicit question clauses and the per-item unsupported-evidence instruction in one request; reuse capitalization variants without another call.

- Scoped question: retain place, time, audience, and comparison qualifiers in the existing answer request; preserve a valid citation and cached capitalization variants.

- Incomplete evidence answer: require a named unsupported detail instead of a generic disclaimer; preserve the mechanism explanation, citation, and answer-cache behavior.

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

## Question-type instruction comparison

`question-type-before.json` records the previous prompt builder against the same seven-case fixtures as `question-type-after.json`. The direct-question case additionally checks that its prompt contains the required cause-first directive. The old builder fails that contract; the new builder passes it. Both use one Gemini operation call, produce 94 response bytes, and retain one valid citation. The prompt increases from 6,078 to 6,193 bytes (115 bytes, about 1.9%).

This is a measured prompt-construction improvement, not a claim of improved live-model answer quality. The provider answer is held fixed. The before report intentionally contains that one failed contract and is retained for review; the passing question-type report was retained only after the paired comparison succeeded.

```sh
npm run evaluate:prompts -- --compare scripts/prompt-evaluation/question-type-before.json scripts/prompt-evaluation/question-type-after.json
```

## Multi-part checklist comparison

`coverage-before.json` records the previous builder against the same eight-case fixture set as `coverage-after.json`. The new case checks that both original clauses reach the existing answer request and that its prompt requires an answer or a specific evidence limitation for each. The previous builder fails the checklist contract; the new builder passes. Both use one operation call, produce 155 canned response bytes, and retain one valid citation. Prompt size grows from 6,079 to 6,373 bytes (294 bytes, about 4.8%); all other case metrics stay unchanged.

This measures prompt construction, not live Gemini compliance. The replay answer and evidence are fixed. Historical question-type comparison reports retain their original seven-case fixture identity and must be compared to each other, not to the expanded current baseline.

```sh
npm run evaluate:prompts -- --compare scripts/prompt-evaluation/coverage-before.json scripts/prompt-evaluation/coverage-after.json
```

## Scope-field comparison

`scope-before.json` and `scope-after.json` use the same nine-case fixtures. The previous builder fails the new scope-field contract; the updated builder passes it. Both make one operation call, retain one valid citation, and produce 198 canned response bytes. The scoped prompt grows from 6,138 to 6,534 bytes (396 bytes, about 6.5%); other case metrics remain unchanged.

This measures local extraction and prompt construction, not live Gemini compliance. Scope phrases come only from the question, preserve negations and subsequent modifiers, ignore quoted titles, and remain reference data. Extraction is conservative and bounded (4,000 input characters, six scopes, 300 characters per scope); the full original question is always sent even when a derived field is omitted. General place/context prepositions are retained without attempting geographic inference. No separate interpretation request is used. The original query and existing evidence validation remain authoritative.

Historical seven- and eight-case comparison reports keep their respective fixture identities.

```sh
npm run evaluate:prompts -- --compare scripts/prompt-evaluation/scope-before.json scripts/prompt-evaluation/scope-after.json
```

## Precise evidence limitations comparison

`precise-evidence-before.json` and `precise-evidence-after.json` use the same ten-case fixtures. The previous builder fails the new instruction contract; the updated builder passes. The incomplete-evidence case makes one operation call, retains one valid citation, and produces 170 canned response bytes in both runs. Its prompt grows from 6,399 to 6,541 bytes (142 bytes, about 2.2%). Other question prompts also grow by 142 bytes; generation and search prompts are unchanged. No response schema, UI, cache, or retry behavior changes.

The question template now requires the specific unsupported detail in the first sentence, a distinction between supported and unsupported parts, and no vague disclaimer or unrelated summary. The quoted mechanism/abandonment sentence is an example, not a required response or an assertion about any source. Tests cover short/detailed, date, cause, multi-part, and comparison questions on web and native.

This is deterministic prompt-construction verification with fixed provider responses, not measured live-model compliance. Historical reports must be compared only with their matching fixture set.

```sh
npm run evaluate:prompts -- --compare scripts/prompt-evaluation/precise-evidence-before.json scripts/prompt-evaluation/precise-evidence-after.json
```

## Evidence date roles comparison

`date-roles-before.json` and `date-roles-after.json` use the same eleven-case fixtures. The new case requires event, publication, discovery, and revision labels in the actual answer prompt, alongside the instruction against substituting article publication/revision dates for subject event/discovery dates. The previous builder fails that contract; the updated builder passes. Both make one operation call, retain one valid citation, and produce 177 canned response bytes. Prompt size grows from 6,487 to 6,883 bytes (396 bytes, about 6.1%). Other cases retain their call counts, output sizes, citation validity, and duplicate metrics; prompt growth stays below the 10% gate.

Labels are derived locally from explicit date predicates in supplied `text` or `extract` fields, using shared web/native patterns. Plain years and titles do not establish a role. Each label includes a UTF-16 source offset so repeated years with different roles remain distinguishable. Labels describe the wording, not certainty: negated or tentative statements remain authoritative in the unchanged excerpt. Dates with unrecognized wording remain unlabeled. Processing is bounded to 16,000 source characters and 24 labels per passage; truncated date endings are omitted. No source discovery, model, or API request is added. Persisted sources, quotations, evidence IDs, and UI are unchanged.

Web/native fixture tests cover mixed roles, same-year roles, full dates, ancient dates, Unicode offsets, unknown roles, input bounds, and prompt-only annotations. A grounding integration test checks that labels reach the provider request, seven cards still take two calls, and restored quotations remain exact. Replay measures prompt construction, not live Gemini compliance. Historical comparisons retain matching before/after reports.

```sh
npm run evaluate:prompts -- --compare scripts/prompt-evaluation/date-roles-before.json scripts/prompt-evaluation/date-roles-after.json
```

### Evidence-backed acronym guidance

`acronym-before.json` and `acronym-after.json` replay the same twelve cases.
The added case supplies the expansion of DPI but only the initials XYZ. The
writing contract permits a first-use expansion only when needed and explicitly
supported, then uses the acronym without repeating its expansion. Connection,
candidate, and search prompts receive no acronym instruction.

The required-contract case improves from failing to passing; request counts,
citation validity, duplicates, and output sizes remain unchanged. Each writing
prompt adds 240 UTF-8 bytes (below the per-case 10% growth limit). Replay checks
prompt construction and held-fixed responses, not live model compliance.


## Sentence-length boundaries

The fixed replay set includes seven-card batches at the shortest and longest
supported settings, currently **1 and 10 sentences**. Each fixture checks its
setting against `SENTENCE_LENGTH_OPTIONS` so a newly supported boundary requires
an explicit fixture update. The provider mock reads the sentence instruction
from the real grounding prompt; it does not infer the answer length from the
fixture. The long fixture supplies ten distinct, complete sentences per source
section, rather than padding a three-sentence response with repetitions. Evidence
caches are cleared between boundary fixtures to prevent cross-case contamination.

The report records these dimensions separately:

- **Sentence counts:** independently segment each published body and check its
  actual count, terminal punctuation, and `sentenceCount` metadata. Every card
  must match the requested length.
- **Complete citations:** every body sentence must have valid evidence with an
  exact quotation, section, and source. A valid citation on just one sentence
  does not establish coverage for the rest of the card.
- **Response size:** total UTF-8 response-text bytes, including retries, measured
  separately for each boundary. The existing 10% per-case growth limit applies.
- **Call count:** exactly two generation calls for each successful boundary
  batch, excluding connection probes and Wikipedia lookups.

| Setting | Correct card lengths | Cited sentences | Response bytes | Gemini calls |
| --- | --- | --- | ---: | ---: |
| 1 sentence | 7/7 | 7/7 | 4,597 | 2 |
| 10 sentences | 7/7 | 70/70 | 13,366 | 2 |

Negative tests independently remove a citation, alter its source/quotation/section,
change the sentence count, remove final punctuation, grow response bytes, and add
a call. Each relevant gate must reject the regression even if task success and
other metrics remain unchanged. Failed scenarios still record actual byte and
call totals.

The baseline was deliberately expanded for these cases; all twelve existing
cases retain their exact previous metrics and the prompt hash is unchanged.
Historical paired reports without sentence metrics remain comparable to each
other, but cannot silently be compared with reports containing the new metrics.
This is deterministic replay coverage, not evidence of live Gemini compliance.
