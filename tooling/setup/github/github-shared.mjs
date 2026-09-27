/**
 * Shared GitHub CLI helpers for tooling/setup/github/*.
 */
import { execFileSync, execSync } from 'node:child_process';

export class GitHubApiError extends Error {
  /**
   * @param {number | null} status
   * @param {string} message
   */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function repositoryFromGitRemote() {
  try {
    const remoteUrl = execSync('git remote get-url origin', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5_000,
    }).trim();

    const sshMatch = remoteUrl.match(/git@github\.com:([^/]+\/[^/.]+?)(?:\.git)?$/);
    if (sshMatch?.[1]) return sshMatch[1];

    const httpsMatch = remoteUrl.match(/github\.com\/([^/]+\/[^/.]+?)(?:\.git)?$/);
    if (httpsMatch?.[1]) return httpsMatch[1];
  } catch {
    // fall through
  }
  return undefined;
}

export function getRepositoryIdentifier() {
  if (process.env.GITHUB_REPOSITORY?.includes('/')) {
    return process.env.GITHUB_REPOSITORY;
  }
  const fromGit = repositoryFromGitRemote();
  if (fromGit) return fromGit;
  try {
    return execSync('gh repo view --json nameWithOwner -q .nameWithOwner', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15_000,
    }).trim();
  } catch {
    throw new Error(
      'Cannot resolve repository: set GITHUB_REPOSITORY, use a github.com git remote, or authenticate gh.',
    );
  }
}

/**
 * @param {readonly string[]} args
 * @param {{ stdin?: string }} [options]
 */
export function runGhJson(args, options = {}) {
  try {
    const output = execFileSync('gh', [...args], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30_000,
      input: options.stdin,
    });
    return JSON.parse(output);
  } catch (commandError) {
    const errorObject =
      /** @type {{ stderr?: Buffer | string, stdout?: Buffer | string, message?: string }} */ (
        commandError
      );
    const stderr =
      typeof errorObject.stderr === 'string'
        ? errorObject.stderr
        : (errorObject.stderr?.toString('utf-8') ?? '');
    const stdout =
      typeof errorObject.stdout === 'string'
        ? errorObject.stdout
        : (errorObject.stdout?.toString('utf-8') ?? '');
    const combined = `${stderr}\n${stdout}`.trim();
    const statusMatch = combined.match(/HTTP\s+(\d{3})/i);
    const status = statusMatch?.[1] ? Number.parseInt(statusMatch[1], 10) : null;
    throw new GitHubApiError(
      status,
      combined || (errorObject.message ?? 'gh command failed'),
    );
  }
}

export function requireGhAuth() {
  try {
    execSync('gh auth status', { stdio: ['pipe', 'pipe', 'pipe'], timeout: 15_000 });
  } catch {
    console.error('gh is not authenticated. Run `gh auth login` first.');
    process.exit(1);
  }
}

/**
 * @param {string} repository
 * @param {string} environment
 */
export function environmentExists(repository, environment) {
  try {
    runGhJson(['api', `repos/${repository}/environments/${environment}`]);
    return true;
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * @param {string} repository
 * @param {string} environment
 */
export function createEnvironment(repository, environment) {
  runGhJson(
    [
      'api',
      '--method',
      'PUT',
      '-H',
      'Accept: application/vnd.github+json',
      `repos/${repository}/environments/${environment}`,
      '--input',
      '-',
    ],
    { stdin: '{}' },
  );
}

/**
 * @param {string} environment
 * @param {'secrets' | 'variables'} resource
 * @param {string} jqPath
 */
export function fetchGitHubResourceLines(environment, resource, jqPath) {
  const output = execSync(
    `gh api --paginate repos/:owner/:repo/environments/${environment}/${resource} --jq '${jqPath}'`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000 },
  );
  return output
    .trim()
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * @param {string} environment
 */
export function listGitHubEnvironmentSecretNames(environment) {
  return fetchGitHubResourceLines(environment, 'secrets', '.secrets[].name');
}

/**
 * Live GitHub Environment Variables as a `name → value` map (values ARE returned
 * by the API, unlike secrets — so variables can be diffed). Paginates via
 * `gh api --paginate`; a 404 (environment has no variables yet) yields an empty
 * map. `@tsv` keeps the value intact even if it contains `=`.
 * @param {string} environment
 * @returns {Map<string, string>}
 */
export function listGitHubEnvironmentVariables(environment) {
  /** @type {Map<string, string>} */
  const variables = new Map();
  let output;
  try {
    // execFileSync (no shell): the jq `|`/`@tsv` are jq operators inside one arg,
    // and `environment` (a validated config name) never reaches a shell.
    output = execFileSync(
      'gh',
      [
        'api',
        '--paginate',
        `repos/:owner/:repo/environments/${environment}/variables`,
        '--jq',
        '.variables[] | [.name, .value] | @tsv',
      ],
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000 },
    );
  } catch (listError) {
    const message = listError instanceof Error ? listError.message : String(listError);
    if (/HTTP 404|Not Found/i.test(message)) return variables;
    throw listError;
  }
  for (const rawLine of output.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab === -1) {
      variables.set(line, '');
      continue;
    }
    variables.set(line.slice(0, tab), line.slice(tab + 1));
  }
  return variables;
}

/**
 * @param {string} environment
 * @param {string} name
 * @param {string} value
 */
export function setGitHubVariable(environment, name, value) {
  execFileSync('gh', ['variable', 'set', name, '--env', environment], {
    input: value,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30_000,
  });
}

/**
 * @param {string} environment
 * @param {string} name
 */
export function deleteGitHubVariable(environment, name) {
  execFileSync('gh', ['variable', 'delete', name, '--env', environment], {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30_000,
  });
}

/**
 * @param {string} environment
 * @param {string} name
 */
export function deleteGitHubSecret(environment, name) {
  execFileSync('gh', ['secret', 'delete', name, '--env', environment], {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30_000,
  });
}
