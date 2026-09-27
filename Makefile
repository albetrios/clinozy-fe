.PHONY: setup lint ci-local health health-fix security-scan secret-scan

## First-time setup
setup:
	@echo "Installing dependencies..."
	pnpm install
	@echo "Installing gitleaks..."
	brew install gitleaks || echo "Install gitleaks manually: https://github.com/gitleaks/gitleaks"
	@echo "Setup complete. Husky hooks are active."

## Run ESLint on entire project
lint:
	pnpm lint

## Simulate full CI locally
ci-local:
	pnpm lint && pnpm format:check && pnpm type-check && pnpm test && pnpm build

## Full project health check
health:
	./scripts/validate/health-check.sh

## Full project health check with auto-fix
health-fix:
	./scripts/validate/health-check.sh --fix

## Run Semgrep SAST scan
security-scan:
	semgrep --config auto .

## Run Gitleaks secret detection
secret-scan:
	gitleaks detect --source . -v
