# Motion audit — change-motion-consistency-2026-10-15-uiya

The app's motion measured against Emil Kowalski's standards (`agent-os/skills/emil-design-eng`,
`agent-os/skills/review-animations/STANDARDS.md`) on 2026-10-15, in the skills' required format:
one row per finding. "Ours" marks what `change-motion-polish` built the day before.

## Findings

| Before                                                                                                                                  | After                                                           | Why                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Glides on `--ease-sheet` (ours)                                                                                                         | Glides on `--ease-in-out-strong`                                | Moving on screen → ease-in-out; the sheet curve is a drawer's                               |
| Glides 280ms (ours); phone lens 320ms                                                                                                   | Every glide 240ms                                               | Tabs are switched tens of times a day: reduce, keep under 300ms; one timing for one gesture |
| The new tab's ink changes on its own 150ms (ours)                                                                                       | Ink transitions on the thumb's 240ms curve                      | The label should darken as the thumb arrives — Emil's "perfect color transitions"           |
| Thumb placed through custom properties (ours)                                                                                           | `translate`, `width`, `height` set on the thumb                 | Set the property directly; no custom-property indirection                                   |
| Switch thumb on `--ease-out-strong` (ours)                                                                                              | Strong ease-in-out, 200ms                                       | The thumb travels; the track's colour keeps `ease`                                          |
| Count roll 280ms (ours)                                                                                                                 | 240ms                                                           | A dashboard stays crisp                                                                     |
| Lane cascade 25ms apart over six (ours)                                                                                                 | 30ms apart over four, 200ms each                                | Stagger 30–80ms; short total for a frequent switch                                          |
| Tick from `scale(0.65)` (ours)                                                                                                          | From `scale(0.9)` + opacity                                     | Never appear from (near) nothing: start at 0.9–0.97                                         |
| Reduced motion: everything at once (ours and the app)                                                                                   | Movement at once; meaningful opacity / colour fades stay, 160ms | Reduced motion means gentler, not zero                                                      |
| Refresh settle skipped under reduced motion (ours)                                                                                      | Kept — it is opacity only                                       | As above                                                                                    |
| Lane tiles: no press feedback                                                                                                           | `scale(0.97)` while held                                        | Every pressable answers a press                                                             |
| Phone tab icons dip to 92%, 100ms on `ease`                                                                                             | 95%, 160ms on the strong ease-out                               | Press scale 0.95–0.98; 100–160ms ease-out                                                   |
| Command palette fades and drops in on Ctrl+K                                                                                            | Opens and closes at once                                        | Keyboard-initiated, 100+ a day: no animation, ever                                          |
| Tooltips animate every time                                                                                                             | Instant (no animation) once one is open                         | Instant follow-on tooltips make a toolbar feel faster                                       |
| Menus, popovers, tooltips leave as slowly as they enter                                                                                 | Leave in 100ms                                                  | Exits faster than entrances                                                                 |
| Vendored entrances on the built-in `ease`                                                                                               | Strong ease-out (`ease-out` utility)                            | Built-in CSS easings are too weak                                                           |
| Sheet primitive: 500ms in, 300ms out, `ease-in-out`                                                                                     | 340ms in on the sheet curve, 200ms out                          | Drawers 200–500ms on the drawer curve; ease-in-out delays an entrance                       |
| Dropdown / reveal on `cubic-bezier(.2,.8,.2,1)`; page rise on `(.22,1,.36,1)`; pop and fade on `ease`; accordion on built-in `ease-out` | All on `--ease-out-strong`                                      | One entering curve, strong                                                                  |
| Tailwind's `ease-out`, `ease-in-out`, default transition curve                                                                          | Re-pointed at the strong curves                                 | Every existing transition follows without per-file edits                                    |
| Bug report, sign-in dial, onboarding: the strong curves as literals                                                                     | Read the named tokens (CSS) or `motion-curves.ts` (script)      | One source; no behaviour change                                                             |
| `transition-all` on the progress bar, accordion trigger, OTP slot, copy chip                                                            | Named properties                                                | `transition: all` animates what nobody meant to                                             |

## Checked and kept

| Where                                     | Why it stays                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Drawer exits (none)                       | A system response should snap; drawers open and close all day                            |
| Room search field width morph             | A layout animation on an occasional action; its curve is now named                       |
| Route progress sweep, OTP shake, spinners | Constant motion and error feedback, each already fit for purpose                         |
| Popover origins                           | Every Radix popover scales from its trigger (`change-motion-polish` fixed the last two)  |
| Hover motion                              | Tailwind's `hover:` is behind `(hover: hover)`; the bug report's plain `:hover` is gated |
| Toasts                                    | Sonner — interruptible transitions by design                                             |
