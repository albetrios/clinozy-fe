// The heavy component is NOT re-exported here on purpose: a static re-export
// would pull cmdk into every importer's chunk graph. Import
// './CommandPalette.tsx' directly in tests; app code uses the Lazy wrapper.
export * from './CommandPaletteLazy.tsx';
export * from './preload-command-palette.ts';
