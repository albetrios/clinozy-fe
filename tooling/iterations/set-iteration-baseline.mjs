#!/usr/bin/env node
/**
 * pnpm iteration:baseline — record the Baseline the user confirmed for an iteration.
 *
 * Usage:
 *   pnpm iteration:baseline <iteration> <baseline|none>
 *
 * The Baseline is `none` (MODE initial) or an existing earlier iteration in this repository whose
 * `intake-files/` holds the required set — the incremental delta is a diff of `intake-files/` only,
 * so the Baseline's drop is mandatory. Writes the README's Baseline row and appends a History line
 * (date · Baseline from → to · — · who). The model: iterations/README.md.
 */
import { writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendHistoryEntry,
  EMPTY_FIELD,
  gitUserName,
  localDate,
  missingIntakeFiles,
  NO_BASELINE,
  parseIterationName,
  readAllIterationReadmes,
  parseIterationReadme,
  readIterationReadme,
  renderHistoryEntry,
  setReadmeField,
} from './iterations.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..');

const USAGE = `Usage:
  pnpm iteration:baseline <iteration> <baseline|none>`;

function openedOf(name, readme) {
  return (
    parseIterationReadme(readme).get('Opened') ?? parseIterationName(name)?.opened ?? ''
  );
}

/**
 * Decides a Baseline change without writing it.
 *
 * @param {{ repositoryRoot: string, iteration: string | undefined, baseline: string | undefined, today?: string }} request
 * @returns {{ readmePath: string, from: string, to: string, historyEntry: string, content: string }}
 * @throws on an unknown iteration; a Baseline that is not `none` or an earlier iteration in this
 *   repository; a Baseline whose `intake-files/` lacks the required set; an unchanged Baseline; or
 *   an empty `user.name`
 */
export function planBaselineChange({ repositoryRoot, iteration, baseline, today }) {
  if (iteration === undefined || baseline === undefined) throw new Error(USAGE);
  const readme = readIterationReadme({ repositoryRoot, iteration });
  if (baseline !== NO_BASELINE) {
    const candidate = readAllIterationReadmes(repositoryRoot).get(baseline);
    if (
      baseline === iteration ||
      candidate === undefined ||
      openedOf(baseline, candidate) > openedOf(iteration, readme.content)
    ) {
      throw new Error(
        `Baseline "${baseline}" must be "none" or an earlier iteration in this repository — see pnpm iteration:list.`,
      );
    }
    const missing = missingIntakeFiles({ repositoryRoot, iteration: baseline });
    if (missing.length > 0) {
      throw new Error(
        `Baseline "${baseline}" has an incomplete intake (missing: ${missing.join(', ')}) — the incremental delta is a diff of the two intakes only, so the Baseline's drop is mandatory.`,
      );
    }
  }
  const current = readme.fields.get('Baseline') ?? EMPTY_FIELD;
  if (current === baseline)
    throw new Error(`${iteration} already has Baseline ${baseline}.`);
  const historyEntry = renderHistoryEntry({
    date: today ?? localDate(new Date()),
    change: `Baseline ${current} → ${baseline}`,
    reason: undefined,
    owner: gitUserName(repositoryRoot),
  });
  return {
    readmePath: readme.path,
    from: current,
    to: baseline,
    historyEntry,
    content: appendHistoryEntry({
      readme: setReadmeField({
        readme: readme.content,
        label: 'Baseline',
        value: baseline,
      }),
      historyEntry,
    }),
  };
}

/**
 * Runs `pnpm iteration:baseline` and returns what to print.
 *
 * @param {readonly string[]} commandLine
 * @param {{ repositoryRoot?: string, today?: string }} [context]
 * @returns {{ exitCode: number, lines: string[] }}
 */
export function runBaseline(commandLine, context = {}) {
  if (commandLine.includes('--help') || commandLine.includes('-h'))
    return { exitCode: 0, lines: [USAGE] };
  const unknown = commandLine.find((token) => token.startsWith('-'));
  if (unknown !== undefined) throw new Error(`Unknown option "${unknown}".`);
  if (commandLine.length !== 2) return { exitCode: 1, lines: [USAGE] };
  const repositoryRoot = context.repositoryRoot ?? REPOSITORY_ROOT;
  const [iteration, baseline] = commandLine;
  const plan = planBaselineChange({
    repositoryRoot,
    iteration,
    baseline,
    today: context.today,
  });
  writeFileSync(plan.readmePath, plan.content);
  return {
    exitCode: 0,
    lines: [
      `${iteration}: Baseline ${plan.from} → ${plan.to}`,
      `History: ${plan.historyEntry.slice(2)}`,
      `Written: ${relative(repositoryRoot, plan.readmePath)}`,
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { exitCode, lines } = runBaseline(process.argv.slice(2));
    console.log(lines.join('\n'));
    process.exitCode = exitCode;
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
