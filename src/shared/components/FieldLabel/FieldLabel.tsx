/**
 * The Appearance cards' compact label above a preference control (14px/500):
 * the regional format, the time zone, the date and number styles. Drawer and
 * Settings forms use `DrawerField`'s label instead.
 */
export function FieldLabel({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} className="text-sm font-medium">
      {children}
    </p>
  );
}
