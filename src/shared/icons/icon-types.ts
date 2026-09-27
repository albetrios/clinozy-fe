import type { ComponentType, SVGProps } from 'react';

/** Props every app icon accepts — the common SVG subset across icon libraries. */
export type IconProps = SVGProps<SVGSVGElement>;

/** A swappable icon component — Lucide / Tabler / Phosphor all satisfy this. */
export type AppIcon = ComponentType<IconProps>;
