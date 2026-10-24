# Paired website and Mac releases

The website catalog is authoritative. `Website/scripts/build-native-parity.mjs`
generates the complete native catalog, migration/selection implementation,
Explore categories, approved YouTube identities, individual videos, recency and
Shorts policy, and original-card search text/ranking. Other `build-native-*`
generators supply the card tools and request/validation policies.

## Release checklist

1. Implement a behavior on both controllers, preserving device-specific Keychain,
   preferences, browser downloads and Mac save dialogs. Never copy credentials
   into workspace data or a release manifest.
2. From Website run `npm run generate:native`, then `npm run check:native-data`.
   Check mode compares complete outputs and must leave files unchanged. Add a
   new generator to the existing naming convention; the aggregator discovers it.
3. Run `npm run test:parity`, TypeScript, generation, semantic/worker, persistence,
   credentials, difficulty, card tools, detour and download checks. Run `swift test`
   from App. Reproduce controller bugs through the native bridge, not only helper
   calls. Test delayed replies, cancellation, account/workspace changes and offline
   data using an isolated workspace/browser profile.
4. Build Pages with `npm run build:github-pages`. After it finishes, build Mac with
   `App/script/build_app.sh native` from the repository root. Do these sequentially:
   the existing Pages builder temporarily stages server routes out of the tree.
   Do not run generated checks during that temporary staging interval.
5. Compare `Website/out/release.json`, `Website/public/release.json`, and the Mac
   bundle's `Contents/Resources/frontend/release.json`. The source-content release
   ID and catalog versions must agree. The native bundle records the release ID
   and a UTC build number in Info.plist; verify its signature with codesign.
6. Exercise the matrix below on production desktop/mobile and actual Mac WebKit.
   Check console errors, keyboard focus, scroll anchors, drafts and bounded DOM
   size with 1,000 cards and 30,000 videos. Use CPU slowdown for browser checks.
7. Commit task changes and push the configured upstream. Wait for the existing
   deployment-only Pages workflow. Compare the live `/release.json` to the bundle.
   Check the live interactions in a clean profile. No additional CI jobs are needed.
8. Stop the stale Mac process before replacing its bundle. Stage and verify the
   replacement first, retain a recoverable old bundle, then launch the replacement
   and verify its executable path and manifest. Never delete Application Support,
   UserDefaults, WebKit data or Keychain items while updating the application.

## Feature parity matrix

| Surface | Equivalent behavior and regression coverage |
|---|---|
| Navigation | Feed, Explore, Videos, Saved, Likes, History, Settings; named/current controls; persistent video tabs, tab keyboard navigation, channel/player return |
| Explore | Same categories; a topic selects its existing catalog branch; custom-topic entry opens the feed picker |
| Settings | Theme, device reveal/download preferences and reset defaults; seven cards, difficulty, sentence count, display/Surprise modes; connection checks and channel recency choices |
| Topics | Complete ordered IDs/labels/aliases; exact-ID suggestions, selection/weights/custom topics, migration, 100 semantic suggestions, filtered expansion/collapse, incremental indexes |
| Search | Original full card content, saved/liked/history collections; local-first semantic topic/video ordering; strict channel/date/duration/exclusion/approval/Shorts filters; cached queries, stale reply/worker recovery |
| Generation | Seven normal slots or three detour slots; Surprise/thread context; shared ten-level difficulty and feedback; novelty, specificity, citations; ordinary two-call/cached one-call paths; unchanged retries/models |
| Card tools | Source spotlight/context, original/simpler/deeper, gradual reveal, follow-ups, glossary, chronology, location map, detour, Heard/Unknown, likes/saves, More menu and individual download |
| Questions | Draft survives navigation and remounts; next-detail choice persists independently from existing answer label; Learn more and question citations/loading/errors remain independent |
| Video flows | Approved channels/individuals including melodysheep QTQVZuBV9oA; no Shorts; topic-restricted discovery; per-channel recency; infinite load, relevant pagination, saved/history, player retained during Save, related results after ending |
| Downloads | All four ordered modes, combined-file default, single-card format inheritance, ten-tag folder naming, full feed/Saved/offscreen content, Unicode PDF/images/credits, ZIP validation and cancellation |
| Workspaces | Create/rename/reorder/delete/switch, import/export, compact local snapshots, full compatible cloud exchange, recovery copy, optional fields and recency preservation |
| Accounts | Isolated credential owners, key edits/removals, restoration and refresh coalescing, stale results discarded, workspace/memory round trips and pending upload recovery |
| Rendering | Measured windows follow the actual scroll container; resize/shrink, offscreen drafts/focus and scroll anchors; no background loading loop |

## Verification notes for this release

Deterministic suites cover all shared card helpers, prompt/recovery policy,
semantic rankers, persistence, exports, credentials, native services and complete
catalog parity. Isolated native-controller interaction checks cover Explore,
video navigation/return, player identity during Save, independent question detail,
drafts, gradual reveal and chronology. The large native fixture uses 1,000 cards
and 30,000 videos under four-times CPU slowdown. Provider-dependent behavior is
verified with fixtures; live Google sign-in and billable Gemini generation are
not implied by a deterministic test pass.

### Recorded checks

- 14 parity regressions pass, including reversed question/Learn more completion
  orders, stale completion isolation, complete catalog equality, read-only
  generation checks, compact navigation visibility, and measured-row shrinking.
- All 72 Swift tests pass. TypeScript, generation, semantic search, workers,
  saved-card fidelity, restoration, credentials, card-tool and export checks pass.
- Native-controller fixtures: 1,000 cards and 30,000 videos, four-times CPU
  slowdown, approximately 0.9-second usable startup; three initial card nodes,
  six after a deep scroll; drafts retained; channel search and filtering pass.
- Production website: 1280×900 and 390×844; reveal, chronology, drafts,
  independent question detail, Explore and persistent video navigation pass.
  Native and web searches each expose 100 unique selectable topic suggestions,
  including the hundredth entry reached by scrolling.
- Installed Downloads bundle verified in actual Mac WebKit: restored cards and
  selected topics, visible compact navigation icons, Explore and channel tabs.
  Replacement leaves Application Support and Keychain intact and retains an old
  bundle for recovery. Signature and installed/source manifests match.
