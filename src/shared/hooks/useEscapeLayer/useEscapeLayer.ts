import { useEffect, useEffectEvent } from 'react';

/** What one open surface knows: the `<body>` children already there when it opened. */
interface EscapeLayer {
  under: ReadonlySet<Element>;
}

/** The surfaces outside the Radix stack that are open now, oldest first. */
const layers: EscapeLayer[] = [];

/** The `<body>` child an event's target sits in: a portal's container, or the app's root. */
function bodyChildOf(target: EventTarget | null): Element | null {
  let node = target instanceof Node ? target : null;
  while (node && node.parentNode !== document.body) node = node.parentNode;
  return node instanceof Element ? node : null;
}

/**
 * Esc for a surface outside the Radix layer stack — one that cannot be a
 * Radix layer because it renders on first paint (KICKOFF §6.0: Esc closes the
 * top-most surface first; `esc-layers.integration.test.tsx`). While `onEscape`
 * is set the surface is open, over whatever was open before it, and takes Esc
 * in the window's capture phase — so the drawer or popover under it never
 * hears the key — unless a layer opened over it since: the focus inside a
 * portal that was not on the page when the surface opened (a Select, a dialog)
 * leaves the key to that layer. Of these surfaces, the newest answers.
 */
export function useEscapeLayer(onEscape: (() => void) | undefined): void {
  const dismiss = useEffectEvent(() => onEscape?.());
  const open = onEscape !== undefined;
  useEffect(() => {
    if (!open) return undefined;
    const layer: EscapeLayer = { under: new Set(document.body.children) };
    layers.push(layer);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || layers.at(-1) !== layer) {
        return;
      }
      const container = bodyChildOf(event.target);
      if (container && !layer.under.has(container)) return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      layers.splice(layers.indexOf(layer), 1);
    };
  }, [open]);
}
