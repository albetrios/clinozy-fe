#!/usr/bin/env node
// Claude Code UserPromptSubmit hook for clinozy-fe.
//
// When a prompt describes a build/change task, inject the relevant skill chain — plus the
// "consult fe-skill-registry FIRST" rule — as additionalContext. This operationalizes CLAUDE.md's
// skill-first workflow at PROMPT time; the skill reminders of fe-edit-hooks.mjs only fire
// reactively, AFTER an edit. The keyword→skill map mirrors agent-os/docs/skill-triggers.md.
//
// A new prompt is a new turn: it clears the once-per-turn record (_fe-turn-once.mjs), and a
// prompt that is /fe-ship or /fe-open-pr marks the turn as the PR request.
//
// Conservative by design: requires a build/change verb AND a domain noun, so ordinary prompts
// (questions, "run the tests", "explain this") produce nothing and never nag. Fails OPEN: an
// unreadable payload, no prompt, or no match exits 0 silently.
import { addModelContext, readHookPayload } from './_fe-hook.mjs';
import { markTurn, resetTurn } from './_fe-turn-once.mjs';

// The matches run line by line (whitespace other than a line break), as the grep that used to
// run them did.
const PULL_REQUEST_COMMAND = /^[^\S\n]*\/fe-(ship|open-pr)([^\S\n]|$)/m;
const BUILD_INTENT =
  /\b(add|create|new|implement|build|introduce|scaffold|generate|wire|register|redesign|beautify|style|restyle)\b/;

/** The skill chain each domain noun implies, in the order they are listed. */
const SKILL_HINTS = [
  [
    /\b(page|route|screen)\b/,
    'page/route → fe-page-scaffolding → fe-route-island (path, manifest, RBAC permission, routeTree + docs/reference/routes-and-ui.md)',
  ],
  [
    /\b(component|widget|card|button|modal|dialog|drawer|sheet|table|menu|dropdown)\b/,
    'component/UI → shadcn (pick + add) → frontend-design → composition-patterns → fe-test-generation',
  ],
  [
    /\b(form|input|field|validation)\b/,
    'form → composition-patterns (react-hook-form + Zod) → fe-test-generation',
  ],
  [
    /\b(hook|query|mutation|fetch|api|endpoint)\b/,
    'data/hook → react-best-practices (TanStack Query owns server state; contracts.ts Zod schemas)',
  ],
  [
    /\b(style|styles|styling|theme|tokens|tailwind|css|design|beautify|premium)\b/,
    'styling/theme → frontend-design (semantic tokens only — pnpm validate:tokens; fe-ui-sources rule)',
  ],
  [
    /\b(test|tests|e2e|playwright|spec|coverage)\b/,
    'tests → fe-test-generation → fe-e2e-testids',
  ],
  [
    /\b(icon|icons)\b/,
    'icons → import from @/shared/icons (fe-ui-sources rule), never lucide-react directly',
  ],
  [
    /\b(accessib|a11y|aria|keyboard|screen reader)\b/,
    'a11y/UX → web-design-guidelines / ui-ux-pro-max',
  ],
  [
    /env var|environment variable|\.env\b/,
    'env var → fe-documentation-maintenance (VITE_ = public; secrets via environment, .env.example template)',
  ],
];

const payload = readHookPayload();
const session = payload?.session_id;
resetTurn(session);
const prompt = typeof payload?.prompt === 'string' ? payload.prompt : '';

// /fe-ship and /fe-open-pr are the user asking for a PR in so many words: fe-no-unrequested-pr.mjs
// and fe-guardrails.mjs let this turn's PR creation through without a second confirmation. (The
// hook sees the prompt as typed — `/fe-ship <title>` — checked on Claude Code 2.1.302.)
if (PULL_REQUEST_COMMAND.test(prompt)) markTurn({ session, mark: 'pr-requested' });

const lower = prompt.toLowerCase();
const hints = BUILD_INTENT.test(lower)
  ? SKILL_HINTS.filter(([pattern]) => pattern.test(lower)).map(([, hint]) => hint)
  : [];
if (hints.length > 0) {
  addModelContext({
    event: 'UserPromptSubmit',
    context: [
      '🧭 clinozy-fe skill routing — consult agent-os/skills/fe-skill-registry/SKILL.md FIRST, then run:',
      ...hints.map((hint) => `  • ${hint}`),
      'Full map: agent-os/docs/skill-triggers.md · Done = pnpm health green.',
    ].join('\n'),
  });
}
process.exit(0);
