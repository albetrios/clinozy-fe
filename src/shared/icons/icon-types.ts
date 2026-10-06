import type { ComponentType, SVGProps } from 'react';

/** Props every app icon accepts — the SVG element's own. */
export type IconProps = SVGProps<SVGSVGElement>;

/** An app icon component: a Lucide glyph or one of the vendored brand marks. */
export type AppIcon = ComponentType<IconProps>;
