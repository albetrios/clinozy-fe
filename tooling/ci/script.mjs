/**
 * The one way an FE tooling script reads its command line and knows it is the entry module
 * (clinozy-be's tooling scripts, on this repository's plain-Node shape).
 *
 * {@link parseCommandLine} reads every command line with node:util `parseArgs` — `--name value`,
 * `--name=value`, `-h`, `--` — strictly: an unknown option, a value option without its value, or
 * more positionals than the script takes throws an Error naming it. {@link isMain} replaces the
 * `process.argv[1]` comparisons each script carried. `tests/ci/tooling-command-line.policy.test.ts`
 * holds every script under `tooling/` and `agent-os/evals/` to both.
 */
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/** `path` with every symlink resolved, or `path` itself when it cannot be resolved. */
function realPath(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/**
 * True when the module at `importMetaUrl` is the script node was started with — not a test or
 * another script importing it. Both sides are compared by real path: node loads the entry module
 * from its real path, so a script started through a symlink (a symlinked checkout or parent
 * folder) would otherwise not know it is the entry and silently do nothing.
 *
 * @param {string} importMetaUrl the caller's `import.meta.url`
 * @returns {boolean}
 */
export function isMain(importMetaUrl) {
  const entry = process.argv[1];
  return (
    entry !== undefined &&
    realPath(resolve(entry)) === realPath(fileURLToPath(importMetaUrl))
  );
}

/**
 * @typedef {{ type: 'boolean' | 'string', short?: string, multiple?: boolean }} CommandLineOption
 */

/**
 * A script's own wording for an unknown option or a missing value; `undefined` keeps the default.
 *
 * @typedef {{ unknownOption?: (option: string) => string | undefined, needsValue?: (option: string) => string | undefined }} CommandLineMessages
 */

/**
 * Reads `args` with node:util `parseArgs` against `options` (its option config: `type`, `short`,
 * `multiple`).
 *
 * @param {readonly string[]} args the arguments after the script (`process.argv.slice(2)`)
 * @param {{ options?: Record<string, CommandLineOption>, maxPositionals?: number, usage?: string, messages?: CommandLineMessages }} [shape]
 *   `maxPositionals` (default 0) caps the positionals; `usage` is appended to a value or count
 *   error; `messages` words the unknown-option and missing-value errors the script's own way
 * @returns {{ values: Record<string, string | boolean | string[] | undefined>, positionals: string[] }}
 *   each given option by its name (a `multiple` one as an array), and the positionals in order
 * @throws {Error} `Unknown option "<option>".`, `<option> needs a value — <usage>` (missing, empty,
 *   or another `--option` in its place), or `Too many arguments: … — <usage>`
 */
export function parseCommandLine(
  args,
  { options = {}, maxPositionals = 0, usage, messages = {} } = {},
) {
  const withUsage = (message) => (usage ? `${message} — ${usage}` : `${message}.`);
  const unknownOption = (option) =>
    messages.unknownOption?.(option) ?? `Unknown option "${option}".`;
  const needsValue = (option) =>
    messages.needsValue?.(option) ?? withUsage(`${option} needs a value`);
  const { tokens } = parseArgs({
    args: [...args],
    options,
    strict: false,
    allowPositionals: true,
    tokens: true,
  });
  /** @type {Record<string, string | boolean | string[] | undefined>} */
  const values = {};
  const positionals = [];
  for (const token of tokens) {
    if (token.kind === 'positional') positionals.push(token.value);
    if (token.kind !== 'option') continue;
    const option = Object.hasOwn(options, token.name) ? options[token.name] : undefined;
    const spelled = token.inlineValue ? `${token.rawName}=${token.value}` : token.rawName;
    if (option === undefined || (option.type === 'boolean' && token.value !== undefined))
      throw new Error(unknownOption(spelled));
    if (option.type === 'boolean') {
      values[token.name] = true;
      continue;
    }
    const value = token.value;
    if (
      value === undefined ||
      value === '' ||
      (!token.inlineValue && value.startsWith('--'))
    )
      throw new Error(needsValue(token.rawName));
    values[token.name] = option.multiple
      ? [.../** @type {string[]} */ (values[token.name] ?? []), value]
      : value;
  }
  if (positionals.length > maxPositionals)
    throw new Error(withUsage(`Too many arguments: ${positionals.join(' ')}`));
  return { values, positionals };
}
