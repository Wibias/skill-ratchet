# Skill Ratchet

**Release engineering for Agent Skills.**

Skill Ratchet prevents duplicate capabilities, tests whether a skill is
discovered for the right prompts, validates real-task execution, exercises
adversarial failure modes across two model classes, and locks every retained
regression.

It complements a host agent's native skill creator. The creator scaffolds and
edits a skill; Skill Ratchet decides whether that skill is necessary, behaves
correctly, and is ready to ship.

## Why it exists

Most authoring guides explain how to write `SKILL.md`. Skill Ratchet adds an
executable release contract:

- capability preflight before `CREATE`, `MERGE`, or substantial expansion;
- evidence-backed `REUSE / EXTEND / MERGE / CREATE` classification;
- explicit and implicit discovery cases plus adjacent must-not-trigger cases;
- real-task execution assertions using observable file and tool traces;
- checks for unnecessary context loading;
- six canonical edge and adversarial cases;
- identical assertions for strong and economical model slots;
- append-only, hash-locked regression cases;
- fail-closed validation: `fail` and `blocked` never count as complete.

## Install

Install the skill with any Agent Skills compatible installer:

```shell
npx skills add Wibias/skill-ratchet --skill skill-ratchet
```

Or copy `skills/skill-ratchet` into an Agent Skills directory such as
`.agents/skills/` or `~/.agents/skills/`.

The deterministic CLI requires Node.js 20 or newer and has no runtime
dependencies.

## CLI

```shell
node skills/skill-ratchet/scripts/skill-ratchet.mjs preflight \
  --query "a skill that audits database migrations"

node skills/skill-ratchet/scripts/skill-ratchet.mjs validate \
  --skill-root /absolute/path/to/skill

node skills/skill-ratchet/scripts/skill-ratchet.mjs validate \
  --skill-root /absolute/path/to/skill \
  --run-evidence /absolute/path/inside/system-temp/run.json
```

Use `--json` for machine-readable output. The preflight accepts repeatable
`--root` options and optional `--project-root`, `--threshold`, `--evidence`,
and `--discovery-only` options. Use `--no-defaults` for isolated fixtures.

## What is original and what is adapted

Selected authoring guidance was adapted from David Ondrej's MIT-licensed
`effective-agent-skills`. Skill Ratchet's preflight classifier, Node.js CLI,
formal evaluation contract, adversarial schema, model parity, observable-load
assertions, regression locking, evidence validator, and tests are original
extensions. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the exact
boundary and retained license notice.

## Documentation

- [Concepts and evaluation model](docs/concepts.md)
- [Host and CI integration](docs/integration.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT. Third-party notices are retained in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
