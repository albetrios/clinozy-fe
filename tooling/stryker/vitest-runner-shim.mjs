/**
 * Stryker test runner `vitest-shim` — the upstream `vitest` runner from
 * `@stryker-mutator/vitest-runner` (pinned in `.github/workflows/mutation-test.yml`)
 * with the two fixes it lacks on Vitest 5. Delete this file and set
 * `"testRunner": "vitest"` + `"plugins": ["@stryker-mutator/vitest-runner"]` in
 * `stryker.config.json` once a runner release ships both.
 *
 * 1. stryker-mutator/stryker-js#6210 — Vitest 5 matches `testNamePattern` against
 *    the suite chain joined with `' > '`; the runner builds the pattern from names
 *    joined with a space. The pattern matched no test, so every mutant with
 *    per-test coverage ran zero tests and was reported Survived (0% on `csv.ts`,
 *    whose tests catch `== null` → `!= null`). Here each space in the pattern
 *    matches either joiner, which stays correct on Vitest 4.
 * 2. stryker-mutator/stryker-js#6144 — with `testFiles`, a static mutant (one that
 *    only runs while its module loads) gets a file-only test filter and therefore
 *    runtime activation, which the runner sets in a `beforeAll`: after the module
 *    has loaded, so the mutant is never active. A file-only filter (no `#` in the
 *    test ids) is exactly that case, and the environment is reloaded for it
 *    anyway, so the shim activates the mutant statically, as Stryker does when it
 *    has no filter at all.
 */
import {
  strykerValidationSchema,
  strykerPlugins as upstreamPlugins,
} from '@stryker-mutator/vitest-runner';

const [upstream] = upstreamPlugins;
/** Vitest 4 joins a test's suite chain with a space, Vitest 5 with `' > '`. */
const SUITE_JOINER = '(?: | > )';

function matchEitherJoiner(pattern) {
  return pattern instanceof RegExp
    ? new RegExp(pattern.source.replaceAll(' ', SUITE_JOINER), pattern.flags)
    : pattern;
}

class VitestRunnerShim {
  constructor(runner) {
    this.runner = runner;
  }

  capabilities() {
    return this.runner.capabilities();
  }

  async init() {
    await this.runner.init();
    for (const project of this.runner.ctx.projects) {
      let pattern = project.config.testNamePattern;
      Object.defineProperty(project.config, 'testNamePattern', {
        configurable: true,
        enumerable: true,
        get: () => pattern,
        set: (value) => {
          pattern = matchEitherJoiner(value);
        },
      });
    }
  }

  dryRun(options) {
    return this.runner.dryRun(options);
  }

  mutantRun(options) {
    const fileOnlyFilter = options.testFilter?.every((testId) => !testId.includes('#'));
    return this.runner.mutantRun(
      fileOnlyFilter ? { ...options, mutantActivation: 'static' } : options,
    );
  }

  dispose() {
    return this.runner.dispose();
  }
}

function createVitestRunnerShim(injector) {
  return new VitestRunnerShim(upstream.factory(injector));
}
createVitestRunnerShim.inject = upstream.factory.inject;

export const strykerPlugins = [
  { kind: upstream.kind, name: 'vitest-shim', factory: createVitestRunnerShim },
];
export { strykerValidationSchema };
