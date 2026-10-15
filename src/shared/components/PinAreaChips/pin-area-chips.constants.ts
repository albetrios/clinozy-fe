import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The PIN look-up's words — the clinic shell's namespace (`app` › `pinPlace`), shared by the setup and the branch drawer. */
export const PIN_PLACE_NS = I18N_NAMESPACES.app;

/** The PIN field's hint, the unknown-PIN line and the area chips' label. */
export const PIN_PLACE_KEYS = {
  hint: 'pinPlace.hint',
  unknown: 'pinPlace.unknown',
  areaPick: 'pinPlace.areaPick',
} as const;

/** Area chips offered at most — a PIN with more lists the first ones, the field takes any. */
export const PIN_AREA_CHIP_LIMIT = 12;
