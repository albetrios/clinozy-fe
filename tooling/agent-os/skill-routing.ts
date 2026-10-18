/**
 * The skill routing map, built once (as in clinozy-be's generate-docs.ts): a row per chain in
 * `agent-os/skills/chains.json` that has a `trigger`, then a row per skill whose own `trigger`
 * frontmatter (with its `triggerNote`) is not a chain's trigger. `pnpm agent-os:generate` renders
 * the rows into the "By file pattern" table of `agent-os/docs/skill-triggers.md` (between its
 * GENERATED markers) and into `agent-os/hooks/skill-routing.json`, which the edit hook reads — so
 * the table, the trigger evals and the edit-time reminders cannot differ.
 *
 * Upstream skills are not edited: their routes are chains (a chain may have one step).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** One routing row: the files that trigger it, the skills to run (in order), a note. */
export interface RoutingRoute {
  trigger: string;
  globs: string[];
  skills: string[];
  optional: string[];
  note: string;
  chain?: string;
}

export const GENERATED_START = '<!-- GENERATED:START -->';
export const GENERATED_END = '<!-- GENERATED:END -->';

/** A frontmatter field's value (a block scalar folded to one line), or undefined. */
export function frontmatterField(text: string, key: string): string | undefined {
  const block = text.match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!block) return undefined;
  const lines = block.split('\n');
  const index = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
  if (index === -1) return undefined;
  const inline = (lines[index] ?? '').slice(key.length + 1).trim();
  if (inline !== '' && !['>', '|', '>-', '|-'].includes(inline)) return unquote(inline);
  const collected: string[] = [];
  for (let cursor = index + 1; cursor < lines.length; cursor++) {
    const current = lines[cursor] ?? '';
    if (/^\s+\S/.test(current)) collected.push(current.trim());
    else if (/^\s*$/.test(current)) continue;
    else break;
  }
  return collected.join(' ').trim() || undefined;
}

/** Strip one layer of surrounding YAML quotes (`"**\/*.route.tsx"` → `**\/*.route.tsx`). */
const unquote = (value: string): string => value.replace(/^(['"])(.*)\1$/, '$2');

/** Escape a `|` so an embedded pipe does not split a Markdown table cell. */
const cell = (value: string): string => value.replace(/\|/g, '\\|');

/** A token that names files: a path, a glob or a dotted file name. */
const isPathLike = (token: string): boolean =>
  token.includes('/') || token.includes('*') || token.includes('.');

/** The comma-separated tokens of a trigger. */
const tokensOf = (trigger: string): string[] =>
  trigger
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

/** A trigger's tokens, path-like ones in backticks. */
const backtickedGlobs = (trigger: string): string =>
  tokensOf(trigger)
    .map((token) => (isPathLike(token) ? `\`${token}\`` : token))
    .join(' · ');

interface ChainDefinition {
  trigger?: string | null;
  steps?: string[];
  optional?: string[];
  description?: string;
}

/** The routing rows: chains first, in file order; then the skill rows, sorted by skill. */
export function routingRoutes(agentOsDirectory: string): RoutingRoute[] {
  const chains = (
    JSON.parse(readFileSync(join(agentOsDirectory, 'skills', 'chains.json'), 'utf8')) as {
      chains: Record<string, ChainDefinition>;
    }
  ).chains;
  const chainRoutes: RoutingRoute[] = [];
  for (const [chain, definition] of Object.entries(chains)) {
    if (!definition.trigger) continue;
    chainRoutes.push({
      trigger: definition.trigger,
      globs: tokensOf(definition.trigger).filter(isPathLike),
      skills: definition.steps ?? [],
      optional: definition.optional ?? [],
      note: definition.description ?? '',
      chain,
    });
  }
  const chainTriggers = new Set(chainRoutes.map((route) => route.trigger));
  const skillRoutes: RoutingRoute[] = [];
  const skills = readdirSync(join(agentOsDirectory, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort();
  for (const skill of skills) {
    const file = join(agentOsDirectory, 'skills', skill, 'SKILL.md');
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    const trigger = frontmatterField(text, 'trigger');
    if (!trigger || chainTriggers.has(trigger)) continue;
    skillRoutes.push({
      trigger,
      globs: tokensOf(trigger).filter(isPathLike),
      skills: [skill],
      optional: [],
      note: frontmatterField(text, 'triggerNote') ?? '',
    });
  }
  return [...chainRoutes, ...skillRoutes];
}

/** The "By file pattern" table body (it goes between the GENERATED markers). */
export function renderTriggerTable(routes: readonly RoutingRoute[]): string {
  const rows = routes.map((route) => {
    const steps = route.skills.map((skill) => `\`${skill}\``).join(' → ');
    const optionalSkills = route.optional.map((skill) => `\`${skill}\``).join(', ');
    const optional = route.optional.length ? ` (+ ${optionalSkills})` : '';
    return `| ${backtickedGlobs(route.trigger)} | ${steps}${optional} | ${cell(route.note)} |`;
  });
  return [
    'Generated by `pnpm agent-os:generate` from `agent-os/skills/chains.json` (one row per chain)',
    "and each skill's own `trigger` / `triggerNote` frontmatter — edit those, never this table.",
    '',
    '| File pattern | Skill(s) | Notes |',
    '| ------------ | -------- | ----- |',
    ...rows,
  ].join('\n');
}

/** The same rows as JSON, for the edit hook (`agent-os/hooks/fe-edit-hooks.mjs`). */
export function renderRoutingJson(routes: readonly RoutingRoute[]): string {
  return `${JSON.stringify(
    {
      description:
        "GENERATED by `pnpm agent-os:generate` from agent-os/skills/chains.json and each skill's `trigger` / `triggerNote` frontmatter — the rows of agent-os/docs/skill-triggers.md. Do not edit.",
      routes: routes.map(({ chain, globs, skills, optional, note }) => ({
        ...(chain ? { chain } : {}),
        globs,
        skills,
        ...(optional.length ? { optional } : {}),
        note,
      })),
    },
    null,
    2,
  )}\n`;
}

/** `text` with its GENERATED region replaced by `body`; undefined when it has no region. */
export function replaceGeneratedRegion(text: string, body: string): string | undefined {
  const start = text.indexOf(GENERATED_START);
  const end = text.indexOf(GENERATED_END);
  if (start === -1 || end === -1 || end < start) return undefined;
  return `${text.slice(0, start + GENERATED_START.length)}\n${body}\n${text.slice(end)}`;
}

/**
 * The fe-skill-registry inventory (between its GENERATED markers): every skill with its group
 * (`agent-os/skills/groups.json`) and its path, under the "(N skills)" count that
 * `agent-os/evals/check.ts` gates — so the inventory can never miss a skill or state a stale count.
 */
export function renderSkillCatalog(agentOsDirectory: string): string {
  const groups =
    (
      JSON.parse(
        readFileSync(join(agentOsDirectory, 'skills', 'groups.json'), 'utf8'),
      ) as {
        groups?: Record<string, string[]>;
      }
    ).groups ?? {};
  const groupOf = new Map(
    Object.entries(groups).flatMap(([group, skills]) =>
      skills.map((skill) => [skill, group]),
    ),
  );
  const skills = readdirSync(join(agentOsDirectory, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name)
    .filter((skill) => existsSync(join(agentOsDirectory, 'skills', skill, 'SKILL.md')))
    .sort();
  const rows = skills.map((skill) => {
    const text = readFileSync(
      join(agentOsDirectory, 'skills', skill, 'SKILL.md'),
      'utf8',
    );
    const manual =
      frontmatterField(text, 'disable-model-invocation') === 'true'
        ? ' (manual only)'
        : '';
    return `| \`${skill}\`${manual} | ${groupOf.get(skill) ?? '—'} | \`agent-os/skills/${skill}/SKILL.md\` |`;
  });
  return [
    `**Skill Inventory (${skills.length} skills)** — generated by \`pnpm agent-os:generate\` from each`,
    "skill's frontmatter and `agent-os/skills/groups.json`. What each skill is for is its description (the skill",
    "listing, and the skill's own file); per-skill notes: `agent-os/docs/skill-inventory.md`.",
    '',
    '| Skill | Group | Path |',
    '| ----- | ----- | ---- |',
    ...rows,
  ].join('\n');
}
