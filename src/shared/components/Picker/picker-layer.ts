import { createContext } from 'react';

/**
 * The layer a picker's list opens on. Pickers open at the overlays' own z-50
 * and stack by portal order, so one inside a dialog or drawer lands on top of
 * it — and the idle-timeout dialog still lands on top of an open list. A
 * surface drawn ABOVE that layer (the Appearance panel, z-80) provides
 * `raised`, and its pickers open at z-90 instead of under their own host.
 */
export type PickerLayer = 'base' | 'raised';

/** {@link PickerLayer} for the pickers inside a surface; `base` everywhere else. */
export const PickerLayerContext = createContext<PickerLayer>('base');
