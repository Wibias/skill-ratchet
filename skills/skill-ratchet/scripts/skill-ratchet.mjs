#!/usr/bin/env node
import { runPreflight } from './preflight.mjs';
import { validateSkill } from './validate.mjs';

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const values = { roots: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (['json', 'discovery-only', 'no-defaults'].includes(key)) {
      values[key] = true;
      continue;
    }
    const value = rest[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    index += 1;
    if (key === 'root') values.roots.push(value);
    else values[key] = value;
  }
  return { command, values };
}

function help() {
  return `Skill Ratchet\n\nCommands:\n  preflight --query <text> [--root <path>] [--project-root <path>] [--threshold <0..1>] [--evidence <temp-path>] [--discovery-only] [--no-defaults] [--json]\n  validate --skill-root <path> [--run-evidence <temp-path>] [--json]\n`;
}

function printPreflight(result, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(`Skill Ratchet preflight\nStatus: ${result.status}\nTop score: ${result.top_score}\n${result.rationale}\n`);
  for (const entry of result.ranked) process.stdout.write(`${entry.plausible ? '*' : '-'} ${entry.score.toFixed(4)} ${entry.path}\n`);
}

function printValidation(result, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(`Skill Ratchet ${result.mode} validation: ${result.ok ? 'PASS' : 'FAIL'}\n`);
  for (const error of result.errors) process.stdout.write(`ERROR: ${error}\n`);
  for (const warning of result.warnings) process.stdout.write(`WARN: ${warning}\n`);
}

async function main() {
  const { command, values } = parseArgs(process.argv.slice(2));
  if (!command || command === 'help' || values.help) {
    process.stdout.write(help());
    return;
  }
  if (command === 'preflight') {
    const result = await runPreflight({
      query: values.query,
      roots: values.roots,
      projectRoot: values['project-root'],
      threshold: values.threshold === undefined ? undefined : Number(values.threshold),
      evidence: values.evidence,
      discoveryOnly: Boolean(values['discovery-only']),
      includeDefaults: !values['no-defaults'],
    });
    printPreflight(result, values.json);
    return;
  }
  if (command === 'validate') {
    if (!values['skill-root']) throw new Error('validate requires --skill-root');
    const result = await validateSkill({ skillRoot: values['skill-root'], runEvidence: values['run-evidence'] });
    printValidation(result, values.json);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  throw new Error(`Unknown command '${command}'\n\n${help()}`);
}

main().catch((error) => {
  process.stderr.write(`Skill Ratchet error: ${error.message}\n`);
  process.exitCode = 1;
});
