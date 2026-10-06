/**
 * A preference control's label: the drawer field label's 12px/500 in the strong
 * muted ink (`_patterns.md:34`) — the Appearance cards and the language card.
 * Drawer and Settings forms get the same label from `DrawerField`.
 */
export function FieldLabel({ id, children }: { id?: string; children: string }) {
  return (
    <p
      id={id}
      className="text-muted-foreground-strong text-xs leading-[normal] font-medium"
    >
      {children}
    </p>
  );
}
