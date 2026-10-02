# Release versioning (conventional commits → release-please)

How version numbers are chosen in **clinozy-fe**. You do not set versions by hand —
conventional-commit prefixes drive release-please on the single trunk (`main`).

Branch flow: [trunk-based-workflow.md](trunk-based-workflow.md). CI/deploy: [cicd-and-netlify.md](../deployment/cicd-and-netlify.md).

## Commit prefix → bump

Highest bump among all **unreleased** commits wins (never additive — five `fix:`
commits still make one patch):

| Commit message                                                                     | Bump  | Example                         |
| ---------------------------------------------------------------------------------- | ----- | ------------------------------- |
| `fix: …`                                                                           | patch | `1.1.0 → 1.1.1`                 |
| `feat: …`                                                                          | minor | `1.1.0 → 1.2.0`                 |
| `feat!: …` or `BREAKING CHANGE:` footer                                            | major | `1.1.0 → 2.0.0`                 |
| `docs:` · `chore:` · `refactor:` · `ci:` · `test:` · `build:` · `style:` · `perf:` | none  | changelog only — **no release** |

## Single channel

One config, one manifest, one changelog — all on `main`:

| Config                               | Manifest                               | Changelog      |
| ------------------------------------ | -------------------------------------- | -------------- |
| `.github/release-please/config.json` | `.github/release-please/manifest.json` | `CHANGELOG.md` |

## How a release happens (cadence)

1. Every push to `main` runs [post-merge-ci.yml](../../.github/workflows/post-merge-ci.yml):
   release-please recomputes the next version + changelog and keeps **one standing
   Release PR** open — `chore: release X.Y.Z`. It is **not** auto-merged.
2. **Merging that Release PR (squash, by hand) is the ship button** → it re-triggers
   post-merge CI, which cuts the tag `vX.Y.Z` + GitHub Release and attaches the SBOM.
   Publishing the Release then fires
   [release-deploy.yml](../../.github/workflows/release-deploy.yml), which deploys that
   **tag** to production (Netlify `--prod`).
3. Meanwhile every `main` push already deploys the **development alias**
   (`development--clinozy-fe.netlify.app`) — no release needed.

`chore`/`docs`/`ci`/etc. commits do not bump the version, so they never open a release.
