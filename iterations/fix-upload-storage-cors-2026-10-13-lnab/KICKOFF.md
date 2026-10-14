# fix-upload-storage-cors-2026-10-13-lnab — kickoff

## 1. Header

| Field     | Value                                                                                       |
| --------- | ------------------------------------------------------------------------------------------- |
| Iteration | `fix-upload-storage-cors-2026-10-13-lnab`                                                   |
| Type      | fix                                                                                         |
| Baseline  | none ([UF2](plans/decisions.md))                                                            |
| Intake    | none — a fix with no design input ([UF2](plans/decisions.md))                               |
| Branch    | `fix/upload-storage-cors`                                                                   |
| Sibling   | clinozy-be's same-named iteration — the cause, the bucket CORS policy and its check / apply |

## 2. Goal and scope

Profile avatar and organization logo uploads fail. The browser's write to S3 is refused by the
bucket's CORS rule (clinozy-be UC1), and the page then toasts the raw English "Network request
failed"; the other upload failures toast bare codes such as `UPLOAD_STORAGE_REJECTED`. The bucket is
fixed on the backend's side; here the failures are said in words in every locale, and the
presigned-PUT fallback sends the headers its URL signs.

In scope: `src/shared/api/uploads-api.ts` (the storage write), the upload codes' messages
(`errors:frontend.upload.*`, 11 locales) and their mapping. Out of scope: any screen's layout, the
upload tray's per-row text, the bucket itself.

## 3. ROUTE

| #   | Work item                                                                                                                 | Kind | Depends on | Skill/driver                             | Acceptance     | Assignee | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ---- | ---------- | ---------------------------------------- | -------------- | -------- | ------ |
| 1   | Storage write: a write that never answers rejects with `UPLOAD_STORAGE_UNREACHABLE`; a PUT sends the response's `headers` | code | —          | fe-http-forms-errors, fe-test-generation | § 4 lines 1, 3 | Claude   | done   |
| 2   | Upload codes in words: `errors:frontend.upload.*` in 11 locales, resolved by code                                         | code | 1          | fe-i18n-constants, fe-test-generation    | § 4 line 2     | Claude   | done   |

## 4. Definition of done

1. A storage write the browser blocks (CORS) or loses (offline) toasts
   `errors:frontend.upload.storageUnreachable`, not "Network request failed" — verified in
   Chromium on `http://localhost:5173` against the development bucket.
2. `UPLOAD_STORAGE_REJECTED`, `UPLOAD_NOT_CONFIRMED` and `UPLOAD_INVALID_FILE_NAME` toast their
   own words in every locale.
3. With a `PUT` presign carrying `headers`, the write sends them; without, `Content-Type` alone.
4. `pnpm type-check`, `pnpm lint`, `pnpm biome:check`, the touched unit suites and
   `pnpm sync:check` pass.
