import type { OrgListKeyParams } from '@/shared/api/organization-query-keys.ts';

/** Preset sort options shared by members, roles, and API-key lists (BE allowlist: name, created_at). */
export const ORG_LIST_SORT_PRESETS = {
  nameAsc: { sort: 'name', order: 'asc' },
  nameDesc: { sort: 'name', order: 'desc' },
  newest: { sort: 'created_at', order: 'desc' },
  oldest: { sort: 'created_at', order: 'asc' },
} as const satisfies Record<string, Pick<OrgListKeyParams, 'sort' | 'order'>>;

export type OrgListSortPreset = keyof typeof ORG_LIST_SORT_PRESETS;

export const DEFAULT_ORG_LIST_SORT: OrgListSortPreset = 'nameAsc';

/** Map a UI preset to the server-side `sort`/`order` pair. */
export function orgListSortToParams(
  preset: OrgListSortPreset,
): Pick<OrgListKeyParams, 'sort' | 'order'> {
  switch (preset) {
    case 'nameAsc':
      return ORG_LIST_SORT_PRESETS.nameAsc;
    case 'nameDesc':
      return ORG_LIST_SORT_PRESETS.nameDesc;
    case 'newest':
      return ORG_LIST_SORT_PRESETS.newest;
    case 'oldest':
      return ORG_LIST_SORT_PRESETS.oldest;
  }
}
