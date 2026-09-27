# Test data factories

Builders for **unit test** fixture shapes. Never imported from `src/`.

**Add here when:** Two or more test files need the same fixture shapes. Until then, keep builders colocated with the tests that use them or under `tests/fixtures/`.

**Example:** `user.ts` exporting `buildUser(overrides?)` that returns a valid `AuthUser`-shaped object for assertions.
