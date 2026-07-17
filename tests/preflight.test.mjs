import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runPreflight } from '../skills/skill-ratchet/scripts/preflight.mjs';

async function writeSkill(root, folder, name, description) {
  const target = path.join(root, folder);
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, 'SKILL.md'), `---\nname: ${name}\ndescription: >\n  ${description}\n---\n\n# ${name}\n`, 'utf8');
  return path.join(target, 'SKILL.md');
}

test('preflight ranks a relevant skill and never emits a semantic verdict', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'skill-ratchet-preflight-'));
  const skillPath = await writeSkill(root, 'migration-gate', 'migration-gate', 'Audits database migration safety. Use when reviewing schema migrations.');
  await writeSkill(root, 'pdf-reader', 'pdf-reader', 'Extracts text from PDF files. Use for PDF document tasks.');
  const result = await runPreflight({ query: 'audit database schema migrations', roots: [root], discoveryOnly: true, includeDefaults: false });
  assert.equal(result.status, 'REVIEW_MATCHES');
  assert.equal(result.ranked[0].path, skillPath);
  assert.equal(result.ranked[0].plausible, true);
  assert.equal('verdict' in result, false);
});

test('discovery-only respects negative description clauses', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'skill-ratchet-negative-'));
  await writeSkill(root, 'skill-auditor', 'skill-auditor', 'Audits Agent Skills. Use for SKILL.md quality. Do not use for: application code review and TypeScript pull requests.');
  const result = await runPreflight({ query: 'review TypeScript application pull request', roots: [root], discoveryOnly: true, includeDefaults: false });
  const candidate = result.ranked.find((entry) => entry.source_root === 'extra:1');
  assert.equal(candidate?.score, 0);
  assert.equal(candidate?.plausible, false);
});

test('same-name near-identical skills deduplicate by root priority', async () => {
  const first = await mkdtemp(path.join(tmpdir(), 'skill-ratchet-dedupe-a-'));
  const second = await mkdtemp(path.join(tmpdir(), 'skill-ratchet-dedupe-b-'));
  await writeSkill(first, 'audit-skill', 'audit-skill', 'Audits Agent Skills for release readiness.');
  await writeSkill(second, 'audit-skill', 'audit-skill', 'Audits Agent Skills for release readiness.');
  const result = await runPreflight({ query: 'audit Agent Skill release readiness', roots: [first, second], discoveryOnly: true, includeDefaults: false });
  assert.equal(result.ranked.filter((entry) => entry.path.endsWith(path.join('audit-skill', 'SKILL.md'))).length, 1);
});

test('evidence writes are allowed inside temp and denied outside it', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'skill-ratchet-evidence-root-'));
  await writeSkill(root, 'audit-skill', 'audit-skill', 'Audits Agent Skills.');
  const evidence = path.join(tmpdir(), 'skill-ratchet-evals', `run-${Date.now()}.json`);
  await runPreflight({ query: 'audit Agent Skills', roots: [root], evidence, includeDefaults: false });
  await assert.rejects(
    runPreflight({ query: 'audit Agent Skills', roots: [root], evidence: path.resolve(tmpdir(), '..', 'outside-ratchet.json'), includeDefaults: false }),
    /outside OS temp/,
  );
});
