# Integration

## Host agents

Install `skills/skill-ratchet` through the host's Agent Skills mechanism. The
skill intentionally does not redistribute a vendor's native skill creator.
When a creator is available, use it for initialization and use Skill Ratchet
for preflight, evaluation, and release qualification.

## CI

Run the deterministic checks on Linux, macOS, and Windows:

```shell
npm test
npm run validate
```

Live model execution is intentionally separate from deterministic CI because
credentials and model availability vary by environment. CI should validate a
fresh evidence artifact when the organization supplies model runners:

```shell
node skills/skill-ratchet/scripts/skill-ratchet.mjs validate \
  --skill-root skills/skill-ratchet \
  --run-evidence "$RUNNER_TEMP/skill-ratchet-evidence.json"
```

The evidence path must resolve inside the operating system temporary directory.
