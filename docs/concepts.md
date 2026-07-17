# Concepts

## Authoring and qualification are separate jobs

A native skill creator owns scaffolding and host-specific metadata. Skill
Ratchet owns capability inventory, behavioral evaluation, regression, and the
release decision. This separation keeps the project portable across hosts.

## The ratchet

Every fixed failure becomes a retained regression. Its exact JSONL line is
hashed in `regression-lock.json`; later edits or deletions fail validation.
New behavior is represented by a new case instead of rewriting history.

## Observable evidence only

Assertions may inspect final output, exit status, files written, and tool or
file-access logs. They must never require hidden chain-of-thought.

## Fail closed

`blocked` records an honest coverage gap. It is not a pass. Both model slots,
all required discovery cases, every execution assertion, and A1 through A6
must pass before a run is complete.
