import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateSkill } from '../skills/skill-ratchet/scripts/validate.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillRoot = path.join(repoRoot, 'skills', 'skill-ratchet');

test('the published Skill Ratchet fixture passes structural validation', async () => {
  const result = await validateSkill({ skillRoot });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.regression_count, 3);
});

async function completeEvidence(overrides = {}) {
  const cases = (await readFile(path.join(skillRoot, 'tests', 'evals', 'cases.jsonl'), 'utf8'))
    .split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const executionCase = cases.find((row) => row.id === 'E1');
  const assertionRows = () => executionCase.assertion_ids.map((id) => ({ id, result: 'pass' }));
  const slot = (model) => ({
    model,
    case_id: 'E1',
    files_opened: executionCase.expected_resources,
    unnecessary_loads: [],
    assertions: assertionRows(),
    trials: Array.from({ length: executionCase.trials || 1 }, (_, index) => ({
      id: `T${index + 1}`,
      result: 'pass',
      assertions: assertionRows(),
    })),
  });
  return {
    skill: 'skill-ratchet',
    eval_date: new Date().toISOString(),
    model_matrix: [
      { slot: 'strong', model: 'gpt-frontier-test', result: 'pass', note: '' },
      { slot: 'weaker', model: 'gpt-economical-test', result: 'pass', note: '' },
    ],
    discovery: {
      must_trigger: ['D1', 'D2', 'D3'].map((id) => ({ id, prompt: id, result: 'pass' })),
      must_not_trigger: ['N1', 'N2', 'N3'].map((id) => ({ id, prompt: id, result: 'pass' })),
    },
    execution: {
      task: executionCase.prompt,
      assertions: executionCase.assertion_ids.map((id) => ({ id, result: 'pass' })),
    },
    execution_per_slot: {
      strong: slot('gpt-frontier-test'),
      weaker: slot('gpt-economical-test'),
    },
    edge_cases: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].map((id) => ({ id, result: 'pass', blocked_reason: '' })),
    ...overrides,
  };
}

test('complete evidence passes only with two distinct passing models and all cases', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'skill-ratchet-complete-'));
  const evidencePath = path.join(directory, 'evidence.json');
  await writeFile(evidencePath, JSON.stringify(await completeEvidence()), 'utf8');
  const result = await validateSkill({ skillRoot, runEvidence: evidencePath });
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('repeated execution trials must meet the case pass threshold in both model slots', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'skill-ratchet-trials-'));
  const evidence = await completeEvidence();
  evidence.execution_per_slot.weaker.trials[2].result = 'fail';
  evidence.execution_per_slot.weaker.trials[2].assertions[0].result = 'fail';
  const evidencePath = path.join(directory, 'evidence.json');
  await writeFile(evidencePath, JSON.stringify(evidence), 'utf8');
  const result = await validateSkill({ skillRoot, runEvidence: evidencePath });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /weaker.*trial pass threshold/);
});

test('blocked model and blocked edge cases never complete', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'skill-ratchet-blocked-'));
  const evidence = await completeEvidence();
  evidence.model_matrix[1].result = 'blocked';
  evidence.model_matrix[1].note = 'model unavailable';
  evidence.edge_cases[2].result = 'blocked';
  const evidencePath = path.join(directory, 'evidence.json');
  await writeFile(evidencePath, JSON.stringify(evidence), 'utf8');
  const result = await validateSkill({ skillRoot, runEvidence: evidencePath });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /weaker.*blocked/);
  assert.match(result.errors.join('\n'), /A3 did not pass/);
});

test('mutating a retained regression fails the lock', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'skill-ratchet-mutation-'));
  const copyRoot = path.join(directory, 'skill-ratchet');
  await mkdir(path.join(copyRoot, 'tests', 'evals'), { recursive: true });
  await mkdir(path.join(copyRoot, 'references'), { recursive: true });
  await copyFile(path.join(skillRoot, 'SKILL.md'), path.join(copyRoot, 'SKILL.md'));
  for (const name of ['capability-preflight.md', 'extended-checklists.md', 'evaluation-contract.md']) await copyFile(path.join(skillRoot, 'references', name), path.join(copyRoot, 'references', name));
  for (const name of ['cases.jsonl', 'regression-cases.jsonl', 'regression-lock.json']) await copyFile(path.join(skillRoot, 'tests', 'evals', name), path.join(copyRoot, 'tests', 'evals', name));
  const regressionPath = path.join(copyRoot, 'tests', 'evals', 'regression-cases.jsonl');
  const retained = await readFile(regressionPath, 'utf8');
  await writeFile(regressionPath, retained.replace('Implicit discovery evaluation', 'Changed discovery evaluation'), 'utf8');
  const result = await validateSkill({ skillRoot: copyRoot });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /mutated/);
});
