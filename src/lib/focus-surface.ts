/**
 * A Radix `onOpenAutoFocus` handler that focuses the opened surface itself
 * instead of its first control: a card or menu whose design moves focus
 * nowhere (`appointments.md:161`) lights nothing up under the pointer, while
 * Tab still walks into it and Esc closes it.
 *
 * @remarks
 * The surface needs `tabIndex={-1}` to take focus; Radix popover and hover-card
 * content already carry it.
 */
export function focusSurfaceOnOpen(event: Event): void {
  event.preventDefault();
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.focus({ preventScroll: true });
  }
}
