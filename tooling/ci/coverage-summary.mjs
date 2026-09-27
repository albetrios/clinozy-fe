#!/usr/bin/env node
/**
 * Renders coverage/coverage-summary.json (vitest json-summary reporter) as a
 * markdown table appended to $GITHUB_STEP_SUMMARY. Invoked by the unit-tests
 * lane in .github/workflows/ci.yml; prints to stdout when the env var is
 * absent so it can be run locally.
 */
import { appendFileSync, readFileSync } from 'node:fs';

const { total } = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
const row = (label, metric) => `| ${label} | ${metric.pct}% | ${metric.covered}/${metric.total} |`;
const lines = [
  '## Coverage',
  '',
  '| Metric | Coverage | Covered/Total |',
  '| --- | --- | --- |',
  row('Statements', total.statements),
  row('Branches', total.branches),
  row('Functions', total.functions),
  row('Lines', total.lines),
  '',
  'Thresholds are a ratchet (vitest.config.ts) — they only move up.',
];

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  appendFileSync(summaryPath, `${lines.join('\n')}\n`);
} else {
  console.log(lines.join('\n'));
}
