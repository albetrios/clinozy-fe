import { createHttpDataProvider } from './http-data-provider/index.ts';

export type { DataProvider, ListParams, ListResult } from './dataProvider.ts';
export { createHttpDataProvider } from './http-data-provider/index.ts';

/** Singleton data provider used by the standard CRUD hooks (`useList`, `useOne`, …). */
export const dataProvider = createHttpDataProvider('/api/v1');
