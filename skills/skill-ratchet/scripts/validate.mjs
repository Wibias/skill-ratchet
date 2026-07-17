import { tmpdir } from 'node:os';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  isInside, normalizeSlash, parseFrontmatter, parseJsonLines, sha256,
} from './shared.mjs';

const REQUIRED_CASES = ['D1', 'D2', 'D3', 'N1', 'N2', 'N3', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'];
const REQUIRED_EDGE = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'];
const REQUIRED_FIELDS = [
  'id', 'category', 'invocation', 'prompt', 'expected_skill',
  'expected_resources', 'unnecessary_resources', 'assertion_ids', 'scenario',
];

async function nonEmpty(target) {
  try {
    return (await stat(target)).size > 0;
  } catch {
    return false;
  }
}

function validateCase(row, label, errors, includeAdded = false) {
  for (const field of REQUIRED_FIELDS) {
    if (!(field in row)) errors.push(`${label} '${row.id || '<no id>'}' missing '${field}'`);
  }
  for (const field of ['id', 'category', 'invocation', 'prompt', 'scenario']) {
    if (typeof row[field] !== 'string' || !row[field].trim()) errors.push(`${label} '${row.id || '<no id>'}' has invalid '${field}'`);
  }
  for (const field of ['expected_resources', 'unnecessary_resources', 'assertion_ids']) {
    if (!Array.isArray(row[field])) errors.push(`${label} '${row.id || '<no id>'}' '${field}' must be an array`);
  }
  if (!row.assertion_ids?.length) errors.push(`${label} '${row.id || '<no id>'}' requires at least one assertion ID`);
  if (includeAdded && (typeof row.added !== 'string' || !row.added.trim())) errors.push(`${label} '${row.id || '<no id>'}' missing 'added'`);
  const categories = ['config', 'must-trigger', 'must-not-trigger', 'explicit-invocation', 'implicit-invocation', 'routing', 'adversarial', 'regression'];
  if (!categories.includes(row.category)) errors.push(`${label} '${row.id}' has invalid category '${row.category}'`);
  if (!['n/a', 'explicit', 'implicit'].includes(row.invocation)) errors.push(`${label} '${row.id}' has invalid invocation '${row.invocation}'`);
}

function resultMap(rows = []) {
  return new Map(rows.map((row) => [row.id, row]));
}

export async function validateSkill(options) {
  const errors = [];
  const warnings = [];
  const skillRoot = path.resolve(options.skillRoot || '');
  const skillMdPath = path.join(skillRoot, 'SKILL.md');
  if (!(await nonEmpty(skillMdPath))) {
    return { ok: false, mode: options.runEvidence ? 'complete' : 'structural', skill_root: skillRoot, errors: [`SKILL.md missing or empty: ${skillMdPath}`], warnings };
  }

  const skillText = await readFile(skillMdPath, 'utf8');
  const metadata = parseFrontmatter(skillText);
  if (!metadata.name) errors.push('SKILL.md frontmatter missing name');
  if (!metadata.description) errors.push('SKILL.md frontmatter missing description');
  if (metadata.name && metadata.name !== path.basename(skillRoot)) errors.push(`Skill name '${metadata.name}' does not match folder '${path.basename(skillRoot)}'`);

  const referenceMatch = skillText.match(/<!--\s*eval:references\s*-->([\s\S]*?)<!--\s*\/eval:references\s*-->/);
  const declaredRefs = [];
  if (!referenceMatch) errors.push('SKILL.md missing eval:references block');
  else {
    for (const line of referenceMatch[1].split(/\r?\n/)) {
      const match = line.trim().match(/^-\s+((?:references\/[^\s]+)|(?:tests\/evals\/[^\s]+))/);
      if (match) declaredRefs.push(match[1]);
    }
    if (!declaredRefs.length) errors.push('eval:references block is empty');
  }
  for (const reference of declaredRefs) {
    const parts = normalizeSlash(reference).split('/');
    const validDepth = (parts[0] === 'references' && parts.length === 2)
      || (parts[0] === 'tests' && parts[1] === 'evals' && parts.length === 3);
    if (!validDepth) errors.push(`Declared path has invalid depth: ${reference}`);
    if (!(await nonEmpty(path.join(skillRoot, reference)))) errors.push(`Declared path missing or empty: ${reference}`);
  }

  const casesPath = path.join(skillRoot, 'tests', 'evals', 'cases.jsonl');
  const regressionPath = path.join(skillRoot, 'tests', 'evals', 'regression-cases.jsonl');
  const lockPath = path.join(skillRoot, 'tests', 'evals', 'regression-lock.json');
  const caseText = (await nonEmpty(casesPath)) ? await readFile(casesPath, 'utf8') : '';
  if (!caseText) errors.push('tests/evals/cases.jsonl missing or empty');
  const cases = parseJsonLines(caseText, 'cases.jsonl', errors);
  const configRows = cases.filter((row) => row.id === 'model_config');
  if (configRows.length !== 1) errors.push('cases.jsonl must contain exactly one model_config row');
  else {
    const config = configRows[0];
    if (config.category !== 'config' || !config.strong_model_hint || !config.weaker_model_hint) errors.push('model_config is incomplete');
  }
  const dataCases = cases.filter((row) => row.id !== 'model_config');
  const byId = resultMap(dataCases);
  for (const required of REQUIRED_CASES) if (!byId.has(required)) errors.push(`cases.jsonl missing required ID '${required}'`);
  for (const row of dataCases) {
    validateCase(row, 'cases.jsonl', errors);
    if (/^A\d+$/.test(row.id) && !REQUIRED_EDGE.includes(row.id)) errors.push(`Reserved adversarial ID not allowed: ${row.id}`);
    if (/^ADV/.test(row.id)) errors.push(`Reserved ADV prefix not allowed: ${row.id}`);
  }
  const dCases = dataCases.filter((row) => /^D[1-3]$/.test(row.id));
  if (!dCases.some((row) => row.invocation === 'explicit')) errors.push('D-series lacks explicit invocation');
  if (!dCases.some((row) => row.invocation === 'implicit')) errors.push('D-series lacks implicit invocation');

  const regressionText = (await nonEmpty(regressionPath)) ? await readFile(regressionPath, 'utf8') : '';
  if (!regressionText) errors.push('regression-cases.jsonl missing or empty');
  const regressions = parseJsonLines(regressionText, 'regression-cases.jsonl', errors);
  for (const row of regressions) validateCase(row, 'regression-cases.jsonl', errors, true);
  let lock = [];
  try {
    lock = JSON.parse(await readFile(lockPath, 'utf8'));
    if (!Array.isArray(lock)) throw new Error('root must be an array');
  } catch (error) {
    errors.push(`regression-lock.json invalid: ${error.message}`);
  }
  const rawRegressionLines = regressionText.split(/\r?\n/).filter((line) => line.trim());
  if (lock.length !== rawRegressionLines.length) errors.push('regression lock count differs from retained cases');
  rawRegressionLines.forEach((line) => {
    const row = JSON.parse(line);
    const entry = lock.find((candidate) => candidate.id === row.id);
    if (!entry) errors.push(`regression lock missing '${row.id}'`);
    else if (entry.sha256 !== sha256(line)) errors.push(`retained regression '${row.id}' was mutated`);
  });

  if (options.runEvidence) {
    const evidencePath = path.resolve(options.runEvidence);
    if (!isInside(tmpdir(), evidencePath)) errors.push(`Run evidence must be inside OS temp: ${evidencePath}`);
    let evidence;
    try {
      evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
    } catch (error) {
      errors.push(`Run evidence missing or invalid: ${error.message}`);
    }
    if (evidence) {
      if (evidence.skill !== metadata.name) errors.push(`Evidence skill '${evidence.skill}' does not match '${metadata.name}'`);
      const matrix = evidence.model_matrix;
      if (!Array.isArray(matrix) || matrix.length !== 2) errors.push('model_matrix must contain exactly two rows');
      const slots = resultMap((matrix || []).map((row) => ({ id: row.slot, ...row })));
      const models = [];
      for (const slotName of ['strong', 'weaker']) {
        const slot = slots.get(slotName);
        if (!slot) errors.push(`model_matrix missing '${slotName}'`);
        else {
          if (slot.result !== 'pass') errors.push(`model_matrix '${slotName}' is '${slot.result}', expected pass`);
          if (!slot.model || /^(?:unknown|placeholder|model[-_ ]?[ab12]?)$/i.test(slot.model)) errors.push(`model_matrix '${slotName}' lacks a concrete model`);
          models.push(slot.model);
        }
      }
      if (models.length === 2 && models[0]?.toLowerCase() === models[1]?.toLowerCase()) errors.push('strong and weaker slots must use distinct models');

      const discoveryMust = resultMap(evidence.discovery?.must_trigger || []);
      const discoveryNot = resultMap(evidence.discovery?.must_not_trigger || []);
      for (const id of ['D1', 'D2', 'D3']) if (discoveryMust.get(id)?.result !== 'pass') errors.push(`discovery ${id} did not pass`);
      for (const id of ['N1', 'N2', 'N3']) if (discoveryNot.get(id)?.result !== 'pass') errors.push(`discovery ${id} did not pass`);

      const aggregateAssertions = evidence.execution?.assertions || [];
      if (!aggregateAssertions.length || aggregateAssertions.some((row) => row.result !== 'pass')) errors.push('aggregate execution assertions must all pass');
      const executionPerSlot = evidence.execution_per_slot || {};
      const assertionOrders = [];
      for (const slotName of ['strong', 'weaker']) {
        const execution = executionPerSlot[slotName];
        if (!execution) {
          errors.push(`execution_per_slot missing '${slotName}'`);
          continue;
        }
        if (execution.model !== slots.get(slotName)?.model) errors.push(`execution model mismatch for '${slotName}'`);
        if (execution.unnecessary_loads?.length) errors.push(`execution '${slotName}' loaded unnecessary resources`);
        const assertions = execution.assertions || [];
        if (!assertions.length || assertions.some((row) => row.result !== 'pass')) errors.push(`execution assertions for '${slotName}' must all pass`);
        assertionOrders.push(assertions.map((row) => row.id));
        const caseRow = byId.get(execution.case_id);
        if (!caseRow) errors.push(`execution '${slotName}' references unknown case '${execution.case_id}'`);
        else {
          const opened = (execution.files_opened || []).map(normalizeSlash);
          for (const resource of caseRow.expected_resources) {
            const normalized = normalizeSlash(resource);
            if (!opened.some((entry) => entry === normalized || entry.endsWith(`/${normalized}`))) errors.push(`execution '${slotName}' did not open expected resource '${resource}'`);
          }
        }
      }
      if (assertionOrders.length === 2 && JSON.stringify(assertionOrders[0]) !== JSON.stringify(assertionOrders[1])) errors.push('model slots used different ordered assertion IDs');

      const edges = resultMap(evidence.edge_cases || []);
      for (const id of REQUIRED_EDGE) if (edges.get(id)?.result !== 'pass') errors.push(`edge case ${id} did not pass`);
    }
  }

  return {
    ok: errors.length === 0,
    mode: options.runEvidence ? 'complete' : 'structural',
    skill_root: skillRoot,
    declared_references: declaredRefs.length,
    case_count: dataCases.length,
    regression_count: regressions.length,
    errors,
    warnings,
  };
}
