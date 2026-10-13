# fix-upload-storage-cors-2026-10-13-lnab — as built

Baseline: none · KICKOFF.md approved 2026-10-13 ([UF3](plans/decisions.md))

## Rows

| #   | Planned                         | Actually built                                                                                                                                                                                                                                                                                                                                                                                                                    | Difference | Why | Decision | Commit        |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --- | -------- | ------------- |
| #1  | ROUTE 1 — the storage write     | `src/shared/api/uploads-api.ts`: the presign wire reads an optional `headers`; a PUT sets exactly those (falling back to `Content-Type` alone), a POST sets none; a write that never answers rejects with `AppError` `UPLOAD_STORAGE_UNREACHABLE` (status 0) instead of `TypeError('Network request failed')`. Tests: `uploads-api.test.ts` — the unreachable case, and a PUT presign's headers sent as listed with no credential | none       | —   | UF4, UF7 | (this commit) |
| #2  | ROUTE 2 — upload codes in words | `FRONTEND_ERROR_CODES.UPLOAD_STORAGE_UNREACHABLE`; `ERRORS_KEYS.frontend.upload.{storageUnreachable, storageRejected, notConfirmed, invalidFileName}` in all 11 `errors.json`; `map-frontend-error.ts` resolves the four codes by code. Tests: `map-frontend-error.test.ts` (each code → its English words)                                                                                                                       | none       | —   | UF5, UF6 | (this commit) |

## Summary

- **Verified in Chromium** on `http://localhost:5173` against the development bucket and clinozy-be
  on `:3000`: the avatar (Settings › Profile) and the organization logo (Settings › General) still
  meet the bucket's CORS refusal — that is fixed in the bucket (clinozy-be UC7) — and now toast
  "Couldn't send the file to storage. Check your connection and try again; if it keeps failing,
  contact support." instead of "Network request failed". With Chromium's CORS checks off, both
  complete end to end (S3 204 → confirm 200 → the avatar or logo attach 200), so the bucket is
  the only thing left.
- **Planned, not built:** none. **Built, not planned:** a `NOSONAR(S6847)` annotation on the consent
  card's `<dialog>` (`ConsentBanner.tsx`) — the one open SonarQube issue, already on `main`, which
  blocked the push's gate; no behaviour change ([UF9](plans/decisions.md)).
- **Definition of done (`KICKOFF.md` § 4):** 1 ✓ · 2 ✓ · 3 ✓ · 4 ✓ (`type-check`, `lint`,
  `biome:check`, `format:check`, `sync:check`, `tsdoc:check`; the touched suites 191/191).
- **AMBER:** the 10 non-English translations are the agent's and want a native read (UF6).

## Standing deviations

None. This iteration has no design input and changes no screen's layout.
