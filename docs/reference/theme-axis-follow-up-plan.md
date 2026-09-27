# Theme axis follow-up plan

Post-audit hardening and polish after the 18-axis compliance pass
(`docs/reference/theme-axis-audit-playbook.md`). Work **one item per cycle**;
mark ✅ when done.

| #   | Item                                        | Status | Deliverable                                     |
| --- | ------------------------------------------- | ------ | ----------------------------------------------- |
| 1   | **CI validator** `pnpm validate:theme-axis` | ✅     | `tooling/validate/theme-axis.sh` + health-check |
| 2   | **Slot coverage** (Appearance, ⌘K)          | ✅     | `data-slot` on high-traffic surfaces            |
| 3   | **Named preset picker**                     | ✅     | Quick themes row in AppearancePanel             |
| 4   | **Settings icons in barrel**                | ✅     | `ICON_NAMES` + semantic settings nav            |
| 5   | **Sync `theming.md`**                       | ✅     | Expanded catalog + validator docs               |
| 6   | **Preset unit tests**                       | ✅     | rose/ocean, glass menu, motion override         |
| 7   | **`axeForDialog` helper**                   | ✅     | `tests/utils/axe-for-dialog.ts`                 |
| 8   | **Reduced motion → instant**                | ✅     | OS override in `applyGeneratedTheme`            |
| 9   | **Visual E2E matrix**                       | ✅     | Theme-extreme login snapshots                   |

## Re-run any item

```bash
pnpm validate:theme-axis   # gate only
pnpm health                # includes theme-axis in phase 8b
```

## Agent handoff

```text
Theme axis follow-up — item: <N> from docs/reference/theme-axis-follow-up-plan.md
Implement fully, update status table, run pnpm validate:theme-axis && pnpm type-check.
```
