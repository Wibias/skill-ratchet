# Skill Evaluation Contract

This is the minimum release contract for every non-trivial Agent Skill create,
edit, merge, audit, or publication. Spelling, link, and single-line example
fixes that add no capability surface are trivial.

## Contents

1. Discovery
2. Execution
3. Edge and adversarial cases
4. Model matrix and repeated trials
5. Iteration and regression
6. Persistent and per-run artifacts
7. Pass semantics
8. Verification-skill profile
9. Completion checklist

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

### Blind candidate contract

The candidate must see an organic user request, not the evaluation apparatus.
Do not put `eval`, `judge`, `rubric`, `score`, `benchmark`, `candidate`, `compare`,
or experiment labels in candidate-visible prompts, file names, or working paths
unless the real user task itself requires that word. Use project-shaped sanitized
names and do not tell one candidate that other candidates or model slots exist.

Do not ask the candidate which skills, rules, or principles it followed. Grade
skill activation and resource use from observable reads/tool traces and grade the
task from produced artifacts and state. A separate judge may know the rubric, but
it must see sanitized candidate labels rather than model names.

### Outcome-first assertions

Define the case around falsifiable outcomes. Process assertions are valid only
when the process is itself part of the skill contract, such as opening the owning
`SKILL.md`, enforcing an authorization boundary, invoking a required deterministic
gate, or avoiding an unnecessary resource.

Do not lock an arbitrary tool sequence when several valid sequences can produce
the same correct state.

A conceptual case shape is:

```yaml
task: "<organic real user request>"
expected_steps:
  - <only contract-required observable actions>
unnecessary_loads:
  - <resource-that-must-not-be-opened>
output_assertions:
  - id: <stable-id>
    claim: <falsifiable observable outcome>
trials: 3
pass_threshold: 3
```

`trials` and `pass_threshold` are optional. Without them, the case runs once.
When `trials` is present, it must be a positive integer and `pass_threshold`
defaults to `trials`. Use repeated trials for behavior whose stochastic failure
rate matters to the release decision, not as ceremony for deterministic checks.

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

## 4. Model matrix and repeated trials

Configure exactly two slots in `tests/evals/cases.jsonl`:

- `strong`: the strongest practical model available;
- `weaker`: a cheaper, smaller, or otherwise less capable model.

Use distinct concrete models. Run the same real task with the same ordered
assertion IDs in both slots. Do not create weaker-model exceptions. If only the
strong model passes, make the skill more deterministic and rerun both slots.

When a case declares repeated trials, both slots run the same number of trials
and the same threshold. Each passing trial must satisfy the case's ordered
assertion IDs. The complete gate fails when either slot misses the threshold.
Do not average the two model slots together.

## 5. Iteration and regression

1. Run the exact case without leaking the evaluation rubric into candidate context.
2. Record expected versus actual observable behavior in per-run evidence.
3. Change the target skill or its required resource.
4. Rerun the same organic prompt and assertion IDs.
5. Append the passing case to `regression-cases.jsonl`.
6. Add the exact JSONL line hash to `regression-lock.json`.

Never edit or delete a retained regression. Add a successor case when behavior
must evolve.

## 6. Persistent and per-run artifacts

Persistent files live inside the target skill:

- `tests/evals/cases.jsonl`: model config and canonical cases;
- `tests/evals/regression-cases.jsonl`: append-only passing cases;
- `tests/evals/regression-lock.json`: SHA-256 of each exact retained line.

Per-run evidence lives only inside the operating system temporary directory.
For a repeated case, each slot includes its trial records:

```json
{
  "skill": "target-skill",
  "eval_date": "2026-09-01T00:00:00.000Z",
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
      "assertions":[{"id":"E1","result":"pass"}],
      "trials":[
        {"id":"T1","result":"pass","assertions":[{"id":"E1","result":"pass"}]}
      ]
    },
    "weaker": {
      "model":"concrete-model-b",
      "case_id":"E1",
      "files_opened":["SKILL.md"],
      "unnecessary_loads":[],
      "assertions":[{"id":"E1","result":"pass"}],
      "trials":[
        {"id":"T1","result":"pass","assertions":[{"id":"E1","result":"pass"}]}
      ]
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
required discovery, execution, edge, model, and declared trial threshold must
pass before the run is complete.

## 8. Verification-skill profile

When the target skill is named `verify-*` or otherwise owns project runtime
verification, qualify both layers separately:

1. **Agent-skill behavior:** discovery, resource loading, adversarial cases, model
   parity, and regressions use this contract unchanged.
2. **Verifier behavior:** the real execution task must use the project verifier's
   own deterministic validation and drive the real user-facing surface when that
   environment is available. A runtime receipt must be observable and bound to the
   exact code revision when the verifier contract supports head binding.

If the required application surface cannot run, record `blocked`. Structural
validation of the `verify-*` skill is not a substitute for a runtime pass. Do not
fabricate a live result to make Skill Ratchet complete.

## 9. Completion checklist

A non-trivial run is complete only when:

- D1-D3 pass and include explicit plus implicit invocation;
- N1-N3 pass;
- candidate-facing execution stayed blind to the hidden rubric and model identity;
- the real-task outcome assertions pass;
- process assertions exist only for contract-required behavior;
- no unnecessary resource was loaded;
- A1-A6 all pass;
- distinct strong and weaker models pass identical ordered assertions;
- every declared repeated-trial threshold passes independently in both model slots;
- `verify-*` targets distinguish structural validation from actual runtime proof;
- at least one passing case is retained and hash-locked;
- per-run evidence is stored inside OS temp;
- structural validation exits zero;
- complete evidence validation exits zero.
