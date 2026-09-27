# In-source documentation tiers

Every subsystem gets an **`<AREA>.OVERVIEW.md`** — that is mandatory and
validator-enforced (`pnpm validate:structure` for route islands). For a **complex
subsystem** whose behaviour is not obvious from the file list alone, three
_optional_ companion tiers add narrative depth next to the code, mirroring
clinozy-be's OVERVIEW / PATTERNS / FLOWS / POLICIES model.

Use them additively — start with OVERVIEW, add a tier only when it earns its
keep. Most areas need only OVERVIEW.

| Tier                    | File                 | Answers                                              | Add it when…                                                |
| ----------------------- | -------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| **Overview** (required) | `<AREA>.OVERVIEW.md` | What lives here, the files, the consumers            | Always                                                      |
| **Patterns**            | `<AREA>.PATTERNS.md` | The recurring idioms — _how we build things here_    | The area has non-obvious conventions a new file must follow |
| **Flows**               | `<AREA>.FLOWS.md`    | The runtime sequences — _what happens, step by step_ | Behaviour spans several modules in an order that matters    |
| **Policies**            | `<AREA>.POLICIES.md` | The invariants — _rules that must not be broken_     | Getting it wrong causes a security/correctness bug          |

Naming mirrors the OVERVIEW convention: `<AREA>` is the uppercased directory name
(`src/shared/tenancy/` → `TENANCY.PATTERNS.md`). Keep each tier short and specific
to _this_ area; cross-link the OVERVIEW to whichever tiers exist.

**Worked exemplar:** `src/shared/tenancy/` carries all four —
[`TENANCY.OVERVIEW.md`](../../src/shared/tenancy/TENANCY.OVERVIEW.md),
`TENANCY.PATTERNS.md`, `TENANCY.FLOWS.md`, `TENANCY.POLICIES.md` — the reference
for what each tier should contain.

## Templates

Each tier is a short markdown file. Skeletons:

```markdown
# `<path>/` — Patterns

## <Pattern name>

**Idiom:** <the recurring shape, in one line.>
**Why:** <the force that makes it the idiom.>
**Applies to:** <which files / when a new file must follow it.>
```

```markdown
# `<path>/` — Flows

## <Flow name>

1. <step> → <step> → <step>

Entry point: `<file.ts>` · Guards: `<guard>` · Ends at: `<result>`.
```

```markdown
# `<path>/` — Policies

## <Invariant, stated as a rule>

**Must:** <the rule.>
**Because:** <the failure if broken — the bug it prevents.>
**Enforced by:** <test / guard / type that backs it, if any.>
```
