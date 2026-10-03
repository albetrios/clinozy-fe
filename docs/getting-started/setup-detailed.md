# Local Development Setup

Step-by-step guide to set up and run `clinozy-fe` on your local machine (macOS and Windows).

**Quick reference:** For the canonical setup (Node **24** LTS, pnpm, env vars), see **[docs/getting-started/setup.md](setup.md)**. This file adds detailed, platform-specific steps (Homebrew, Windows, etc.).

---

## Quick Setup (copy-paste)

Already have **Git** installed? Just run these commands to get up and running in under 2 minutes.

### macOS

```bash
# Clone
git clone <repo-url>
cd clinozy-fe

# Install every external tool in one shot — bootstraps Homebrew + Node 24, then
# gitleaks, gh, jq, uv, ripgrep, shellcheck, librsvg, and a headless Docker runtime.
# (Non-interactive + idempotent; add --check to preview without changing anything.)
bash tooling/dev/setup-mac-tools.sh

# Install deps + run. Once Node/pnpm exist, `pnpm setup:local` does all of the above
# (it re-runs mac-tools in preflight) plus .env.local + MCP + dev in one command.
corepack enable
pnpm install
pnpm dev
# → App running at http://localhost:5173
```

### Windows (run PowerShell as Administrator)

```powershell
# Install Node.js + Git + Gitleaks
winget install OpenJS.NodeJS.LTS
winget install Git.Git
scoop install gitleaks          # or: choco install gitleaks

# Restart terminal after installs, then:
corepack enable

# Clone, install, and run
git clone <repo-url>
cd clinozy-fe
pnpm install
pnpm dev
# → App running at http://localhost:5173
```

> **That's it.** The app works without a backend — it redirects to `/login` and all UI renders correctly. See the detailed steps below if you hit any issues.

---

## Prerequisites

| #   | Tool           | Required Version                          | Required?   | Purpose                             |
| --- | -------------- | ----------------------------------------- | ----------- | ----------------------------------- |
| 1   | **Git**        | any recent                                | Yes         | Version control + Husky hooks       |
| 2   | **Node.js**    | **24.21.0** (24 Active LTS; see `.nvmrc`) | Yes         | JavaScript runtime                  |
| 3   | **Corepack**   | (ships with Node)                         | Yes         | Enables pnpm without global install |
| 4   | **pnpm**       | **12.8.1** (`packageManager` pin)         | Yes         | Package manager (via Corepack)      |
| 5   | **Gitleaks**   | any recent                                | Recommended | Pre-commit secret scanning          |
| 6   | **Semgrep**    | any recent                                | Optional    | Static analysis security scanning   |
| 7   | **Playwright** | (installed via pnpm)                      | Optional    | E2E browser testing                 |

> **macOS shortcut:** `pnpm setup:mac-tools` installs/upgrades items 2–6 above — plus `gh`, `jq`, `uv`, `ripgrep`, `shellcheck`, `librsvg` (`rsvg-convert`), and a headless Docker runtime — non-interactively via Homebrew. `pnpm setup:local` runs it for you on macOS (opt out with `--skip-mac-tools`). The list is data-driven from [`tooling/dev/setup-prerequisites-mac-tools.manifest`](../../tooling/dev/setup-prerequisites-mac-tools.manifest).

---

## Step 1 — Install Git

Git is required for cloning the repository and for Husky pre-commit hooks.

<details>
<summary><strong>macOS</strong></summary>

Git comes pre-installed on macOS. Verify by running:

```bash
git --version
```

If not installed, it will prompt you to install Xcode Command Line Tools. Alternatively:

```bash
# Via Homebrew
brew install git
```

If you don't have Homebrew yet:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

</details>

<details>
<summary><strong>Windows</strong></summary>

**Option A: Git for Windows (recommended)**

Download and install from [git-scm.com](https://git-scm.com/download/win). During installation:

- Select "Git from the command line and also from 3rd-party software"
- Select "Checkout as-is, commit Unix-style line endings"
- Select "Use Windows' default console window" or "Use MinTTY"

**Option B: Via winget**

```powershell
winget install Git.Git
```

**Option C: Via Chocolatey**

```powershell
choco install git
```

**Option D: Via Scoop**

```powershell
scoop install git
```

> **Tip:** After installing, restart your terminal so `git` is available on your PATH.

</details>

### Verify

```bash
git --version
# Should output git version 2.x.x
```

---

## Step 2 — Install Node.js (24 LTS)

The project pins **Node.js 24.21.0** (the latest release on the 24 Active LTS line, "Krypton") in `.nvmrc` and `.node-version`; `package.json` `engines` requires `>=24.15`.

<details>
<summary><strong>macOS</strong></summary>

**Option A: Using nvm (recommended)**

nvm lets you switch between Node versions per project.

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Restart your terminal (or source your profile), then:
nvm install    # reads .nvmrc and installs Node 24.21.0
nvm use        # activates Node 24.21.0 for the current shell
```

**Option B: Using Homebrew**

```bash
brew install node@24

# If you need to link it (when multiple Node versions exist):
brew link --overwrite node@24
```

**Option C: Direct download**

Download the macOS installer from [nodejs.org](https://nodejs.org/) (**LTS** — currently the 24.x line).

</details>

<details>
<summary><strong>Windows</strong></summary>

**Option A: Using nvm-windows (recommended)**

nvm-windows lets you switch between Node versions per project.

1. Download the installer from [github.com/coreybutler/nvm-windows/releases](https://github.com/coreybutler/nvm-windows/releases)
2. Run the installer
3. Restart your terminal, then:

```powershell
nvm install 24.21.0
nvm use 24.21.0
```

**Option B: Using fnm (fast alternative to nvm)**

```powershell
# Install fnm via winget
winget install Schniz.fnm

# Restart terminal, then:
fnm install 24.21.0
fnm use 24.21.0
```

**Option C: Direct download**

Download the Windows installer (.msi) from [nodejs.org](https://nodejs.org/) (**LTS** — 24.x). Run the installer and follow the prompts.

**Option D: Via winget**

```powershell
winget install OpenJS.NodeJS.LTS
```

**Option E: Via Chocolatey**

```powershell
choco install nodejs-lts
```

**Option F: Via Scoop**

```powershell
scoop install nodejs-lts
```

</details>

### Verify

```bash
node -v
# Should output v24.x.x (or newer LTS)
```

---

## Step 3 — Enable pnpm via Corepack

This project uses **pnpm 12.8.1** as its package manager (declared in `package.json` → `"packageManager": "pnpm@12.8.1+sha512…"`). Corepack ships with Node.js and manages the correct pnpm version for you automatically. pnpm reads its settings (overrides, allowed build scripts, `engineStrict`, release-age exclusions) only from `pnpm-workspace.yaml`.

<details>
<summary><strong>macOS</strong></summary>

```bash
# Enable Corepack (one-time setup)
corepack enable
```

If you get a permission error:

```bash
sudo corepack enable
```

</details>

<details>
<summary><strong>Windows</strong></summary>

Open **PowerShell as Administrator** (right-click PowerShell → "Run as administrator"):

```powershell
corepack enable
```

> **Note for nvm-windows users:** If `corepack` is not found, it may not be included in your Node installation. Install pnpm directly instead:
>
> ```powershell
> npm install -g pnpm@12.8.1
> ```

</details>

### Verify

```bash
pnpm -v
# Should output 12.8.1
```

Corepack reads the `"packageManager"` field from `package.json` and automatically downloads and uses the exact pnpm version when you run any `pnpm` command inside this project.

---

## Step 4 — Install Gitleaks (recommended)

Gitleaks scans staged files for accidental secrets (API keys, passwords, tokens) before every commit via the Husky pre-commit hook.

<details>
<summary><strong>macOS</strong></summary>

```bash
brew install gitleaks
```

</details>

<details>
<summary><strong>Windows</strong></summary>

**Option A: Via Scoop**

```powershell
scoop install gitleaks
```

**Option B: Via Chocolatey**

```powershell
choco install gitleaks
```

**Option C: Manual download**

Download the Windows binary from [github.com/gitleaks/gitleaks/releases](https://github.com/gitleaks/gitleaks/releases) and add it to your PATH.

</details>

### Verify

```bash
gitleaks version
```

> **Note:** If Gitleaks is not installed, the pre-commit hook skips the secret scan gracefully and prints a notice. Strongly recommended but not required to run the app.

---

## Step 5 — Install Semgrep (optional)

Semgrep runs static application security testing (SAST). Only needed if you want to run `pnpm security:sast` locally — CI always runs it regardless.

<details>
<summary><strong>macOS</strong></summary>

**Option A: Homebrew**

```bash
brew install semgrep
```

**Option B: pip**

```bash
pip3 install semgrep
```

</details>

<details>
<summary><strong>Windows</strong></summary>

**Option A: pip (recommended)**

```powershell
pip install semgrep
```

> **Note:** Requires Python 3.8+ installed. If you don't have Python, install it via [python.org](https://www.python.org/downloads/) or `winget install Python.Python.3.12`.

**Option B: WSL (Windows Subsystem for Linux)**

Semgrep has best support on Linux/macOS. On Windows, running it inside WSL is the most reliable approach:

```bash
# Inside WSL terminal:
pip3 install semgrep
```

</details>

### Verify

```bash
semgrep --version
```

---

## Step 6 — Clone and Install Dependencies

<details>
<summary><strong>macOS (Terminal / iTerm)</strong></summary>

```bash
# Clone the repository
git clone <repo-url>
cd clinozy-fe

# Install all dependencies (also sets up Husky git hooks automatically)
pnpm install
```

</details>

<details>
<summary><strong>Windows (PowerShell / Git Bash / Terminal)</strong></summary>

```powershell
# Clone the repository
git clone <repo-url>
cd clinozy-fe

# Install all dependencies (also sets up Husky git hooks automatically)
pnpm install
```

> **Tip:** Use **Git Bash** or **Windows Terminal** for the best experience. Avoid cmd.exe — it doesn't support some shell features used by Husky hooks.

</details>

This single command:

- Downloads all npm packages
- Sets up Husky pre-commit hooks (lint-staged, type-check, Gitleaks)
- Prepares the project for development

---

## Step 7 — Set Up Environment Variables

`pnpm setup:local` scaffolds `.env.local` from the committed `.env.example` with sensible defaults (it is gitignored — your local dev file for behavior flags and secrets). **No changes needed** for basic local development.

Default values in `.env.local`:

| Variable            | Default Value           | Description                      |
| ------------------- | ----------------------- | -------------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:3000` | Backend API URL                  |
| `VITE_DEV_API_URL`  | `http://localhost:3000` | Vite dev proxy target            |
| `VITE_SENTRY_DSN`   | (empty)                 | Sentry error tracking (optional) |
| `VITE_POSTHOG_KEY`  | (empty)                 | PostHog analytics (optional)     |
| `VITE_POSTHOG_HOST` | (empty)                 | PostHog host URL (optional)      |

> **Tip:** Put local overrides and secrets directly in `.env.local` (gitignored). The `.env.development` / `.env.production` files are the deploy-environment files (one `.env.<environment>` per environment), separate from your local dev file. `pnpm dev` reads `.env.local` only; `pnpm build` reads one file — the environment you pick when it asks, `.env.local` when it can't ask. Details: [which env files each command reads](../deployment/runbooks/environment-variables.md#which-env-files-each-command-reads).

---

## Step 8 — Start the Dev Server

```bash
pnpm dev
```

The app will be available at **http://localhost:5173/**

### Without Backend Running

The app works without a backend:

- Silent auth refresh fails gracefully (logged as "No active session")
- Redirects to `/login` automatically
- All UI, animations, and theme toggling work
- API-dependent features error or show empty states until clinozy-be is running on `:3000`

---

## Step 9 — (Optional) Install Playwright Browsers for E2E Tests

Only needed if you want to run end-to-end tests. Works the same on both macOS and Windows.

```bash
# Install Playwright browsers (Chromium, Firefox, WebKit)
pnpm exec playwright install
```

Then run E2E tests with:

```bash
pnpm test:e2e
```

---

## Quick Reference — All Commands

| Command                 | What it does                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`              | Start dev server with hot reload (port 5173)                                                                                                                    |
| `pnpm build`            | Type-check + production build → `dist/`; in a terminal, asks which `.env.<environment>` to use (`--env <environment>` skips it, `--sentry` uploads source maps) |
| `pnpm build:bundle`     | The same build without the question (for scripts)                                                                                                               |
| `pnpm preview`          | Preview the production build locally                                                                                                                            |
| `pnpm lint`             | Run ESLint on all files                                                                                                                                         |
| `pnpm lint:fix`         | Run ESLint with auto-fix                                                                                                                                        |
| `pnpm format`           | Format source files with Prettier                                                                                                                               |
| `pnpm format:check`     | Check formatting (no write)                                                                                                                                     |
| `pnpm type-check`       | TypeScript type-check (no emit)                                                                                                                                 |
| `pnpm test`             | Run unit tests (Vitest)                                                                                                                                         |
| `pnpm test:watch`       | Run tests in watch mode                                                                                                                                         |
| `pnpm test:coverage`    | Run tests with coverage report                                                                                                                                  |
| `pnpm test:e2e`         | Run E2E tests (Playwright — requires browser install)                                                                                                           |
| `pnpm security:secrets` | Gitleaks full-repo secret scan                                                                                                                                  |
| `pnpm security:sast`    | Semgrep SAST scan                                                                                                                                               |
| `pnpm clean`            | Remove `dist/`, coverage, and Vite cache                                                                                                                        |

---

## Troubleshooting

### `corepack enable` permission error

**macOS:**

```bash
sudo corepack enable
```

**Windows:** Open PowerShell as Administrator and retry.

### `corepack` or `pnpm` not found (Windows with nvm-windows)

nvm-windows may not include Corepack. Install pnpm directly:

```powershell
npm install -g pnpm@12.8.1
```

### pnpm version mismatch warning

Corepack reads the `"packageManager"` field from `package.json` and enforces `pnpm@12.8.1`. If you have a different global pnpm, Corepack takes precedence inside this project.

### Port 5173 already in use

Either stop the other process or Vite will auto-pick the next available port.

**macOS — find and kill the process:**

```bash
lsof -ti:5173 | xargs kill -9
```

**Windows — find and kill the process:**

```powershell
netstat -ano | findstr :5173
taskkill /PID <PID_NUMBER> /F
```

### Husky hooks not running

Make sure you ran `pnpm install` (which triggers the `prepare` script that sets up Husky). If hooks still don't run:

```bash
pnpm exec husky
```

> **Windows note:** Husky hooks work best in **Git Bash** or **Windows Terminal**. If you're using cmd.exe, hooks may not execute properly.

### Node version mismatch

**macOS (nvm):**

```bash
nvm use       # reads .nvmrc and switches to Node 24.21.0
node -v       # verify
```

**Windows (nvm-windows):**

```powershell
nvm use 24.21.0
node -v
```

### Line ending issues on Windows

If you see Git warnings about line endings, configure Git to handle them:

```powershell
git config --global core.autocrlf input
```

### Execution policy error on Windows (PowerShell)

If you get "running scripts is disabled on this system":

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
