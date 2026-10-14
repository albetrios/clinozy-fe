# Screens

| Slug         | Route                                                                                  | Purpose                                                                                     |
| ------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| empty-states | every clinic room under `/organization/:organizationSlug/…` and the `#settings/*` modal | What each section, tab and in-card list shows when it has no rows: the room and compact looks |

One screen spec covers every surface, because the change is one look applied everywhere; its
inventory names each surface, its route, tone, icon, words and action.

Shared: `shell.md` (where the empty state sits inside the room shell, the patient file and the
settings modal) · `preset.md` (the tones and the illustration's anatomy, light and dark).

Prototype: `empty-states.html` — both looks in every tone, light and dark (self-contained, no
scripts beyond the inline theme switch).
