import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Locks the deploy-per-purpose workflows: an instant production rollback that
// restores (never rebuilds) behind the production reviewer gate.
const workflow = (name: string): string =>
  readFileSync(join(process.cwd(), '.github/workflows', name), 'utf8');

/** Credentials the deploy itself uses: Netlify's, and Sentry's source-map upload (build only). */
const DEPLOY_CREDENTIALS = new Set([
  'NETLIFY_AUTH_TOKEN',
  'NETLIFY_SITE_ID',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
]);

describe('deploy workflows policy', () => {
  // clinozy-be's Railway deploy mirrored the whole GitHub Environment into the services, so CI-only
  // credentials (RELEASE_PLEASE_TOKEN, the Postman and Scalar keys) reached production's runtime
  // variables. Here every secret is named: the build reads VITE_* (public by design) and the deploy
  // its own credentials, never the environment wholesale. clinozy-be pins its side in
  // railway-variables-push.policy.unit.test.ts.
  it('names every secret the deploy reads, and never mirrors the GitHub Environment', () => {
    for (const name of readdirSync(join(process.cwd(), '.github/workflows'))) {
      expect(workflow(name), name).not.toMatch(/toJSON\((?:secrets|vars)\)/);
    }
    const named = [
      ...workflow('reusable-netlify-deploy.yml').matchAll(
        /\bsecrets\.([A-Z_][A-Z0-9_]*)/g,
      ),
    ].map((match) => match[1] ?? '');
    expect(named).toEqual(
      expect.arrayContaining(['NETLIFY_AUTH_TOKEN', 'VITE_API_BASE_URL']),
    );
    expect(
      named.filter(
        (secret) => !(secret.startsWith('VITE_') || DEPLOY_CREDENTIALS.has(secret)),
      ),
    ).toEqual([]);
  });

  it('rollback-deploy.yml is manual, production-gated, and restores without a rebuild', () => {
    const rollback = workflow('rollback-deploy.yml');
    expect(rollback).toContain('workflow_dispatch:');
    expect(rollback).toContain('environment: production');
    // Instant restore of an immutable deploy — NOT a rebuild.
    expect(rollback).toContain('restoreSiteDeploy');
    expect(rollback).not.toContain('pnpm build');
    expect(rollback).not.toMatch(/netlify\s+deploy\b/);
    // Shares the production concurrency group so it can't race a forward deploy.
    expect(rollback).toContain('group: netlify-deploy-production');
  });

  it('reusable-netlify-deploy.yml attests build provenance for the production bundle', () => {
    const reusable = workflow('reusable-netlify-deploy.yml');
    // The provenance attestation over the shipped bundle, wired into the deploy
    // that builds it — the frontend analog of clinozy-be's release attestation.
    expect(reusable).toContain('actions/attest-build-provenance@');
    // Attestation needs OIDC + write scope on the deploy job.
    expect(reusable).toContain('id-token: write');
    expect(reusable).toContain('attestations: write');
    // Production only — the development alias is not a release surface.
    expect(reusable).toMatch(
      /Attest production build provenance[\s\S]*environment == 'production'/,
    );
  });

  // cosign works on any plan: the production bundle and its SBOM are signed keyless, both
  // signatures verified against this workflow before the deploy, and only the verified bytes ship.
  it('signs the production bundle and its SBOM with cosign and deploys only verified bytes', () => {
    const reusable = workflow('reusable-netlify-deploy.yml');
    const steps = reusable.split('\n      - name: ');
    const step = (title: string) => steps.find((entry) => entry.startsWith(title)) ?? '';
    const production =
      "if: needs.resolve-environment.outputs.environment == 'production'";
    const sbom = step('Generate the production SBOM (CycloneDX)');
    expect(sbom).toContain(production);
    expect(sbom).toContain('format: cyclonedx-json');
    expect(step('Install cosign')).toContain('sigstore/cosign-installer@');
    const sign = step('Sign the production bundle and its SBOM (keyless)');
    expect(sign).toContain(production);
    expect(sign).toContain(
      'for subject in clinozy-fe-dist.tgz clinozy-fe-sbom.cyclonedx.json',
    );
    expect(sign).toContain(
      'cosign sign-blob --yes --bundle "${subject}.sigstore.json" "${subject}"',
    );
    const verify = step('Verify both signatures, then unpack the verified bundle');
    expect(verify).toContain(production);
    expect(verify).toContain('cosign verify-blob --bundle "${subject}.sigstore.json"');
    expect(verify).toContain(
      'SIGNER: ^${{ github.server_url }}/${{ github.repository }}/\\.github/workflows/reusable-netlify-deploy\\.yml@',
    );
    expect(verify).toContain(
      '--certificate-oidc-issuer https://token.actions.githubusercontent.com',
    );
    expect(verify).toContain('tar -xzf clinozy-fe-dist.tgz -C dist-verified');
    // Sign → verify → deploy, in that order, and production publishes the verified copy.
    const order = [
      'Sign the production bundle',
      'Verify both signatures',
      'Deploy to Netlify',
    ].map((title) => reusable.indexOf(`- name: ${title}`));
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(step('Deploy to Netlify')).toContain('DEPLOY_DIR="dist-verified"');
    expect(step('Deploy to Netlify')).toContain('--dir="$DEPLOY_DIR"');
    // Not gated on ARTIFACT_ATTESTATIONS: cosign needs no Enterprise plan.
    expect(sign).not.toContain('ARTIFACT_ATTESTATIONS');
  });

  // GitHub stores artifact attestations for a private repository only on Enterprise Cloud; on
  // other plans every attest step fails the job. ARTIFACT_ATTESTATIONS=disabled skips them —
  // so every attest step must honour the switch, and a disabled run must say so.
  it('gates every attest step on ARTIFACT_ATTESTATIONS and warns when it is disabled', () => {
    for (const name of ['post-merge-ci.yml', 'reusable-netlify-deploy.yml']) {
      const text = workflow(name);
      const steps: string[] = [];
      for (const line of text.split('\n')) {
        if (line.trimStart().startsWith('- name: ')) steps.push(line);
        else if (steps.length > 0) steps[steps.length - 1] += `\n${line}`;
      }
      const attestSteps = steps.filter((step) => step.includes('uses: actions/attest-'));
      expect(attestSteps.length, name).toBeGreaterThan(0);
      for (const step of attestSteps) {
        expect(step, `${name}: ${step.split('\n')[0]?.trim()}`).toContain(
          "vars.ARTIFACT_ATTESTATIONS != 'disabled'",
        );
      }
      expect(text, name).toContain("vars.ARTIFACT_ATTESTATIONS == 'disabled'");
      expect(text, name).toContain('title=Artifact attestations skipped');
    }
  });

  it('every caller of the reusable deploy grants the permissions its jobs request', () => {
    // A reusable workflow's job permissions must be a SUBSET of the caller's
    // grant, validated statically when the run starts — a caller that grants
    // less makes the ENTIRE calling workflow a startup_failure (this broke
    // every post-merge run and release deploy after the provenance job gained
    // id-token/attestations in #101). Each `uses:` job must widen explicitly.
    const requested = ['contents: read', 'id-token: write', 'attestations: write'];
    for (const caller of ['post-merge-ci.yml', 'release-deploy.yml']) {
      const text = workflow(caller);
      expect(text, `${caller} no longer calls the reusable?`).toContain(
        'reusable-netlify-deploy.yml',
      );
      for (const permission of requested) {
        expect(
          text,
          `${caller} must grant "${permission}" on the job calling reusable-netlify-deploy.yml`,
        ).toContain(permission);
      }
    }
  });

  it('release-deploy.yml deploys production on release publish, pinned to the tag', () => {
    const release = workflow('release-deploy.yml');
    // event-driven, and re-runnable for the same tag
    expect(release).toContain('release:');
    expect(release).toMatch(/types:\s*\[published\]/);
    expect(release).toContain('workflow_dispatch:');
    // production reviewer gate (via the reusable) + tag pin, never github.sha
    expect(release).toContain('github_environment: production');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression syntax, asserted verbatim
    expect(release).toContain('ref: ${{ needs.resolve.outputs.tag }}');
    expect(release).not.toContain('github.sha');
    expect(release).toContain('reusable-netlify-deploy.yml');
  });
});
