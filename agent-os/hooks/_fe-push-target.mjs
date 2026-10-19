// Shared by fe-guardrails.mjs (the push review gate) and fe-push-ci-watch.mjs: the directory a
// `git push` command runs in — its `git -C <dir>`, else its last `cd <dir>`, else the session's
// working directory — so a hook judges only pushes in its own repository (as clinozy-be's
// _be-push-target.mjs does); _fe-hook.mjs's isInsideRepository tells whether it is this one.
import { resolve } from 'node:path';

/** The absolute directory `command` pushes from, resolved against `cwd`. */
export function pushDirectory({ command, cwd }) {
  const flag = /\bgit\s+-C\s+(\S+)[^;&|]*\bpush\b/.exec(command)?.[1];
  const changes = [...command.matchAll(/(?:^|[;&|]\s*)cd\s+(\S+)/g)].map(
    (match) => match[1],
  );
  const target = flag ?? changes.pop();
  return target ? resolve(cwd, target) : cwd;
}
