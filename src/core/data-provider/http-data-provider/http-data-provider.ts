import { apiClient } from '@/core/http/fetch-client.ts';

import type { DataProvider, ListParams } from '../dataProvider.ts';

function buildQuery(params?: ListParams): string {
  if (!params) return '';
  const search = new URLSearchParams();

  if (params.pagination) {
    search.set('_page', String(params.pagination.page));
    search.set('_perPage', String(params.pagination.perPage));
  }
  if (params.sort) {
    search.set('_sort', params.sort.field);
    search.set('_order', params.sort.order);
  }
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value === undefined || value === null || value === '') continue;
      if (typeof value === 'string') search.set(key, value);
      else if (typeof value === 'number' || typeof value === 'boolean')
        search.set(key, String(value));
      else search.set(key, JSON.stringify(value) ?? '');
    }
  }

  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/**
 * REST adapter for the {@link DataProvider} contract. Wraps `apiClient`
 * (`@/core/http/fetch-client`), which already unwraps the clinozy-be `{ data, meta }`
 * envelope — so `res.data` is the payload and list totals come from
 * `res.meta.pagination` (falling back to the page length).
 */
export function createHttpDataProvider(basePath = '/api/v1'): DataProvider {
  const path = (resource: string, id?: string) =>
    id ? `${basePath}/${resource}/${id}` : `${basePath}/${resource}`;

  return {
    getList: async <T>(resource: string, params?: ListParams) => {
      const res = await apiClient.get<T[]>(`${path(resource)}${buildQuery(params)}`);
      const items = Array.isArray(res.data) ? res.data : [];
      return {
        data: items,
        total: res.meta?.pagination?.estimated_total ?? items.length,
      };
    },
    getOne: async <T>(resource: string, id: string) => {
      const res = await apiClient.get<T>(path(resource, id));
      return res.data;
    },
    create: async <T, D = Partial<T>>(resource: string, data: D) => {
      const res = await apiClient.post<T>(path(resource), data);
      return res.data;
    },
    update: async <T, D = Partial<T>>(resource: string, id: string, data: D) => {
      const res = await apiClient.patch<T>(path(resource, id), data);
      return res.data;
    },
    delete: async (resource: string, id: string) => {
      await apiClient.delete<void>(path(resource, id));
    },
  };
}
