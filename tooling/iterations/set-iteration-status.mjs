#!/usr/bin/env node
/**
 * pnpm iteration:status — move an iteration along its lifecycle.
 *
 * Usage:
 *   pnpm iteration:status <iteration> <status> [--reason "<text>" | --reason=<text>]
 *
 * One step forward along planning → ready-for-approval → approved → implementing → done → frozen,
 * or ready-for-approval / approved / implementing back to planning with --reason. Writes the
 * README's Status row and appends a History line (date · from → to · reason · who). The model:
 * iterations/README.md.
 */
import { writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendHistoryEntry,
  gitUserName,
  ITERATION_STATUSES,
  localDate,
  readIterationReadme,
  renderHistoryEntry,
  setReadmeField,
  validateStatusTransition,
} from './iterations.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..');

const USAGE = `Usage:
  pnpm iteration:status <iteration> <status> [--reason "<text>"]

  statuses: ${ITERATION_STATUSES.join(' → ')}
  back to planning (from ready-for-approval, approved or implementing) needs --reason`;

/**
 * Parses `<iteration> <status> [--reason "<text>" | --reason=<text>]`.
 *
 * @param {readonly string[]} commandLine
 * @returns {{ iteration: string | undefined, status: string | undefined, reason: string | undefined, help: boolean }}
 * @throws on an unknown option, a `--reason` without text, or a third positional
 */
export function parseStatusArguments(commandLine) {
  const positionals = [];
  let reason;
  let help = false;
  for (let index = 0; index < commandLine.length; index += 1) {
    const token = commandLine[index];
    if (token === '--help' || token === '-h') help = true;
    else if (token === '--reason') {
      reason = commandLine[index + 1]?.trim();
      if (!reason || reason.startsWith('--'))
        throw new Error(
          '--reason needs text, e.g. --reason "scope changed after review"',
        );
      index += 1;
    } else if (token.startsWith('--reason=')) {
      reason = token.slice('--reason='.length).trim();
      if (reason === '') throw new Error('--reason needs text.');
    } else if (token.startsWith('-')) throw new Error(`Unknown option "${token}".`);
    else positionals.push(token);
  }
  if (positionals.length > 2)
    throw new Error(
      `Too many arguments: ${positionals.join(' ')} — expected <iteration> <status>.`,
    );
  return { iteration: positionals[0], status: positionals[1], reason, help };
}

/**
 * Decides a Status change without writing it: reads the README, validates the move, sets the
 * Status row and appends a History line signed with `git config user.name`.
 *
 * @param {{ repositoryRoot: string, iteration: string | undefined, status: string | undefined, reason: string | undefined, today?: string }} request
 * @returns {{ readmePath: string, from: string, to: string, historyEntry: string, content: string }}
 * @throws on an unknown iteration or status, an unknown current Status, a refused move, or an empty
 *   `user.name`
 */
export function planStatusChange({ repositoryRoot, iteration, status, reason, today }) {
  if (iteration === undefined || status === undefined) throw new Error(USAGE);
  const readme = readIterationReadme({ repositoryRoot, iteration });
  if (!ITERATION_STATUSES.includes(status)) {
    throw new Error(`Unknown status "${status}" — use ${ITERATION_STATUSES.join(', ')}.`);
  }
  const current = readme.fields.get('Status') ?? '';
  if (!ITERATION_STATUSES.includes(current)) {
    throw new Error(
      `${iteration}/README.md has Status "${current}", which is not a known status.`,
    );
  }
  validateStatusTransition({ from: current, to: status, reason });
  const historyEntry = renderHistoryEntry({
    date: today ?? localDate(new Date()),
    change: `${current} → ${status}`,
    reason,
    owner: gitUserName(repositoryRoot),
  });
  return {
    readmePath: readme.path,
    from: current,
    to: status,
    historyEntry,
    content: appendHistoryEntry({
      readme: setReadmeField({ readme: readme.content, label: 'Status', value: status }),
      historyEntry,
    }),
  };
}

/**
 * Runs `pnpm iteration:status` and returns what to print.
 *
 * @param {readonly string[]} commandLine
 * @param {{ repositoryRoot?: string, today?: string }} [context]
 * @returns {{ exitCode: number, lines: string[] }}
 */
export function runStatus(commandLine, context = {}) {
  const options = parseStatusArguments(commandLine);
  if (options.help || options.status === undefined)
    return { exitCode: options.help ? 0 : 1, lines: [USAGE] };
  const repositoryRoot = context.repositoryRoot ?? REPOSITORY_ROOT;
  const plan = planStatusChange({ repositoryRoot, ...options, today: context.today });
  writeFileSync(plan.readmePath, plan.content);
  return {
    exitCode: 0,
    lines: [
      `${options.iteration}: ${plan.from} → ${plan.to}`,
      `History: ${plan.historyEntry.slice(2)}`,
      `Written: ${relative(repositoryRoot, plan.readmePath)}`,
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { exitCode, lines } = runStatus(process.argv.slice(2));
    console.log(lines.join('\n'));
    process.exitCode = exitCode;
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
