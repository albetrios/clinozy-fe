import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The toolbar's copy lives in the room's namespace. */
export const OFFERINGS_TOOLBAR_NS = I18N_NAMESPACES.offerings;

/** The Offerings toolbar's copy (`offerings.md` › Copy; KICKOFF §6.11 Toolbar). */
export const OFFERINGS_TOOLBAR_KEYS = {
  /** The h1, "Offerings", on both tabs. */
  title: 'manifest.title',
  /** The tab row's accessible name. */
  tabsLabel: 'toolbar.tabsLabel',
  tabOfferings: 'toolbar.tabOfferings',
  tabOffers: 'toolbar.tabOffers',
  /** "Search name or search term" — the Offerings tab. */
  searchOfferings: 'toolbar.searchOfferings',
  /** "Search offers or codes" — the Offers tab. */
  searchOffers: 'toolbar.searchOffers',
  /** The search's accessible name on both tabs. */
  searchLabel: 'toolbar.searchLabel',
  newOffering: 'toolbar.newOffering',
  newOffer: 'toolbar.newOffer',
} as const;

/** The tabs' and the New buttons' test-id prefix, the same on both tabs. */
export const OFFERINGS_TABS_TEST_PREFIX = 'offerings';

/** The New button's action id — `offerings-new-button` / `offers-new-button`. */
export const NEW_BUTTON_ACTION_ID = 'new-button';
