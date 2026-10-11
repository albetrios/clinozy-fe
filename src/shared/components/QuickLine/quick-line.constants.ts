import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The quick line's own copy lives in `app` (the namespace `APP_NS`
 * names), which loads with the org shell where every drawer renders.
 */
export const QUICK_LINE_NS = I18N_NAMESPACES.app;

/** Key paths for the quick line's chrome (every value verbatim from the design, H:911–935). */
export const QUICK_LINE_KEYS = {
  /** The input's accessible name. */
  label: 'quickLine.label',
  /** The "↵ add" key cap. */
  enter: 'quickLine.enter',
  /** The matches list's name. */
  matches: 'quickLine.matches',
  /** Above the suggestions while nothing is typed. */
  suggested: 'quickLine.suggested',
  /** Under a name the list does not have: "Not in the list · add as typed". */
  typed: 'quickLine.typed',
  noMatch: 'quickLine.noMatch',
  /** The matches footer: "↑↓ choose · ↵ add · Esc clear". */
  keys: 'quickLine.keys',
  browse: 'quickLine.browse',
  /** Browse's accessible name and tooltip. */
  browseAll: 'quickLine.browseAll',
  /** The Browse groups' name. */
  groups: 'quickLine.groups',
  closeBrowse: 'quickLine.closeBrowse',
  /** "2 added" (plural). */
  added: 'quickLine.added',
  tapToAdd: 'quickLine.tapToAdd',
  /** "Showing 60 of 84 · type to narrow". */
  showing: 'quickLine.showing',
  done: 'quickLine.done',
  emptyGroup: 'quickLine.emptyGroup',
  /** A tile's "+" and "−", and the new item's add. */
  addOne: 'quickLine.addOne',
  removeOne: 'quickLine.removeOne',
  addNew: 'quickLine.addNew',
  /** The shorthand's pills (H:3863): "×20" · "+2 free" · "@ ₹180" · "10% off". */
  tags: {
    qty: 'quickLine.tags.qty',
    free: 'quickLine.tags.free',
    rate: 'quickLine.tags.rate',
    discount: 'quickLine.tags.discount',
  },
} as const;

/** How many tiles Browse shows before "Showing 60 of 84" (H:3798). */
export const QUICK_LINE_BROWSE_LIMIT = 60;

/** The `data-testid`s of a quick line's parts, derived from its root id. */
export function quickLineTestIds(root: string) {
  return {
    input: `${root}-input`,
    browse: `${root}-browse`,
    matches: `${root}-matches`,
    option: `${root}-option`,
    typed: `${root}-typed`,
    noMatch: `${root}-no-match`,
    frequent: `${root}-frequent`,
    panel: `${root}-browse-panel`,
    group: `${root}-browse-group`,
    tile: `${root}-browse-tile`,
    newItem: `${root}-browse-new`,
    done: `${root}-browse-done`,
  } as const;
}
