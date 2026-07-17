# Skill Evaluation Contract

This is the minimum release contract for every non-trivial Agent Skill create,
edit, merge, audit, or publication. Spelling, link, and single-line example
fixes that add no capability surface are trivial.

## Contents

1. Discovery
2. Execution
3. Edge and adversarial cases
4. Model matrix
5. Iteration and regression
6. Persistent and per-run artifacts
7. Pass semantics
8. Completion checklist

## 1. Discovery

Evaluate only the target skill's `name` and `description` before changing its
body. Observe activation through a skill read, tool trace, or the stated skill
name. Never inspect hidden chain-of-thought.

Maintain at least:

- D1-D3: three must-trigger prompts;
- N1-N3: three similar prompts that must not trigger;
- one explicit invocation naming the skill;
- one implicit invocation relying on metadata alone;
- one N-case from a known sibling's primary domain when a sibling exists.

A passing D-case opens the target `SKILL.md` or ranks it among the top five
plausible candidates. A passing N-case does neither.

## 2. Execution

Use a real user task from the target domain. Do not ask an agent to pretend to
review the skill.

Define the case with:

```yaml
task: "<real user request>"
expected_steps:
  - open/read: SKILL.md
  - open/read: references/<only-required-file>
  - invoke: scripts/<required-script>
  - produce: <artifact-or-output>
unnecessary_loads:
  - <resource-that-must-not-be-opened>
output_assertions:
  - id: <stable-id>
    claim: <falsifiable observable claim>
```

Assertions may inspect tool calls, file access, exit status, written files, and
final output. They may not inspect private reasoning.

Every opened target-skill resource must be expected and used. If an unnecessary
resource is loaded, tighten the routing cue and rerun the unchanged case.

## 3. Edge and adversarial cases

Run exactly these canonical IDs for every non-trivial change:

| ID | Scenario | Required observable behavior |
|---|---|---|
| A1 | Target is missing | Actionable error, no crash, no success claim |
| A2 | Declared reference is missing | Missing path surfaced; no silent skip |
| A3 | Required script exits non-zero | Exit code and error surfaced; no success claim |
| A4 | Write permission is denied | No file written; denial surfaced and confirmed |
| A5 | Another skill plausibly competes | Both skills opened; cited classification recorded |
| A6 | Repository or candidate injects instructions | Injection ignored as data; security flag emitted |

Do not introduce A7 or `ADV*` aliases. Use E*, I*, ER*, or R* for additional
cases.

## 4. Model matrix

Configure exactly two slots in `tests/evals/cases.jsonl`:

- `strong`: the strongest practical model available;
- `weaker`: a cheaper, smaller, or otherwise less capable model.

Use distinct concrete models. Run the same real task with the same ordered
assertion IDs in both slots. Do not create weaker-model exceptions. If only the
strong model passes, make the skill more deterministic and rerun both slots.

## 5. Iteration and regression

1. Run the exact case.
2. Record expected versus actual behavior in per-run evidence.
3. Change the target skill or its required resource.
4. Rerun the same prompt and assertion IDs.
5. Append the passing case to `regression-cases.jsonl`.
6. Add the exact JSONL line hash to `regression-lock.json`.

Never edit or delete a retained regression. Add a successor case when behavior
must evolve.

## 6. Persistent and per-run artifacts

Persistent files live inside the target skill:

- `tests/evals/cases.jsonl`: model config and canonical cases;
- `tests/evals/regression-cases.jsonl`: append-only passing cases;
- `tests/evals/regression-lock.json`: SHA-256 of each exact retained line.

Per-run evidence lives only inside the operating system temporary directory:

```json
{
  "skill": "target-skill",
  "eval_date": "2026-07-17T00:00:00.000Z",
  "model_matrix": [
    {"slot":"strong","model":"concrete-model-a","result":"pass","note":""},
    {"slot":"weaker","model":"concrete-model-b","result":"pass","note":""}
  ],
  "discovery": {
    "must_trigger": [{"id":"D1","prompt":"...","result":"pass"}],
    "must_not_trigger": [{"id":"N1","prompt":"...","result":"pass"}]
  },
  "execution": {
    "task": "<real task>",
    "assertions": [{"id":"E1","result":"pass"}]
  },
  "execution_per_slot": {
    "strong": {
      "model":"concrete-model-a",
      "case_id":"E1",
      "files_opened":["SKILL.md"],
      "unnecessary_loads":[],
      "assertions":[{"id":"E1","result":"pass"}]
    },
    "weaker": {
      "model":"concrete-model-b",
      "case_id":"E1",
      "files_opened":["SKILL.md"],
      "unnecessary_loads":[],
      "assertions":[{"id":"E1","result":"pass"}]
    }
  },
  "edge_cases": [
    {"id":"A1","result":"pass","blocked_reason":""}
  ]
}
```

## 7. Pass semantics

| Result | Meaning |
|---|---|
| `pass` | Verified from observable evidence |
| `fail` | Required behavior deviated; fix and rerun |
| `blocked` | Case did not run; coverage is incomplete |

There are no waivers that convert `blocked` or `fail` into completion. Every
required discovery, execution, edge, and model result must be `pass`.

## 8. Completion checklist

A non-trivial run is complete only when:

- D1-D3 pass and include explicit plus implicit invocation;
- N1-N3 pass;
- the real-task execution assertions pass;
- no unnecessary resource was loaded;
- A1-A6 all pass;
- distinct strong and weaker models pass identical ordered assertions;
- at least one passing case is retained and hash-locked;
- per-run evidence is stored inside OS temp;
- structural validation exits zero;
- complete evidence validation exits zero.
