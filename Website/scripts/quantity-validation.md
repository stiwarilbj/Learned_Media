# Local numerical evidence checks

New cards are checked before publication on web and macOS. Each sentence uses only its assigned quotations; the main claim uses its assigned claim evidence IDs. Titles and hooks use the same card's cited passages. Existing quotation, section, slot-ownership, duplicate, and source checks still apply. A mismatch enters the existing recovery path for that slot; successful cards remain published. No prompt changes or extra successful-path Gemini calls are required.

`quantity-units.json` supplies a shared bounded unit table. `build-native-prompts.mjs` generates `QuantityUnits.swift` and checks it for drift. Factors use [NIST SP 811's conversion table](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8). Length, mass, time, area, volume, speed, pressure, percentage, and temperature quantities are compared by dimension and value. Alias spelling does not change the quantity. Calendar months/years and ambiguous ton/gallon/degree conventions are literal-only; no variable conversion is assumed.

- Digit integers, grouped thousands, signed decimals, scientific notation, and hundred/thousand/million/billion scale words are recognized.
- Common written numbers through 999, optionally followed by a scale word, are recognized when attached to a supported unit. Number words in ordinary prose are not inferred as measurements.
- Unit aliases accept common plural forms, metric spellings, symbols, and hyphenated quantities. Known compound units are matched before simpler prefixes. Other compounds can match literally but cannot convert.
- Exact conversions use the local factors (and offsets for absolute temperatures), allowing only floating-point arithmetic error. Temperature changes use scale factors without absolute-temperature offsets.
- Rounded conversions require “about,” “approximately,” “around,” “roughly,” or “circa” immediately before the quantity, and must match deterministic rounding at the stated decimal precision. Same-unit value changes are not treated as conversions.
- Non-finite values and more than 15 significant digits are rejected; large scientific magnitudes remain supported within that precision. No currency exchange, calendar arithmetic, arbitrary formulas, implied range endpoints, locale-dependent decimal parsing, or general inference about which subject owns a measurement is attempted. Existing semantic evidence requirements remain necessary; the local checker is an additional numerical safeguard, not a complete entailment checker.

Shared fixtures in `quantity-fixtures.json` run in both the generation suite and Swift tests. Publication tests cover sentence/claim citation separation and heading checks. The provider mock injects one numerical error and confirms six valid cards survive, with only the seventh grounding slot retried. The fixed prompt replay still checks the normal two-call seven-card pipeline.

Run `npm run test:generation`, `npm run test:prompts`, `npm run typecheck` in Website, and `swift test --package-path App` from the repository root. Builds must include the shared frontend and native app.
