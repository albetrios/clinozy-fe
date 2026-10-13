import type { ReactNode } from 'react';

/**
 * A key cap in the command menu (H:2672, H:2677): 20px, the body font at
 * 11px on the canvas tint — "esc" in the input row, ↑ ↓ ↵ in the footer.
 */
export function CommandPaletteKbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      data-slot="kbd"
      className="bg-canvas text-muted-foreground text-micro inline-flex h-5 min-w-5 flex-none items-center justify-center rounded-sm border px-1.25 font-sans leading-none"
    >
      {children}
    </kbd>
  );
}
