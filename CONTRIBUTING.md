# Contributing

Changes to the skill are treated as release-engineering changes, not prose-only
edits.

1. Run the capability preflight before adding or merging capability surface.
2. Keep `SKILL.md` lean and route optional detail through one-level references.
3. Add or update exact cases in `tests/evals/cases.jsonl`.
4. Run `npm test` and `npm run validate`.
5. Run the unchanged real-task case against both configured model slots.
6. Append passing regressions; never mutate or delete retained cases.
7. Store per-run evidence in the operating system's temporary directory.

Pull requests must state the capability classification, the exact assertions
run, the two model identifiers, and whether any resource was loaded
unnecessarily.
