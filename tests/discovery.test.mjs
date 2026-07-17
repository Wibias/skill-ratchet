import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runPreflight } from '../skills/skill-ratchet/scripts/preflight.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillRoot = path.join(repoRoot, 'skills');
const cases = (await readFile(path.join(skillRoot, 'skill-ratchet', 'tests', 'evals', 'cases.jsonl'), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);

for (const row of cases.filter((entry) => /^D[1-3]$/.test(entry.id))) {
  test(`${row.id} routes to Skill Ratchet from metadata`, async () => {
    const result = await runPreflight({
      query: row.prompt,
      roots: [skillRoot],
      discoveryOnly: true,
      includeDefaults: false,
    });
    const target = result.ranked.find((entry) => entry.path.endsWith(path.join('skill-ratchet', 'SKILL.md')));
    assert.equal(target?.plausible, true, JSON.stringify(result.ranked, null, 2));
  });
}

for (const row of cases.filter((entry) => /^N[1-3]$/.test(entry.id))) {
  test(`${row.id} does not route to Skill Ratchet`, async () => {
    const result = await runPreflight({
      query: row.prompt,
      roots: [skillRoot],
      discoveryOnly: true,
      includeDefaults: false,
    });
    const target = result.ranked.find((entry) => entry.path.endsWith(path.join('skill-ratchet', 'SKILL.md')));
    assert.equal(target?.plausible, false, JSON.stringify(result.ranked, null, 2));
  });
}
