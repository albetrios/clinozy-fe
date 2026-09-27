// Only the dependency-free hash grammar is re-exported here — NOT
// `parseSettingsHash` (which pulls settings-sections.ts → settings.constants.ts).
// `SettingsModalLazy` is mounted on the root route, so anything this barrel
// touches lands in the entry chunk; keeping it grammar-only keeps the settings
// section registry + i18n key table off first paint. The lazy modal imports
// `parseSettingsHash` directly from `settings-hash.ts`.
export { isSettingsHash, settingsHash } from './settings-hash-grammar.ts';
export { isSettingsPathAllowed } from './settings-route-policy.ts';
// The heavy modal is NOT re-exported here on purpose (it would land the whole
// settings tree in every importer's chunk graph). App code mounts the Lazy
// shell; tests import './SettingsModal.tsx' directly.
export { SettingsModalLazy } from './SettingsModalLazy.tsx';
