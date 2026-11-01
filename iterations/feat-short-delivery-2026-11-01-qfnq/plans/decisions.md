# Decisions — feat-short-delivery-2026-11-01-qfnq

Every blocking answer and every scope decision, add-only. Kind is `RED`, `AMBER` or `SCOPE`. The contract is
clinozy-be's —
[`plans/decisions.md`](https://github.com/albetrios/clinozy-be/blob/main/iterations/feat-short-delivery-2026-11-01-qfnq/plans/decisions.md)
SD1–SD14; this file holds the screens' decisions only.

| #   | Date       | Kind  | Question or change                 | Decision                                                                                                                                                                                       |
| --- | ---------- | ----- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 2026-11-01 | RED   | What this iteration does on screen | The user: the Receive goods drawer takes the received quantity and free quantity per line; the order view marks short lines. Straight through.                                                 |
| D2  | 2026-11-01 | RED   | The contract                       | clinozy-be's route review (SD12): receive takes `received_quantity`, `received_free_quantity` per ordered line; reads carry them, `is_short` and `short_line_count`.                           |
| D3  | 2026-11-01 | AMBER | How the drawer takes them          | Two small number cells per ordered line ("Came" and "Free came"), prefilled with the ordered packs, 0…ordered; a line set to 0 + 0 reads as not arrived. The drawer's total follows what came. |
| D4  | 2026-11-01 | AMBER | How the view marks a short line    | A "Short · 8 of 10" chip on the line, and "2 lines short" beside the summary.                                                                                                                  |
| D5  | 2026-11-01 | RED   | Approval                           | Approved — straight through. Built on `main` after feat-purchase-line-gst (#213) merges.                                                                                                       |
