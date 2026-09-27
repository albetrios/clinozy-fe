# Setup — from clone to running

End-to-end guide for **clinozy-fe**. Two paths:

- **[Local development](#local-development)** — **clinozy-be** on `:3000` (Vite proxies `/api`). One command: `pnpm setup:local`.
- **[Deploy](#deploy)** — hosted providers (Sentry, PostHog, Stripe, Turnstile) are provisioned from a separate infrastructure repository; clinozy-fe consumes the resulting `.env.<environment>` values and pushes them to GitHub Environments with `pnpm github:sync`.

**Related:** [README.md](README.md) · [CLAUDE.md](CLAUDE.md) · [docs/getting-started/setup.md](docs/getting-started/setup.md) · [docs/README.md](docs/README.md)

---

## Local development

```bash
git clone <repo-url>
cd clinozy-fe
pnpm setup:local
```

See [docs/getting-started/setup.md](docs/getting-started/setup.md) for flags, MCP setup, and env vars.

---

## Deploy

**Source of truth for env values.** Each environment's deploy values live in a gitignored
`.env.<environment>` file at the repo root, derived from the committed `.env.example`. Fill
`.env.development` / `.env.production`, then:

```bash
pnpm github:sync          # scaffold .env.*, sync rulesets + environments, push secrets
pnpm github:sync --check  # read-only drift check
pnpm validate:deploy-env  # fail if required deploy secrets are missing
```

Netlify itself is connected once through the Netlify UI (push-to-deploy on `main`); manual
deploys use `pnpm deploy:netlify` / `pnpm deploy:netlify:prod`.

See [docs/deployment/netlify-cli-setup.md](docs/deployment/netlify-cli-setup.md) and
[.github/environments/README.md](.github/environments/README.md).
