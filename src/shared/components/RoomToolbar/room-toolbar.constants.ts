import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type {
  AgeBand,
  CreatedPreset,
  FollowUpPreset,
} from '@/shared/api/app/app-list-filters.ts';

/**
 * The room toolbar's copy lives in `app` (`APP_NS`): that namespace
 * loads with the organization shell, and every room renders inside it — so
 * the chrome stays off the entry bundle (English `common` ships in it).
 */
export const ROOM_TOOLBAR_NS = I18N_NAMESPACES.app;

/** Toolbar chrome (KICKOFF §3.5 List toolbar). */
export const ROOM_TOOLBAR_KEYS = {
  more: 'roomToolbar.more',
  moreSections: 'roomToolbar.moreSections',
  searchTitle: 'roomToolbar.searchTitle',
  moreCreate: 'roomToolbar.moreCreate',
} as const;

/** The Filters popover's copy (KICKOFF §3.5 Filters popover). */
export const ROOM_FILTERS_KEYS = {
  title: 'filters.title',
  appliedCount: 'filters.appliedCount',
  clearAll: 'filters.clearAll',
  clearAllFilters: 'filters.clearAllFilters',
  apply: 'filters.apply',
  saveView: 'filters.saveView',
  savedView: 'filters.savedView',
  viewSaved: 'filters.viewSaved',
  any: 'filters.any',
  from: 'filters.from',
  to: 'filters.to',
} as const;

/**
 * Each date section's label, its preset chips keyed by the URL's preset value
 * (`app-list-filters.ts`), and its "Custom range" chip.
 */
export const DATE_FILTER_KEYS = {
  created: {
    label: 'filters.created.label',
    range: 'filters.created.range',
    presets: {
      today: 'filters.created.today',
      yesterday: 'filters.created.yesterday',
      last_7: 'filters.created.lastSevenDays',
      last_30: 'filters.created.lastThirtyDays',
      this_month: 'filters.created.thisMonth',
    } satisfies Record<CreatedPreset, string>,
  },
  followUp: {
    label: 'filters.followUp.label',
    range: 'filters.followUp.range',
    presets: {
      overdue: 'filters.followUp.overdue',
      today: 'filters.followUp.today',
      tomorrow: 'filters.followUp.tomorrow',
      next_7: 'filters.followUp.nextSevenDays',
      not_set: 'filters.followUp.notSet',
    } satisfies Record<FollowUpPreset, string>,
  },
} as const;

/** The Age section (a list of people): its label, "Any", and each band's chip ("30–44"). */
export const AGE_FILTER_KEYS = {
  label: 'filters.age.label',
  any: 'filters.age.any',
  bands: {
    child: 'filters.age.child',
    young: 'filters.age.young',
    adult: 'filters.age.adult',
    middle: 'filters.age.middle',
    senior: 'filters.age.senior',
  } satisfies Record<AgeBand, string>,
} as const;

/** `data-testid`s of a room's toolbar, prefixed by its `tableId`. */
export function roomToolbarTestIds(prefix: string) {
  return {
    toolbar: `${prefix}-toolbar`,
    tabs: `${prefix}-tabs`,
    tab: (id: string) => `${prefix}-tab-${id}`,
    tabsMore: `${prefix}-tabs-more`,
    search: `${prefix}-search`,
    filters: `${prefix}-filters`,
    filtersTrigger: `${prefix}-filters-trigger`,
    filtersClear: `${prefix}-filters-clear`,
    filtersClearAll: `${prefix}-filters-clear-all`,
    filtersSave: `${prefix}-filters-save`,
    filtersApply: `${prefix}-filters-apply`,
    primary: (id: string) => `${prefix}-${id}`,
    primaryMenu: `${prefix}-new-menu`,
    fab: `${prefix}-fab`,
  } as const;
}
