# Rebrand prompt — derive a new product from this repo

A copy-paste prompt for an AI agent (Claude Code, Cursor, Codex) that renames this repo to a new
product **end to end**: rename, verify, independently sweep for misses, and publish a fresh repo.
[new-project.md](new-project.md) explains _what_ the rebrand covers; this file is _how an agent
runs it_ without repeating the mistakes the first real rename made.

**How to use it:** fill in the inputs below, paste everything from
[The prompt](#the-prompt) down into a new agent session opened in this repo, and let it run. It
stops and asks at every irreversible step.

---

## Inputs

| Input            | Example            | Notes                                                                                              |
| ---------------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| `NEW_PRODUCT`    | `Acme Portal`      | Display name, exactly as users should see it                                                       |
| `NEW_REPO`       | `acme-org/acme-fe` | GitHub `owner/name` the result is pushed to                                                        |
| `HISTORY`        | `fresh` or `keep`  | `fresh` = one root commit, no inherited history (what the first rename chose)                      |
| `PRODUCT_DOMAIN` | `acme.app`         | Only if it is not `<namespace>.app` — one line in `src/lib/i18n/i18n.ts`                           |
| Backend running? | yes / no           | The new backend on `:3000` is needed to regenerate visual baselines; without it one test stays red |

---

## The prompt

> Rebrand this repo to **`<NEW_PRODUCT>`**, published to **`<NEW_REPO>`**, history **`<HISTORY>`**.
> Follow every phase below in order. Verify each step with real command output — never report a
> step done on inspection alone. Ask me before anything irreversible (deleting `.git`, any force
> push). If you find a rename miss that is not listed as already guarded, fix it **in the rebrand
> tooling** with a regression test, not only in the renamed files.

### Phase 0 — Confirm before touching anything

1. Read `tooling/setup/setup.config.json` → `project.*`. Record the **current** `productName`,
   `name`, `namespace`, `backendName` and `previousNames`. Call them `OLD_*` from here on.
2. `git status` must be clean. Record `OLD_HEAD=$(git rev-parse HEAD)` and the current `origin` URL.
3. **Snapshot the pre-rebrand tree** into the scratchpad — the independent sweep in Phase 5
   diffs against it, and it survives even if `.git` is later deleted:

   ```bash
   mkdir -p "$SCRATCH/orig" && git archive HEAD | tar -x -C "$SCRATCH/orig"
   ```

4. If `NEW_REPO` already exists on GitHub, count its commits **after fetching**, never with
   `gh api …/commits` — that endpoint returns one page of 30, and the first rename told the user
   "30 commits" about a repo that held 348:

   ```bash
   git fetch <new-remote> main && git rev-list --count FETCH_HEAD
   ```

   Report the exact count to the user before any overwrite is agreed.

### Phase 1 — Rename

```bash
pnpm rebrand "<NEW_PRODUCT>"           # dry run — read the whole preview
pnpm rebrand "<NEW_PRODUCT>" --apply   # write
```

Keep the "Manual steps this script cannot do" block it prints — Phase 7 works through it.
It deletes the visual baselines on purpose (they render the old brand).

### Phase 2 — Reinstall and re-lock

```bash
pnpm install && pnpm agent-os:lock
```

Then `git diff --stat pnpm-lock.yaml package.json`: only the package `name` line may change. Version
lines pnpm prints during install are it reconciling `node_modules`, not a re-resolution — the
lockfile diff is the source of truth.

### Phase 3 — Gates

```bash
pnpm health
pnpm validate:identity
```

Run them **separately**. While the visual baselines are missing, `pnpm health` exits non-zero, so
`pnpm health && pnpm validate:identity` silently skips the second command.

Expected: every phase passes except unit tests, where exactly one test fails —
`identity.policy.test.ts › deletes visual baselines`. That one is Phase 6. Any other failure is a
real miss: fix it before moving on.

### Phase 4 — Do not start the dev server with a chain

`pnpm setup:local` ends by spawning `pnpm dev` itself and never returns, so
`pnpm setup:local && pnpm dev` never reaches the second command. Run `pnpm setup:local` alone (in
the background) or use the preview tooling, then check `http://localhost:5173` answers 200.

### Phase 5 — Independent sweep (do not trust the validator alone)

`pnpm validate:identity` checks the ~17 declared surfaces. The first rename passed it while the old
brand was still on the onboarding screen in 11 languages. Sweep the whole tree both ways.

**5a. Old names still present.** For each of `OLD_productName`, `OLD_name`, `OLD_backendName`,
`OLD_namespace`:

```bash
git grep -Iin "<old>" | grep -v '^CHANGELOG.md:' | grep -v previousNames
```

Classify every hit. **Expected and correct:** `CHANGELOG.md` (excluded by design), the
`previousNames` entry in `setup.config.json`. **A miss:** the old name used as the _product_ — in
copy, a domain, a storage key, a doc example, a type name.

**5b. Nothing legitimate was renamed.** Several words that look like a brand are not one. Every
count must be ≥ the original (`NOW < ORIG` means the rename clobbered something):

```bash
ORIG="$SCRATCH/orig"
for t in 'src/core/' '@/core' 'core/http' 'core/rbac' 'core/config' 'core/version' 'core/types' \
         'core\.notice' 'corepack' 'Corepack' 'Core Web Vitals' 'axe-core' 'playwright-core' \
         'stryker-mutator/core' 'core-js' 'Core Concepts' 'Core principle' 'Core Layer'; do
  # This prompt lists every token itself — exclude it on both sides or it masks a loss of one.
  o=$(grep -rIoh --exclude=CHANGELOG.md --exclude=rebrand-prompt.md "$t" "$ORIG" | wc -l | tr -d ' ')
  n=$(git grep --untracked -Ioh "$t" -- ':!CHANGELOG.md' ':!**/rebrand-prompt.md' | wc -l | tr -d ' ')
  [ "$o" -gt "$n" ] && v="*** LOST $((o-n)) ***" || v=ok
  printf '%-24s %6s %6s  %s\n' "$t" "$o" "$n" "$v"
done
```

Add any new product-agnostic `core`-like token you spot in 5c to this list.

**5c. Every substitution, word by word.** Aligns each changed line with the original and prints
what word now sits where the new name appears. Read the whole list — this is what found the
lowercased type aliases:

```bash
NEW_NS=<new namespace> ORIG="$SCRATCH/orig" python3 - <<'PY'
import collections, difflib, os, re, subprocess
orig, ns = os.environ['ORIG'], os.environ['NEW_NS']
files = subprocess.run(['git', 'ls-files', '--others', '--cached', '--exclude-standard'],
                       capture_output=True, text=True).stdout.split()
pairs = collections.Counter()
for f in files:
    # Both sides must exist: the rebrand renames files on disk while the index can still
    # list the old path, and a new file has no original to compare against.
    if (f.startswith(('CHANGELOG.md', 'pnpm-lock.yaml'))
            or not os.path.isfile(os.path.join(orig, f)) or not os.path.isfile(f)):
        continue
    try:
        a = open(os.path.join(orig, f), encoding='utf-8').read().splitlines()
        b = open(f, encoding='utf-8').read().splitlines()
    except (UnicodeDecodeError, IsADirectoryError):
        continue
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag != 'replace':
            continue
        for old_line, new_line in zip(a[i1:i2], b[j1:j2]):
            if not re.search(ns, new_line, re.I):
                continue
            ow = re.findall(r'[A-Za-z0-9_.\-/]+', old_line)
            nw = re.findall(r'[A-Za-z0-9_.\-/]+', new_line)
            for t, x1, x2, y1, y2 in difflib.SequenceMatcher(None, ow, nw, autojunk=False).get_opcodes():
                if t == 'replace':
                    for o, n in zip(ow[x1:x2], nw[y1:y2]):
                        if re.search(ns, n, re.I):
                            pairs[(o, n)] += 1
for (o, n), c in pairs.most_common():
    print(f'{c:5}  {o!r:40} -> {n!r}')
PY
```

For each pair ask: was the left side the **product**? Red flags:

- **Casing changed shape** — `PascalCase` became `camelCase`, or `UPPER` became `Mixed`.
- **A ticket or issue id** (`ABC-FE-123` style) — historical references should not be renamed.
- **An alignment artifact** — an unrelated word on the left (`timeout -> …`) is the diff lining up
  two different lines, not a real substitution. Check the file before acting.

Intended, do not "fix": the local Postgres URL (`postgresql://<ns>:<ns>@localhost:5432/<ns>`) — the
backend's compose derives user, password and database from the product stem (`localDatabaseUrl()`).

**5d. Brand hiding in lowercase or inside another token.** Grep for the old namespace as a domain
(`<old>.app`, `<old>.com`), a storage-key prefix (`'<old>:`), and inside identifiers. Locale files
must contain **no** brand in any casing — they use `{{productName}}` / `{{productDomain}}`.

### Phase 6 — Visual baselines

With the new backend on `:3000`:

```bash
pnpm test:visual:update
```

Then `pnpm test` must be fully green. If the backend is not running, say so plainly: this is the
one test that is allowed to stay red, and it is not a defect.

### Phase 7 — Manual steps (credentials or binaries)

Work through the list the rebrand printed. Do the ones you can and **report the rest** — don't
skip them silently:

- PWA PNGs: new artwork in `public/app-icon.svg`, then the two `rsvg-convert` commands.
- GitHub: repo description + homepage, then `pnpm github:sync` (branch protection, environments).
- Netlify site, Sentry and PostHog projects → set `NETLIFY_SITE_ID` / `SENTRY_*` / `VITE_POSTHOG_*`
  in GitHub Environments, never in a committed file.
- Confirm the product domain (`productDomain` in `src/lib/i18n/i18n.ts`).
- The backend repo is a separate rebrand.

### Phase 8 — Publish

**Before anything irreversible, confirm with the user**: the exact remote commit count from
Phase 0, and that `HISTORY` is what they want.

For `HISTORY=fresh` (one root commit, nothing inherited):

1. The repo guardrail blocks `rm -rf` from agents. Give the user this one command to run:

   ```bash
   rm -rf .git
   ```

2. Then:

   ```bash
   git init -b main
   git remote add origin https://github.com/<NEW_REPO>.git
   pnpm prepare                      # re-installs the husky hooks the old .git held
   git add -A
   git diff --cached --name-only | grep -E '^\.env|node_modules|\.map$'   # must print only .env.example
   git commit -m "chore: initial commit"
   ```

   Later fixes are **amended into that commit** (`git add -A && git commit --amend`) so the repo
   starts as a single scratch commit with no history of the rename itself. Keep the message a
   plain `chore: initial commit` — no "renamed from …" wording.

3. Push. `git push --force` is blocked by the guardrail; the lease form is allowed and safer, since
   it refuses if anyone pushed after your fetch:

   ```bash
   git fetch origin main
   git push --force-with-lease=main:origin/main -u origin main
   ```

4. Verify: `git fetch origin && git rev-list --count origin/main` prints `1`.

For `HISTORY=keep`: point `origin` at `NEW_REPO` with `git remote set-url`, commit on a branch,
and open a PR — no history rewrite, no force push.

### Phase 9 — Report

End with: what was renamed (file count), every miss found in Phase 5 and where each was fixed,
gate results with real numbers (`health` N/15, tests N/M), what is still open and why, the
commit SHA and remote commit count. Correct any number you reported earlier if it turned out wrong.

---

## Already guarded — do not re-fix by hand

These misses were found by the first real rename and are now fixed **in the tooling**, each with a
test in `tests/ci/identity.policy.test.ts` that was proven to fail without its fix:

| Miss                                                                                          | Fix                                                                                    | Test                                                                |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| PascalCase type aliases lowercased (`type XFeRouter` → `type yFeRouter`)                      | `patternFor()` gives the camelCase matcher `preserveCase: true`                        | keeps a PascalCase identifier PascalCase                            |
| Colon storage keys left behind (`<old>:last-activity`) — tests cleared dead keys              | `NAMESPACE_STORAGE_KEYS` in `tooling/identity/identity.mjs`, wired into `rebrand.mjs`  | covers every colon-namespaced storage key the app derives           |
| Lowercase domain in 11 locales (`<old>.app/{{slug}}`) invisible to a cased guard              | `{{productDomain}}` i18n variable; locale guard now case-insensitive across every file | `<locale>` locale uses the variable, not the product name           |
| Test literal pinned the old key (`'<old>:last-activity'`)                                     | Tests derive keys from `PRODUCT_NAMESPACE`                                             | `SessionTimeoutDialog`, `version-update.cross-browser` suites       |
| Bare product word / namespace skipped for an invented name (`Organizations · <Old>` survived) | `isDistinctiveWord()` — swept and added to `previousNames` unless a common word        | sweeps and guards the bare product word only when it is distinctive |
| Bare camelCase token at the end of an identifier (`'oldFe'`) neither renamed nor guarded      | `camelPrefix` lookahead `(?![a-z0-9])`; guard also checks camelCase spellings          | renames a bare camelCase token at the end of an identifier          |

The storage-key test reads `${PRODUCT_NAMESPACE}:…` keys straight from `src/`, so adding a new key
without teaching the rebrand about it fails CI.

## Lessons that apply to any new miss

- **A green validator is not proof.** It checks the surfaces it was told about. The word-by-word diff
  against the snapshot (5c) is the proof.
- **A miss in a test is worse than a miss in copy.** A fixture that clears or asserts the old key
  keeps passing while testing nothing.
- **Fix the class, not the instance.** Patch the tooling, add a test, then revert the fix once to watch
  the test go red before trusting it.
- **Check both directions.** Under-renaming leaves the old brand; over-renaming invents things that do
  not exist ("Core Web Vitals" once became a fictional metric in 14 files).
- **Tests of the rename must use invented names** (`acme` → `zenith`). A test written with the real
  brand is itself rewritten by the next rename — its expectations updated, its input not — and fails
  while testing nothing new.

## Related

- [new-project.md](new-project.md) — what the rebrand covers, options, upstream sync
- [../reference/tools-and-usage.md](../reference/tools-and-usage.md) — every `pnpm` script
- `tooling/identity/` — `rebrand.mjs` (the command), `identity.mjs` (matchers, surfaces, invariants)
