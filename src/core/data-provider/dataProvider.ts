/**
 * Refine-style data provider — single CRUD contract that abstracts over the
 * backend transport (REST/GraphQL/mock). All standard CRUD hooks
 * (`useList`, `useOne`, `useCreate`, `useUpdate`, `useDelete`) call through
 * this interface; resource pages don't know whether requests go to HTTP, a
 * mock, or a future GraphQL endpoint.
 */

export interface ListParams {
  filters?: Record<string, unknown>;
  sort?: { field: string; order: 'asc' | 'desc' };
  pagination?: { page: number; perPage: number };
}

export interface ListResult<T> {
  data: T[];
  total: number;
}

export interface DataProvider {
  getList<T>(resource: string, params?: ListParams): Promise<ListResult<T>>;
  getOne<T>(resource: string, id: string): Promise<T>;
  create<T, D = Partial<T>>(resource: string, data: D): Promise<T>;
  update<T, D = Partial<T>>(resource: string, id: string, data: D): Promise<T>;
  delete(resource: string, id: string): Promise<void>;
}
